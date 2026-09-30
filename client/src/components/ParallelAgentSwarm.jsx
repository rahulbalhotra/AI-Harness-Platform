import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  Terminal, 
  Zap, 
  ChevronDown, 
  ChevronRight, 
  Clock, 
  Layers, 
  Activity,
  FileCode,
  ShieldCheck,
  Check
} from 'lucide-react';

export default function ParallelAgentSwarm({ 
  plan, 
  liveAgentMap = {}, 
  isStreaming = false 
}) {
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for live parallel execution
  useEffect(() => {
    let timer;
    if (isStreaming) {
      const start = plan?.startedAt || Date.now();
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - start) / 100) / 10);
      }, 100);
    } else if (plan?.durationMs) {
      setElapsedTime(Math.round(plan.durationMs / 100) / 10);
    }
    return () => clearInterval(timer);
  }, [isStreaming, plan]);

  // Aggregate tasks: either from live plan or deliverables
  const tasks = plan?.agentDeliverables || plan?.tasks || [
    { agentId: 'agent-architect', agentName: 'System Architect', agentAvatar: '📐', agentRole: 'Architectural Blueprint' },
    { agentId: 'agent-senior-engineer', agentName: 'Senior Engineer', agentAvatar: '💻', agentRole: 'Code Implementation' },
    { agentId: 'agent-qa-synthesizer', agentName: 'QA Synthesizer', agentAvatar: '🧪', agentRole: 'Test Suite & Coverage' },
    { agentId: 'agent-secops-auditor', agentName: 'SecOps Auditor', agentAvatar: '🛡️', agentRole: 'OWASP Security Audit' },
    { agentId: 'agent-devops-sre', agentName: 'DevOps & SRE', agentAvatar: '🚀', agentRole: 'CI/CD & Reliability' },
  ];

  const totalAgents = tasks.length;
  const completedCount = tasks.filter(t => {
    const live = liveAgentMap[t.agentId];
    return live?.status === 'completed' || t.status === 'completed';
  }).length;

  const isAllComplete = completedCount === totalAgents && totalAgents > 0 && !isStreaming;

  return (
    <div style={{
      width: '100%',
      borderRadius: '14px',
      background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 13, 20, 0.98) 100%)',
      border: '1px solid rgba(6, 182, 212, 0.35)',
      boxShadow: '0 8px 32px rgba(6, 182, 212, 0.12), 0 0 0 1px rgba(99, 102, 241, 0.15)',
      overflow: 'hidden',
      margin: '12px 0',
      position: 'relative'
    }}>
      {/* Top Holographic Header */}
      <div style={{
        padding: '14px 18px',
        background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.12) 50%, rgba(16, 185, 129, 0.1) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        {/* Left: Swarm Protocol Badge & Plan Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(6, 182, 212, 0.5)'
          }}>
            <Zap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                ⚡ AutoGen Swarm Protocol
              </span>
              <span className="badge badge-indigo" style={{ fontSize: '10px', padding: '1px 6px' }}>
                Parallel Multi-Agent
              </span>
            </div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, marginTop: '2px' }}>
              {plan?.planTitle || 'AutoGen Parallel Execution Swarm'}
            </h3>
          </div>
        </div>

        {/* Right: Concurrency Speedup & Live Stopwatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)'
          }}>
            <Clock size={13} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>Swarm Time:</span>
            <strong style={{ color: 'var(--accent-cyan)' }}>{elapsedTime}s</strong>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '20px',
            background: isAllComplete 
              ? 'rgba(16, 185, 129, 0.15)' 
              : 'rgba(6, 182, 212, 0.15)',
            border: `1px solid ${isAllComplete ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)'}`,
            fontSize: '11px',
            fontWeight: 600,
            color: isAllComplete ? '#6ee7b7' : 'var(--accent-cyan)'
          }}>
            <span className={`status-dot ${isAllComplete ? 'active' : 'pending animate-glow'}`} />
            <span>
              {isAllComplete ? `Completed (${completedCount}/${totalAgents} Agents)` : `Executing in Parallel (${completedCount}/${totalAgents})`}
            </span>
          </div>
        </div>
      </div>

      {/* Plan Objective Banner */}
      {plan?.planObjective && (
        <div style={{
          padding: '8px 18px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Layers size={13} color="var(--accent-indigo)" />
          <span><strong>Objective:</strong> {plan.planObjective}</span>
        </div>
      )}

      {/* ================= COOL VISUAL NEURAL ORCHESTRATOR ANIMATION ================= */}
      <div style={{
        padding: '24px 20px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.07) 0%, rgba(15, 23, 42, 0.0) 70%)',
        overflow: 'hidden'
      }}>
        {/* Animated Central Willow Orchestrator Hub */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '28px',
          zIndex: 2
        }}>
          {/* Outer Pulsing Radar Ring */}
          <div 
            className={isStreaming || !isAllComplete ? 'animate-radar' : ''}
            style={{
              position: 'absolute',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              border: '2px solid rgba(16, 185, 129, 0.4)',
              top: '-15px',
              left: '-15px',
              pointerEvents: 'none'
            }}
          />

          {/* Rotating Dashed Orbit Ring */}
          <div 
            className="animate-orbit"
            style={{
              position: 'absolute',
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '1.5px dashed rgba(6, 182, 212, 0.6)',
              top: '-10px',
              left: '-10px',
              pointerEvents: 'none'
            }}
          />

          {/* Central Willow Node */}
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 24px rgba(16, 185, 129, 0.5), inset 0 0 12px rgba(255, 255, 255, 0.4)',
            border: '2px solid #fff',
            cursor: 'default',
            zIndex: 3
          }}>
            🌿
          </div>

          <div style={{ marginTop: '8px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Willow
            </span>
            <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 500 }}>
              AutoGen GroupChat Orchestrator
            </div>
          </div>
        </div>

        {/* Dynamic Multi-Agent Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '14px',
          width: '100%',
          maxWidth: '1000px',
          zIndex: 2
        }}>
          {tasks.map((task, idx) => {
            const live = liveAgentMap[task.agentId] || {};
            const status = live.status || task.status || (isAllComplete ? 'completed' : 'working');
            const progress = live.progress !== undefined ? live.progress : (status === 'completed' ? 100 : 50);
            const latestLog = live.log || task.taskDescription || task.findings || 'Autonomous task dispatched.';
            const isCompleted = status === 'completed';
            const isExpanded = expandedAgent === task.agentId;

            return (
              <div
                key={task.agentId || idx}
                style={{
                  background: 'rgba(15, 20, 32, 0.85)',
                  border: isCompleted 
                    ? '1px solid rgba(16, 185, 129, 0.35)' 
                    : '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isCompleted 
                    ? '0 4px 16px rgba(16, 185, 129, 0.1)' 
                    : '0 4px 16px rgba(6, 182, 212, 0.1)'
                }}
              >
                {/* Top Shimmer Line on Active Cards */}
                {!isCompleted && isStreaming && (
                  <div 
                    className="animate-shimmer"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px'
                    }}
                  />
                )}

                {/* Agent Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '15px'
                    }}>
                      {task.agentAvatar || '🤖'}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {task.agentName}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {task.agentRole || 'SDLC Specialist'}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                    color: isCompleted ? '#6ee7b7' : 'var(--accent-cyan)',
                    border: `1px solid ${isCompleted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)'}`
                  }}>
                    {isCompleted ? <Check size={11} /> : <Activity size={11} className="animate-spin" />}
                    <span>{isCompleted ? '100% Done' : `${progress}%`}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{
                  width: '100%',
                  height: '4px',
                  borderRadius: '2px',
                  background: 'rgba(255, 255, 255, 0.07)',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: isCompleted
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #06b6d4, #6366f1)',
                    transition: 'width 0.3s ease',
                    boxShadow: isCompleted
                      ? '0 0 8px rgba(16, 185, 129, 0.6)'
                      : '0 0 8px rgba(6, 182, 212, 0.6)'
                  }} />
                </div>

                {/* Live Terminal Output / Thought Stream */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.45)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: isCompleted ? '#cbd5e1' : 'var(--accent-cyan)',
                  lineHeight: '1.4',
                  minHeight: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '5px' }}>&gt;</span>
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%'
                  }}>
                    {latestLog}
                  </span>
                  {!isCompleted && isStreaming && <span className="terminal-cursor" />}
                </div>

                {/* Deliverable Dropdown if completed */}
                {(task.findings || task.toolOutput) && (
                  <div>
                    <button
                      onClick={() => setExpandedAgent(isExpanded ? null : task.agentId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        fontSize: '10.5px',
                        cursor: 'pointer',
                        padding: '2px 0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      <span>{isExpanded ? 'Hide Deliverable' : 'View Agent Deliverable'}</span>
                    </button>

                    {isExpanded && (
                      <div style={{
                        marginTop: '6px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        maxHeight: '160px',
                        overflowY: 'auto'
                      }}>
                        {task.findings && (
                          <div style={{ whiteSpace: 'pre-wrap', marginBottom: '6px' }}>
                            {task.findings}
                          </div>
                        )}
                        {task.toolOutput && (
                          <pre style={{
                            margin: 0,
                            padding: '6px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            fontSize: '10px'
                          }}>
                            {JSON.stringify(task.toolOutput, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Swarm Consensus Briefing Bar */}
      {isAllComplete && (
        <div style={{
          padding: '10px 18px',
          background: 'rgba(16, 185, 129, 0.08)',
          borderTop: '1px solid rgba(16, 185, 129, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11.5px',
          color: '#6ee7b7'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={15} color="var(--accent-emerald)" />
            <span>
              <strong>AutoGen Swarm Complete</strong> &bull; All {totalAgents} specialist deliverables synthesized into consensus briefing below.
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>
            Execution time: {elapsedTime}s
          </div>
        </div>
      )}
    </div>
  );
}
