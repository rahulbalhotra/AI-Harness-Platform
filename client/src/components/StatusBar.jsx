import React from 'react';
import { Shield, Cpu, Activity, FolderGit2, CheckCircle2, AlertTriangle, Layers, RefreshCw, Sun, Moon } from 'lucide-react';

export default function StatusBar({ 
  isConnected, 
  activeModel, 
  models = [],
  routingStatus = null,
  lastRetryEvent = null,
  onSelectModel = null,
  policy, 
  pendingCount, 
  workspaceRoot, 
  workspaceInfo,
  onOpenRepoAccess,
  sessionTokens = 0,
  onOpenGovernance,
  currentUser = null,
  onOpenLoginModal = () => {},
  theme = 'dark',
  onToggleTheme = () => {}
}) {
  const selectedMode = routingStatus?.selectedMode || 'auto';
  const displayModelName = activeModel?.name || activeModel?.id || 'Gemini 2.5 Flash';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Live Retry / Failover Telemetry Pill */}
        {lastRetryEvent && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '1px 7px',
              borderRadius: '4px',
              background: 'rgba(245, 158, 11, 0.18)',
              color: '#fcd34d',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              fontSize: '10px'
            }}
            title={`Retry attempt #${lastRetryEvent.attempt}: ${lastRetryEvent.reason}`}
          >
            <RefreshCw size={11} />
            <span>Retry #{lastRetryEvent.attempt} ({lastRetryEvent.modelId || lastRetryEvent.nextModelId})</span>
          </div>
        )}

        {/* Dynamic Active Model Pill + Quick Switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '1px 7px',
            borderRadius: '4px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.25)'
          }}
          title={`Active Model: ${displayModelName} (${selectedMode === 'auto' ? 'Adaptive Auto-Router' : 'Pinned Model'})`}
        >
          <Cpu size={12} color="var(--accent-cyan)" />
          <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Model:</span>
          {onSelectModel && models.length > 0 ? (
            <select
              value={selectedMode === 'auto' ? 'auto' : (activeModel?.id || 'auto')}
              onChange={(e) => onSelectModel(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
                padding: 0
              }}
            >
              <option value="auto" style={{ background: '#0f172a', color: '#38bdf8' }}>
                ⚡ {displayModelName} (Auto)
              </option>
              {models.filter(m => m.enabled !== false).map(m => (
                <option key={m.id} value={m.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                  {m.name} ({m.provider})
                </option>
              ))}
            </select>
          ) : (
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
              {displayModelName}
            </span>
          )}
        </div>

        {/* Tokens used */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Layers size={12} />
          <span>{sessionTokens.toLocaleString()} tokens</span>
        </div>

        {/* Day / Night Theme Toggle */}
        <div
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Day Mode (Capgemini Clean Light)' : 'Switch to Night Mode (Capgemini Midnight Navy)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            padding: '1px 8px',
            borderRadius: '4px',
            background: theme === 'dark' ? 'rgba(0, 163, 224, 0.1)' : 'rgba(0, 112, 173, 0.12)',
            color: theme === 'dark' ? '#fcd34d' : '#0070ad',
            border: '1px solid var(--border-subtle)',
            fontSize: '11px',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-cyan)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          {theme === 'dark' ? <Sun size={12} color="#fcd34d" /> : <Moon size={12} color="#0070ad" />}
          <span>{theme === 'dark' ? 'Night Mode' : 'Day Mode'}</span>
        </div>

        {/* Antigravity version */}
        <div>
          <span>Antigravity Harness v1.0.0</span>
        </div>
      </div>
    </footer>
  );
}
