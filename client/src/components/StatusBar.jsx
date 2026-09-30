import React from 'react';
import { Shield, Cpu, Activity, FolderGit2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export default function StatusBar({ 
  isConnected, 
  activeModel, 
  policy, 
  pendingCount, 
  workspaceRoot, 
  workspaceInfo,
  onOpenRepoAccess,
  sessionTokens = 0,
  onOpenGovernance,
  currentUser = null,
  onOpenLoginModal = () => {}
}) {
  return (
    <footer style={{
      height: '26px',
      backgroundColor: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      fontSize: '11px',
      color: 'var(--text-muted)',
      userSelect: 'none',
      zIndex: 40
    }}>
      {/* Left items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Connection status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`status-dot ${isConnected ? 'active' : 'error'}`} />
          <span style={{ color: isConnected ? 'var(--text-secondary)' : 'var(--accent-rose)' }}>
            {isConnected ? 'Harness Engine Online' : 'Engine Disconnected'}
          </span>
        </div>

        {/* Workspace repository authorization pill */}
        <div 
          onClick={onOpenRepoAccess}
          title="Click to configure repository folder access permissions"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '5px',
            cursor: 'pointer',
            padding: '1px 7px',
            borderRadius: '4px',
            background: workspaceInfo?.isAuthorized ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.15)',
            color: workspaceInfo?.isAuthorized ? '#6ee7b7' : '#fcd34d',
            border: workspaceInfo?.isAuthorized ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
            transition: 'all 0.15s ease'
          }}
        >
          <FolderGit2 size={13} />
          <span>
            Repo: {workspaceInfo?.repoPath ? (workspaceInfo.repoPath.split('\\').pop() || workspaceInfo.repoPath) : (workspaceRoot ? workspaceRoot.split('\\').pop() : 'Workspace')} ({workspaceInfo?.isAuthorized ? 'Granted 🟢' : 'Authorization Needed 🟡'})
          </span>
        </div>

        {/* Policy Pill */}
        <div 
          onClick={onOpenGovernance}
          title="Click to adjust execution policy"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            cursor: 'pointer',
            padding: '1px 6px',
            borderRadius: '4px',
            background: policy === 'always-proceed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: policy === 'always-proceed' ? '#6ee7b7' : '#fcd34d'
          }}
        >
          <Shield size={12} />
          <span>Policy: {policy}</span>
        </div>

        {/* Current User & Role RBAC Pill */}
        {currentUser && (
          <div 
            onClick={onOpenLoginModal}
            title={`Active User: ${currentUser.name || currentUser.username} (${currentUser.role}). Click to switch or authenticate.`}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '5px',
              cursor: 'pointer',
              padding: '1px 7px',
              borderRadius: '4px',
              background: currentUser.role === 'admin' ? 'rgba(236, 72, 153, 0.15)' : 'rgba(99, 102, 241, 0.15)',
              color: currentUser.role === 'admin' ? '#f472b6' : '#a5b4fc',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <span>{currentUser.role === 'admin' ? '👑' : currentUser.role === 'lead' ? '📐' : currentUser.role === 'developer' ? '💻' : '👁️'}</span>
            <span style={{ fontWeight: 600 }}>{currentUser.username}</span>
            <span style={{ opacity: 0.75, fontSize: '10px' }}>({currentUser.role})</span>
          </div>
        )}

        {/* Pending approvals */}
        {pendingCount > 0 && (
          <div 
            onClick={onOpenGovernance}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              cursor: 'pointer',
              color: 'var(--accent-rose)', 
              fontWeight: 600 
            }}
          >
            <AlertTriangle size={12} />
            <span>{pendingCount} Pending Approvals</span>
          </div>
        )}
      </div>

      {/* Right items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Active Model */}
        {activeModel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Cpu size={12} color="var(--accent-cyan)" />
            <span style={{ color: 'var(--text-secondary)' }}>{activeModel.name || activeModel.id}</span>
          </div>
        )}

        {/* Tokens used */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Layers size={12} />
          <span>{sessionTokens.toLocaleString()} tokens</span>
        </div>

        {/* Antigravity version */}
        <div>
          <span>Antigravity Harness v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}
