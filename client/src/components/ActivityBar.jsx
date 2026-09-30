import React from 'react';
import { 
  MessageSquare, 
  Bot, 
  Cpu, 
  Wrench, 
  GitMerge, 
  FolderTree, 
  ShieldCheck, 
  Sparkles, 
  Settings, 
  BookOpen, 
  Database,
  Kanban,
  Activity,
  Sun,
  Moon
} from 'lucide-react';

export default function ActivityBar({ 
  activeTab, 
  setActiveTab, 
  pendingApprovalsCount = 0,
  currentUser = null,
  onOpenLoginModal = () => {},
  theme = 'dark',
  onToggleTheme = () => {}
}) {
  const navItems = [
    { id: 'chat', label: 'Agent Studio & Pair Chat', icon: MessageSquare },
    { id: 'pm', label: 'Project Management & Jira Board', icon: Kanban },
    { id: 'observability', label: 'Observability & Telemetry Tracing', icon: Activity },
    { id: 'agents', label: 'Agent Hub & Creator', icon: Bot },
    { id: 'pipelines', label: 'SDLC Multi-Agent Pipelines', icon: GitMerge },
    { id: 'knowledge', label: 'Knowledge Base & RAG', icon: BookOpen },
    { id: 'database', label: 'PostgreSQL & Versioning', icon: Database },
    { id: 'models', label: 'Model Hub & Router', icon: Cpu },
    { id: 'tools', label: 'Tools & MCP Registry', icon: Wrench },
    { id: 'explorer', label: 'Workspace & Code Canvas', icon: FolderTree },
    { 
      id: 'governance', 
      label: 'Governance & Security', 
      icon: ShieldCheck,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : null 
    }
  ];

  const roleEmoji = {
    admin: '👑',
    lead: '📐',
    developer: '💻',
    viewer: '👁️'
  }[currentUser?.role] || '👤';

  return (
    <div style={{
      width: '56px',
      backgroundColor: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      zIndex: 50,
      userSelect: 'none'
    }}>
      {/* Brand Icon */}
      <div 
        title="Antigravity Enterprise AI Harness Engine — Powered by Capgemini Design"
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #0070ad 0%, #00b2e3 50%, #eb214e 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px',
          cursor: 'pointer',
          boxShadow: '0 0 16px rgba(0, 112, 173, 0.45)',
          position: 'relative'
        }}
      >
        <Sparkles size={20} color="#fff" />
      </div>

      {/* Nav Icons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, width: '100%', alignItems: 'center' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              title={item.label}
              style={{
                position: 'relative',
                width: '42px',
                height: '42px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'rgba(0, 112, 173, 0.24)' : 'transparent',
                color: isActive ? '#38c8f4' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                outline: 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
                if (!isActive) e.currentTarget.style.background = 'rgba(0, 163, 224, 0.08)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = 'var(--text-muted)';
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Active left bar */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: '-7px',
                  top: '8px',
                  bottom: '8px',
                  width: '3.5px',
                  background: 'linear-gradient(to bottom, #0070ad, #00b2e3)',
                  borderRadius: '0 4px 4px 0',
                  boxShadow: '0 0 8px rgba(0, 178, 227, 0.6)'
                }} />
              )}
              <Icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />

              {/* Notification Badge */}
              {item.badge && (
                <div style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'var(--accent-rose)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 6px rgba(244, 63, 94, 0.8)'
                }}>
                  {item.badge}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Settings & User Login Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        {/* Day / Night Theme Switch Button */}
        <button
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Day Mode (Capgemini Clean Light)' : 'Switch to Night Mode (Capgemini Midnight Navy)'}
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            background: theme === 'dark' ? 'rgba(0, 163, 224, 0.08)' : 'rgba(0, 112, 173, 0.1)',
            color: theme === 'dark' ? '#fcd34d' : '#0070ad',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease',
            boxShadow: theme === 'dark' ? '0 0 10px rgba(245, 158, 11, 0.15)' : '0 2px 8px rgba(0, 112, 173, 0.15)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.borderColor = 'var(--accent-cyan)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
          }}
        >
          {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
        </button>

        <button
          onClick={onOpenLoginModal}
          title={`User Login & Policy Enforcement Access (${currentUser?.username || 'admin'} - ${currentUser?.role || 'admin'})`}
          style={{
            position: 'relative',
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            outline: 'none',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
            e.currentTarget.style.borderColor = 'var(--accent-indigo)';
            e.currentTarget.style.color = 'var(--accent-indigo)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <Settings size={20} />
          
          {/* User Role Micro-Badge */}
          <span style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            fontSize: '11px',
            lineHeight: 1,
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '50%',
            padding: '1px',
            border: '1px solid var(--border-subtle)'
          }}>
            {roleEmoji}
          </span>
        </button>
      </div>
    </div>
  );
}
