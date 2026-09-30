import React, { useState, useEffect } from 'react';
import { 
  GitMerge, 
  Play, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Bot, 
  Cpu, 
  ShieldCheck, 
  ChevronRight, 
  Layers, 
  RefreshCw 
} from 'lucide-react';
import { getPipelines, triggerPipeline, getPipelineRuns } from '../services/api';

export default function SDLCPipelines({ agents, models }) {
  const [pipelines, setPipelines] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pipelineInput, setPipelineInput] = useState('Implement a resilient Rate Limiting and Token Bucket middleware with Redis caching and unit test coverage.');
  const [activeRunState, setActiveRunState] = useState(null);

  const loadData = async () => {
    try {
      const pList = await getPipelines();
      setPipelines(pList);
      if (pList.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(pList[0].id);
      }
      const rList = await getPipelineRuns();
      setRuns(rList);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId) || pipelines[0];

  const handleTriggerPipeline = async () => {
    if (!selectedPipeline || isRunning) return;
    setIsRunning(true);
    try {
      const run = await triggerPipeline(selectedPipeline.id, { prompt: pipelineInput });
      setActiveRunState(run);
      // Poll progress for 4 seconds
      const interval = setInterval(async () => {
        const updatedRuns = await getPipelineRuns();
        setRuns(updatedRuns);
        const current = updatedRuns.find(r => r.runId === run.runId);
        if (current) {
          setActiveRunState(current);
          if (current.status === 'completed' || current.status === 'failed') {
            clearInterval(interval);
            setIsRunning(false);
          }
        }
      }, 1000);
    } catch (err) {
      alert('Pipeline trigger failed: ' + err.message);
      setIsRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(15, 20, 32, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(236, 72, 153, 0.3)'
          }}>
            <GitMerge size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              SDLC Multi-Agent Pipelines
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Autonomous multi-agent DAG pipelines orchestrating Spec &rarr; Code &rarr; Test &rarr; SecOps &rarr; Review.
            </p>
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={loadData}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr', overflow: 'hidden' }}>
        
        {/* Left Column: Pipeline List */}
        <div style={{
          borderRight: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Available SDLC Pipelines
          </span>

          {pipelines.map(pipe => {
            const isSelected = pipe.id === selectedPipeline?.id;
            return (
              <div
                key={pipe.id}
                onClick={() => setSelectedPipelineId(pipe.id)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {pipe.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.3' }}>
                  {pipe.description}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                  <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                    {pipe.stages.length} Stages
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Visual DAG and Runner */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {selectedPipeline && (
            <>
              {/* Trigger Card */}
              <div className="glass-panel-elevated" style={{ borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedPipeline.name}
                    </h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {selectedPipeline.description}
                    </p>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleTriggerPipeline}
                    disabled={isRunning}
                    style={{
                      background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                      padding: '8px 18px'
                    }}
                  >
                    <Play size={15} /> {isRunning ? 'Running Pipeline DAG...' : 'Execute Full Pipeline'}
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Pipeline Feature Goal / Specification Prompt:
                  </label>
                  <input
                    type="text"
                    value={pipelineInput}
                    onChange={(e) => setPipelineInput(e.target.value)}
                    style={{ width: '100%' }}
                    disabled={isRunning}
                  />
                </div>
              </div>

              {/* Visual Pipeline DAG Flow */}
              <div className="glass-panel" style={{ borderRadius: '12px', padding: '24px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '16px' }}>
                  Multi-Agent Pipeline Graph
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflowX: 'auto', paddingBottom: '10px' }}>
                  {selectedPipeline.stages.map((stage, idx) => {
                    const agent = agents.find(a => a.id === stage.agentId);
                    const isLast = idx === selectedPipeline.stages.length - 1;

                    // Progress states
                    const runStage = activeRunState?.stageHistory?.find(s => s.stageId === stage.id);
                    const isStageRunning = runStage?.status === 'running';
                    const isStageCompleted = runStage?.status === 'completed';

                    return (
                      <React.Fragment key={stage.id}>
                        {/* Node Card */}
                        <div style={{
                          minWidth: '220px',
                          padding: '14px',
                          borderRadius: '10px',
                          background: isStageRunning ? 'rgba(99, 102, 241, 0.2)' : isStageCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid',
                          borderColor: isStageRunning ? 'var(--accent-indigo)' : isStageCompleted ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          boxShadow: isStageRunning ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              STAGE {idx + 1}
                            </span>
                            {isStageCompleted ? (
                              <span className="badge badge-emerald" style={{ fontSize: '9px' }}>
                                <CheckCircle2 size={10} /> Done
                              </span>
                            ) : isStageRunning ? (
                              <span className="badge badge-indigo" style={{ fontSize: '9px' }}>
                                Running...
                              </span>
                            ) : (
                              <span className="badge" style={{ fontSize: '9px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                                Queued
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {stage.name}
                          </div>

                          {/* Agent Badge */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            marginTop: '2px'
                          }}>
                            <span style={{ fontSize: '16px' }}>{agent?.avatar || '🤖'}</span>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {agent?.name || stage.agentId}
                              </div>
                              <div style={{ fontSize: '9px', color: 'var(--accent-cyan)' }}>
                                {agent?.role}
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                            {stage.description}
                          </div>
                        </div>

                        {/* Connector Arrow */}
                        {!isLast && (
                          <div style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                            <ArrowRight size={18} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Stage Execution Outputs */}
              {activeRunState && (
                <div className="glass-panel animate-fade-in" style={{ borderRadius: '12px', padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Active Run Telemetry ({activeRunState.runId})
                    </h3>
                    <span className={activeRunState.status === 'completed' ? 'badge badge-emerald' : 'badge badge-indigo'}>
                      Status: {activeRunState.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {activeRunState.stageHistory?.map((s, i) => (
                      <div key={i} style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle2 size={16} color="var(--accent-emerald)" />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {s.stageName}:
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {s.summary || 'In progress...'}
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {s.completedAt ? new Date(s.completedAt).toLocaleTimeString() : 'Running'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
