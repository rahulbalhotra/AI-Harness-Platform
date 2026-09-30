const EventEmitter = require('events');

class TelemetryEngine extends EventEmitter {
  constructor(db = null, broadcast = null) {
    super();
    this.db = db;
    this.broadcast = broadcast;
    this.activeTraces = new Map();
    this.activeSpans = new Map();

    // In-memory ring buffer of recent spans for sub-millisecond querying
    this.recentSpans = [];
    this.maxRecentSpans = 2000;
  }

  setBroadcast(broadcast) {
    this.broadcast = broadcast;
  }

  setDb(db) {
    this.db = db;
  }

  // --- Core Distributed Tracing ---

  startTrace({ traceId, sessionId, agentId, agentName, modelId, name, attributes = {} }) {
    const tid = traceId || `trc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const rootSpanId = `spn_root_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTime = new Date().toISOString();

    const rootSpan = {
      spanId: rootSpanId,
      traceId: tid,
      parentSpanId: null,
      name: name || `Agent Execution: ${agentName || agentId || 'Willow'}`,
      type: 'agent_turn',
      sessionId: sessionId || null,
      agentId: agentId || 'agent-willow',
      agentName: agentName || 'Willow (Master Orchestrator)',
      modelId: modelId || 'gemini-2.5-flash',
      startTime,
      endTime: null,
      durationMs: 0,
      status: 'running',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      attributes: { ...attributes }
    };

    const trace = {
      traceId: tid,
      rootSpanId,
      rootSpan,
      spans: [rootSpan],
      startTime: Date.now(),
      status: 'running'
    };

    this.activeTraces.set(tid, trace);
    this.activeSpans.set(rootSpanId, rootSpan);

    this.emitSpanEvent(rootSpan);
    return { traceId: tid, rootSpanId };
  }

