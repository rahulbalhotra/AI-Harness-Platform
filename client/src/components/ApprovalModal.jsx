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

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div 
        className="glass-panel-elevated animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid rgba(245, 158, 11, 0.4)'
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-amber)'
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fef3c7' }}>
              Human-in-the-Loop Approval Required
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Agent requested permission to execute a privileged SDLC action.
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  {approval.toolName || approval.toolId}
                </span>
              </div>
              <span className="badge badge-amber">
                Risk: {approval.riskLevel || 'High'}
              </span>
            </div>

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

            {!isTerminal && !isFile && !isFolder && !isBrowserTest && (
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
              placeholder="e.g. Approved with dry-run flag, or use alternative command..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          backgroundColor: 'rgba(15, 20, 32, 0.9)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '10px'
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
            {isBrowserTest ? 'Approve & Launch Chrome' : 'Approve & Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}
