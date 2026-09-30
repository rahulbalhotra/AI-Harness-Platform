import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  MessageSquare, 
  Cpu, 
  Wrench, 
  ShieldCheck, 
  Send, 
  Check, 
  ArrowRight,
  Filter,
  Code2,
  Play,
  History,
  RotateCcw,
  FileText,
  Layers,
  Lock,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  chatCreateAgent, 
  createAgent, 
  deleteAgent, 
  updateAgent,
  getAgentVersions,
  rollbackAgentVersion
} from '../services/api';

export default function AgentStudio({ 
  agents, 
  models, 
  tools, 
  onSelectAgentForChat, 
  onRefreshAgents,
  currentUser = null 
}) {
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'chat_creator' | 'manual_creator'
  const [selectedStage, setSelectedStage] = useState('ALL');
  
  // Agent Editing & Version Tracking state
  const [editingAgent, setEditingAgent] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [agentVersions, setAgentVersions] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState('prompt'); // 'prompt' | 'versions'
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [expandedPromptVersion, setExpandedPromptVersion] = useState(null);

  // Chat-to-Agent state
  const [chatPrompt, setChatPrompt] = useState('');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizedResult, setSynthesizedResult] = useState(null);
  const [creationSuccess, setCreationSuccess] = useState(false);

  // Manual Agent Form state
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: '',
    sdlcStage: 'Development & Coding',
    avatar: '🤖',
    modelId: models[0]?.id || 'gemini-3.8-flash',
    autonomyPolicy: 'request-review',
    temperature: 0.2,
    maxIterations: 10,
    systemPrompt: '',
    tools: ['read_file', 'list_directory', 'grep_search']
  });

  const stages = [
    'ALL',
    'Architecture & Design',
    'Development & Coding',
    'Testing & Verification',
    'Security & Compliance',
    'DevOps & CI/CD',
    'Code Review & PR'
  ];

  const filteredAgents = selectedStage === 'ALL' 
    ? agents 
    : agents.filter(a => a.sdlcStage === selectedStage);

  // Handle Conversational Agent Synthesis ("Chat to Create Agent")
  const handleSynthesize = async (e) => {
    e?.preventDefault();
    if (!chatPrompt.trim() || isSynthesizing) return;
    setIsSynthesizing(true);
    setSynthesizedResult(null);
    setCreationSuccess(false);

    try {
      const res = await chatCreateAgent(chatPrompt);
      setSynthesizedResult(res);
    } catch (err) {
      alert('Error creating agent: ' + err.message);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleSaveSynthesizedAgent = async () => {
    if (!synthesizedResult?.agent) return;
    try {
      await createAgent(synthesizedResult.agent);
      setCreationSuccess(true);
      onRefreshAgents();
      setTimeout(() => {
        setActiveTab('catalog');
        setSynthesizedResult(null);
        setCreationSuccess(false);
        setChatPrompt('');
      }, 1200);
    } catch (err) {
      alert('Failed to save agent: ' + err.message);
    }
  };

  const handleDeleteAgent = async (agentId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this agent from the harness?')) return;
    try {
      await deleteAgent(agentId);
      onRefreshAgents();
    } catch (err) {
      alert(err.message);
    }
  };

  // Open Edit Modal & Fetch Version History
  const handleOpenEditModal = async (agent, e) => {
    e?.stopPropagation();
    setEditingAgent(agent);
    setEditForm({
      name: agent.name || '',
      role: agent.role || '',
      sdlcStage: agent.sdlcStage || 'Development & Coding',
      avatar: agent.avatar || '🤖',
      modelId: agent.modelId || models[0]?.id || 'gemini-3.8-flash',
      autonomyPolicy: agent.autonomyPolicy || 'request-review',
      temperature: agent.temperature ?? 0.2,
      maxIterations: agent.maxIterations || 10,
      systemPrompt: agent.systemPrompt || '',
      tools: agent.tools ? [...agent.tools] : [],
      changeSummary: ''
    });
    setSaveFeedback(null);
    setExpandedPromptVersion(null);
    setShowEditModal(true);
    setActiveEditTab('prompt');

    try {
      const versions = await getAgentVersions(agent.id);
      setAgentVersions(versions);
    } catch (err) {
      console.error('Failed to load agent versions:', err);
    }
  };

  // Save Agent System Prompt & Config -> increments version
  const handleSaveAgentEdits = async (e) => {
    e?.preventDefault();
    if (!editingAgent) return;

    if (currentUser?.role === 'viewer') {
      alert("⚠️ Read-Only Policy: Your account has 'Viewer' role. Modifying agent system prompts is prohibited by Enterprise RBAC.");
      return;
    }

    setIsSaving(true);
    setSaveFeedback(null);

    try {
      const payload = {
        ...editForm,
        author: currentUser?.username || 'admin'
      };
      const res = await updateAgent(editingAgent.id, payload);
      const updatedAgent = res.agent || res;
      setEditingAgent(updatedAgent);
      setSaveFeedback({ 
        success: true, 
        message: `Agent updated successfully! New version v${updatedAgent.version || (editingAgent.version + 1)} recorded in registry.` 
      });

      // Reload versions and catalog
      const versions = await getAgentVersions(editingAgent.id);
      setAgentVersions(versions);
      onRefreshAgents();
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      setSaveFeedback({ 
        success: false, 
        message: err.message || 'Failed to update agent' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Rollback Agent to a previous version
  const handleRollbackVersion = async (targetVersion) => {
    if (!editingAgent) return;

    if (currentUser?.role === 'viewer') {
      alert("⚠️ Read-Only Policy: Your account has 'Viewer' role. Version rollback is restricted under Enterprise RBAC.");
      return;
    }

    const confirmMsg = `Are you sure you want to rollback "${editingAgent.name}" to Version v${targetVersion}?\nThis will restore its exact system prompt and configuration.`;
    if (!confirm(confirmMsg)) return;

    setIsRollingBack(true);
    setSaveFeedback(null);

    try {
      const res = await rollbackAgentVersion(editingAgent.id, targetVersion);
      const rolledBackAgent = res.agent || res;
      setEditingAgent(rolledBackAgent);
      setEditForm({
        name: rolledBackAgent.name || '',
        role: rolledBackAgent.role || '',
        sdlcStage: rolledBackAgent.sdlcStage || 'Development & Coding',
        avatar: rolledBackAgent.avatar || '🤖',
        modelId: rolledBackAgent.modelId || models[0]?.id || 'gemini-3.8-flash',
        autonomyPolicy: rolledBackAgent.autonomyPolicy || 'request-review',
        temperature: rolledBackAgent.temperature ?? 0.2,
        maxIterations: rolledBackAgent.maxIterations || 10,
        systemPrompt: rolledBackAgent.systemPrompt || '',
        tools: rolledBackAgent.tools ? [...rolledBackAgent.tools] : [],
        changeSummary: `Rolled back to v${targetVersion}`
      });

      setSaveFeedback({ 
        success: true, 
        message: `Rollback successful! Restored prompt from v${targetVersion} as current active version v${rolledBackAgent.version}.` 
      });

      const versions = await getAgentVersions(editingAgent.id);
      setAgentVersions(versions);
      onRefreshAgents();
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err) {
      alert('Rollback error: ' + err.message);
    } finally {
      setIsRollingBack(false);
    }
  };

  const toggleEditToolSelection = (toolId) => {
    setEditForm(prev => {
      const has = prev.tools.includes(toolId);
      return {
        ...prev,
        tools: has ? prev.tools.filter(t => t !== toolId) : [...prev.tools, toolId]
      };
    });
  };

  const handleCreateManualAgent = async (e) => {
    e.preventDefault();
    try {
      await createAgent(newAgent);
      onRefreshAgents();
      setActiveTab('catalog');
      setNewAgent({
        name: '',
        role: '',
        sdlcStage: 'Development & Coding',
        avatar: '🤖',
        modelId: models[0]?.id || 'gemini-3.8-flash',
        autonomyPolicy: 'request-review',
        temperature: 0.2,
        maxIterations: 10,
        systemPrompt: '',
        tools: ['read_file', 'list_directory', 'grep_search']
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleToolSelection = (toolId) => {
    setNewAgent(prev => {
      const has = prev.tools.includes(toolId);
      return {
        ...prev,
        tools: has ? prev.tools.filter(t => t !== toolId) : [...prev.tools, toolId]
      };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header */}
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
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.3)'
          }}>
            <Bot size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Agent Hub & Dynamic Creator
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Select, configure, or dynamically synthesize autonomous SDLC agents using natural language.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}>
          <button
            onClick={() => setActiveTab('catalog')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'catalog' ? 'var(--accent-indigo)' : 'transparent',
              color: activeTab === 'catalog' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Agent Catalog ({agents.length})
          </button>
          <button
            onClick={() => setActiveTab('chat_creator')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'chat_creator' ? 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)' : 'transparent',
              color: activeTab === 'chat_creator' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Sparkles size={14} />
            Chat to Create Agent
          </button>
          <button
            onClick={() => setActiveTab('manual_creator')}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: activeTab === 'manual_creator' ? 'var(--accent-indigo)' : 'transparent',
              color: activeTab === 'manual_creator' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            <Plus size={14} />
            Manual Config
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        
        {/* ================= VIEW 1: AGENT CATALOG ================= */}
        {activeTab === 'catalog' && (
          <div>
            {/* Stage Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={13} /> Stage:
              </span>
              {stages.map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStage(st)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: selectedStage === st ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                    background: selectedStage === st ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    color: selectedStage === st ? '#a5b4fc' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Agent Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '18px'
            }}>
              {filteredAgents.map((agent) => {
                const model = models.find(m => m.id === agent.modelId);
                return (
                  <div
                    key={agent.id}
                    className="glass-panel"
                    style={{
                      borderRadius: '12px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    onClick={() => onSelectAgentForChat(agent.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Header: Avatar, Name, Stage */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          fontSize: '24px',
                          width: '44px',
                          height: '44px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {agent.avatar || '🤖'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {agent.name}
                            </h3>
                            {agent.isBuiltin && (
                              <span className="badge badge-indigo">Core</span>
                            )}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>
                            {agent.role}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Edit Agent, System Prompt & Version History"
                          onClick={(e) => handleOpenEditModal(agent, e)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.12)',
                            border: '1px solid rgba(99, 102, 241, 0.35)',
                            color: '#a5b4fc',
                            cursor: 'pointer',
                            padding: '4px 9px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 500,
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                            e.currentTarget.style.color = '#a5b4fc';
                          }}
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>

                        {!agent.isBuiltin && (
                          <button
                            title="Delete Agent"
                            onClick={(e) => handleDeleteAgent(agent.id, e)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stage & Policy Chips */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span className="badge badge-purple" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <History size={10} /> v{agent.version || 1}
                      </span>
                      <span className="badge badge-cyan" style={{ fontSize: '10px' }}>
                        {agent.sdlcStage}
                      </span>
                      <span className={agent.autonomyPolicy === 'always-proceed' ? 'badge badge-emerald' : 'badge badge-amber'} style={{ fontSize: '10px' }}>
                        <ShieldCheck size={10} /> {agent.autonomyPolicy}
                      </span>
                      <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                        <Cpu size={10} /> {model?.name || agent.modelId}
                      </span>
                    </div>

                    {/* System Prompt snippet */}
                    <p style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.4',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {agent.systemPrompt}
                    </p>

                    {/* Tool Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <Wrench size={12} color="var(--text-muted)" />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tools:</span>
                      {agent.tools?.slice(0, 3).map(tid => (
                        <span key={tid} style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          padding: '1px 6px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '4px',
                          color: 'var(--text-secondary)'
                        }}>
                          {tid}
                        </span>
                      ))}
                      {(agent.tools?.length || 0) > 3 && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          +{agent.tools.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Bottom Launch Button */}
                    <div style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: '10px',
                      marginTop: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Max Loops: {agent.maxIterations || 10}
                      </span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px', gap: '4px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectAgentForChat(agent.id);
                        }}
                      >
                        <Play size={12} /> Launch Pair Session
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= VIEW 2: CHAT TO CREATE AGENT ================= */}
        {activeTab === 'chat_creator' && (
          <div style={{ maxWidth: '820px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.3)',
              borderRadius: '12px',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={22} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Conversational Agent Synthesis Studio
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Describe your ideal SDLC specialist in plain English. The harness synthesizes its persona, selects the best model, assigns minimal-privilege tools, and builds the agent.
                  </p>
                </div>
              </div>

              {/* Input Area */}
              <form onSubmit={handleSynthesize} style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <input
                  type="text"
                  placeholder="e.g. Build an expert Kubernetes Helm chart & container security auditor with DeepSeek R1 and strict review policy..."
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: '14px',
                    backgroundColor: 'rgba(10, 13, 20, 0.8)',
                    borderColor: 'rgba(168, 85, 247, 0.4)'
                  }}
                  disabled={isSynthesizing}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    padding: '0 20px',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)'
                  }}
                  disabled={isSynthesizing || !chatPrompt.trim()}
                >
                  {isSynthesizing ? 'Synthesizing...' : <><Send size={16} /> Synthesize Agent</>}
                </button>
              </form>

              {/* Prompt Suggestions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Examples:</span>
                {[
                  'PostgreSQL Migration & Prisma Indexing Specialist',
                  'Playwright & Vitest Automated QA Synthesizer with Gemini 3.8 Flash',
                  'Strict OWASP Top-10 & Secret Leak Auditor with DeepSeek R1',
                  'GraphQL Schema Stitching & Performance Architect with Claude 3.7'
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setChatPrompt(sample)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '12px',
                      padding: '3px 10px',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Synthesized Preview Card */}
            {synthesizedResult && (
              <div className="glass-panel-elevated animate-fade-in" style={{ borderRadius: '12px', padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '32px' }}>{synthesizedResult.agent.avatar}</span>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {synthesizedResult.agent.name}
                      </h3>
                      <span style={{ fontSize: '13px', color: 'var(--accent-cyan)' }}>
                        {synthesizedResult.agent.role} &bull; {synthesizedResult.agent.sdlcStage}
                      </span>
                    </div>
                  </div>
                  <span className="badge badge-emerald">Ready for Deployment</span>
                </div>

                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}>
                  <strong>Synthesis Rationale:</strong> {synthesizedResult.rationale}
                </div>

                {/* Agent Properties Matrix */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Model</span>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-indigo)', marginTop: '2px' }}>
                      {synthesizedResult.agent.modelId}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Governance Policy</span>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-amber)', marginTop: '2px' }}>
                      {synthesizedResult.agent.autonomyPolicy}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Max Autonomous Loops</span>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {synthesizedResult.agent.maxIterations} steps
                    </div>
                  </div>
                </div>

                {/* System Prompt View */}
                <div style={{ marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Synthesized System Instructions:
                  </span>
                  <pre style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {synthesizedResult.agent.systemPrompt}
                  </pre>
                </div>

                {/* Assigned Tools */}
                <div style={{ marginBottom: '24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                    Tool Permissions:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {synthesizedResult.agent.tools.map(t => (
                      <span key={t} className="badge badge-cyan">
                        <Wrench size={10} /> {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Save or cancel buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSynthesizedResult(null)}
                  >
                    Discard
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveSynthesizedAgent}
                    disabled={creationSuccess}
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    {creationSuccess ? <><Check size={16} /> Agent Saved & Activated!</> : <><Plus size={16} /> Add to Harness Registry</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= VIEW 3: MANUAL FORM CREATOR ================= */}
        {activeTab === 'manual_creator' && (
          <form onSubmit={handleCreateManualAgent} style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="glass-panel-elevated" style={{ borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Configure Custom SDLC Agent
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SRE Incident Responder"
                    value={newAgent.name}
                    onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Specialist Role *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Observability & Root-Cause Analyst"
                    value={newAgent.role}
                    onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    SDLC Stage
                  </label>
                  <select
                    value={newAgent.sdlcStage}
                    onChange={(e) => setNewAgent({ ...newAgent, sdlcStage: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {stages.filter(s => s !== 'ALL').map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Model Backbone
                  </label>
                  <select
                    value={newAgent.modelId}
                    onChange={(e) => setNewAgent({ ...newAgent, modelId: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    {models.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Governance Policy
                  </label>
                  <select
                    value={newAgent.autonomyPolicy}
                    onChange={(e) => setNewAgent({ ...newAgent, autonomyPolicy: e.target.value })}
                    style={{ width: '100%' }}
                  >
                    <option value="request-review">request-review (Recommended)</option>
                    <option value="always-proceed">always-proceed (Autonomous)</option>
                    <option value="sandbox-strict">sandbox-strict (Dry-run)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  System Prompt & Personas
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="You are an autonomous engineer specialized in..."
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Tools selection */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Assign Tools & Capabilities:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {tools.map(tool => {
                    const isSelected = newAgent.tools.includes(tool.id);
                    return (
                      <div
                        key={tool.id}
                        onClick={() => toggleToolSelection(tool.id)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isSelected ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {tool.name}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            {tool.id}
                          </div>
                        </div>
                        {isSelected && <Check size={16} color="var(--accent-indigo)" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveTab('catalog')}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={15} /> Create & Register Agent
                </button>
              </div>
            </div>
          </form>
        )}

      </div>

      {/* ================= EDIT AGENT & SYSTEM PROMPT VERSIONING MODAL ================= */}
      {showEditModal && editingAgent && editForm && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '860px',
              maxHeight: '92vh',
              backgroundColor: '#0d1117',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(255, 255, 255, 0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  fontSize: '26px',
                  width: '46px',
                  height: '46px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                  {editForm.avatar || '🤖'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Edit Agent: {editingAgent.name}
                    </h2>
                    <span className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <History size={11} /> v{editingAgent.version || 1}
                    </span>
                    {editingAgent.isBuiltin && (
                      <span className="badge badge-indigo">Core Agent</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Configure agent parameters and modify version-tracked system prompts in PostgreSQL.
                  </p>
                </div>
              </div>

              {/* Tab Switcher & Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  display: 'flex',
                  backgroundColor: 'rgba(0, 0, 0, 0.4)',
                  padding: '3px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <button
                    type="button"
                    onClick={() => setActiveEditTab('prompt')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: activeEditTab === 'prompt' ? 'var(--accent-indigo)' : 'transparent',
                      color: activeEditTab === 'prompt' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    <Edit3 size={13} />
                    Configuration & Prompt
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditTab('versions')}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: activeEditTab === 'versions' ? 'var(--accent-indigo)' : 'transparent',
                      color: activeEditTab === 'versions' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    <History size={13} />
                    Version History ({agentVersions.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* RBAC Viewer Alert Banner */}
            {currentUser?.role === 'viewer' && (
              <div style={{
                padding: '10px 20px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fca5a5',
                fontSize: '12px'
              }}>
                <Lock size={14} color="#f87171" />
                <span>
                  <strong>Enterprise RBAC Policy Enforcement:</strong> Logged in as <strong>Viewer</strong>. You have read-only permissions and cannot modify system prompts or execute version rollbacks.
                </span>
              </div>
            )}

            {/* Save / Rollback Feedback Alert */}
            {saveFeedback && (
              <div style={{
                padding: '10px 20px',
                backgroundColor: saveFeedback.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                borderBottom: '1px solid',
                borderColor: saveFeedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: saveFeedback.success ? '#6ee7b7' : '#fca5a5',
                fontSize: '12px'
              }}>
                {saveFeedback.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{saveFeedback.message}</span>
              </div>
            )}

            {/* Modal Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              
              {/* TAB 1: EDIT FORM & SYSTEM PROMPT */}
              {activeEditTab === 'prompt' && (
                <form onSubmit={handleSaveAgentEdits} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Name and Role */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Agent Display Name
                      </label>
                      <input
                        type="text"
                        required
                        disabled={currentUser?.role === 'viewer'}
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Specialized Role
                      </label>
                      <input
                        type="text"
                        required
                        disabled={currentUser?.role === 'viewer'}
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Stage and Autonomy Policy */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        SDLC Lifecycle Stage
                      </label>
                      <select
                        value={editForm.sdlcStage}
                        disabled={currentUser?.role === 'viewer'}
                        onChange={(e) => setEditForm({ ...editForm, sdlcStage: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        {stages.filter(s => s !== 'ALL').map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Autonomy Governance Policy
                      </label>
                      <select
                        value={editForm.autonomyPolicy}
                        disabled={currentUser?.role === 'viewer'}
                        onChange={(e) => setEditForm({ ...editForm, autonomyPolicy: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="request-review">request-review (HITL Approval Required)</option>
                        <option value="always-proceed">always-proceed (Autonomous Execution)</option>
                      </select>
                    </div>
                  </div>

                  {/* Model Selector & Temperature */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Foundation LLM Engine
                      </label>
                      <select
                        value={editForm.modelId}
                        disabled={currentUser?.role === 'viewer'}
                        onChange={(e) => setEditForm({ ...editForm, modelId: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        {models.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.provider})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          Temperature (Creativity):
                        </label>
                        <span style={{ fontSize: '12px', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                          {editForm.temperature}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        disabled={currentUser?.role === 'viewer'}
                        value={editForm.temperature}
                        onChange={(e) => setEditForm({ ...editForm, temperature: parseFloat(e.target.value) })}
                        style={{ width: '100%', accentColor: 'var(--accent-indigo)' }}
                      />
                    </div>
                  </div>

                  {/* System Prompt Editor with Monospace Styling */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} color="var(--accent-indigo)" />
                        System Prompt & Personas (Version-Tracked)
                      </label>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {editForm.systemPrompt?.length || 0} characters • {editForm.systemPrompt?.split('\n').length || 0} lines
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Defines agent instructions, reasoning rules, and tool invocation constraints. Modifying this prompt will increment version to <strong>v{(editingAgent.version || 1) + 1}</strong>.
                    </p>
                    <textarea
                      rows={9}
                      required
                      disabled={currentUser?.role === 'viewer'}
                      value={editForm.systemPrompt}
                      onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                      style={{
                        width: '100%',
                        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '12px',
                        color: '#e2e8f0',
                        resize: 'vertical'
                      }}
                      placeholder="Enter detailed agent instructions..."
                    />
                  </div>

                  {/* Version Change Summary Input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Change Summary / Version Note
                    </label>
                    <input
                      type="text"
                      disabled={currentUser?.role === 'viewer'}
                      value={editForm.changeSummary}
                      onChange={(e) => setEditForm({ ...editForm, changeSummary: e.target.value })}
                      placeholder="e.g. Updated system prompt for strict unit test generation and validation"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Tools Selection Checklist */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Permitted Agent Tools:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                      {tools.map(tool => {
                        const isSelected = editForm.tools.includes(tool.id);
                        return (
                          <div
                            key={tool.id}
                            onClick={() => {
                              if (currentUser?.role !== 'viewer') {
                                toggleEditToolSelection(tool.id);
                              }
                            }}
                            style={{
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--accent-indigo)' : 'var(--border-subtle)',
                              background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: currentUser?.role === 'viewer' ? 'not-allowed' : 'pointer',
                              opacity: currentUser?.role === 'viewer' ? 0.7 : 1
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {tool.name}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {tool.id}
                              </div>
                            </div>
                            {isSelected && <Check size={16} color="var(--accent-indigo)" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modal Action Buttons */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '12px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Author: <strong>{currentUser?.username || 'admin'}</strong> ({currentUser?.role || 'admin'}) • Target Version: <strong>v{(editingAgent.version || 1) + 1}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowEditModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={currentUser?.role === 'viewer' || isSaving}
                      >
                        {isSaving ? 'Saving Version...' : `Save & Increment Version (v${(editingAgent.version || 1) + 1})`}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: VERSION HISTORY & ROLLBACK */}
              {activeEditTab === 'versions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Audit Trail & System Prompt Versions
                      </h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Historical snapshots preserved in database. You can rollback to any prior prompt version.
                      </p>
                    </div>
                    <span className="badge badge-purple">
                      {agentVersions.length} Recorded Snapshots
                    </span>
                  </div>

                  {agentVersions.length === 0 ? (
                    <div style={{
                      padding: '30px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '10px',
                      border: '1px dashed var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      No previous versions logged yet. Edits made in the Configuration tab will create new version snapshots.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {agentVersions.map((ver) => {
                        const isCurrentActive = ver.versionNumber === editingAgent.version;
                        const isExpanded = expandedPromptVersion === ver.versionNumber;

                        return (
                          <div
                            key={ver.id || ver.versionNumber}
                            style={{
                              padding: '14px 16px',
                              borderRadius: '10px',
                              backgroundColor: isCurrentActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                              border: '1px solid',
                              borderColor: isCurrentActive ? 'rgba(99, 102, 241, 0.4)' : 'var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            {/* Version summary row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="badge badge-purple" style={{ fontSize: '12px', fontWeight: 700 }}>
                                  v{ver.versionNumber}
                                </span>
                                {isCurrentActive && (
                                  <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                                    Active Version
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                  {ver.changeSummary || 'System prompt updated'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {ver.timestamp ? new Date(ver.timestamp).toLocaleString() : 'Recent'}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--accent-indigo)' }}>
                                  by {ver.author || 'admin'}
                                </span>
                              </div>
                            </div>

                            {/* Metadata tags & actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                                  Model: {ver.modelId || editingAgent.modelId}
                                </span>
                                <span className="badge badge-cyan" style={{ fontSize: '10px' }}>
                                  Policy: {ver.autonomyPolicy || editingAgent.autonomyPolicy}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Prompt: {ver.systemPrompt ? `${ver.systemPrompt.length} chars` : 'Standard'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedPromptVersion(isExpanded ? null : ver.versionNumber)}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  {isExpanded ? <EyeOff size={12} /> : <Eye size={12} />}
                                  {isExpanded ? 'Hide Prompt' : 'Preview Prompt'}
                                </button>

                                <button
                                  type="button"
                                  disabled={isCurrentActive || currentUser?.role === 'viewer' || isRollingBack}
                                  onClick={() => handleRollbackVersion(ver.versionNumber)}
                                  style={{
                                    background: isCurrentActive ? 'transparent' : 'rgba(245, 158, 11, 0.15)',
                                    border: '1px solid',
                                    borderColor: isCurrentActive ? 'transparent' : 'rgba(245, 158, 11, 0.4)',
                                    color: isCurrentActive ? 'var(--text-muted)' : '#fcd34d',
                                    cursor: (isCurrentActive || currentUser?.role === 'viewer') ? 'not-allowed' : 'pointer',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <RotateCcw size={12} />
                                  {isCurrentActive ? 'Currently Active' : `Rollback to v${ver.versionNumber}`}
                                </button>
                              </div>
                            </div>

                            {/* Collapsible Prompt Preview */}
                            {isExpanded && (
                              <div style={{
                                marginTop: '6px',
                                padding: '12px',
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                              }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>System Prompt Snapshot for v{ver.versionNumber}:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(ver.systemPrompt || '');
                                      alert('Prompt copied to clipboard');
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--accent-indigo)',
                                      cursor: 'pointer',
                                      fontSize: '11px'
                                    }}
                                  >
                                    Copy Prompt
                                  </button>
                                </div>
                                <pre style={{
                                  fontSize: '11px',
                                  fontFamily: 'Consolas, Monaco, monospace',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  color: '#cbd5e1',
                                  maxHeight: '160px',
                                  overflowY: 'auto',
                                  margin: 0
                                }}>
                                  {ver.systemPrompt || '(Empty prompt snapshot)'}
                                </pre>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
