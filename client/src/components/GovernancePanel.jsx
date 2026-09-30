import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  ListFilter, 
  Clock, 
  Terminal, 
  Lock, 
  FileCode,
  RefreshCw
} from 'lucide-react';
import { 
  getGovernancePolicy, 
  setGovernancePolicy, 
  getPendingApprovals, 
  resolveApproval, 
  getAuditLogs 
} from '../services/api';

export default function GovernancePanel() {
  const [currentPolicy, setCurrentPolicy] = useState('request-review');
  const [approvals, setApprovals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    try {
      const p = await getGovernancePolicy();
      setCurrentPolicy(p.policy);
      const apprs = await getPendingApprovals();
      setApprovals(apprs);
      const logs = await getAuditLogs();
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handlePolicyChange = async (newPolicy) => {
    try {
      await setGovernancePolicy(newPolicy);
      setCurrentPolicy(newPolicy);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResolve = async (approvalId, executionId, decision) => {
    setIsProcessing(true);
    try {
      await resolveApproval(approvalId, executionId, decision, 'Operator reviewed via Governance Panel');
      await loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
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
            background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(245, 158, 11, 0.3)'
          }}>
            <ShieldCheck size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Governance, Sandboxing & Security
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Configure autonomy policies, resolve human-in-the-loop approvals, and inspect real-time audit trails.
            </p>
          </div>
        </div>

        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Autonomy Policy Selector */}
        <div className="glass-panel-elevated" style={{ borderRadius: '12px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px' }}>
            Harness Tool Autonomy Policy
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
            {[
              {
                id: 'request-review',
                name: 'Request Review (Default)',
                desc: 'Autonomous for safe reads. Sensitive terminal commands and critical file writes pause for human review.',
                badge: 'Recommended',
                color: 'var(--accent-amber)'
              },
              {
                id: 'always-proceed',
                name: 'Always Proceed (Full Autonomy)',
                desc: 'Agents execute without pausing. Destructive commands are still intercepted by Accidental Data Loss Prevention (ADLP).',
                badge: 'Fast Flow',
                color: 'var(--accent-emerald)'
              },
              {
                id: 'sandbox-strict',
                name: 'Sandbox Strict (Zero Write)',
                desc: 'All execution is sandboxed. Every single modification and tool call requires operator sign-off.',
                badge: 'Air-Gapped',
                color: 'var(--accent-cyan)'
              }
            ].map(p => {
              const isSelected = currentPolicy === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => handlePolicyChange(p.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isSelected ? p.color : 'var(--border-subtle)',
                    background: isSelected ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.name}
                    </span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: p.color }}>
                      {p.badge}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    {p.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Approvals Section */}
        <div className="glass-panel" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} color="var(--accent-amber)" />
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Pending Human-in-the-Loop Approvals ({approvals.length})
              </h3>
            </div>
            {approvals.length > 0 && <span className="badge badge-rose">Attention Required</span>}
          </div>

          {approvals.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              <CheckCircle2 size={28} color="var(--accent-emerald)" style={{ margin: '0 auto 8px' }} />
              All clear! No pending execution approvals in the queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {approvals.map(appr => (
                <div
                  key={appr.approvalId}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={15} color="var(--accent-cyan)" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {appr.toolName} ({appr.toolId})
                      </span>
                      <span className="badge badge-amber">Risk: {appr.riskLevel}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Requested: {new Date(appr.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <pre style={{ margin: 0, padding: '10px', fontSize: '12px', color: '#67e8f9' }}>
                    {JSON.stringify(appr.parameters, null, 2)}
                  </pre>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleResolve(appr.approvalId, appr.executionId, 'rejected')}
                      disabled={isProcessing}
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                    >
                      <XCircle size={13} /> Reject
                    </button>
                    <button
                      className="btn btn-success"
                      onClick={() => handleResolve(appr.approvalId, appr.executionId, 'approved')}
                      disabled={isProcessing}
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                    >
                      <CheckCircle2 size={13} /> Approve Execution
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Audit Trail */}
        <div className="glass-panel" style={{ borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Live Security & Tool Audit Trail
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Last 50 events recorded
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
            {auditLogs.map(log => (
              <div
                key={log.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                    {log.action}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {JSON.stringify(log.details)}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
