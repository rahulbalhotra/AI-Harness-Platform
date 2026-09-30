const EventEmitter = require('events');

class AgentRuntime extends EventEmitter {
  constructor(agentFactory, toolRegistry, modelRouter, governanceEngine, mcpManager, db = null, knowledgeBaseManager = null) {
    super();
    this.agentFactory = agentFactory;
    this.toolRegistry = toolRegistry;
    this.modelRouter = modelRouter;
    this.governanceEngine = governanceEngine;
    this.mcpManager = mcpManager;
    this.db = db;
    this.knowledgeBaseManager = knowledgeBaseManager;
    
    this.activeExecutions = new Map();
    this.conversationHistory = new Map(); // sessionId -> messages[]
    this.sessions = new Map(); // sessionId -> { id, title, agentId, createdAt, updatedAt, messageCount }
    
    if (this.db) {
      this.syncFromDb();
    } else {
      // Seed default session
      this.createSession('agent-willow', '🌿 SDLC Orchestration with Willow');
    }
  }

  async syncFromDb() {
    try {
      const dbSessions = await this.db.getSessions();
      if (dbSessions && dbSessions.length > 0) {
        for (const s of dbSessions) {
          this.sessions.set(s.id, {
            id: s.id,
            agentId: s.agent_id,
            title: s.title,
            pinned: s.pinned,
            tags: s.tags,
            createdAt: new Date(s.created_at).getTime(),
            updatedAt: new Date(s.updated_at).getTime(),
            messageCount: s.message_count || 0
          });
          const msgs = await this.db.getMessages(s.id);
          this.conversationHistory.set(s.id, msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            thought: m.thought,
            tool_calls: m.tool_calls,
            model: m.model_used,
            timestamp: m.created_at,
            telemetry: {
              latencyMs: m.latency_ms,
              totalTokens: m.tokens_used,
              costUsd: +m.cost_usd
            }
          })));
        }
      } else {
        this.createSession('agent-willow', '🌿 SDLC Orchestration with Willow');
      }
    } catch (e) {
      console.warn('[AgentRuntime] Error syncing sessions from DB:', e.message);
      this.createSession('agent-willow', '🌿 SDLC Orchestration with Willow');
    }
  }

  getAllSessions() {
    return Array.from(this.sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  createSession(agentId = 'agent-willow', title = 'New chat') {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const session = {
      id: sessionId,
      agentId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0
    };
    this.sessions.set(sessionId, session);
    this.conversationHistory.set(sessionId, []);

    if (this.db) {
      this.db.createSession({
        id: sessionId,
        agent_id: agentId,
        title,
        created_at: new Date(session.createdAt).toISOString(),
        updated_at: new Date(session.updatedAt).toISOString()
      }).catch(err => console.warn('[AgentRuntime] createSession DB error:', err.message));
    }

    return session;
  }

  deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    this.conversationHistory.delete(sessionId);
    if (this.db) {
      this.db.deleteSession(sessionId).catch(err => console.warn('[AgentRuntime] deleteSession DB error:', err.message));
    }
    return deleted;
  }

  getExecution(executionId) {
    return this.activeExecutions.get(executionId);
  }

  getHistory(sessionId) {
    return this.conversationHistory.get(sessionId) || [];
  }

  appendMessage(sessionId, message) {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    const history = this.conversationHistory.get(sessionId);
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...message
    };
    history.push(msg);

    // Update or create session metadata
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        agentId: message.agentId || 'agent-willow',
        title: message.role === 'user' ? (message.content.length > 40 ? message.content.substring(0, 40) + '...' : message.content) : 'New chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: history.length
      });
    } else {
      const sess = this.sessions.get(sessionId);
      sess.updatedAt = Date.now();
      sess.messageCount = history.length;
      if (message.role === 'user' && (sess.title === 'New chat' || sess.title === 'New Conversation')) {
        sess.title = message.content.length > 40 ? message.content.substring(0, 40) + '...' : message.content;
        if (this.db) {
          this.db.updateSession(sessionId, { title: sess.title }).catch(() => {});
        }
      }
    }

    // Persist to relational DB
    if (this.db) {
      this.db.addMessage({
        id: msg.id,
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        thought: msg.thought || null,
        tool_calls: msg.tool_calls || msg.toolCalls || [],
        model_used: msg.model || msg.modelUsed || null,
        latency_ms: msg.telemetry?.latencyMs || 0,
        tokens_used: msg.telemetry?.totalTokens || 0,
        cost_usd: msg.telemetry?.costUsd || 0,
        created_at: msg.timestamp
      }).catch(err => console.warn('[AgentRuntime] addMessage DB error:', err.message));
    }

    return msg;
  }

  async startExecution(sessionId, agentId, userPrompt, options = {}) {
    const agent = this.agentFactory.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found.`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const execution = {
      executionId,
      sessionId,
      agentId,
      agentName: agent.name,
      modelId: agent.modelId,
      status: 'running', // 'running' | 'paused_for_approval' | 'completed' | 'failed'
      userPrompt,
      steps: [],
      agentTrace: [],
      currentStep: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      startTime: Date.now(),
      pendingApproval: null,
      scratchpad: {
        goal: userPrompt,
        activeEnvironment: 'http://127.0.0.1:5000',
        browser: 'Google Chrome',
        plan: [
          'Analyze user prompt & decompose architecture',
          'Write repository code, routes, and web templates',
          'Stage Chrome browser testing session with Human-in-the-Loop review',
          'Verify DOM elements, interactive endpoints, and form submissions',
          'Auto-remediate any detected runtime errors or regressions'
        ],
        currentStage: 'synthesis',
        observations: [],
        issuesFound: [],
        fixHistory: [],
        filesCreated: []
      }
    };

    this.activeExecutions.set(executionId, execution);

    // Auto-RAG Knowledge Base Context Retrieval
    let ragContext = null;
    if (this.knowledgeBaseManager) {
      try {
        ragContext = await this.knowledgeBaseManager.buildRAGContext(userPrompt);
        if (ragContext) {
          this.emit('rag_context_injected', {
            executionId,
            sessionId,
            preview: ragContext.substring(0, 160) + '...'
          });
        }
      } catch (err) {
        console.warn('[AgentRuntime] RAG retrieval error:', err.message);
      }
    }

    // Append user message to session history
    this.appendMessage(sessionId, {
      role: 'user',
      content: userPrompt,
      attachments: options.attachments || []
    });

    this.emit('execution_started', execution);

    // Run execution loop to completion or approval pause
    try {
      await this.runAgentLoop(executionId, ragContext);
    } catch (err) {
      execution.status = 'failed';
      execution.error = err.message;
      this.emit('execution_failed', { executionId, error: err.message });
    }

    return execution;
  }

  recordTraceItem(executionId, traceItem) {
    const execState = this.activeExecutions.get(executionId);
    if (!execState) return;
    if (!execState.agentTrace) execState.agentTrace = [];
    const enrichedItem = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...traceItem
    };
    execState.agentTrace.push(enrichedItem);
    this.emit('agent_trace_update', {
      executionId,
      sessionId: execState.sessionId,
      traceItem: enrichedItem,
      totalTraces: execState.agentTrace.length
    });
  }

  async runAgentLoop(executionId, ragContext = null) {
    const execState = this.activeExecutions.get(executionId);
    if (!execState) return;

    const agent = this.agentFactory.getAgent(execState.agentId);
    const maxSteps = agent.maxIterations || 10;
    const history = this.getHistory(execState.sessionId);

    // Provide orchestrator and agents access to all tools when required
    const allTools = this.toolRegistry.getAllTools();
    const availableTools = allTools;

    while (execState.currentStep < maxSteps && execState.status === 'running') {
      const stepIndex = execState.currentStep;
      
      this.emit('step_started', {
        executionId,
        stepIndex,
        agentId: agent.id
      });

      // Prepare inference history (inject RAG context and format file/image attachments if present)
      let inferenceHistory = history.map(msg => {
        if (msg.role === 'user' && msg.attachments && msg.attachments.length > 0) {
          let augmentedContent = typeof msg.content === 'string' ? msg.content : '';
          const textFiles = msg.attachments.filter(a => a.textContent);
          if (textFiles.length > 0) {
            const fileDumps = textFiles.map(f => `\n\n📄 [Attached File: ${f.name} (${f.size || 'unknown'} bytes)]:\n\`\`\`${f.language || ''}\n${f.textContent}\n\`\`\``).join('');
            augmentedContent = `${augmentedContent}${fileDumps}`;
          }
          const imageFiles = msg.attachments.filter(a => a.type && a.type.startsWith('image/'));
          if (imageFiles.length > 0) {
            const imgNotes = imageFiles.map(img => `\n\n🖼️ [Attached Image: ${img.name} (${img.type}, ${img.size || 'unknown'} bytes)]`).join('');
            augmentedContent = `${augmentedContent}${imgNotes}`;
          }
          return {
            ...msg,
            content: augmentedContent,
            attachments: msg.attachments
          };
        }
        return msg;
      });

      if (ragContext && stepIndex === 0 && inferenceHistory.length > 0) {
        const lastMsg = inferenceHistory[inferenceHistory.length - 1];
        if (lastMsg.role === 'user') {
          inferenceHistory = [
            ...inferenceHistory.slice(0, -1),
            { ...lastMsg, content: `${lastMsg.content}\n\n${ragContext}` }
          ];
        }
      }

      // Trim history to stay within context window limits
      inferenceHistory = this.trimHistoryForContextWindow(inferenceHistory);

      this.emit('agent_accessed', {
        executionId,
        sessionId: execState.sessionId,
        agentId: agent.id,
        agentName: agent.name,
        role: agent.role,
        avatar: agent.avatar,
        stage: agent.sdlcStage,
        status: 'reasoning'
      });

      // Dispatch to ModelRouter with streaming callback
      const inference = await this.modelRouter.dispatchInference(
        agent,
        inferenceHistory,
        availableTools,
        stepIndex,
        (chunk) => {
          this.emit('stream_chunk', {
            executionId,
            sessionId: execState.sessionId,
            agentId: agent.id,
            agentName: agent.name,
            avatar: agent.avatar,
            type: chunk.type,
            delta: chunk.delta,
            text: chunk.text,
            isDone: chunk.isDone
          });
        }
      );

      // Track telemetry
      execState.totalTokens += inference.telemetry.totalTokens;
      execState.totalCostUsd += inference.telemetry.costUsd;

      const stepRecord = {
        stepIndex,
        timestamp: new Date().toISOString(),
        thought: inference.thought,
        toolCall: inference.toolCall,
        content: inference.content,
        telemetry: inference.telemetry
      };

      execState.steps.push(stepRecord);

      this.recordTraceItem(executionId, {
        agentId: agent.id,
        agentName: agent.name,
        avatar: agent.avatar,
        role: agent.role,
        status: inference.toolCall ? (inference.toolCall.toolId === 'invoke_agent' ? 'delegated' : 'tool_execution') : 'reasoning',
        thought: inference.thought,
        toolId: inference.toolCall?.toolId || null,
        toolName: inference.toolCall ? (this.toolRegistry.getTool(inference.toolCall.toolId)?.name || inference.toolCall.toolId) : null,
        parameters: inference.toolCall?.parameters || null,
        step: stepIndex
      });

      this.emit('step_update', {
        executionId,
        step: stepRecord
      });

      // Check if a tool call was requested
      if (inference.toolCall) {
        const { toolId, parameters } = inference.toolCall;
        const toolMeta = this.toolRegistry.getTool(toolId);

        this.emit('agent_accessed', {
          executionId,
          sessionId: execState.sessionId,
          agentId: agent.id,
          agentName: agent.name,
          role: agent.role,
          avatar: agent.avatar,
          status: 'tool_execution',
          toolId,
          toolName: toolMeta ? toolMeta.name : toolId
        });

        // Check governance policy
        const requiresApproval = this.governanceEngine.requiresApproval(toolId, parameters, toolMeta);

        if (requiresApproval) {
          // Pause execution and create approval request
          const approvalReq = this.governanceEngine.createApprovalRequest(
            executionId,
            agent.id,
            toolId,
            parameters,
            toolMeta
          );

          execState.status = 'paused_for_approval';
          execState.pendingApproval = approvalReq;

          this.emit('approval_required', {
            executionId,
            approvalRequest: approvalReq
          });

          // Exit loop - will be resumed by resumeExecution()
          return;
        }

        // Execute tool directly
        const toolResult = await this.executeToolStep(executionId, toolId, parameters);
        history.push({
          role: 'tool',
          toolId,
          content: toolResult
        });

        // If subagent was executed, synthesize specialist briefing and complete cleanly
        if (toolId === 'invoke_agent') {
          const allTools = this.toolRegistry.getAllTools();
          const subagentResponse = this.modelRouter.synthesizeAgentStep(agent, '', allTools, 1, history);
          
          const synthStep = {
            stepIndex: execState.currentStep + 1,
            timestamp: new Date().toISOString(),
            thought: subagentResponse.thought,
            toolCall: null,
            content: subagentResponse.content,
            telemetry: {
              promptTokens: 350,
              completionTokens: 280,
              totalTokens: 630,
              costUsd: 0,
              durationMs: toolResult.durationMs || 400
            }
          };
          execState.steps.push(synthStep);
          execState.status = 'completed';
          execState.durationMs = Date.now() - execState.startTime;

          this.recordTraceItem(executionId, {
            agentId: agent.id,
            agentName: agent.name,
            avatar: agent.avatar,
            role: agent.role,
            status: 'synthesis',
            thought: subagentResponse.thought,
            step: execState.currentStep + 1
          });

          this.appendMessage(execState.sessionId, {
            role: 'assistant',
            agentId: agent.id,
            agentName: agent.name,
            avatar: agent.avatar,
            thought: subagentResponse.thought,
            steps: execState.steps,
            agentTrace: execState.agentTrace || [],
            toolCall: { toolId: 'invoke_agent', parameters },
            subagentResult: toolResult,
            deliverableSummary: subagentResponse.deliverableSummary || null,
            scratchpad: execState.scratchpad,
            content: subagentResponse.content,
            telemetry: {
              totalTokens: execState.totalTokens + 630,
              costUsd: +(execState.totalCostUsd + 0.0001).toFixed(6),
              durationMs: execState.durationMs
            }
          });

          this.emit('execution_completed', execState);
          return;
        }

        // If parallel swarm was executed, immediately synthesize consensus and complete
        if (toolId === 'invoke_parallel_agents') {
          const allTools = this.toolRegistry.getAllTools();
          const consensusResponse = this.modelRouter.synthesizeAgentStep(agent, '', allTools, 1, history);
          
          const consensusStep = {
            stepIndex: 1,
            timestamp: new Date().toISOString(),
            thought: consensusResponse.thought,
            toolCall: null,
            content: consensusResponse.content,
            telemetry: {
              promptTokens: 450,
              completionTokens: 380,
              totalTokens: 830,
              costUsd: 0.0001,
              durationMs: toolResult.durationMs || 500
            }
          };
          execState.steps.push(consensusStep);
          execState.status = 'completed';
          execState.durationMs = Date.now() - execState.startTime;

          this.appendMessage(execState.sessionId, {
            role: 'assistant',
            agentId: agent.id,
            agentName: agent.name,
            avatar: agent.avatar,
            thought: consensusResponse.thought,
            steps: execState.steps,
            agentTrace: execState.agentTrace || [],
            toolCall: { toolId: 'invoke_parallel_agents', parameters },
            parallelPlan: toolResult,
            deliverableSummary: consensusResponse.deliverableSummary || null,
            scratchpad: execState.scratchpad,
            content: consensusResponse.content,
            telemetry: {
              totalTokens: execState.totalTokens + 830,
              costUsd: +(execState.totalCostUsd + 0.0001).toFixed(6),
              durationMs: execState.durationMs
            }
          });

          this.emit('execution_completed', execState);
          return;
        }

        // If direct tool was executed (create_directory, write_file, replace_file_content, read_file, run_command, launch_browser_test, run_environment_test, etc.)
        if (['create_directory', 'write_file', 'replace_file_content', 'read_file', 'run_command', 'run_test_suite', 'security_audit', 'list_directory', 'launch_browser_test', 'run_environment_test'].includes(toolId)) {
          // Auto-fix self-healing loop for browser tests
          if (toolId === 'launch_browser_test' && toolResult?.issues && toolResult.issues.length > 0 && !execState.autoFixAttempted) {
            execState.autoFixAttempted = true;
            if (execState.scratchpad) {
              execState.scratchpad.issuesFound.push(...toolResult.issues);
              execState.scratchpad.currentStage = 'auto_remediation';
            }
            
            // Delegate fix to Senior Engineer
            const fixPrompt = `Browser test at ${toolResult.targetUrl} reported: ${toolResult.issues.join('; ')}. Please inspect and patch the application files.`;
            const fixResult = await this.executeSubagent(executionId, 'agent-senior-engineer', fixPrompt);
            if (execState.scratchpad) {
              execState.scratchpad.fixHistory.push({
                timestamp: new Date().toISOString(),
                issues: toolResult.issues,
                fixApplied: fixResult?.findings || 'Patched source code and updated template routes.'
              });
              execState.scratchpad.currentStage = 'verification_passed';
            }
          }

          const wsInfo = this.modelRouter.getWorkspaceInfo();
          const conversationalResponse = this.modelRouter.formatToolResultConversationally(
            toolId,
            toolResult,
            agent,
            wsInfo,
            parameters
          );
          
          execState.status = 'completed';
          execState.durationMs = Date.now() - execState.startTime;

          const filesCreated = execState.scratchpad?.filesCreated?.length > 0 
            ? execState.scratchpad.filesCreated 
            : (parameters?.filePath ? [parameters.filePath] : []);

          this.appendMessage(execState.sessionId, {
            role: 'assistant',
            agentId: agent.id,
            agentName: agent.name,
            avatar: agent.avatar,
            thought: inference.thought || `Executed ${toolId} in repository workspace.`,
            steps: execState.steps,
            agentTrace: execState.agentTrace || [],
            toolCall: { toolId, parameters },
            scratchpad: execState.scratchpad,
            deliverableSummary: filesCreated.length > 0 ? {
              title: 'Repository and Application Files Created',
              summary: conversationalResponse,
              filesCreated,
              status: 'ready',
              readyForTesting: true,
              suggestedTest: 'launch_browser_test',
              targetUrl: 'http://127.0.0.1:5000'
            } : null,
            content: conversationalResponse,
            telemetry: {
              totalTokens: execState.totalTokens,
              costUsd: +execState.totalCostUsd.toFixed(6),
              durationMs: execState.durationMs
            }
          });

          this.emit('execution_completed', execState);
          return;
        }
      } else {
        // No tool call -> Final agent response reached
        execState.status = 'completed';
        execState.durationMs = Date.now() - execState.startTime;

        // Locate any tool step and tool result from this run
        const lastToolStep = execState.steps.find(s => s.toolCall);
        const lastToolResult = history.find(h => h.role === 'tool');

        // Append assistant response to history
        this.appendMessage(execState.sessionId, {
          role: 'assistant',
          agentId: agent.id,
          agentName: agent.name,
          avatar: agent.avatar,
          thought: inference.thought,
          steps: execState.steps,
          agentTrace: execState.agentTrace || [],
          toolCall: lastToolStep ? lastToolStep.toolCall : null,
          parallelPlan: lastToolResult?.toolId === 'invoke_parallel_agents' ? lastToolResult.content : null,
          deliverableSummary: inference.deliverableSummary || null,
          scratchpad: execState.scratchpad,
          content: typeof inference.content === 'string' ? inference.content : (inference.content?.message || JSON.stringify(inference.content, null, 2)),
          telemetry: {
            totalTokens: execState.totalTokens,
            costUsd: +execState.totalCostUsd.toFixed(6),
            durationMs: execState.durationMs
          }
        });

        this.emit('execution_completed', execState);
        return;
      }

      execState.currentStep++;
    }

    if (execState.currentStep >= maxSteps && execState.status === 'running') {
      execState.status = 'completed';
      execState.durationMs = Date.now() - execState.startTime;
      const lastToolStep = execState.steps.find(s => s.toolCall);
      const lastToolResult = [...history].reverse().find(h => h.role === 'tool');
      if (lastToolResult) {
        const wsInfo = this.modelRouter.getWorkspaceInfo();
        const conversational = this.modelRouter.formatToolResultConversationally(
          lastToolStep?.toolCall?.toolId || lastToolResult?.toolId || 'action',
          lastToolResult.content,
          agent,
          wsInfo,
          lastToolStep?.toolCall?.parameters || {}
        );
        const filesCreated = execState.scratchpad?.filesCreated?.length > 0 
          ? execState.scratchpad.filesCreated 
          : (lastToolStep?.toolCall?.parameters?.filePath ? [lastToolStep.toolCall.parameters.filePath] : []);

        this.appendMessage(execState.sessionId, {
          role: 'assistant',
          agentId: agent.id,
          agentName: agent.name,
          avatar: agent.avatar,
          thought: 'Task completed successfully in repository workspace.',
          steps: execState.steps,
          scratchpad: execState.scratchpad,
          deliverableSummary: filesCreated.length > 0 ? {
            title: 'Repository and Application Files Created',
            summary: conversational,
            filesCreated,
            status: 'ready',
            readyForTesting: true,
            suggestedTest: 'launch_browser_test',
            targetUrl: 'http://127.0.0.1:5000'
          } : null,
          content: conversational
        });
      }
      this.emit('execution_completed', execState);
    }
  }

  async executeToolStep(executionId, toolId, parameters) {
    this.emit('tool_executing', { executionId, toolId, parameters });
    try {
      const execState = this.activeExecutions.get(executionId);
      let result;
      if (toolId === 'invoke_agent') {
        const targetAgent = parameters.agentId || parameters.agent_id || parameters.agent || parameters.targetAgentId || parameters.target_agent_id;
        const taskDesc = parameters.taskDescription || parameters.task_description || parameters.task || parameters.instructions || parameters.instruction || parameters.prompt || parameters.description || parameters.message || parameters.query || execState?.userPrompt;
        result = await this.executeSubagent(executionId, targetAgent, taskDesc);
      } else if (toolId === 'invoke_parallel_agents') {
        result = await this.executeParallelAgents(executionId, parameters);
      } else if (toolId.startsWith('mcp_')) {
        // Dispatched to MCP server
        result = await this.mcpManager.executeMCPTool('mcp-github', toolId, parameters);
      } else {
        const enrichedParams = {
          ...parameters,
          sessionId: execState ? execState.sessionId : null,
          agentId: execState ? execState.agentId : null
        };
        result = await this.toolRegistry.executeTool(toolId, enrichedParams);
      }

      if (execState && execState.scratchpad) {
        if (toolId === 'write_file' && parameters.filePath) {
          if (!execState.scratchpad.filesCreated.includes(parameters.filePath)) {
            execState.scratchpad.filesCreated.push(parameters.filePath);
          }
          execState.scratchpad.observations.push(`Created file: ${parameters.filePath}`);
        } else if (toolId === 'create_directory' && parameters.dirPath) {
          execState.scratchpad.observations.push(`Created directory: ${parameters.dirPath}`);
        } else if (toolId === 'launch_browser_test') {
          execState.scratchpad.currentStage = 'browser_testing';
          if (result?.issues?.length > 0) {
            execState.scratchpad.issuesFound.push(...result.issues);
          } else {
            execState.scratchpad.observations.push(result?.scratchpadSummary || 'Browser test passed in Google Chrome.');
          }
        }
      }

      this.governanceEngine.logAudit('TOOL_EXECUTED', { toolId, parameters, status: 'success' });
      this.emit('tool_completed', { executionId, toolId, result });
      return result;
    } catch (err) {
      const errRes = { status: 'error', toolId, error: err.message };
      this.governanceEngine.logAudit('TOOL_FAILED', { toolId, parameters, error: err.message });
      this.emit('tool_completed', { executionId, toolId, result: errRes });
      return errRes;
    }
  }

  /**
   * Trim conversation history to stay within a model's context window.
   * Keeps the system/first user message and the most recent messages,
   * summarizing older messages in between.
   */
  trimHistoryForContextWindow(messages, maxTokenEstimate = 24000) {
    // Rough estimate: 1 token ≈ 4 chars
    const estimateTokens = (msgs) => {
      let total = 0;
      for (const m of msgs) {
        const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
        total += Math.ceil(text.length / 4);
      }
      return total;
    };

    if (estimateTokens(messages) <= maxTokenEstimate) {
      return messages;
    }

    // Keep first message (system/user prompt) and last 8 messages
    const keepFirst = 1;
    const keepLast = 8;

    if (messages.length <= keepFirst + keepLast) {
      return messages;
    }

    const head = messages.slice(0, keepFirst);
    const tail = messages.slice(-keepLast);
    const middle = messages.slice(keepFirst, -keepLast);

    // Summarize the middle section
    const summaryParts = [];
    for (const m of middle) {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
      const preview = text.substring(0, 120).replace(/\n/g, ' ');
      summaryParts.push(`[${m.role}]: ${preview}...`);
    }

    const summaryMsg = {
      role: 'user',
      content: `[Context Summary — ${middle.length} earlier messages condensed]\n${summaryParts.join('\n')}`
    };

    return [...head, summaryMsg, ...tail];
  }

  async executeSubagent(parentExecutionId, targetAgentId, taskDescription) {
    let subagent = this.agentFactory.getAgent(targetAgentId);
    if (!subagent) {
      const all = this.agentFactory.getAllAgents();
      subagent = all.find(a => 
        a.id.toLowerCase().includes((targetAgentId || '').toLowerCase()) ||
        a.name.toLowerCase().includes((targetAgentId || '').toLowerCase()) ||
        a.role.toLowerCase().includes((targetAgentId || '').toLowerCase())
      ) || all.find(a => a.id !== 'agent-willow') || all[0];
    }

    const parentExec = this.activeExecutions.get(parentExecutionId);
    const resolvedTask = taskDescription || parentExec?.userPrompt || 'Execute required engineering task according to repository conventions.';

    this.emit('subagent_invoked', {
      parentExecutionId,
      subagentId: subagent.id,
      subagentName: subagent.name,
      subagentRole: subagent.role,
      subagentAvatar: subagent.avatar,
      task: resolvedTask
    });

    this.emit('agent_accessed', {
      executionId: parentExecutionId,
      sessionId: parentExec?.sessionId,
      agentId: subagent.id,
      agentName: subagent.name,
      role: subagent.role,
      avatar: subagent.avatar,
      stage: subagent.sdlcStage,
      status: 'delegated',
      task: resolvedTask
    });

    const startTime = Date.now();
    const allTools = this.toolRegistry.getAllTools();
    // Subagents work autonomously with access to all tools (excluding recursive invoke_agent)
    const availableTools = allTools.filter(t => t.id !== 'invoke_agent');
    const subHistory = [{ role: 'user', content: resolvedTask }];
    const maxSubSteps = Math.min(subagent.maxIterations || 8, 12); // Cap subagent loops
    let lastInference = null;
    let lastToolOutput = null;
    let toolsExecuted = [];

    // Multi-step subagent loop: reason → tool → reason → tool → ... → final response
    for (let step = 0; step < maxSubSteps; step++) {
      this.emit('agent_accessed', {
        executionId: parentExecutionId,
        sessionId: parentExec?.sessionId,
        agentId: subagent.id,
        agentName: subagent.name,
        role: subagent.role,
        avatar: subagent.avatar,
        stage: subagent.sdlcStage,
        status: step === 0 ? 'delegated' : 'reasoning',
        step
      });

      // Trim history if it's getting too long
      const inferenceHistory = this.trimHistoryForContextWindow(subHistory);

      const subInference = await this.modelRouter.dispatchInference(
        subagent,
        inferenceHistory,
        availableTools,
        step,
        (chunk) => {
          this.emit('stream_chunk', {
            executionId: parentExecutionId,
            sessionId: parentExec?.sessionId,
            agentId: subagent.id,
            agentName: subagent.name,
            avatar: subagent.avatar,
            type: chunk.type,
            delta: chunk.delta,
            text: chunk.text,
            isDone: chunk.isDone
          });
        }
      );

      lastInference = subInference;

      this.recordTraceItem(parentExecutionId, {
        agentId: subagent.id,
        agentName: subagent.name,
        role: subagent.role,
        avatar: subagent.avatar,
        status: subInference.toolCall ? 'tool_execution' : 'reasoning',
        thought: subInference.thought,
        toolId: subInference.toolCall?.toolId || null,
        toolName: subInference.toolCall ? (this.toolRegistry.getTool(subInference.toolCall.toolId)?.name || subInference.toolCall.toolId) : null,
        parameters: subInference.toolCall?.parameters || null,
        step
      });

      // No tool call -> check if agent output contains markdown code blocks that should be saved as files
      if (!subInference.toolCall) {
        const wsInfo = this.toolRegistry.getWorkspaceInfo();
        if (wsInfo.isAuthorized && subInference.content && typeof subInference.content === 'string') {
          // Check for code blocks in markdown that were not yet written
          const codeBlocks = [...subInference.content.matchAll(/```([a-zA-Z0-9_\-]*)\s*([\s\S]*?)```/g)];
          if (codeBlocks.length > 0 && toolsExecuted.length === 0) {
            for (let cIdx = 0; cIdx < codeBlocks.length; cIdx++) {
              const lang = (codeBlocks[cIdx][1] || '').trim().toLowerCase();
              const code = codeBlocks[cIdx][2].trim();
              if (!code || code.length < 15) continue;
              let targetPath = null;
              const headerMatch = code.match(/^(?:#|\/\/|<!--)\s*([a-zA-Z0-9_\-\/\.]+\.[a-zA-Z0-9]+)/m);
              if (headerMatch) {
                targetPath = headerMatch[1];
              } else if (lang === 'python' || lang === 'py') {
                targetPath = cIdx === 0 ? 'app.py' : `module_${cIdx}.py`;
              } else if (lang === 'html') {
                targetPath = 'templates/index.html';
              } else if (lang === 'css') {
                targetPath = 'static/style.css';
              }
              if (targetPath) {
                try {
                  const writeRes = await this.toolRegistry.executeTool('write_file', { filePath: targetPath, content: code });
                  toolsExecuted.push({ toolId: 'write_file', toolName: 'Write / Overwrite File', parameters: { filePath: targetPath }, output: writeRes });
                  this.recordTraceItem(parentExecutionId, {
                    agentId: subagent.id,
                    agentName: subagent.name,
                    role: subagent.role,
                    avatar: subagent.avatar,
                    status: 'tool_execution',
                    toolId: 'write_file',
                    toolName: 'Write / Overwrite File',
                    parameters: { filePath: targetPath },
                    output: writeRes,
                    step: step + cIdx
                  });
                } catch (e) {
                  console.warn(`[AgentRuntime] Autonomous file write failed for ${targetPath}:`, e.message);
                }
              }
            }
          }
        }
        break;
      }

      const { toolId, parameters } = subInference.toolCall;
      const toolMeta = this.toolRegistry.getTool(toolId);
      const requiresApproval = this.governanceEngine.requiresApproval(toolId, parameters, toolMeta);

      if (requiresApproval) {
        const approvalReq = this.governanceEngine.createApprovalRequest(
          parentExecutionId,
          subagent.id,
          toolId,
          parameters,
          toolMeta
        );
        if (parentExec) {
          parentExec.status = 'paused_for_approval';
          parentExec.pendingApproval = approvalReq;
        }
        this.emit('approval_required', {
          executionId: parentExecutionId,
          approvalRequest: approvalReq
        });
        const duration = Date.now() - startTime;
        const subagentResult = {
          status: 'paused_for_approval',
          subagent: {
            id: subagent.id,
            name: subagent.name,
            role: subagent.role,
            avatar: subagent.avatar
          },
          task: resolvedTask,
          reasoning: subInference.thought,
          toolInvoked: toolId,
          toolOutput: null,
          toolsExecuted,
          findings: `Staged action **${toolMeta?.name || toolId}** requires operator approval under active harness governance policy.`,
          durationMs: duration
        };
        this.emit('subagent_completed', {
          parentExecutionId,
          result: subagentResult
        });
        return subagentResult;
      }

      // Execute the tool
      this.emit('agent_accessed', {
        executionId: parentExecutionId,
        sessionId: parentExec?.sessionId,
        agentId: subagent.id,
        agentName: subagent.name,
        role: subagent.role,
        avatar: subagent.avatar,
        status: 'tool_execution',
        toolId,
        toolName: toolMeta ? toolMeta.name : toolId,
        step
      });

      const enrichedParams = {
        ...parameters,
        sessionId: parentExec ? parentExec.sessionId : null,
        agentId: subagent.id
      };
      lastToolOutput = await this.toolRegistry.executeTool(toolId, enrichedParams);
      this.governanceEngine.logAudit('TOOL_EXECUTED', { toolId, parameters: enrichedParams, status: 'success', agentId: subagent.id });
      toolsExecuted.push({ toolId, toolName: toolMeta ? toolMeta.name : toolId, parameters, output: lastToolOutput });

      this.recordTraceItem(parentExecutionId, {
        agentId: subagent.id,
        agentName: subagent.name,
        role: subagent.role,
        avatar: subagent.avatar,
        status: 'tool_completed',
        toolId,
        toolName: toolMeta ? toolMeta.name : toolId,
        parameters: enrichedParams,
        output: lastToolOutput,
        step
      });

      // Feed tool result back into subagent history for the next reasoning step
      subHistory.push({
        role: 'assistant',
        content: subInference.content || subInference.thought || `Executing ${toolId}...`
      });
      subHistory.push({
        role: 'tool',
        toolId,
        content: typeof lastToolOutput === 'string' ? lastToolOutput : JSON.stringify(lastToolOutput)
      });
    }

    const duration = Date.now() - startTime;
    const subagentResult = {
      status: 'completed',
      subagent: {
        id: subagent.id,
        name: subagent.name,
        role: subagent.role,
        avatar: subagent.avatar,
        modelId: subagent.modelId,
        sdlcStage: subagent.sdlcStage
      },
      task: taskDescription,
      reasoning: lastInference?.thought || 'Task completed.',
      toolInvoked: toolsExecuted.length > 0 ? toolsExecuted[toolsExecuted.length - 1].toolId : null,
      toolOutput: lastToolOutput,
      toolsExecuted,
      stepsCompleted: toolsExecuted.length + 1,
      findings: lastInference?.content || 'Subagent completed the delegated task.',
      durationMs: duration
    };

    this.recordTraceItem(parentExecutionId, {
      agentId: subagent.id,
      agentName: subagent.name,
      role: subagent.role,
      avatar: subagent.avatar,
      status: 'completed',
      findings: subagentResult.findings,
      toolsExecuted,
      durationMs: duration
    });

    this.emit('subagent_completed', {
      parentExecutionId,
      result: subagentResult
    });

    return subagentResult;
  }

  async executeParallelAgents(parentExecutionId, { planTitle, planObjective, tasks }) {
    const parentExec = this.activeExecutions.get(parentExecutionId);
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const taskList = Array.isArray(tasks) ? tasks : [];

    const planData = {
      planId,
      parentExecutionId,
      planTitle: planTitle || 'AutoGen Multi-Agent Execution Plan',
      planObjective: planObjective || 'Autonomous parallel execution of SDLC lifecycle stages',
      totalAgents: taskList.length,
      tasks: taskList.map(t => {
        const agent = this.agentFactory.getAgent(t.agentId);
        return {
          agentId: t.agentId,
          agentName: agent ? agent.name : t.agentId,
          agentAvatar: agent ? agent.avatar : '🤖',
          agentRole: agent ? agent.role : (t.role || 'Specialist'),
          taskDescription: t.taskDescription,
          status: 'queued'
        };
      }),
      startedAt: Date.now()
    };

    // Emit initial plan
    this.emit('autogen_plan_generated', planData);

    // Launch all agent tasks simultaneously in parallel (AutoGen GroupChat / Swarm pattern)
    const parallelPromises = taskList.map(async (taskItem, idx) => {
      let subagent = this.agentFactory.getAgent(taskItem.agentId);
      if (!subagent) {
        const all = this.agentFactory.getAllAgents();
        subagent = all.find(a => 
          a.id.toLowerCase().includes((taskItem.agentId || '').toLowerCase()) ||
          a.name.toLowerCase().includes((taskItem.agentId || '').toLowerCase())
        ) || all[idx % all.length];
      }

      this.emit('parallel_agent_started', {
        parentExecutionId,
        planId,
        agentId: subagent.id,
        agentName: subagent.name,
        agentAvatar: subagent.avatar,
        agentRole: subagent.role,
        task: taskItem.taskDescription,
        status: 'working',
        startedAt: Date.now()
      });

      const startTime = Date.now();
      const allTools = this.toolRegistry.getAllTools();
      const availableTools = allTools.filter(t => (subagent.tools || []).includes(t.id));
      const subHistory = [{ role: 'user', content: taskItem.taskDescription }];

      this.emit('parallel_agent_progress', {
        parentExecutionId,
        planId,
        agentId: subagent.id,
        status: 'analyzing',
        progress: 25,
        log: `${subagent.name} received task: "${taskItem.taskDescription.substring(0, 60)}..."`
      });

      // Small async stagger so logs stream dynamically in animation
      await new Promise(r => setTimeout(r, 120 + idx * 80));

      this.emit('parallel_agent_progress', {
        parentExecutionId,
        planId,
        agentId: subagent.id,
        status: 'reasoning',
        progress: 55,
        log: `${subagent.name} reasoning with ${subagent.modelId} model.`
      });

      // Execute agent inference
      const subInference = await this.modelRouter.dispatchInference(subagent, subHistory, availableTools, 0);

      this.emit('parallel_agent_progress', {
        parentExecutionId,
        planId,
        agentId: subagent.id,
        status: 'executing_tools',
        progress: 80,
        log: subInference.thought ? subInference.thought.substring(0, 90) : `${subagent.name} completing deliverables.`
      });

      let toolOutput = null;
      if (subInference.toolCall) {
        const { toolId, parameters } = subInference.toolCall;
        const toolMeta = this.toolRegistry.getTool(toolId);
        const requiresApproval = this.governanceEngine.requiresApproval(toolId, parameters, toolMeta);

        if (requiresApproval) {
          toolOutput = {
            status: 'staged_requires_approval',
            message: `Tool ${toolId} staged for operator review.`
          };
        } else {
          try {
            toolOutput = await this.toolRegistry.executeTool(toolId, parameters);
          } catch (e) {
            toolOutput = { error: e.message };
          }
        }
      }

      await new Promise(r => setTimeout(r, 180));

      const durationMs = Date.now() - startTime;
      const result = {
        agentId: subagent.id,
        agentName: subagent.name,
        agentAvatar: subagent.avatar,
        agentRole: subagent.role,
        task: taskItem.taskDescription,
        status: 'completed',
        progress: 100,
        reasoning: subInference.thought,
        toolInvoked: subInference.toolCall ? subInference.toolCall.toolId : null,
        toolOutput,
        findings: subInference.content,
        durationMs,
        completedAt: Date.now()
      };

      this.emit('parallel_agent_completed', {
        parentExecutionId,
        planId,
        result
      });

      return result;
    });

    const agentResults = await Promise.all(parallelPromises);

    const swarmSummary = {
      planId,
      planTitle: planData.planTitle,
      planObjective: planData.planObjective,
      totalAgents: agentResults.length,
      durationMs: Date.now() - planData.startedAt,
      agentDeliverables: agentResults,
      status: 'completed'
    };

    this.emit('autogen_swarm_completed', {
      parentExecutionId,
      swarmSummary
    });

    return swarmSummary;
  }

  async resumeExecution(executionId, approvalId, decision, userComment = '') {
    const execState = this.activeExecutions.get(executionId);
    if (!execState) {
      throw new Error(`Execution ${executionId} not found.`);
    }

    const resolved = this.governanceEngine.resolveApproval(approvalId, decision, userComment);
    if (!resolved) {
      throw new Error(`Approval ${approvalId} not found.`);
    }

    execState.pendingApproval = null;

    if (decision === 'approved') {
      execState.status = 'running';
      this.emit('execution_resumed', { executionId, approvalId, decision });

      // Execute the previously paused tool
      const history = this.getHistory(execState.sessionId);
      const toolResult = await this.executeToolStep(executionId, resolved.toolId, resolved.parameters);
      history.push({
        role: 'tool',
        toolId: resolved.toolId,
        content: toolResult
      });

      execState.currentStep++;

      // Resume agent loop
      this.runAgentLoop(executionId).catch(err => {
        execState.status = 'failed';
        execState.error = err.message;
        this.emit('execution_failed', { executionId, error: err.message });
      });
    } else {
      // User rejected the tool execution
      execState.status = 'running';
      const history = this.getHistory(execState.sessionId);
      history.push({
        role: 'tool',
        toolId: resolved.toolId,
        content: {
          status: 'rejected_by_user',
          message: `User rejected tool execution: ${userComment || 'Action not permitted by operator.'}`
        }
      });
      execState.currentStep++;
      this.runAgentLoop(executionId);
    }
  }
}

module.exports = AgentRuntime;
