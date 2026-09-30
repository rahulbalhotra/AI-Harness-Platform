import React, { useState, useEffect } from 'react';
import ActivityBar from './components/ActivityBar';
import StatusBar from './components/StatusBar';
import ChatCanvas from './components/ChatCanvas';
import AgentStudio from './components/AgentStudio';
import ModelHub from './components/ModelHub';
import ToolMCPHub from './components/ToolMCPHub';
import SDLCPipelines from './components/SDLCPipelines';
import WorkspaceExplorer from './components/WorkspaceExplorer';
import GovernancePanel from './components/GovernancePanel';
import ApprovalModal from './components/ApprovalModal';
import RepositoryAccessModal from './components/RepositoryAccessModal';
import KnowledgeBaseHub from './components/KnowledgeBaseHub';
import DatabaseVersioningHub from './components/DatabaseVersioningHub';
import UserLoginModal from './components/UserLoginModal';
import ProjectManagementHub from './components/ProjectManagementHub';
import ObservabilityHub from './components/ObservabilityHub';

import { 
  getAgents, 
  getModels, 
  getTools, 
  getMCPServers, 
  getGovernancePolicy, 
  getPendingApprovals,
  getWorkspaceInfo,
  resolveApproval,
  getAuthMe,
  getActiveModelStatus,
  setActiveModel
} from './services/api';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Harness UI caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '30px',
          margin: '40px auto',
          maxWidth: '600px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          color: '#fca5a5',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f87171' }}>⚠️ Display Error Intercepted</h3>
          <p style={{ fontSize: '13px', margin: '12px 0', color: 'var(--text-secondary)' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn btn-primary"
            style={{ marginTop: '8px' }}
          >
            Reload Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'agents' | 'models' | 'tools' | 'pipelines' | 'explorer' | 'governance'
  const [agents, setAgents] = useState([]);
  const [models, setModels] = useState([]);
  const [tools, setTools] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [activeAgentId, setActiveAgentId] = useState(null);
  
  // Health & connection state
  const [isConnected, setIsConnected] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [workspaceInfo, setWorkspaceInfo] = useState(null);
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [policy, setPolicy] = useState('request-review');
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [activeApprovalModal, setActiveApprovalModal] = useState(null);
  const [sessionTokens, setSessionTokens] = useState(14820);
  const [routingStatus, setRoutingStatus] = useState(null);
  const [lastRetryEvent, setLastRetryEvent] = useState(null);

  // Day / Night Theme Mode ('dark' | 'light')
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('harness_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('harness_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Current User & Access Control State
  const [currentUser, setCurrentUser] = useState({
    id: 'u_admin',
    username: 'admin',
    name: 'Enterprise Platform & SecOps Admin',
    role: 'admin'
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Initial data load
  const loadHarnessData = async () => {
    try {
      const [aList, mList, tList, mcpList, gov, wsInfo, authUser, activeModelSt] = await Promise.all([
        getAgents(),
        getModels(),
        getTools(),
        getMCPServers(),
        getGovernancePolicy(),
        getWorkspaceInfo().catch(() => null),
        getAuthMe().catch(() => null),
        getActiveModelStatus().catch(() => null)
      ]);
      setAgents(aList);
      setModels(mList);
      setTools(tList);
      setMcpServers(mcpList);
      setPolicy(gov.policy);
      if (activeModelSt) {
        setRoutingStatus(activeModelSt);
      }

      if (authUser?.username) {
        setCurrentUser(authUser);
      }

      if (wsInfo) {
        setWorkspaceInfo(wsInfo);
        setWorkspaceRoot(wsInfo.repoPath);
      }

      if (aList.length > 0 && !activeAgentId) {
        const willow = aList.find(a => a.id === 'agent-willow');
        setActiveAgentId(willow ? willow.id : aList[0].id);
      }

      const pending = await getPendingApprovals();
      setPendingApprovals(pending);
    } catch (e) {
      console.error('Failed to load harness data:', e);
    }
  };

  useEffect(() => {
    loadHarnessData();

    // Setup WebSocket connection to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:4000/`;
    let ws;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'CONNECTED') {
            if (data.payload.workspace) {
              setWorkspaceInfo(data.payload.workspace);
              setWorkspaceRoot(data.payload.workspace.repoPath);
            } else {
              setWorkspaceRoot(data.payload.workspaceRoot);
            }
            setPolicy(data.payload.policy);
            if (data.payload.pendingApprovals?.length > 0) {
              setPendingApprovals(data.payload.pendingApprovals);
            }
          } else if (data.type === 'WORKSPACE_UPDATED') {
            setWorkspaceInfo(data.payload);
            setWorkspaceRoot(data.payload.repoPath);
          } else if (data.type === 'APPROVAL_REQUIRED') {
            setActiveApprovalModal(data.payload.approvalRequest);
            setPendingApprovals(prev => [...prev, data.payload.approvalRequest]);
          } else if (data.type === 'EXECUTION_COMPLETED') {
            if (data.payload?.totalTokens) {
              setSessionTokens(prev => prev + data.payload.totalTokens);
            }
            if (data.payload?.modelId) {
              getActiveModelStatus(data.payload.agentId).then(st => {
                if (st) setRoutingStatus(st);
              }).catch(() => {});
            }
          } else if (data.type === 'MODEL_ROUTED') {
            setRoutingStatus(prev => ({
              ...(prev || {}),
              lastRoutedModelId: data.payload.actualModelId,
              activeModel: {
                ...(prev?.activeModel || {}),
                id: data.payload.actualModelId,
                name: data.payload.actualModelName || data.payload.actualModelId,
                provider: data.payload.provider,
                routingMode: data.payload.routingMode || prev?.selectedMode || 'auto'
              },
              lastRouteEvent: data.payload
            }));
          } else if (data.type === 'MODEL_RETRY') {
            setLastRetryEvent(data.payload);
            setTimeout(() => setLastRetryEvent(null), 6000);
          } else if (data.type === 'ACTIVE_MODEL_UPDATED') {
            setRoutingStatus(data.payload);
          } else if (data.type === 'MODEL_UPDATED') {
            getModels().then(mList => setModels(mList)).catch(() => {});
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    } catch (e) {
      console.warn('WS error', e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Refresh resolved active model when activeAgentId changes
  useEffect(() => {
    if (activeAgentId) {
      getActiveModelStatus(activeAgentId).then(st => {
        if (st) setRoutingStatus(st);
      }).catch(() => {});
    }
  }, [activeAgentId]);

  const handleSelectAgentForChat = (agentId) => {
    setActiveAgentId(agentId);
    setActiveTab('chat');
  };

  const handleSelectActiveModel = async (modelId) => {
    try {
      const updatedStatus = await setActiveModel(modelId, activeAgentId);
      setRoutingStatus(updatedStatus);
      const refreshedAgents = await getAgents();
      setAgents(refreshedAgents);
    } catch (err) {
      console.error('Failed to switch active model:', err);
    }
  };

  const handleResolveApprovalModal = async (approvalId, executionId, decision, comment) => {
    await resolveApproval(approvalId, executionId, decision, comment);
    const updated = await getPendingApprovals();
    setPendingApprovals(updated);
    setActiveApprovalModal(null);
  };

  const activeModel = routingStatus?.activeModel || models.find(m => m.id === agents.find(a => a.id === activeAgentId)?.modelId) || models[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Main Workspace Row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Activity Bar */}
        <ActivityBar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingApprovalsCount={pendingApprovals.length}
          currentUser={currentUser}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {/* Center Main Stage Panel */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-primary)' }}>
          <ErrorBoundary>
            {activeTab === 'chat' && (
              <ChatCanvas
                agents={agents}
                models={models}
                activeModel={activeModel}
                routingStatus={routingStatus}
                lastRetryEvent={lastRetryEvent}
                onSelectModel={handleSelectActiveModel}
                activeAgentId={activeAgentId}
                onSelectAgent={setActiveAgentId}
                onTriggerApprovalModal={(appr) => setActiveApprovalModal(appr)}
                workspaceInfo={workspaceInfo}
                onOpenRepoAccess={() => setIsRepoModalOpen(true)}
              />
            )}

            {activeTab === 'agents' && (
              <AgentStudio
                agents={agents}
                models={models}
                tools={tools}
                currentUser={currentUser}
                onSelectAgentForChat={handleSelectAgentForChat}
                onRefreshAgents={loadHarnessData}
              />
            )}

            {activeTab === 'pm' && (
              <ProjectManagementHub
                agents={agents}
                activeAgentId={activeAgentId}
                currentUser={currentUser}
                isConnected={isConnected}
              />
            )}

            {activeTab === 'observability' && (
              <ObservabilityHub
                currentUser={currentUser}
                activeAgentId={activeAgentId}
              />
            )}

            {activeTab === 'models' && (
              <ModelHub
                models={models}
                activeModel={activeModel}
                routingStatus={routingStatus}
                onSelectModel={handleSelectActiveModel}
                onRefreshModels={loadHarnessData}
              />
            )}

            {activeTab === 'knowledge' && (
              <KnowledgeBaseHub />
            )}

            {activeTab === 'database' && (
              <DatabaseVersioningHub />
            )}

            {activeTab === 'tools' && (
              <ToolMCPHub
                tools={tools}
                mcpServers={mcpServers}
                currentUser={currentUser}
                onRefreshTools={loadHarnessData}
                onRefreshMCP={loadHarnessData}
              />
            )}

            {activeTab === 'pipelines' && (
              <SDLCPipelines
                agents={agents}
                models={models}
              />
            )}

            {activeTab === 'explorer' && (
              <WorkspaceExplorer />
            )}

            {activeTab === 'governance' && (
              <GovernancePanel />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <StatusBar
        isConnected={isConnected}
        activeModel={activeModel}
        models={models}
        routingStatus={routingStatus}
        lastRetryEvent={lastRetryEvent}
        onSelectModel={handleSelectActiveModel}
        policy={policy}
        pendingCount={pendingApprovals.length}
        workspaceRoot={workspaceRoot}
        workspaceInfo={workspaceInfo}
        onOpenRepoAccess={() => setIsRepoModalOpen(true)}
        sessionTokens={sessionTokens}
        onOpenGovernance={() => setActiveTab('governance')}
        currentUser={currentUser}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Global Approval Modal */}
      {activeApprovalModal && (
        <ApprovalModal
          approval={activeApprovalModal}
          onResolve={handleResolveApprovalModal}
          onClose={() => setActiveApprovalModal(null)}
        />
      )}

      {/* Repository Folder Access Modal */}
      {isRepoModalOpen && (
        <RepositoryAccessModal
          workspaceInfo={workspaceInfo}
          onClose={() => setIsRepoModalOpen(false)}
          onWorkspaceUpdated={(updated) => {
            setWorkspaceInfo(updated);
            setWorkspaceRoot(updated.repoPath);
          }}
        />
      )}

      {/* User Login & Policy Access Control Modal */}
      {isLoginModalOpen && (
        <UserLoginModal
          currentUser={currentUser}
          onUserChanged={(user) => {
            setCurrentUser(user);
            loadHarnessData();
          }}
          onClose={() => setIsLoginModalOpen(false)}
        />
      )}
    </div>
  );
}
