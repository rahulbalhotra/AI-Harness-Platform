import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, Terminal, FileCode2, FolderPlus, Globe, Compass, Play } from 'lucide-react';

export default function ApprovalModal({ approval, onResolve, onClose }) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!approval) return null;

  const handleDecision = async (decision) => {
    setSubmitting(true);
    try {
      await onResolve(approval.approvalId, approval.executionId, decision, comment);
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  const isTerminal = approval.toolId === 'run_command';
  const isFile = approval.toolId === 'write_file' || approval.toolId === 'replace_file_content';
  const isFolder = approval.toolId === 'create_directory';
  const isBrowserTest = approval.toolId === 'launch_browser_test';
  const isEnvTest = approval.toolId === 'run_environment_test';
  const isParallelSwarm = approval.toolId === 'invoke_parallel_agents';
  const kbDoc = approval.parameters?.knowledgeDoc;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px',
      overflowY: 'auto',
      overflowX: 'hidden'
    }}>
      <div 
        className="glass-panel-elevated animate-fade-in"
        style={{
          width: '100%',
          maxWidth: isParallelSwarm ? '660px' : '560px',
          maxHeight: 'calc(100vh - 32px)',
          maxHeight: 'calc(100dvh - 32px)',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)'
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-amber)',
            flexShrink: 0
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fef3c7', margin: 0 }}>
              {isParallelSwarm ? 'Approve Architecture Plan & Launch Parallel Swarm' : 'Human-in-the-Loop Approval Required'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {isParallelSwarm
                ? 'Research Agent ingested PRD into Knowledge Hub. Review and approve parallel repository implementation.'
                : 'Agent requested permission to execute a privileged SDLC action.'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ 
          padding: '18px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '14px', 
          flex: '1 1 auto', 
          overflowY: 'auto', 
          minHeight: 0 
        }}>
          {/* Ingested Knowledge Hub Document Badge for Parallel Swarm */}
          {isParallelSwarm && kbDoc && (
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '8px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  📚 Phase 1 Complete: Specification Ingested in Knowledge Hub
                </span>
                <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                  {kbDoc.chunkCount || 6} RAG Chunks Indexed
                </span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                {kbDoc.title}
              </div>
              {kbDoc.savedFilePath && (
                <div style={{ fontSize: '11.5px', fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>
                  Saved in Repo: <span style={{ color: '#38bdf8' }}>{kbDoc.savedFilePath}</span>
                </div>
              )}
            </div>
          )}

          {/* Tool information */}
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            padding: '12px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isTerminal ? (
                  <Terminal size={15} color="var(--accent-cyan)" />
                ) : isFolder ? (
                  <FolderPlus size={15} color="var(--accent-cyan)" />
                ) : isBrowserTest ? (
                  <Globe size={15} color="#38bdf8" />
                ) : isEnvTest ? (
                  <Play size={15} color="#10b981" />
                ) : (
                  <FileCode2 size={15} color="var(--accent-indigo)" />
                )}
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isParallelSwarm ? (approval.parameters?.planTitle || 'Parallel Multi-Agent Swarm Implementation') : (approval.toolName || approval.toolId)}
                </span>
              </div>
              <span className="badge badge-amber">
                {isParallelSwarm ? `${approval.parameters?.tasks?.length || 5} Agents in Parallel` : `Risk: ${approval.riskLevel || 'High'}`}
              </span>
            </div>

            {/* Parallel Swarm Tasks List */}
            {isParallelSwarm && Array.isArray(approval.parameters?.tasks) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  {approval.parameters.planObjective}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {approval.parameters.tasks.map((t, idx) => (
                    <div key={idx} style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '12px', color: '#e2e8f0' }}>{t.role} ({t.agentId})</strong>
                        {t.targetFiles && t.targetFiles.length > 0 && (
                          <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#818cf8' }}>
                            {t.targetFiles.join(', ')}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {t.taskDescription}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Browser Testing Target */}
            {isBrowserTest && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Web Application:</span>
                  <div style={{
                    marginTop: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    color: '#38bdf8',
                    padding: '8px 12px',
                    background: 'rgba(56, 189, 248, 0.08)',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Globe size={15} color="#38bdf8" />
                    <strong>{approval.parameters?.targetUrl || 'http://127.0.0.1:5000'}</strong>
                    <span className="badge badge-indigo" style={{ marginLeft: 'auto', fontSize: '10px' }}>Google Chrome</span>
                  </div>
                </div>
                {approval.parameters?.testScenario && (
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Test Plan & Scenario:</span>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '2px', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '4px' }}>
                      {approval.parameters.testScenario}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Parameter values */}
            {isTerminal && approval.parameters?.command && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Command to execute:</span>
                <pre style={{ marginTop: '4px', color: '#67e8f9', background: '#070a10' }}>
                  $ {approval.parameters.command}
                </pre>
              </div>
            )}

            {isFolder && (approval.parameters?.dirPath || approval.parameters?.path || approval.parameters?.directory) && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target Directory / Folder to Create:</span>
                <div style={{ 
                  marginTop: '4px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '12px', 
                  color: 'var(--accent-cyan)', 
                  padding: '8px 10px', 
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: '1px solid rgba(6, 182, 212, 0.3)'
                }}>
                  <FolderPlus size={16} color="var(--accent-cyan)" />
                  <span>{approval.parameters.dirPath || approval.parameters.path || approval.parameters.directory}</span>
                  {approval.parameters.recursive !== false && (
                    <span className="badge badge-indigo" style={{ fontSize: '9px', marginLeft: 'auto' }}>
                      recursive
                    </span>
                  )}
                </div>
              </div>
            )}

            {isFile && approval.parameters?.filePath && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Target File:</span>
                <div style={{ 
                  marginTop: '4px', 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: '12px', 
                  color: 'var(--accent-emerald)', 
                  padding: '6px 8px', 
                  background: 'rgba(0,0,0,0.5)',
                  borderRadius: '4px' 
                }}>
                  {approval.parameters.filePath}
                </div>
              </div>
            )}

            {!isTerminal && !isFile && !isFolder && !isBrowserTest && !isParallelSwarm && (
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Parameters:</span>
                <pre style={{ marginTop: '4px' }}>
                  {JSON.stringify(approval.parameters, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Feedback input */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Optional Feedback / Guidance to Agent:
            </label>
            <input
              type="text"
              placeholder="e.g. Approved, proceed with parallel implementation in repository..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          backgroundColor: 'rgba(15, 20, 32, 0.95)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px',
          flexWrap: 'wrap',
          flexShrink: 0
        }}>
          <button
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Review Later
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleDecision('rejected')}
            disabled={submitting}
          >
            <XCircle size={15} />
            Reject Action
          </button>
          <button
            className="btn btn-success"
            onClick={() => handleDecision('approved')}
            disabled={submitting}
          >
            <CheckCircle size={15} />
            {isParallelSwarm ? 'Approve Plan & Launch Swarm' : isBrowserTest ? 'Approve & Launch Chrome' : 'Approve & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}
