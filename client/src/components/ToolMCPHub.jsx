import React, { useState } from 'react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  Terminal, 
  FileCode, 
  Shield, 
  Search, 
  RefreshCw,
  ExternalLink,
  Edit3,
  Lock,
  X,
  Sliders,
  Check,
  History,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  addTool, 
  updateTool,
  toggleTool, 
  deleteTool, 
  executeToolDirectly, 
  getMCPServers, 
  addMCPServer, 
  deleteMCPServer,
  getToolVersions,
  rollbackToolVersion
} from '../services/api';

export default function ToolMCPHub({ 
  tools, 
  mcpServers, 
  onRefreshTools, 
  onRefreshMCP,
  currentUser = null 
}) {
  const [activeTab, setActiveTab] = useState('tools'); // 'tools' | 'mcp' | 'tester'
  const [showAddToolModal, setShowAddToolModal] = useState(false);
  const [showAddMCPModal, setShowAddMCPModal] = useState(false);
  
  // Tool editing & versioning state
  const [editingTool, setEditingTool] = useState(null);
  const [editToolForm, setEditToolForm] = useState(null);
  const [showEditToolModal, setShowEditToolModal] = useState(false);
  const [activeToolModalTab, setActiveToolModalTab] = useState('config'); // 'config' | 'versions'
  const [toolVersions, setToolVersions] = useState([]);
  const [isUpdatingTool, setIsUpdatingTool] = useState(false);
  const [isRollingBackTool, setIsRollingBackTool] = useState(false);
  const [toolFeedback, setToolFeedback] = useState(null);
  const [expandedVersionParam, setExpandedVersionParam] = useState(null);

  // Tool tester state
  const [testToolId, setTestToolId] = useState(tools[0]?.id || 'list_directory');
  const [testParams, setTestParams] = useState('{\n  "dirPath": "."\n}');
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  // New tool form
  const [newTool, setNewTool] = useState({
    id: '',
    name: '',
    category: 'custom',
    riskLevel: 'medium',
    requiresApproval: true,
    description: '',
    parameters: '{\n  "type": "object",\n  "properties": {\n    "query": { "type": "string" }\n  }\n}'
  });

  // New MCP server form
  const [newMCP, setNewMCP] = useState({
    id: '',
    name: '',
    transport: 'stdio',
    command: '',
    description: ''
  });

  const handleToggleTool = async (toolId, currentEnabled) => {
    try {
      await toggleTool(toolId, !currentEnabled);
      onRefreshTools();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTool = async (toolId) => {
    if (!confirm('Are you sure you want to delete this custom tool?')) return;
    try {
      await deleteTool(toolId);
      onRefreshTools();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOpenEditTool = async (tool, e) => {
    e?.stopPropagation();
    setEditingTool(tool);
    setEditToolForm({
      name: tool.name || '',
      description: tool.description || '',
      category: tool.category || 'custom',
      riskLevel: tool.riskLevel || 'medium',
      requiresApproval: !!tool.requiresApproval,
      enabled: tool.enabled !== undefined ? tool.enabled : true,
      parameters: typeof tool.parameters === 'object' ? JSON.stringify(tool.parameters, null, 2) : (tool.parameters || '{}'),
      changeSummary: ''
    });
    setToolFeedback(null);
    setExpandedVersionParam(null);
    setActiveToolModalTab('config');
    setShowEditToolModal(true);

    try {
      const versions = await getToolVersions(tool.id);
      setToolVersions(versions);
    } catch (err) {
      console.error('Failed to load tool versions:', err);
    }
  };

  const handleSaveToolEdit = async (e) => {
    e?.preventDefault();
    if (!editingTool) return;

    if (currentUser?.role === 'viewer') {
      alert("⚠️ Read-Only Policy: Your account has 'Viewer' role. Modifying tool definitions is prohibited by Enterprise RBAC.");
      return;
    }

    let parsedParameters;
    try {
      parsedParameters = JSON.parse(editToolForm.parameters);
    } catch (err) {
      alert('Parameters must be valid JSON: ' + err.message);
      return;
    }

    setIsUpdatingTool(true);
    setToolFeedback(null);

    try {
      const updated = await updateTool(editingTool.id, {
        name: editToolForm.name,
        description: editToolForm.description,
        category: editToolForm.category,
        riskLevel: editToolForm.riskLevel,
        requiresApproval: editToolForm.requiresApproval,
        enabled: editToolForm.enabled,
        parameters: parsedParameters,
        changeSummary: editToolForm.changeSummary || 'Tool specification and schema updated',
        author: currentUser?.username || 'admin'
      });
      setEditingTool(updated);
      setToolFeedback({ success: true, message: `Tool '${updated.name}' updated! Recorded as version v${updated.version || (editingTool.version + 1)}.` });
      onRefreshTools();
      const updatedVersions = await getToolVersions(editingTool.id);
      setToolVersions(updatedVersions);
      setTimeout(() => setToolFeedback(null), 3500);
    } catch (err) {
      setToolFeedback({ success: false, message: err.message || 'Failed to update tool' });
    } finally {
      setIsUpdatingTool(false);
    }
  };

  const handleRollbackTool = async (targetVersion) => {
    if (!editingTool) return;

    if (currentUser?.role === 'viewer') {
      alert("⚠️ Read-Only Policy: Your account has 'Viewer' role. Version rollback is prohibited by Enterprise RBAC.");
      return;
    }

    const confirmMsg = `Are you sure you want to rollback tool "${editingTool.name}" to Version v${targetVersion}?\nThis will restore its parameters schema, description, and policy settings.`;
    if (!confirm(confirmMsg)) return;

    setIsRollingBackTool(true);
    setToolFeedback(null);

    try {
      const res = await rollbackToolVersion(editingTool.id, targetVersion);
      const rolledBack = res.tool || res;
      setEditingTool(rolledBack);
      setEditToolForm({
        name: rolledBack.name || '',
        description: rolledBack.description || '',
        category: rolledBack.category || 'custom',
        riskLevel: rolledBack.riskLevel || 'medium',
        requiresApproval: !!rolledBack.requiresApproval,
        enabled: rolledBack.enabled !== undefined ? rolledBack.enabled : true,
        parameters: typeof rolledBack.parameters === 'object' ? JSON.stringify(rolledBack.parameters, null, 2) : (rolledBack.parameters || '{}'),
        changeSummary: `Rolled back to v${targetVersion}`
      });
      setToolFeedback({ success: true, message: `Successfully rolled back to v${targetVersion}! Active as v${rolledBack.version}.` });
      onRefreshTools();
      const versions = await getToolVersions(editingTool.id);
      setToolVersions(versions);
      setTimeout(() => setToolFeedback(null), 3500);
    } catch (err) {
      alert('Rollback failed: ' + err.message);
    } finally {
      setIsRollingBackTool(false);
    }
  };

  const handleAddTool = async (e) => {
    e.preventDefault();
    try {
      let parsedParams = {};
      try {
        parsedParams = JSON.parse(newTool.parameters);
      } catch (err) {
        alert('Parameters must be valid JSONSchema');
        return;
      }

      await addTool({
        ...newTool,
        parameters: parsedParams
      });
      onRefreshTools();
      setShowAddToolModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddMCP = async (e) => {
    e.preventDefault();
    try {
      await addMCPServer(newMCP);
      onRefreshMCP();
      setShowAddMCPModal(false);
      setNewMCP({ id: '', name: '', transport: 'stdio', command: '', description: '' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteMCP = async (serverId) => {
    if (!confirm('Disconnect this MCP server?')) return;
    try {
      await deleteMCPServer(serverId);
      onRefreshMCP();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRunToolTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      let parsed = {};
      if (testParams.trim()) {
        parsed = JSON.parse(testParams);
      }
      const res = await executeToolDirectly(testToolId, parsed);
      setTestResult(res);
    } catch (err) {
      setTestResult({ error: err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSelectToolForTesting = (tool) => {
    setTestToolId(tool.id);
    if (tool.id === 'read_file') {
      setTestParams('{\n  "filePath": "package.json"\n}');
    } else if (tool.id === 'grep_search') {
      setTestParams('{\n  "pattern": "Harness"\n}');
    } else if (tool.id === 'run_test_suite') {
      setTestParams('{\n  "testFilter": "all"\n}');
    } else if (tool.id === 'security_audit') {
      setTestParams('{\n  "targetPath": "."\n}');
    } else if (tool.id === 'git_status_diff') {
      setTestParams('{\n  "detailed": false\n}');
    } else if (tool.id === 'run_command') {
      setTestParams('{\n  "command": "node -v"\n}');
    } else {
      setTestParams('{\n  "dirPath": "."\n}');
    }
    setActiveTab('tester');
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
            background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.3)'
          }}>
            <Wrench size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Tools & Model Context Protocol (MCP) Hub
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Configure native SDLC tools, manage standard MCP servers, and test executions live.
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setActiveTab('tools')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'tools' ? 'var(--accent-indigo)' : 'transparent',
                color: activeTab === 'tools' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Native Tools ({tools.length})
            </button>
            <button
              onClick={() => setActiveTab('mcp')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'mcp' ? 'var(--accent-indigo)' : 'transparent',
                color: activeTab === 'mcp' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              MCP Servers ({mcpServers.length})
            </button>
            <button
              onClick={() => setActiveTab('tester')}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 500,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'tester' ? 'var(--accent-indigo)' : 'transparent',
                color: activeTab === 'tester' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              <Play size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Sandbox Runner
            </button>
          </div>

          {activeTab === 'tools' && (
            <button className="btn btn-primary" onClick={() => setShowAddToolModal(true)}>
              <Plus size={14} /> Register Custom Tool
            </button>
          )}

          {activeTab === 'mcp' && (
            <button className="btn btn-primary" onClick={() => setShowAddMCPModal(true)}>
              <Plus size={14} /> Connect MCP Server
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        
        {/* ================= TOOLS VIEW ================= */}
        {activeTab === 'tools' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 330px), 1fr))',
            gap: '16px'
          }}>
            {tools.map(tool => (
              <div
                key={tool.id}
                className="glass-panel"
                style={{
                  borderRadius: '12px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  border: '1px solid',
                  borderColor: tool.enabled ? 'var(--border-subtle)' : 'rgba(255, 255, 255, 0.03)',
                  opacity: tool.enabled ? 1 : 0.6
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {tool.name}
                      </h3>
                      {tool.isSystem && <span className="badge badge-indigo">Builtin</span>}
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: '2px' }}>
                      {tool.id}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      onClick={(e) => handleOpenEditTool(tool, e)}
                      title="Edit Tool Specification & Parameters"
                      style={{
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.35)',
                        color: '#a5b4fc',
                        cursor: 'pointer',
                        padding: '3px 8px',
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

                    <button
                      onClick={() => handleToggleTool(tool.id, tool.enabled)}
                      className={tool.enabled ? 'btn btn-success' : 'btn btn-secondary'}
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      {tool.enabled ? 'Active' : 'Disabled'}
                    </button>

                    {!tool.isSystem && (
                      <button
                        onClick={() => handleDeleteTool(tool.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {tool.description}
                </p>

                {/* Metadata Chips */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="badge badge-purple" style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <History size={10} /> v{tool.version || 1}
                  </span>
                  <span className="badge badge-cyan">
                    Category: {tool.category}
                  </span>
                  <span className={tool.riskLevel === 'high' ? 'badge badge-rose' : tool.riskLevel === 'medium' ? 'badge badge-amber' : 'badge badge-emerald'}>
                    Risk: {tool.riskLevel}
                  </span>
                  {tool.requiresApproval && (
                    <span className="badge badge-amber">Requires Approval</span>
                  )}
                </div>

                {/* Bottom Actions Row */}
                <div style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '10px',
                  marginTop: 'auto',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {tool.updatedAt ? `Edited: ${new Date(tool.updatedAt).toLocaleDateString()}` : (tool.isSystem ? 'Core Builtin' : 'Custom Extension')}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 9px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={(e) => handleOpenEditTool(tool, e)}
                    >
                      <Edit3 size={12} /> Edit
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 9px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => handleSelectToolForTesting(tool)}
                    >
                      <Play size={12} /> Test In Sandbox
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= MCP SERVERS VIEW ================= */}
        {activeTab === 'mcp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '18px'
            }}>
              {mcpServers.map(server => (
                <div
                  key={server.id}
                  className="glass-panel"
                  style={{
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-indigo)'
                      }}>
                        <Server size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {server.name}
                        </h3>
                        <div style={{ fontSize: '11px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="status-dot active" />
                          <span>Connected ({server.transport})</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteMCP(server.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {server.description}
                  </p>

                  {server.command && (
                    <div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Launch Command:</span>
                      <pre style={{ marginTop: '2px', fontSize: '11px', color: 'var(--accent-cyan)' }}>
                        {server.command}
                      </pre>
                    </div>
                  )}

                  {/* Discovered MCP Tools */}
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                      Exposed Tools ({server.tools?.length || 0}):
                    </span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {server.tools?.map(t => (
                        <span key={t.name} className="badge badge-indigo" title={t.description}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= SANDBOX RUNNER VIEW ================= */}
        {activeTab === 'tester' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel-elevated" style={{ borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Interactive Tool Execution Sandbox
                </h3>
                <span className="badge badge-cyan">Isolated Sandbox</span>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Select Target Tool:
                </label>
                <select
                  value={testToolId}
                  onChange={(e) => setTestToolId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {tools.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Execution Parameters (JSON):
                </label>
                <textarea
                  rows={5}
                  value={testParams}
                  onChange={(e) => setTestParams(e.target.value)}
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleRunToolTest}
                  disabled={isTesting}
                >
                  <Play size={15} /> {isTesting ? 'Executing Tool...' : 'Run Tool in Sandbox'}
                </button>
              </div>
            </div>

            {/* Test Results Output */}
            {testResult && (
              <div className="glass-panel animate-fade-in" style={{ borderRadius: '12px', padding: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Execution Response Telemetry:
                </h4>
                <pre style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal: Add Tool */}
      {showAddToolModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          overflowY: 'auto'
        }}>
          <form onSubmit={handleAddTool} className="glass-panel-elevated animate-fade-in" style={{
            width: '100%',
            maxWidth: '560px',
            maxHeight: 'calc(100vh - 32px)',
            maxHeight: 'calc(100dvh - 32px)',
            borderRadius: '12px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            margin: 'auto'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Register Custom Tool Definition
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Tool ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. generate_openapi_spec"
                  value={newTool.id}
                  onChange={(e) => setNewTool({ ...newTool, id: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Tool Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. OpenAPI Spec Generator"
                  value={newTool.name}
                  onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Risk Level
                </label>
                <select
                  value={newTool.riskLevel}
                  onChange={(e) => setNewTool({ ...newTool, riskLevel: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="low">Low (Safe Read)</option>
                  <option value="medium">Medium (Workspace Write)</option>
                  <option value="high">High (Terminal / Network)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Approval Policy
                </label>
                <select
                  value={newTool.requiresApproval}
                  onChange={(e) => setNewTool({ ...newTool, requiresApproval: e.target.value === 'true' })}
                  style={{ width: '100%' }}
                >
                  <option value="true">Require Human Approval</option>
                  <option value="false">Execute Autonomously</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                rows={2}
                placeholder="What this tool accomplishes for the agent..."
                value={newTool.description}
                onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                JSONSchema Parameters Specification
              </label>
              <textarea
                rows={4}
                value={newTool.parameters}
                onChange={(e) => setNewTool({ ...newTool, parameters: e.target.value })}
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddToolModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Register Tool
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Add MCP Server */}
      {showAddMCPModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          overflowY: 'auto'
        }}>
          <form onSubmit={handleAddMCP} className="glass-panel-elevated animate-fade-in" style={{
            width: '100%',
            maxWidth: '520px',
            maxHeight: 'calc(100vh - 32px)',
            maxHeight: 'calc(100dvh - 32px)',
            borderRadius: '12px',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            overflowY: 'auto',
            margin: 'auto'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Connect Model Context Protocol (MCP) Server
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Server ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. mcp-jira"
                  value={newMCP.id}
                  onChange={(e) => setNewMCP({ ...newMCP, id: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Server Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jira & Confluence MCP"
                  value={newMCP.name}
                  onChange={(e) => setNewMCP({ ...newMCP, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Launch Command (stdio)
              </label>
              <input
                type="text"
                placeholder="e.g. npx -y @modelcontextprotocol/server-jira"
                value={newMCP.command}
                onChange={(e) => setNewMCP({ ...newMCP, command: e.target.value })}
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                rows={2}
                placeholder="Purpose of this MCP server in SDLC..."
                value={newMCP.description}
                onChange={(e) => setNewMCP({ ...newMCP, description: e.target.value })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddMCPModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Connect MCP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= EDIT TOOL MODAL ================= */}
      {showEditToolModal && editingTool && editToolForm && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflowY: 'auto'
          }}
          onClick={() => setShowEditToolModal(false)}
        >
          <div 
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '780px',
              maxHeight: 'calc(100vh - 32px)',
              maxHeight: 'calc(100dvh - 32px)',
              backgroundColor: '#0d1117',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              margin: 'auto'
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <Wrench size={22} color="#10b981" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Edit Tool: {editingTool.name}
                    </h2>
                    <span className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <History size={11} /> v{editingTool.version || 1}
                    </span>
                    <span className="badge badge-cyan" style={{ fontFamily: 'var(--font-mono)' }}>
                      {editingTool.id}
                    </span>
                    {editingTool.isSystem ? (
                      <span className="badge badge-indigo">Builtin System Tool</span>
                    ) : (
                      <span className="badge badge-emerald">Custom Tool</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Configure tool specifications, parameters schema, and track version audit snapshots.
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
                    onClick={() => setActiveToolModalTab('config')}
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
                      background: activeToolModalTab === 'config' ? 'var(--accent-indigo)' : 'transparent',
                      color: activeToolModalTab === 'config' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    <Sliders size={13} />
                    Configuration & Schema
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveToolModalTab('versions')}
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
                      background: activeToolModalTab === 'versions' ? 'var(--accent-indigo)' : 'transparent',
                      color: activeToolModalTab === 'versions' ? '#fff' : 'var(--text-secondary)'
                    }}
                  >
                    <History size={13} />
                    Version History ({toolVersions.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditToolModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Viewer Notice */}
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
                  <strong>Enterprise RBAC Policy:</strong> Logged in as <strong>Viewer</strong>. You have read-only access and cannot save changes or rollback tool versions.
                </span>
              </div>
            )}

            {/* Feedback Alert */}
            {toolFeedback && (
              <div style={{
                padding: '10px 20px',
                backgroundColor: toolFeedback.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                borderBottom: '1px solid',
                borderColor: toolFeedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: toolFeedback.success ? '#6ee7b7' : '#fca5a5',
                fontSize: '12px'
              }}>
                {toolFeedback.success ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>{toolFeedback.message}</span>
              </div>
            )}

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              
              {/* TAB 1: TOOL CONFIGURATION & PARAMETERS */}
              {activeToolModalTab === 'config' && (
                <form onSubmit={handleSaveToolEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Row 1: Tool Name & Category */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Tool Display Name *
                      </label>
                      <input
                        type="text"
                        required
                        disabled={currentUser?.role === 'viewer'}
                        value={editToolForm.name}
                        onChange={(e) => setEditToolForm({ ...editToolForm, name: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Category
                      </label>
                      <select
                        disabled={currentUser?.role === 'viewer'}
                        value={editToolForm.category}
                        onChange={(e) => setEditToolForm({ ...editToolForm, category: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="custom">Custom Extension</option>
                        <option value="filesystem">Filesystem & Codebase</option>
                        <option value="terminal">Terminal & Shell</option>
                        <option value="git">Version Control & Git</option>
                        <option value="orchestration">Multi-Agent Orchestration</option>
                        <option value="security">Security & Hardening</option>
                        <option value="knowledge">Knowledge Base & RAG</option>
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Risk Level & Policy Enforcement */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Execution Risk Level
                      </label>
                      <select
                        disabled={currentUser?.role === 'viewer'}
                        value={editToolForm.riskLevel}
                        onChange={(e) => setEditToolForm({ ...editToolForm, riskLevel: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="low">Low Risk (Read-only operations)</option>
                        <option value="medium">Medium Risk (Standard file edits)</option>
                        <option value="high">High Risk (Shell execution, file delete)</option>
                        <option value="critical">Critical (Privileged system actions)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)', cursor: 'pointer', marginTop: '16px' }}>
                        <input
                          type="checkbox"
                          disabled={currentUser?.role === 'viewer'}
                          checked={editToolForm.requiresApproval}
                          onChange={(e) => setEditToolForm({ ...editToolForm, requiresApproval: e.target.checked })}
                          style={{ accentColor: 'var(--accent-indigo)' }}
                        />
                        <span><strong>Requires Human-In-The-Loop Approval</strong> (Triggers HITL review)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: '6px' }}>
                        <input
                          type="checkbox"
                          disabled={currentUser?.role === 'viewer'}
                          checked={editToolForm.enabled}
                          onChange={(e) => setEditToolForm({ ...editToolForm, enabled: e.target.checked })}
                          style={{ accentColor: 'var(--accent-emerald)' }}
                        />
                        <span>Tool Enabled in Harness</span>
                      </label>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Tool Purpose & Description (Supplied to LLM in Tool Calling Schema) *
                    </label>
                    <textarea
                      rows={3}
                      required
                      disabled={currentUser?.role === 'viewer'}
                      value={editToolForm.description}
                      onChange={(e) => setEditToolForm({ ...editToolForm, description: e.target.value })}
                      style={{ width: '100%', lineHeight: '1.4' }}
                      placeholder="Explains to the AI assistant when and how to invoke this tool..."
                    />
                  </div>

                  {/* Parameters Schema JSON */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Parameters Specification (JSONSchema) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(editToolForm.parameters);
                            setEditToolForm({ ...editToolForm, parameters: JSON.stringify(parsed, null, 2) });
                          } catch (err) {
                            alert('Invalid JSON: ' + err.message);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-indigo)',
                          cursor: 'pointer',
                          fontSize: '11px'
                        }}
                      >
                        Format JSON
                      </button>
                    </div>
                    <textarea
                      rows={7}
                      required
                      disabled={currentUser?.role === 'viewer'}
                      value={editToolForm.parameters}
                      onChange={(e) => setEditToolForm({ ...editToolForm, parameters: e.target.value })}
                      style={{
                        width: '100%',
                        fontFamily: 'Consolas, Monaco, monospace',
                        fontSize: '11px',
                        backgroundColor: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        padding: '10px',
                        color: '#cbd5e1'
                      }}
                      placeholder='{\n  "type": "object",\n  "properties": {}\n}'
                    />
                  </div>

                  {/* Change Summary / Version Note */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Version Change Summary / Commit Note
                    </label>
                    <input
                      type="text"
                      disabled={currentUser?.role === 'viewer'}
                      value={editToolForm.changeSummary}
                      onChange={(e) => setEditToolForm({ ...editToolForm, changeSummary: e.target.value })}
                      placeholder="e.g. Added optional startLine parameter and refined risk level"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Footer buttons */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--border-subtle)',
                    marginTop: '8px'
                  }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Author: <strong>{currentUser?.username || 'admin'}</strong> • Target Version: <strong>v{(editingTool.version || 1) + 1}</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setShowEditToolModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={currentUser?.role === 'viewer' || isUpdatingTool}
                      >
                        {isUpdatingTool ? 'Saving Version...' : `Save & Increment Version (v${(editingTool.version || 1) + 1})`}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: VERSION HISTORY & ROLLBACK */}
              {activeToolModalTab === 'versions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Tool Schema & Parameter Version Snapshots
                      </h3>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Complete immutable audit trail of tool specification changes. You can rollback to any past schema.
                      </p>
                    </div>
                    <span className="badge badge-purple">
                      {toolVersions.length} Recorded Snapshots
                    </span>
                  </div>

                  {toolVersions.length === 0 ? (
                    <div style={{
                      padding: '30px',
                      textAlign: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '10px',
                      border: '1px dashed var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      No previous versions logged yet. Edits made in Configuration will generate new version snapshots.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {toolVersions.map((ver) => {
                        const verNum = ver.version_number || ver.version || 1;
                        const isCurrentActive = verNum === editingTool.version;
                        const isExpanded = expandedVersionParam === verNum;

                        return (
                          <div
                            key={ver.id || verNum}
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
                            {/* Summary row */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span className="badge badge-purple" style={{ fontSize: '12px', fontWeight: 700 }}>
                                  v{verNum}
                                </span>
                                {isCurrentActive && (
                                  <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                                    Active Version
                                  </span>
                                )}
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                  {ver.name || editingTool.name}
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                  • {ver.change_summary || ver.changeSummary || 'Tool specification update'}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {ver.created_at || ver.timestamp ? new Date(ver.created_at || ver.timestamp).toLocaleString() : 'Recent'}
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--accent-indigo)' }}>
                                  by {ver.modified_by || ver.author || 'admin'}
                                </span>
                              </div>
                            </div>

                            {/* Metadata tags & actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span className="badge badge-cyan" style={{ fontSize: '10px' }}>
                                  {ver.category || editingTool.category}
                                </span>
                                <span className="badge badge-amber" style={{ fontSize: '10px' }}>
                                  Risk: {ver.risk_level || ver.riskLevel || editingTool.riskLevel}
                                </span>
                                {(ver.requires_approval !== undefined ? ver.requires_approval : ver.requiresApproval) && (
                                  <span className="badge badge-rose" style={{ fontSize: '10px' }}>
                                    Requires HITL
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => setExpandedVersionParam(isExpanded ? null : verNum)}
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
                                  {isExpanded ? 'Hide Schema' : 'Preview Schema'}
                                </button>

                                <button
                                  type="button"
                                  disabled={isCurrentActive || currentUser?.role === 'viewer' || isRollingBackTool}
                                  onClick={() => handleRollbackTool(verNum)}
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
                                  {isCurrentActive ? 'Currently Active' : `Rollback to v${verNum}`}
                                </button>
                              </div>
                            </div>

                            {/* Description quote */}
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                              "{ver.description || editingTool.description}"
                            </p>

                            {/* Expanded JSONSchema Preview */}
                            {isExpanded && (
                              <div style={{
                                marginTop: '6px',
                                padding: '12px',
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px'
                              }}>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>JSONSchema Parameters for v{verNum}:</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = typeof ver.parameters === 'object' ? JSON.stringify(ver.parameters, null, 2) : (ver.parameters || '{}');
                                      navigator.clipboard.writeText(text);
                                      alert('Schema copied to clipboard');
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--accent-indigo)',
                                      cursor: 'pointer',
                                      fontSize: '11px'
                                    }}
                                  >
                                    Copy Schema
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
                                  {typeof ver.parameters === 'object' ? JSON.stringify(ver.parameters, null, 2) : (ver.parameters || '{}')}
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
