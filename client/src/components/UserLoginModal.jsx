import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Lock, 
  Key, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  LogIn, 
  UserPlus, 
  X,
  ChevronRight
} from 'lucide-react';
import { loginUser, registerUser, switchUser } from '../services/api';

export default function UserLoginModal({ currentUser, onUserChanged, onClose }) {
  const [activeTab, setActiveTab] = useState('quick_switch'); // 'quick_switch' | 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('developer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const quickUsers = [
    {
      username: 'admin',
      pass: 'admin123',
      name: 'Enterprise Platform & SecOps Admin',
      role: 'admin',
      avatar: '👑',
      badgeColor: '#ec4899',
      desc: 'Full Autonomy. Can edit all agents & prompts, modify global policies, and approve privileged actions.'
    },
    {
      username: 'lead_dev',
      pass: 'lead123',
      name: 'Lead System Architect',
      role: 'lead',
      avatar: '📐',
      badgeColor: '#8b5cf6',
      desc: 'Can edit agent system prompts, formulate AutoGen swarms, ingest RAG knowledge, and review HITL requests.'
    },
    {
      username: 'developer',
      pass: 'dev123',
      name: 'Senior Full-Stack Engineer',
      role: 'developer',
      avatar: '💻',
      badgeColor: '#3b82f6',
      desc: 'Standard pair-programming with Willow. Terminal commands & file writes require review.'
    },
    {
      username: 'viewer',
      pass: 'viewer123',
      name: 'Security & Compliance Auditor',
      role: 'viewer',
      avatar: '👁️',
      badgeColor: '#10b981',
      desc: 'Read-only access. Cannot edit agents or execute filesystem/terminal modifying tools.'
    }
  ];

  const handleQuickSwitch = async (qu) => {
    try {
      setLoading(true);
      setError(null);
      const res = await loginUser(qu.username, qu.pass);
      setSuccessMsg(`Switched identity to ${res.user.name} (${res.user.role.toUpperCase()})`);
      onUserChanged(res.user);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await loginUser(username.trim(), password.trim());
      setSuccessMsg(`Welcome back, ${res.user.name}!`);
      onUserChanged(res.user);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    try {
      setLoading(true);
      setError(null);
      const res = await registerUser({
        username: username.trim(),
        password: password.trim(),
        name: name.trim() || username.trim(),
        role
      });
      setSuccessMsg(`Account created for ${res.user.name}!`);
      onUserChanged(res.user);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000, overflowY: 'auto' }}>
      <div className="modal-card" style={{ maxWidth: '620px', width: '92%', maxHeight: 'calc(100vh - 32px)', padding: '24px', overflowY: 'auto', margin: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <ShieldCheck size={22} color="#818cf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#fff' }}>
                Identity & Access Control (RBAC)
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                User authentication and role-based policy enforcement
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Current User Card */}
        {currentUser && (
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}>
                {currentUser.role === 'admin' ? '👑' : currentUser.role === 'lead' ? '📐' : currentUser.role === 'viewer' ? '👁️' : '💻'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                  {currentUser.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(@{currentUser.username})</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Active Policy: {currentUser.role === 'admin' ? 'High Autonomy (Admin)' : currentUser.role === 'viewer' ? 'Sandbox Strict (Read-Only)' : 'Human-in-the-Loop Review'}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.2)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              fontWeight: 600,
              textTransform: 'uppercase'
            }}>
              {currentUser.role}
            </span>
          </div>
        )}

        {/* Feedback Alerts */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#f87171',
            fontSize: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#34d399',
            fontSize: '12px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={16} />
            {successMsg}
          </div>
        )}

        {/* Sub-tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('quick_switch')}
            style={{
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'quick_switch' ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === 'quick_switch' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Enterprise Roles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'login' ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === 'login' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Sign In (User & Pass)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              padding: '8px 14px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'register' ? '2px solid #818cf8' : '2px solid transparent',
              color: activeTab === 'register' ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Register User
          </button>
        </div>

        {/* TAB 1: Enterprise Quick Role Switcher */}
        {activeTab === 'quick_switch' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 4px 0' }}>
              Select an enterprise role below to switch identities with verified pre-configured credentials:
            </p>
            {quickUsers.map((qu) => {
              const isCurrent = currentUser?.username === qu.username;
              return (
                <div
                  key={qu.username}
                  onClick={() => !loading && handleQuickSwitch(qu)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: isCurrent ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid',
                    borderColor: isCurrent ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                    cursor: loading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCurrent) e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCurrent) e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '22px' }}>{qu.avatar}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                          {qu.name}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: `${qu.badgeColor}22`,
                          color: qu.badgeColor,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {qu.role}
                        </span>
                        {isCurrent && (
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                            (Active)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {qu.desc}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ID: <code style={{ color: '#93c5fd' }}>{qu.username}</code> • Pass: <code style={{ color: '#93c5fd' }}>{qu.pass}</code>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 2: Manual Login */}
        {activeTab === 'login' && (
          <form onSubmit={handleManualLogin}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                User ID / Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or developer"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
                <UserCheck size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
                <Lock size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !username.trim() || !password.trim()}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <LogIn size={15} />
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* TAB 3: Register */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  User ID / Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. dev_sarah"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Full Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                  Access Role Level
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  <option value="developer">Developer (Standard SDLC)</option>
                  <option value="lead">Lead Architect (Agent Editor)</option>
                  <option value="admin">Administrator (Full Autonomy)</option>
                  <option value="viewer">Viewer (Read-Only)</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading || !username.trim() || !password.trim()}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <UserPlus size={15} />
              {loading ? 'Creating Account...' : 'Register User Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
