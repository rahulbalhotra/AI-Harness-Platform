import React, { useState } from 'react';
import { 
  FolderGit2, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  FolderPlus, 
  FileCode2, 
  Lock, 
  Unlock,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import { authorizeWorkspaceFolder, revokeWorkspaceAccess } from '../services/api';

export default function RepositoryAccessModal({ 
  workspaceInfo, 
  onClose, 
  onWorkspaceUpdated 
}) {
  const [repoPath, setRepoPath] = useState(workspaceInfo?.repoPath || 'c:\\Enterprise AI Harness Engine');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isAuthorized = !!workspaceInfo?.isAuthorized;

  const handleAuthorize = async () => {
    if (!repoPath.trim()) {
      setError('Please provide a valid repository folder path.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await authorizeWorkspaceFolder(repoPath.trim());
      if (res.workspace) {
        onWorkspaceUpdated?.(res.workspace);
        setSuccessMsg(`Repository access granted for: ${res.workspace.repoPath}`);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.message || 'Failed to authorize repository folder access.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke repository folder access? Agents will no longer be able to create files or folders until re-authorized.')) return;
    setLoading(true);
    setError(null);
    try {
      const res = await revokeWorkspaceAccess();
      if (res.workspace) {
        onWorkspaceUpdated?.(res.workspace);
        setSuccessMsg('Repository access revoked.');
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 110,
      padding: '20px'
    }}>
      <div 
        className="glass-panel-elevated animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '580px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: isAuthorized ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
          boxShadow: isAuthorized 
            ? '0 20px 40px -15px rgba(16, 185, 129, 0.2)' 
            : '0 20px 40px -15px rgba(245, 158, 11, 0.2)'
        }}
      >
        {/* Header */}
        <div style={{
          backgroundColor: isAuthorized ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
          borderBottom: isAuthorized ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: isAuthorized ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isAuthorized ? 'var(--accent-emerald)' : 'var(--accent-amber)'
            }}>
              {isAuthorized ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Repository Folder Access
                </h3>
                <span className={`badge ${isAuthorized ? 'badge-emerald' : 'badge-amber'}`} style={{ fontSize: '10px' }}>
                  {isAuthorized ? 'Access Authorized 🟢' : 'Pending Authorization 🟡'}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Grant autonomous agents permission to create files and folders in your repository.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Target Folder Path Input */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <FolderGit2 size={14} color="var(--accent-cyan)" />
              <span>Target Repository Folder Path:</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                placeholder="e.g. c:\Enterprise AI Harness Engine or /path/to/repo"
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  padding: '9px 12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  borderColor: isAuthorized ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-subtle)',
                  borderRadius: '6px'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <HardDrive size={12} />
              <span>Current workspace directory root for file and directory creation.</span>
            </div>
          </div>

          {/* Agent Capabilities Matrix */}
          <div style={{
            backgroundColor: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Permissions Granted to SDLC Agents:
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#e2e8f0' }}>
                <FolderPlus size={15} color="var(--accent-cyan)" />
                <span>Create Directories & Folders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#e2e8f0' }}>
                <FileCode2 size={15} color="var(--accent-indigo)" />
                <span>Create & Modify Files</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#e2e8f0' }}>
                <CheckCircle2 size={15} color="var(--accent-emerald)" />
                <span>Read Workspace Files</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#e2e8f0' }}>
                <ShieldCheck size={15} color="var(--accent-amber)" />
                <span>Human-in-the-Loop Review</span>
              </div>
            </div>

            <div style={{
              marginTop: '4px',
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              fontSize: '11px',
              color: '#fef3c7',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertTriangle size={14} color="var(--accent-amber)" flexShrink={0} />
              <span>
                <strong>Safety Policy Active</strong>: All file and folder creations will pause for your interactive approval modal before executing on disk.
              </span>
            </div>
          </div>

          {/* Feedback messages */}
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#6ee7b7', fontSize: '12px' }}>
              {successMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            {isAuthorized ? (
              <button
                type="button"
                onClick={handleRevoke}
                disabled={loading}
                className="btn btn-secondary"
                style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244, 63, 94, 0.3)', fontSize: '12px' }}
              >
                <Lock size={14} />
                <span>Revoke Access</span>
              </button>
            ) : <div />}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                style={{ fontSize: '12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAuthorize}
                disabled={loading}
                className="btn btn-primary"
                style={{
                  fontSize: '12px',
                  background: isAuthorized
                    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #06b6d4 100%)'
                }}
              >
                {loading ? (
                  <span>Saving...</span>
                ) : isAuthorized ? (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Update Access Path</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    <span>Grant Repository Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
