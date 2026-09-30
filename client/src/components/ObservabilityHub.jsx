import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Clock, 
  Cpu, 
  Coins, 
  ShieldCheck, 
  Database, 
  Search, 
  Filter, 
  Play, 
  RefreshCw, 
  Download, 
  Trash2, 
  Layers, 
  Wrench, 
  Bot, 
  Server, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  ChevronDown, 
  Sparkles, 
  Zap, 
  BarChart2, 
  HardDrive,
  FileCheck2
} from 'lucide-react';
import { 
  getTelemetryOverview, 
  getTelemetryTraces, 
  getTraceDetail, 
  simulateTelemetryTraffic, 
  clearTelemetryTraces, 
  exportTelemetryData, 
  getDatabaseHealth, 
  createDatabaseBackup, 
  verifyDatabaseIntegrity 
} from '../services/api';

export default function ObservabilityHub({ currentUser, activeAgentId }) {
  const [activeTab, setActiveTab] = useState('traces'); // 'traces' | 'models' | 'agents' | 'database'
  const [timeRange, setTimeRange] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [traces, setTraces] = useState([]);
  const [selectedTrace, setSelectedTrace] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyReport, setVerifyReport] = useState(null);
  const [backupNotice, setBackupNotice] = useState(null);

  // Filters for Traces table
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovData, trData, dbData] = await Promise.all([
        getTelemetryOverview({ timeRange }),
        getTelemetryTraces({ limit: 150 }),
        getDatabaseHealth().catch(() => null)
      ]);
      setOverview(ovData);
      setTraces(trData);
      if (dbData) setDbHealth(dbData);

      // If a trace is selected, refresh its details
      if (selectedTrace?.traceId) {
        const detail = await getTraceDetail(selectedTrace.traceId).catch(() => null);
        if (detail) setSelectedTrace(detail);
      } else if (trData.length > 0 && !selectedTrace) {
        // Auto-select first trace for preview
        const firstTrace = trData.find(t => !t.parentSpanId) || trData[0];
        if (firstTrace?.traceId) {
          getTraceDetail(firstTrace.traceId).then(setSelectedTrace).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error loading observability telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      await simulateTelemetryTraffic(3);
      await loadData();
    } catch (err) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearTraces = async () => {
    if (!confirm('Are you sure you want to clear historical telemetry spans?')) return;
    try {
      await clearTelemetryTraces();
      setSelectedTrace(null);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBackupDb = async () => {
    setIsBackingUp(true);
    try {
      const res = await createDatabaseBackup();
      setBackupNotice(`Snapshot created: ${res.backupFile.split(/[\\/]/).pop()} (${res.sizeKb} KB)`);
      setTimeout(() => setBackupNotice(null), 4000);
      const updatedHealth = await getDatabaseHealth();
      setDbHealth(updatedHealth);
    } catch (err) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleVerifyDb = async () => {
    setIsVerifying(true);
    try {
      const report = await verifyDatabaseIntegrity();
      setVerifyReport(report);
      const updatedHealth = await getDatabaseHealth();
      setDbHealth(updatedHealth);
    } catch (err) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSelectTrace = async (traceId) => {
    try {
      const detail = await getTraceDetail(traceId);
      setSelectedTrace(detail);
    } catch (err) {
      console.error('Failed to load trace detail:', err);
    }
  };

  // Filter traces
  const filteredTraces = traces.filter(t => {
    const isRoot = !t.parentSpanId || t.type === 'agent_turn';
    if (!isRoot) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = (t.name || '').toLowerCase().includes(q);
      const matchTrace = (t.traceId || '').toLowerCase().includes(q);
      const matchAgent = (t.agentName || t.agentId || '').toLowerCase().includes(q);
      if (!matchName && !matchTrace && !matchAgent) return false;
    }

    if (filterAgent !== 'all' && t.agentId !== filterAgent) return false;
    if (filterModel !== 'all' && t.modelId !== filterModel) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;

    return true;
  });

  const summary = overview?.summary || {
    totalTraces: 0,
    totalSpans: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalCostUsd: 0,
    avgLatencyMs: 0,
    p50LatencyMs: 0,
    p90LatencyMs: 0,
    p99LatencyMs: 0,
    errorRatePct: 0
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* ================= TOP HEADER ================= */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        flexShrink: 0
      }}>
        {/* Left: Title & Live Pulse */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(6, 182, 212, 0.25) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-indigo)'
          }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Observability & Telemetry Tracing
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <span className="status-dot online" style={{ width: '6px', height: '6px' }} />
                LIVE STREAM
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              OpenTelemetry-grade distributed span tracing, agent latency percentiles, token cost tracking, and ACID database health.
            </p>
          </div>
        </div>

        {/* Right: Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Time range pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            {['15m', '1h', '24h', 'All'].map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t.toLowerCase())}
                style={{
                  background: timeRange === t.toLowerCase() ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: timeRange === t.toLowerCase() ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary"
            onClick={handleSimulate}
            disabled={isSimulating}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Generate synthetic multi-agent traffic to visualize live charts and waterfall spans"
          >
            <Zap size={14} color="#f59e0b" />
            <span>{isSimulating ? 'Simulating...' : 'Simulate Swarm Traffic'}</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={loadData}
            disabled={loading}
            style={{ fontSize: '12px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh metrics and traces"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={exportTelemetryData}
            style={{ fontSize: '12px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Export OpenTelemetry ResourceSpans JSON"
          >
            <Download size={13} />
            <span>Export OTel</span>
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleClearTraces}
            style={{ fontSize: '12px', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}
            title="Clear historical spans"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ================= KEY PERFORMANCE METRICS STRIP ================= */}
      <div style={{
        padding: '16px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0
      }}>
        {/* Metric 1: Total Traces */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Total Traces / Spans</span>
            <Layers size={16} color="var(--accent-indigo)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
            {summary.totalTraces} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>({summary.totalSpans} spans)</span>
          </div>
          <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
            Active Ring Buffer: {overview?.system?.activeSpansCount || 0} active
          </div>
        </div>

        {/* Metric 2: Latency Percentiles */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Latency (p50 / p90 / p99)</span>
            <Clock size={16} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
            {summary.p50LatencyMs || summary.avgLatencyMs || 0}ms <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>p50</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            p90: <span style={{ color: '#fcd34d' }}>{summary.p90LatencyMs || 0}ms</span> &bull; p99: <span style={{ color: '#f87171' }}>{summary.p99LatencyMs || 0}ms</span>
          </div>
        </div>

        {/* Metric 3: Token Throughput */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Token Throughput</span>
            <Cpu size={16} color="#c084fc" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>
            {summary.totalTokens.toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Prompt: {summary.promptTokens.toLocaleString()} &bull; Output: {summary.completionTokens.toLocaleString()}
          </div>
        </div>

        {/* Metric 4: Estimated Cost */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Estimated Cost</span>
            <Coins size={16} color="#fbbf24" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#fbbf24', marginTop: '6px' }}>
            ${summary.totalCostUsd.toFixed(4)}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Avg: ${summary.totalTokens > 0 ? ((summary.totalCostUsd / summary.totalTokens) * 1000).toFixed(5) : '0.000'} / 1k tokens
          </div>
        </div>

        {/* Metric 5: Reliability & Retry Rate */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Error & Retry Rate</span>
            <ShieldCheck size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: summary.errorRatePct === 0 ? '#34d399' : '#f87171', marginTop: '6px' }}>
            {summary.errorRatePct}%
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {summary.errorCount || 0} errors &bull; {summary.retryCount || 0} self-healing retries
          </div>
        </div>

        {/* Metric 6: Database Engine & Robustness */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '12px' }}>
            <span>Database Engine</span>
            <Database size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{dbHealth?.engine === 'postgres' ? 'PostgreSQL' : 'Embedded Relational'}</span>
            <span className="badge badge-emerald" style={{ fontSize: '9px', padding: '1px 5px' }}>ACID</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {dbHealth?.totalRecords || 0} records &bull; {dbHealth?.fileSizeKb || 0} KB &bull; <strong style={{ color: '#34d399' }}>Atomic</strong>
          </div>
        </div>
      </div>

      {/* ================= SECONDARY NAVIGATION TABS ================= */}
      <div style={{
        padding: '0 24px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        flexShrink: 0
      }}>
        {[
          { id: 'traces', label: 'Distributed Traces & Spans', icon: Layers, count: filteredTraces.length },
          { id: 'models', label: 'Models & Cost Breakdown', icon: Cpu, count: overview?.modelMetrics?.length || 0 },
          { id: 'agents', label: 'Agents & Tool Sandbox Matrix', icon: Bot, count: overview?.agentMetrics?.length || 0 },
          { id: 'database', label: 'Database Health & Snapshots', icon: HardDrive, count: dbHealth?.totalRecords || 0 }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 4px',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent-indigo)' : '2px solid transparent',
                background: 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} color={isActive ? 'var(--accent-indigo)' : 'var(--text-muted)'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '10.5px',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#a5b4fc' : 'var(--text-muted)'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB CONTENT PANELS ================= */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Notification alerts */}
        {backupNotice && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '8px',
            color: '#34d399',
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={16} />
            <span>{backupNotice}</span>
          </div>
        )}

        {/* ================= TAB 1: DISTRIBUTED TRACES & SPAN WATERFALL ================= */}
        {activeTab === 'traces' && (
          <div style={{ display: 'grid', gridTemplateColumns: selectedTrace ? '1.1fr 1fr' : '1fr', gap: '20px', minHeight: '500px' }}>
            
            {/* Left: Filterable Traces Table */}
            <div className="glass-panel" style={{ borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Filter bar */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flexWrap: 'wrap'
              }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search traces by name, agent, prompt..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '32px',
                      fontSize: '12px',
                      height: '32px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  style={{ fontSize: '11.5px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Agents</option>
                  <option value="agent-willow">Willow (Master)</option>
                  <option value="agent-architect">System Architect</option>
                  <option value="agent-senior-engineer">Senior Engineer</option>
                  <option value="agent-qa-synthesizer">QA Synthesizer</option>
                  <option value="agent-secops-auditor">SecOps Auditor</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ fontSize: '11.5px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)' }}
                >
                  <option value="all">All Status</option>
                  <option value="ok">Success (200)</option>
                  <option value="completed">Completed</option>
                  <option value="error">Error (500)</option>
                </select>
              </div>

              {/* Traces List */}
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '650px' }}>
                {filteredTraces.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No execution traces found. Click <strong>"Simulate Swarm Traffic"</strong> or send a message in chat to view live spans!
                  </div>
                ) : (
                  filteredTraces.map(trace => {
                    const isSelected = selectedTrace?.traceId === trace.traceId;
                    const duration = trace.durationMs || 100;
                    return (
                      <div
                        key={trace.spanId || trace.traceId}
                        onClick={() => handleSelectTrace(trace.traceId)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--accent-indigo)' : '3px solid transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '15px' }}>
                              {trace.agentId?.includes('architect') ? '📐' :
                               trace.agentId?.includes('engineer') ? '💻' :
                               trace.agentId?.includes('qa') ? '🧪' :
                               trace.agentId?.includes('secops') ? '🛡️' : '🌿'}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {trace.name || trace.traceId}
                            </span>
                          </div>
                          <span className={trace.status === 'error' ? 'badge badge-rose' : 'badge badge-emerald'} style={{ fontSize: '10px' }}>
                            {trace.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                              {trace.traceId.substring(0, 16)}...
                            </span>
                            <span>&bull;</span>
                            <span style={{ color: '#c084fc' }}>{trace.modelId || 'gemini-2.5-flash'}</span>
                            <span>&bull;</span>
                            <span>{trace.totalTokens || 0} tokens</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: '#fcd34d' }}>{duration}ms</span>
                            <span>{new Date(trace.startTime).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Waterfall Span Visualizer (OpenTelemetry style) */}
            {selectedTrace && (
              <div className="glass-panel" style={{ borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{
                  padding: '14px 18px',
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700 }}>Trace Waterfall</span>
                      <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                        {selectedTrace.spans.length} Spans
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Trace ID: {selectedTrace.traceId}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fcd34d' }}>
                      {selectedTrace.durationMs}ms
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ${selectedTrace.totalCostUsd?.toFixed(5) || '0.00000'} &bull; {selectedTrace.totalTokens} tokens
                    </div>
                  </div>
                </div>

                {/* Spans Gantt list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedTrace.spans.map((span, idx) => {
                    const isRoot = !span.parentSpanId;
                    const maxDuration = Math.max(1, selectedTrace.durationMs);
                    const spanDuration = span.durationMs || 10;
                    const widthPct = Math.max(8, Math.min(100, Math.round((spanDuration / maxDuration) * 100)));

                    const spanColor = {
                      agent_turn: 'var(--accent-indigo)',
                      rag_retrieval: '#06b6d4',
                      model_inference: '#8b5cf6',
                      tool_execution: '#10b981',
                      hitl_approval: '#f59e0b'
                    }[span.type] || '#64748b';

                    return (
                      <div 
                        key={span.spanId || idx}
                        style={{
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          padding: '10px 14px',
                          marginLeft: isRoot ? '0' : '16px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: spanColor
                            }} />
                            <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {span.name}
                            </span>
                            <span className="badge" style={{ fontSize: '9.5px', padding: '1px 5px', background: 'rgba(255,255,255,0.06)' }}>
                              {span.type}
                            </span>
                          </div>
                          <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#fcd34d' }}>
                            {spanDuration}ms
                          </span>
                        </div>

                        {/* Gantt Duration Timeline bar */}
                        <div style={{
                          height: '6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '3px',
                          marginTop: '8px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${widthPct}%`,
                            height: '100%',
                            backgroundColor: spanColor,
                            borderRadius: '3px'
                          }} />
                        </div>

                        {/* Attributes snippet */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {span.modelId && <span>Model: <strong style={{ color: '#a5b4fc' }}>{span.modelId}</strong></span>}
                          {span.toolId && <span>Tool: <strong style={{ color: '#34d399' }}>{span.toolId}</strong></span>}
                          {span.totalTokens > 0 && <span>Tokens: <strong>{span.totalTokens}</strong></span>}
                          {span.estimatedCostUsd > 0 && <span>Cost: <strong>${span.estimatedCostUsd.toFixed(5)}</strong></span>}
                          {span.attributes?.vectorEngine && <span style={{ color: '#38bdf8' }}>pgvector search</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 2: MODELS & COST BREAKDOWN ================= */}
        {activeTab === 'models' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {(overview?.modelMetrics || []).map(m => (
                <div key={m.modelId} className="glass-panel" style={{ padding: '18px', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Cpu size={18} color="#818cf8" />
                      <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{m.modelId}</h3>
                    </div>
                    <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                      {m.calls} Invocations
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tokens Consumed</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {m.tokens.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Cumulative Cost</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#fcd34d', marginTop: '2px' }}>
                        ${m.costUsd.toFixed(5)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Avg Latency: <strong style={{ color: 'var(--accent-cyan)' }}>{m.avgLatencyMs}ms</strong></span>
                    <span>Failures: <strong style={{ color: m.errors > 0 ? '#f87171' : '#34d399' }}>{m.errors}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* RAG Knowledge Hub Vector Retrieval Telemetry */}
            <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={18} color="#38bdf8" />
                <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                  Knowledge Hub pgvector RAG Performance
                </h3>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Telemetry from semantic cosine similarity chunk matching in PostgreSQL pgvector / embedded vector store.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '14px' }}>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Vector Retrievals</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                    {overview?.ragMetrics?.totalRetrievals || 0}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Avg Search Latency</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                    {overview?.ragMetrics?.avgLatencyMs || 0}ms
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '12px 14px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Avg Chunks Injected</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#c084fc', marginTop: '4px' }}>
                    {overview?.ragMetrics?.avgChunksRetrieved || 0} chunks / turn
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: AGENTS & TOOL SANDBOX MATRIX ================= */}
        {activeTab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Agent Performance Table */}
            <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={17} color="var(--accent-indigo)" />
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Specialist Agent Invocations & Token Footprint</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 16px' }}>Agent Persona</th>
                      <th style={{ padding: '10px 16px' }}>Invocations</th>
                      <th style={{ padding: '10px 16px' }}>Tokens</th>
                      <th style={{ padding: '10px 16px' }}>Cost</th>
                      <th style={{ padding: '10px 16px' }}>Avg Latency</th>
                      <th style={{ padding: '10px 16px' }}>Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.agentMetrics || []).map(a => (
                      <tr key={a.agentId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {a.agentName}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{a.invocations}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{a.tokens.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', color: '#fcd34d' }}>${a.costUsd.toFixed(5)}</td>
                        <td style={{ padding: '12px 16px' }}>{a.avgLatencyMs}ms</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className="badge badge-emerald" style={{ fontSize: '10.5px' }}>
                            {a.successRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tool Sandbox Execution Stats */}
            <div className="glass-panel" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wrench size={17} color="#34d399" />
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Tool & Sandbox Execution Telemetry</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px', padding: '16px' }}>
                {(overview?.toolMetrics || []).map(t => (
                  <div key={t.toolId} style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                      {t.toolId}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span>Calls: <strong>{t.calls}</strong></span>
                      <span>Avg: <strong>{t.avgLatencyMs}ms</strong></span>
                      <span>Errors: <strong style={{ color: t.errors > 0 ? '#f87171' : '#34d399' }}>{t.errors}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: DATABASE HEALTH & SNAPSHOTS ================= */}
        {activeTab === 'database' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Database Engine Status Card */}
            <div className="glass-panel-elevated" style={{ padding: '22px', borderRadius: '14px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#34d399'
                  }}>
                    <Database size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                      Robust Relational Persistence Engine
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                      Engine: <strong style={{ color: '#38bdf8' }}>{dbHealth?.engine === 'postgres' ? 'PostgreSQL with pgvector' : 'Embedded Relational (ACID Atomic)'}</strong> &bull; Total Records: <strong style={{ color: '#34d399' }}>{dbHealth?.totalRecords || 0}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={handleVerifyDb}
                    disabled={isVerifying}
                    style={{ fontSize: '12px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileCheck2 size={15} color="#38bdf8" />
                    <span>{isVerifying ? 'Verifying...' : 'Verify Table Integrity'}</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={handleBackupDb}
                    disabled={isBackingUp}
                    style={{ fontSize: '12px', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399' }}
                  >
                    <Download size={15} />
                    <span>{isBackingUp ? 'Creating Snapshot...' : 'Create Snapshot Backup'}</span>
                  </button>
                </div>
              </div>

              {/* Table counts grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginTop: '18px'
              }}>
                {Object.entries(dbHealth?.tables || {}).map(([tbl, cnt]) => (
                  <div key={tbl} style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {tbl.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                      {cnt} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>rows</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Robustness guarantees checklist */}
              <div style={{
                marginTop: '18px',
                padding: '14px',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '8px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '10px',
                fontSize: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                  <CheckCircle size={15} />
                  <span>Atomic persistence via .tmp + renameSync (Zero corruption on crashes)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                  <CheckCircle size={15} />
                  <span>Automatic .bak snapshot rotation on every write</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399' }}>
                  <CheckCircle size={15} />
                  <span>Automatic startup recovery from backup if file is damaged</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8' }}>
                  <CheckCircle size={15} />
                  <span>Memory RSS: {dbHealth?.memory?.rssMb || 0} MB &bull; Heap: {dbHealth?.memory?.heapUsedMb || 0} MB</span>
                </div>
              </div>
            </div>

            {/* Verification Audit Report */}
            {verifyReport && (
              <div className="glass-panel" style={{ padding: '18px 22px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#34d399" />
                  <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
                    Relational Integrity Audit Report
                  </h3>
                </div>
                <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {verifyReport.issuesReport.map((msg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', color: '#f8fafc' }}>
                      <CheckCircle size={14} color="#34d399" />
                      <span>{msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