  startSpan({ traceId, parentSpanId, type = 'step', name, agentId, agentName, modelId, toolId, attributes = {} }) {
    const tid = traceId || Array.from(this.activeTraces.keys())[0] || `trc_${Date.now()}`;
    const spanId = `spn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = new Date().toISOString();

    const parentId = parentSpanId || (this.activeTraces.get(tid)?.rootSpanId || null);

    const span = {
      spanId,
      traceId: tid,
      parentSpanId: parentId,
      name: name || `${type}: ${toolId || modelId || agentId || 'action'}`,
      type, // 'agent_turn' | 'model_inference' | 'tool_execution' | 'rag_retrieval' | 'hitl_approval' | 'swarm_phase'
      agentId: agentId || null,
      agentName: agentName || null,
      modelId: modelId || null,
      toolId: toolId || null,
      startTime,
      endTime: null,
      durationMs: 0,
      status: 'running',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      attributes: { ...attributes }
    };

    this.activeSpans.set(spanId, span);
    const trace = this.activeTraces.get(tid);
    if (trace) {
      trace.spans.push(span);
    }

    this.emitSpanEvent(span);
    return spanId;
  }

  async endSpan(spanId, {
    status = 'ok',
    inputTokens = 0,
    outputTokens = 0,
    totalTokens = 0,
    estimatedCostUsd = 0,
    attributes = {},
    errorMessage = null
  } = {}) {
    let span = this.activeSpans.get(spanId);
    if (!span) {
      // Check in recent spans
      span = this.recentSpans.find(s => s.spanId === spanId);
      if (!span) return null;
    }

    const endTime = new Date().toISOString();
    const durationMs = Math.max(1, new Date(endTime).getTime() - new Date(span.startTime).getTime());

    span.endTime = endTime;
    span.durationMs = durationMs;
    span.status = status;
    span.inputTokens = inputTokens || span.inputTokens || 0;
    span.outputTokens = outputTokens || span.outputTokens || 0;
    span.totalTokens = totalTokens || (span.inputTokens + span.outputTokens) || span.totalTokens || 0;
    span.estimatedCostUsd = estimatedCostUsd || span.estimatedCostUsd || 0;

    if (errorMessage) {
      span.attributes.error = errorMessage;
      span.status = 'error';
    }

    if (attributes && typeof attributes === 'object') {
      span.attributes = { ...span.attributes, ...attributes };
    }

    // Persist span to database
    if (this.db) {
      await this.db.saveTelemetrySpan(span).catch(err => {
        console.warn('[TelemetryEngine] Error saving span to DB:', err.message);
      });
    }

    // Cache in recent buffer
    this.recentSpans.unshift({ ...span });
    if (this.recentSpans.length > this.maxRecentSpans) {
      this.recentSpans.pop();
    }

    this.activeSpans.delete(spanId);
    this.emitSpanEvent(span);
    return span;
  }

  async endTrace(traceId, { status = 'completed', finalOutput = null, errorMessage = null } = {}) {
    const trace = this.activeTraces.get(traceId);
    if (!trace) return null;

    const totalDuration = Date.now() - trace.startTime;
    const totalTokens = trace.spans.reduce((sum, s) => sum + (s.totalTokens || 0), 0);
    const totalCostUsd = trace.spans.reduce((sum, s) => sum + (s.estimatedCostUsd || 0), 0);

    if (trace.rootSpanId) {
      await this.endSpan(trace.rootSpanId, {
        status: errorMessage ? 'error' : status,
        totalTokens,
        estimatedCostUsd: +totalCostUsd.toFixed(6),
        attributes: {
          finalOutputSnippet: finalOutput ? String(finalOutput).substring(0, 300) : undefined,
          errorMessage: errorMessage || undefined,
          childSpansCount: trace.spans.length
        }
      });
    }

    this.activeTraces.delete(traceId);
    return {
      traceId,
      totalDuration,
      totalTokens,
      totalCostUsd,
      status: errorMessage ? 'error' : status,
      spansCount: trace.spans.length
    };
  }

  emitSpanEvent(span) {
    this.emit('span', span);
    if (typeof this.broadcast === 'function') {
      this.broadcast('TELEMETRY_SPAN', span);
    }
  }

  // --- High-Level Helper Recorders ---

  async recordModelInference({ traceId, parentSpanId, agentId, modelId, modelName, durationMs, inputTokens, outputTokens, costUsd, status = 'ok', isRetry = false, retryAttempt = 0 }) {
    const spanId = this.startSpan({
      traceId,
      parentSpanId,
      type: 'model_inference',
      name: `LLM Inference: ${modelName || modelId}`,
      agentId,
      modelId,
      attributes: {
        provider: (modelId || '').split('-')[0] || 'google',
        isRetry,
        retryAttempt
      }
    });

    const span = await this.endSpan(spanId, {
      status,
      inputTokens,
      outputTokens,
      totalTokens: (inputTokens || 0) + (outputTokens || 0),
      estimatedCostUsd: costUsd || 0
    });

    if (durationMs) {
      span.durationMs = durationMs;
      if (this.db) this.db.saveTelemetrySpan(span).catch(() => {});
    }

    return span;
  }

  async recordToolExecution({ traceId, parentSpanId, agentId, toolId, toolName, parameters, durationMs, status = 'ok', error = null, resultSnippet = null }) {
    const spanId = this.startSpan({
      traceId,
      parentSpanId,
      type: 'tool_execution',
      name: `Tool: ${toolName || toolId}`,
      agentId,
      toolId,
      attributes: {
        parameters: parameters ? JSON.stringify(parameters).substring(0, 400) : '{}',
        resultSnippet: resultSnippet ? String(resultSnippet).substring(0, 300) : null
      }
    });

    const span = await this.endSpan(spanId, {
      status,
      errorMessage: error,
      attributes: {
        error: error ? String(error) : null
      }
    });

    if (durationMs) {
      span.durationMs = durationMs;
      if (this.db) this.db.saveTelemetrySpan(span).catch(() => {});
    }

    return span;
  }

  async recordRagRetrieval({ traceId, parentSpanId, query, chunkCount, topSimilarity, durationMs, citations = [] }) {
    const spanId = this.startSpan({
      traceId,
      parentSpanId,
      type: 'rag_retrieval',
      name: `Knowledge Hub Vector RAG (${chunkCount || 0} chunks)`,
      attributes: {
        query: query ? String(query).substring(0, 200) : '',
        chunkCount: chunkCount || 0,
        topSimilarity: topSimilarity || 0.85,
        citationsCount: citations.length,
        vectorEngine: 'pgvector'
      }
    });

    const span = await this.endSpan(spanId, {
      status: 'ok',
      attributes: {
        citations: citations.map(c => c.title || c.source)
      }
    });

    if (durationMs) {
      span.durationMs = durationMs;
      if (this.db) this.db.saveTelemetrySpan(span).catch(() => {});
    }

    return span;
  }

  async recordApprovalGate({ traceId, parentSpanId, toolId, decision, durationMs, reviewer = 'admin' }) {
    const spanId = this.startSpan({
      traceId,
      parentSpanId,
      type: 'hitl_approval',
      name: `HITL Security Gate: ${decision.toUpperCase()}`,
      toolId,
      attributes: {
        decision,
        reviewer,
        policy: 'human-in-the-loop'
      }
    });

    const span = await this.endSpan(spanId, {
      status: decision === 'approved' ? 'approved' : 'rejected'
    });

    if (durationMs) {
      span.durationMs = durationMs;
      if (this.db) this.db.saveTelemetrySpan(span).catch(() => {});
    }

    return span;
  }

  // --- Aggregate Metrics & Analytics ---

  async getOverview({ timeRange = '24h', agentId = 'all', modelId = 'all', status = 'all' } = {}) {
    let since = null;
    const now = Date.now();
    if (timeRange === '15m') since = new Date(now - 15 * 60 * 1000).toISOString();
    else if (timeRange === '1h') since = new Date(now - 60 * 60 * 1000).toISOString();
    else if (timeRange === '24h') since = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const spans = this.db ? await this.db.getTelemetrySpans({ since, agentId, modelId, status, limit: 2500 }) : this.recentSpans;

    // Separate root traces vs child spans
    const rootTraces = spans.filter(s => s.type === 'agent_turn' || !s.parentSpanId);
    const modelSpans = spans.filter(s => s.type === 'model_inference');
    const toolSpans = spans.filter(s => s.type === 'tool_execution');
    const ragSpans = spans.filter(s => s.type === 'rag_retrieval');
    const approvalSpans = spans.filter(s => s.type === 'hitl_approval');

    // Token counts & costs
    const promptTokens = spans.reduce((sum, s) => sum + (s.inputTokens || 0), 0);
    const completionTokens = spans.reduce((sum, s) => sum + (s.outputTokens || 0), 0);
    const totalTokens = promptTokens + completionTokens;
    const totalCostUsd = +spans.reduce((sum, s) => sum + (s.estimatedCostUsd || 0), 0).toFixed(5);

    // Latency Percentiles (p50, p90, p99)
    const latencies = rootTraces.map(s => s.durationMs || 0).sort((a, b) => a - b);
    const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const p90 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.9)] : 0;
    const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    // Error & Retry calculations
    const errorCount = spans.filter(s => s.status === 'error' || s.status === 'failed').length;
    const retryCount = spans.filter(s => s.status === 'retry' || s.attributes?.isRetry).length;
    const errorRatePct = spans.length > 0 ? +((errorCount / spans.length) * 100).toFixed(2) : 0;

    // Per-Agent breakdown
    const agentMap = new Map();
    for (const s of spans) {
      if (!s.agentId) continue;
      const existing = agentMap.get(s.agentId) || {
        agentId: s.agentId,
        agentName: s.agentName || s.agentId,
        invocations: 0,
        tokens: 0,
        costUsd: 0,
        durations: [],
        errors: 0
      };
      existing.invocations++;
      existing.tokens += (s.totalTokens || 0);
      existing.costUsd += (s.estimatedCostUsd || 0);
      if (s.durationMs) existing.durations.push(s.durationMs);
      if (s.status === 'error') existing.errors++;
      agentMap.set(s.agentId, existing);
    }

    const agentMetrics = Array.from(agentMap.values()).map(a => ({
      agentId: a.agentId,
      agentName: a.agentName,
      invocations: a.invocations,
      tokens: a.tokens,
      costUsd: +a.costUsd.toFixed(5),
      avgLatencyMs: a.durations.length > 0 ? Math.round(a.durations.reduce((x, y) => x + y, 0) / a.durations.length) : 0,
      successRate: a.invocations > 0 ? +(((a.invocations - a.errors) / a.invocations) * 100).toFixed(1) : 100
    })).sort((a, b) => b.invocations - a.invocations);

    // Per-Model breakdown
    const modelMap = new Map();
    for (const s of modelSpans) {
      const mid = s.modelId || 'gemini-2.5-flash';
      const existing = modelMap.get(mid) || {
        modelId: mid,
        calls: 0,
        tokens: 0,
        costUsd: 0,
        durations: [],
        errors: 0
      };
      existing.calls++;
      existing.tokens += (s.totalTokens || 0);
      existing.costUsd += (s.estimatedCostUsd || 0);
      if (s.durationMs) existing.durations.push(s.durationMs);
      if (s.status === 'error') existing.errors++;
      modelMap.set(mid, existing);
    }

    const modelMetrics = Array.from(modelMap.values()).map(m => ({
      modelId: m.modelId,
      calls: m.calls,
      tokens: m.tokens,
      costUsd: +m.costUsd.toFixed(5),
      avgLatencyMs: m.durations.length > 0 ? Math.round(m.durations.reduce((x, y) => x + y, 0) / m.durations.length) : 0,
      errors: m.errors
    })).sort((a, b) => b.calls - a.calls);

    // Per-Tool breakdown
    const toolMap = new Map();
    for (const s of toolSpans) {
      const tid = s.toolId || 'unknown_tool';
      const existing = toolMap.get(tid) || {
        toolId: tid,
        calls: 0,
        durations: [],
        errors: 0
      };
      existing.calls++;
      if (s.durationMs) existing.durations.push(s.durationMs);
      if (s.status === 'error') existing.errors++;
      toolMap.set(tid, existing);
    }

    const toolMetrics = Array.from(toolMap.values()).map(t => ({
      toolId: t.toolId,
      calls: t.calls,
      avgLatencyMs: t.durations.length > 0 ? Math.round(t.durations.reduce((x, y) => x + y, 0) / t.durations.length) : 0,
      errors: t.errors
    })).sort((a, b) => b.calls - a.calls);

    // RAG metrics
    const ragMetrics = {
      totalRetrievals: ragSpans.length,
      avgLatencyMs: ragSpans.length > 0 ? Math.round(ragSpans.reduce((a, b) => a + (b.durationMs || 0), 0) / ragSpans.length) : 0,
      avgChunksRetrieved: ragSpans.length > 0 ? +(ragSpans.reduce((a, b) => a + (b.attributes?.chunkCount || 4), 0) / ragSpans.length).toFixed(1) : 4
    };

    // System runtime telemetry
    const system = {
      rssMb: +(process.memoryUsage().rss / (1024 * 1024)).toFixed(2),
      heapUsedMb: +(process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(2),
      heapTotalMb: +(process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(2),
      uptimeSeconds: Math.floor(process.uptime()),
      activeTracesCount: this.activeTraces.size,
      activeSpansCount: this.activeSpans.size
    };

    return {
      timeRange,
      summary: {
        totalTraces: rootTraces.length,
        totalSpans: spans.length,
        totalTokens,
        promptTokens,
        completionTokens,
        totalCostUsd,
        avgLatencyMs: avgLatency,
        p50LatencyMs: p50,
        p90LatencyMs: p90,
        p99LatencyMs: p99,
        errorCount,
        retryCount,
        errorRatePct
      },
      agentMetrics,
      modelMetrics,
      toolMetrics,
      ragMetrics,
      approvalsCount: approvalSpans.length,
      system
    };
  }

  // --- Synthetic Load Generator for Live Demonstration ---

  async simulateTraffic(count = 3) {
    const agents = [
      { id: 'agent-willow', name: 'Willow (Master Orchestrator)', avatar: '🌿' },
      { id: 'agent-architect', name: 'System Architect & RFC Lead', avatar: '📐' },
      { id: 'agent-senior-engineer', name: 'Senior Full-Stack Engineer', avatar: '💻' },
      { id: 'agent-qa-synthesizer', name: 'QA & Chrome Test Synthesizer', avatar: '🧪' },
      { id: 'agent-secops-auditor', name: 'AppSec & SAST Auditor', avatar: '🛡️' }
    ];

    const models = [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', costPer1k: 0.0003 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', costPer1k: 0.003 },
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', costPer1k: 0.009 },
      { id: 'gpt-4o', name: 'OpenAI GPT-4o', costPer1k: 0.006 }
    ];

    const tools = [
      'read_file', 'write_file', 'grep_search', 'run_command', 'launch_browser_test', 'invoke_parallel_agents'
    ];

    const tasks = [
      'Analyze repository architecture and author RFC blueprint',
      'Implement Flask storefront API endpoints and shopping cart session',
      'Synthesize Pytest unit tests and execute headless Chrome DOM verification',
      'Scan dependencies for CVE vulnerabilities and secret leaks',
      'Execute database migration with pgvector indexing in PostgreSQL'
    ];

    const generated = [];

    for (let i = 0; i < count; i++) {
      const agent = agents[i % agents.length];
      const model = models[i % models.length];
      const task = tasks[i % tasks.length];
      const traceId = `trc_sim_${Date.now()}_${i}`;

      const { rootSpanId } = this.startTrace({
        traceId,
        agentId: agent.id,
        agentName: agent.name,
        modelId: model.id,
        name: `SDLC Turn: ${agent.name} (${task.substring(0, 35)}...)`,
        attributes: { simulated: true, task }
      });

      // 1. RAG retrieval span
      const ragSpanId = this.startSpan({
        traceId,
        parentSpanId: rootSpanId,
        type: 'rag_retrieval',
        name: 'Knowledge Hub Vector RAG (5 chunks retrieved)',
        attributes: { query: task, chunkCount: 5, topSimilarity: 0.88, vectorEngine: 'pgvector' }
      });
      await this.endSpan(ragSpanId, {
        status: 'ok',
        inputTokens: 350,
        outputTokens: 0,
        attributes: { durationMs: 45 + Math.floor(Math.random() * 30) }
      });

      // 2. Model inference span
      const inTokens = 600 + Math.floor(Math.random() * 800);
      const outTokens = 350 + Math.floor(Math.random() * 450);
      const cost = +((inTokens + outTokens) / 1000 * model.costPer1k).toFixed(5);
      const modelSpanId = this.startSpan({
        traceId,
        parentSpanId: rootSpanId,
        type: 'model_inference',
        name: `Inference: ${model.name}`,
        agentId: agent.id,
        modelId: model.id,
        attributes: { prompt: task.substring(0, 100) }
      });
      await this.endSpan(modelSpanId, {
        status: 'ok',
        inputTokens: inTokens,
        outputTokens: outTokens,
        totalTokens: inTokens + outTokens,
        estimatedCostUsd: cost,
        attributes: { durationMs: 250 + Math.floor(Math.random() * 500) }
      });

      // 3. Tool execution span
      const toolId = tools[i % tools.length];
      const toolSpanId = this.startSpan({
        traceId,
        parentSpanId: rootSpanId,
        type: 'tool_execution',
        name: `Tool Execution: ${toolId}`,
        agentId: agent.id,
        toolId,
        attributes: { command: toolId === 'run_command' ? 'pytest tests/ -v' : undefined }
      });
      await this.endSpan(toolSpanId, {
        status: 'ok',
        attributes: { durationMs: 80 + Math.floor(Math.random() * 150) }
      });

      // 4. End trace
      await this.endTrace(traceId, {
        status: 'completed',
        finalOutput: `Successfully completed: ${task}`
      });

      generated.push(traceId);
    }

    return {
      success: true,
      generatedTraces: generated.length,
      traceIds: generated
    };
  }

  // --- OpenTelemetry JSON Exporter ---

  async exportOpenTelemetryFormat() {
    const spans = this.db ? await this.db.getTelemetrySpans({ limit: 1000 }) : this.recentSpans;

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'enterprise-ai-harness' } },
              { key: 'service.version', value: { stringValue: '1.0.0' } },
              { key: 'telemetry.sdk.name', value: { stringValue: 'antigravity-telemetry-engine' } },
              { key: 'environment', value: { stringValue: 'enterprise-production' } }
            ]
          },
          scopeSpans: [
            {
              scope: { name: 'ai.harness.agent-orchestrator', version: '1.0.0' },
              spans: spans.map(s => ({
                traceId: s.traceId,
                spanId: s.spanId,
                parentSpanId: s.parentSpanId || undefined,
                name: s.name,
                kind: s.type === 'agent_turn' ? 'SPAN_KIND_SERVER' : 'SPAN_KIND_INTERNAL',
                startTimeUnixNano: new Date(s.startTime).getTime() * 1000000,
                endTimeUnixNano: s.endTime ? new Date(s.endTime).getTime() * 1000000 : undefined,
                attributes: [
                  { key: 'agent.id', value: { stringValue: s.agentId || 'none' } },
                  { key: 'agent.name', value: { stringValue: s.agentName || 'none' } },
                  { key: 'llm.model', value: { stringValue: s.modelId || 'none' } },
                  { key: 'llm.tokens.prompt', value: { intValue: s.inputTokens || 0 } },
                  { key: 'llm.tokens.completion', value: { intValue: s.outputTokens || 0 } },
                  { key: 'llm.tokens.total', value: { intValue: s.totalTokens || 0 } },
                  { key: 'llm.cost.usd', value: { doubleValue: s.estimatedCostUsd || 0 } },
                  { key: 'tool.id', value: { stringValue: s.toolId || 'none' } },
                  { key: 'status.code', value: { stringValue: s.status } }
                ],
                status: {
                  code: s.status === 'error' ? 'STATUS_CODE_ERROR' : 'STATUS_CODE_OK',
                  message: s.attributes?.error || undefined
                }
              }))
            }
          ]
        }
      ],
      exportedAt: new Date().toISOString()
    };
  }
}

module.exports = TelemetryEngine;
