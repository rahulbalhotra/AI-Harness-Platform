import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Terminal, 
  ChevronDown, 
  ChevronRight, 
  Wrench, 
  Sparkles, 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Copy, 
  Check, 
  Trash2, 
  ShieldAlert,
  ArrowRight,
  Code2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Clock,
  FolderGit2,
  FolderPlus,
  Zap,
  Paperclip,
  Upload,
  Image as ImageIcon,
  FileText,
  FileCode,
  File,
  X,
  Eye,
  Maximize2,
  Globe,
  Compass,
  ExternalLink
} from 'lucide-react';
import ParallelAgentSwarm from './ParallelAgentSwarm';
import { 
  executeChat, 
  getChatHistory, 
  getChatSessions, 
  createChatSession, 
  deleteChatSession 
} from '../services/api';

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Recent';
  const diffMs = Date.now() - timestamp;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMessageContent(content) {
  if (!content) return '';
  if (typeof content === 'object') {
    if (content.summary) return content.summary;
    if (content.content) return formatMessageContent(content.content);
    if (content.message) return content.message;
    if (content.findings) return content.findings;
    return JSON.stringify(content, null, 2);
  }
  let str = String(content).trim();
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const parsed = JSON.parse(str);
      if (parsed.summary) return parsed.summary;
      if (parsed.content) return formatMessageContent(parsed.content);
      if (parsed.message) return parsed.message;
    } catch (e) {}
  }
  str = str.replace(/^(?:\*\*|\*|#+\s*)?(?:Thought|Thinking|Reasoning):\s*[\s\S]*?(?:\n\n|\r\n\r\n)/i, '');
  str = str.replace(/```(?:json)?\s*\{\s*["']thought["'][\s\S]*?\}\s*```/gi, '').trim();
  // Strip raw markdown headers (##, ###, etc.) and raw bold asterisks (**) so output is clean
  str = str.replace(/^#+\s*/gm, '');
  str = str.replace(/\*\*([^*]+)\*\*/g, '$1');
  return str;
}

export default function ChatCanvas({ 
  agents, 
  models, 
  activeModel = null,
  routingStatus = null,
  lastRetryEvent = null,
  onSelectModel = null,
  activeAgentId, 
  onSelectAgent, 
  onTriggerApprovalModal,
  workspaceInfo,
  onOpenRepoAccess
}) {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [activeSwarmPlan, setActiveSwarmPlan] = useState(null);
  const [liveAgentMap, setLiveAgentMap] = useState({});
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [activeExecutingAgent, setActiveExecutingAgent] = useState(null);
  const [liveThought, setLiveThought] = useState(null);
  const [streamingContent, setStreamingContent] = useState(null);
  const [liveAgentTrace, setLiveAgentTrace] = useState([]);
  const [isLiveThinkingOpen, setIsLiveThinkingOpen] = useState(true);
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewModalItem, setPreviewModalItem] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);
  const messagesEndRef = useRef(null);

  const formatFileSize = (bytes) => {
    if (!bytes && bytes !== 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFiles = (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    files.forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isText = file.type.startsWith('text/') || 
        file.type === 'application/json' || 
        file.type === 'application/javascript' ||
        /\.(js|jsx|ts|tsx|py|html|css|json|md|csv|txt|yaml|yml|xml|sql|sh|env|cfg|ini|dockerfile|gitignore|rs|go|java|c|cpp)$/i.test(file.name);

      const reader = new FileReader();

      if (isImg) {
        reader.onload = (e) => {
          setAttachments(prev => [...prev, {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            formattedSize: formatFileSize(file.size),
            type: file.type || 'image/png',
            isImage: true,
            dataUrl: e.target.result
          }]);
        };
        reader.readAsDataURL(file);
      } else if (isText) {
        reader.onload = (e) => {
          const text = e.target.result;
          setAttachments(prev => [...prev, {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            formattedSize: formatFileSize(file.size),
            type: file.type || 'text/plain',
            isImage: false,
            textContent: text,
            snippet: text.substring(0, 300)
          }]);
        };
        reader.readAsText(file);
      } else {
        reader.onload = (e) => {
          setAttachments(prev => [...prev, {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            formattedSize: formatFileSize(file.size),
            type: file.type || 'application/octet-stream',
            isImage: false,
            dataUrl: e.target.result
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handlePaste = (e) => {
    if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      processFiles(e.clipboardData.files);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (attId) => {
    setAttachments(prev => prev.filter(a => a.id !== attId));
  };

  const selectedAgent = agents.find(a => a.id === activeAgentId) || agents[0];
  const selectedModel = activeModel || models.find(m => m.id === selectedAgent?.modelId) || models[0];
  const selectedRoutingMode = routingStatus?.selectedMode || 'auto';

  // Timer for Gemini-style thinking animation
  useEffect(() => {
    let interval;
    if (isExecuting) {
      setThinkingSeconds(0);
      interval = setInterval(() => {
        setThinkingSeconds(s => s + 1);
      }, 1000);
    } else {
      setThinkingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isExecuting]);

  // Real-time WebSocket connection for AutoGen parallel swarm streaming
  useEffect(() => {
    let ws;
    let reconnectTimer;

    function initWebSocket() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:4000';
      const wsUrl = `${protocol}//${host}`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'AUTOGEN_PLAN_GENERATED') {
              setActiveSwarmPlan(data.payload);
              setLiveAgentMap({});
            } else if (data.type === 'PARALLEL_AGENT_STARTED') {
              setLiveAgentMap(prev => ({
                ...prev,
                [data.payload.agentId]: {
                  status: 'working',
                  progress: 15,
                  log: `${data.payload.agentName} activated on parallel task.`
                }
              }));
            } else if (data.type === 'PARALLEL_AGENT_PROGRESS') {
              setLiveAgentMap(prev => ({
                ...prev,
                [data.payload.agentId]: {
                  status: data.payload.status,
                  progress: data.payload.progress,
                  log: data.payload.log
                }
              }));
            } else if (data.type === 'PARALLEL_AGENT_COMPLETED') {
              setLiveAgentMap(prev => ({
                ...prev,
                [data.payload.result.agentId]: {
                  ...data.payload.result,
                  status: 'completed',
                  progress: 100,
                  log: `${data.payload.result.agentName} completed deliverables.`
                }
              }));
            } else if (data.type === 'AUTOGEN_SWARM_COMPLETED') {
              setActiveSwarmPlan(data.payload.swarmSummary);
            } else if (data.type === 'AGENT_TRACE_UPDATE') {
              if (data.payload?.traceItem) {
                setLiveAgentTrace(prev => {
                  const existingIdx = prev.findIndex(item => item.id === data.payload.traceItem.id);
                  if (existingIdx >= 0) {
                    const copy = [...prev];
                    copy[existingIdx] = data.payload.traceItem;
                    return copy;
                  }
                  return [...prev, data.payload.traceItem];
                });
              }
            } else if (data.type === 'AGENT_ACCESSED') {
              setActiveExecutingAgent(data.payload);
              if (data.payload.status === 'tool_execution') {
                setLiveAgentTrace(prev => {
                  const exists = prev.some(t => t.toolId === data.payload.toolId && t.agentId === data.payload.agentId && t.step === data.payload.step);
                  if (exists) return prev;
                  return [...prev, {
                    id: `acc_${Date.now()}_${Math.random()}`,
                    agentId: data.payload.agentId,
                    agentName: data.payload.agentName,
                    avatar: data.payload.avatar,
                    role: data.payload.role,
                    status: 'tool_execution',
                    toolId: data.payload.toolId,
                    toolName: data.payload.toolName,
                    parameters: data.payload.parameters,
                    step: data.payload.step
                  }];
                });
              }
            } else if (data.type === 'STREAM_CHUNK') {
              if (data.payload.type === 'thought') {
                setLiveThought(data.payload.text);
              } else if (data.payload.type === 'content') {
                setStreamingContent(data.payload.text);
              }
            } else if (data.type === 'EXECUTION_COMPLETED' || data.type === 'EXECUTION_FAILED') {
              setLiveThought(null);
              setStreamingContent(null);
              setActiveExecutingAgent(null);
              setLiveAgentTrace([]);
            }
          } catch (err) {
            console.error('Error handling WebSocket message:', err);
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(initWebSocket, 3000);
        };
      } catch (err) {
        reconnectTimer = setTimeout(initWebSocket, 3000);
      }
    }

    initWebSocket();
    return () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);

  // Initial load of sessions
  useEffect(() => {
    async function initSessions() {
      try {
        const list = await getChatSessions();
        if (list && list.length > 0) {
          setSessions(list);
          setActiveSessionId(list[0].id);
        } else {
          // Create initial default session
          const newSess = await createChatSession(activeAgentId || 'agent-willow', '🌿 SDLC Orchestration with Willow');
          setSessions([newSess]);
          setActiveSessionId(newSess.id);
        }
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
      }
    }
    initSessions();
  }, []);

  // Load chat history when activeSessionId changes
  useEffect(() => {
    async function loadHistory() {
      if (!activeSessionId) return;
      try {
        const hist = await getChatHistory(activeSessionId);
        if (hist && hist.length > 0) {
          setMessages(hist);
        } else {
          // Chat starts clean without any prior messages
          setMessages([]);
        }
      } catch (err) {
        console.error('Error loading history:', err);
      }
    }
    loadHistory();
  }, [activeSessionId, selectedAgent?.id]);

  // Scroll to bottom on new messages or live streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isExecuting, streamingContent, liveThought]);

  // Handler: Start New Chat
  const handleNewChat = async () => {
    try {
      const newSess = await createChatSession(activeAgentId || 'agent-willow', 'New chat');
      setSessions(prev => [newSess, ...prev]);
      setActiveSessionId(newSess.id);
    } catch (err) {
      console.error('Failed to create new chat:', err);
    }
  };

  // Handler: Switch Chat Session
  const handleSelectSession = (session) => {
    setActiveSessionId(session.id);
    if (session.agentId && session.agentId !== activeAgentId) {
      onSelectAgent?.(session.agentId);
    }
  };

  // Handler: Delete Chat Session
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    try {
      await deleteChatSession(sessionId);
      const remaining = sessions.filter(s => s.id !== sessionId);
      setSessions(remaining);
      if (activeSessionId === sessionId) {
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      alert('Failed to delete chat: ' + err.message);
    }
  };

  // Handler: Send Message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!inputPrompt.trim() && attachments.length === 0) || isExecuting) return;

    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
      const initialTitle = inputPrompt.trim() ? inputPrompt.substring(0, 36) : `File: ${attachments[0]?.name || 'Upload'}`;
      const created = await createChatSession(selectedAgent.id, initialTitle);
      setSessions(prev => [created, ...prev]);
      targetSessionId = created.id;
      setActiveSessionId(targetSessionId);
    }

    const currentAttachments = [...attachments];
    const userText = inputPrompt.trim() || (currentAttachments.length > 0 ? `Please analyze the attached ${currentAttachments.map(a => a.name).join(', ')}.` : '');
    setInputPrompt('');
    setAttachments([]);
    setActiveSwarmPlan(null);
    setLiveAgentMap({});

    // Append optimistic user message with attachments
    const tempUserMsg = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: userText,
      attachments: currentAttachments,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsExecuting(true);
    setLiveThought(null);
    setStreamingContent(null);
    setActiveExecutingAgent({
      agentId: selectedAgent.id,
      agentName: selectedAgent.name,
      avatar: selectedAgent.avatar,
      role: selectedAgent.role,
      status: 'reasoning'
    });

    // Optimistically update session title in sidebar if it's new
    setSessions(prev => prev.map(s => {
      if (s.id === targetSessionId && (s.title === 'New chat' || s.title === 'New Conversation')) {
        return {
          ...s,
          title: userText.length > 36 ? userText.substring(0, 36) + '...' : userText,
          updatedAt: Date.now()
        };
      }
      return s;
    }));

    try {
      const execResult = await executeChat(targetSessionId, selectedAgent.id, userText, currentAttachments);
      if (execResult && execResult.history && execResult.history.length > 0) {
        setMessages(execResult.history);
      } else {
        const updatedHistory = await getChatHistory(targetSessionId);
        if (updatedHistory && updatedHistory.length > 0) {
          setMessages(updatedHistory);
        }
      }

      // Refresh sessions to get updated message counts & server title
      const updatedSessions = await getChatSessions();
      if (updatedSessions) setSessions(updatedSessions);

      if (execResult?.execution?.pendingApproval) {
        onTriggerApprovalModal?.(execResult.execution.pendingApproval);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          avatar: '⚠️',
          content: `**Execution Error**: ${err.message}`
        }
      ]);
    } finally {
      setIsExecuting(false);
      setLiveThought(null);
      setStreamingContent(null);
      setActiveExecutingAgent(null);
    }
  };

  const toggleThought = (msgId) => {
    setExpandedThoughts(prev => ({
      ...prev,
      [msgId]: !prev[msgId]
    }));
  };

  const handleCopyCode = (code, index) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* ================= GEMINI-STYLE CHAT HISTORY SIDEBAR ================= */}
      {sidebarOpen && (
        <aside style={{
          width: '260px',
          minWidth: '260px',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          zIndex: 15,
          transition: 'all 0.2s ease'
        }}>
          {/* Sidebar Top: Collapse Toggle & Header */}
          <div style={{
            padding: '14px 16px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Conversations
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Collapse chat history"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <PanelLeftClose size={17} />
            </button>
          </div>

          {/* New Chat Button (Gemini Style Pill) */}
          <div style={{ padding: '14px 16px' }}>
            <button
              onClick={handleNewChat}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 10px rgba(6, 182, 212, 0.15)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Plus size={16} color="var(--accent-cyan)" />
              <span>New chat</span>
            </button>
          </div>

          {/* Recent Section Header */}
          <div style={{
            padding: '4px 16px 8px',
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Clock size={11} />
            <span>Recent</span>
          </div>

          {/* Session History List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 10px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {sessions.map(s => {
              const isActive = s.id === activeSessionId;
              const sessionAgent = agents.find(a => a.id === s.agentId);

              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'rgba(59, 130, 246, 0.4)' : 'transparent',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>
                      {sessionAgent?.avatar || '💬'}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }} title={s.title}>
                        {s.title}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {formatRelativeTime(s.updatedAt)}
                      </div>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    title="Delete conversation"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      opacity: isActive ? 1 : 0.4,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = 'var(--accent-rose)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isActive ? '1' : '0.4';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            {sessions.length === 0 && (
              <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                No conversations yet.<br />Click "+ New chat" to begin!
              </div>
            )}
          </div>

          {/* Footer of Sidebar */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span className="status-dot online" />
            <span>AI Harness &bull; Memory Synced</span>
          </div>
        </aside>
      )}

      {/* ================= MAIN CHAT CANVAS STAGE ================= */}
      <div 
        style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', position: 'relative' }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
      >
        
        {/* Top Header */}
        <div style={{
          padding: '10px 18px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10
        }}>
          {/* Left: Sidebar Toggle + Agent Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 auto', minWidth: '260px', flexWrap: 'wrap' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Open chat history"
                className="btn btn-secondary"
                style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', flexShrink: 0 }}
              >
                <PanelLeftOpen size={16} />
                <span>History</span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '26px', flexShrink: 0, filter: selectedAgent?.id === 'agent-willow' ? 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.5))' : 'none' }}>
                {selectedAgent?.avatar || '🌿'}
              </span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap' }}>
                    {selectedAgent?.name}
                  </h2>
                  {selectedAgent?.id === 'agent-willow' ? (
                    <>
                      <span className="badge badge-emerald" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                        Master Orchestrator
                      </span>
                      <span className="badge badge-indigo" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                        General Assistant
                      </span>
                    </>
                  ) : (
                    <span className="badge badge-cyan" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                      {selectedAgent?.sdlcStage}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '11px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  {selectedAgent?.id === 'agent-willow' ? (
                    <span>Autonomous delegation to: <strong style={{ color: 'var(--accent-cyan)' }}>Specialist SDLC Agents</strong></span>
                  ) : (
                    <span>Specialist Persona &bull; Policy: <strong style={{ color: 'var(--accent-amber)' }}>{selectedAgent?.autonomyPolicy}</strong></span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Active Model Switcher, Partner Dropdown & "+ New Chat" Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '0 1 auto' }}>
            {onSelectModel && models.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Model:</span>
                <select
                  value={selectedRoutingMode === 'auto' ? 'auto' : (selectedModel?.id || 'auto')}
                  onChange={(e) => onSelectModel(e.target.value)}
                  style={{
                    fontSize: '11.5px',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    maxWidth: '190px'
                  }}
                  title="Switch active model or use Adaptive Auto-Router with automatic failure retry"
                >
                  <option value="auto">⚡ Auto ({selectedModel?.name || 'Adaptive Router'})</option>
                  <optgroup label="Pin Specific Active Model">
                    {models.filter(m => m.enabled !== false).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                    ))}
                  </optgroup>
                </select>
                <span
                  style={{
                    fontSize: '9.5px',
                    padding: '2px 5px',
                    borderRadius: '4px',
                    background: selectedRoutingMode === 'auto' ? 'rgba(6, 182, 212, 0.14)' : 'rgba(99, 102, 241, 0.16)',
                    color: selectedRoutingMode === 'auto' ? '#38bdf8' : '#a5b4fc',
                    border: '1px solid rgba(255,255,255,0.08)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {selectedRoutingMode === 'auto' ? '⚡ Auto' : '📌 Pinned'}
                </span>
                {lastRetryEvent && (
                  <span
                    style={{
                      fontSize: '9.5px',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      background: 'rgba(245, 158, 11, 0.18)',
                      color: '#fcd34d',
                      border: '1px solid rgba(245, 158, 11, 0.35)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🔄 Retry #{lastRetryEvent.attempt}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active Partner:</span>
              <select
                value={selectedAgent?.id}
                onChange={(e) => onSelectAgent(e.target.value)}
                style={{
                  fontSize: '11.5px',
                  padding: '4px 8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  maxWidth: '190px'
                }}
              >
                <option value="agent-willow">🌿 Willow (Master Orchestrator)</option>
                <optgroup label="Direct Specialist Override">
                  {agents.filter(a => a.id !== 'agent-willow').map(a => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name} ({a.role})</option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Repository Folder Access Badge */}
            <button
              onClick={onOpenRepoAccess}
              title="Click to view or authorize repository folder access"
              className="btn btn-secondary"
              style={{
                fontSize: '11px',
                padding: '5px 9px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                borderRadius: '6px',
                border: workspaceInfo?.isAuthorized ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                background: workspaceInfo?.isAuthorized ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                color: workspaceInfo?.isAuthorized ? '#6ee7b7' : '#fcd34d'
              }}
            >
              <FolderGit2 size={13} />
              <span>{workspaceInfo?.isAuthorized ? 'Repo: Authorized 🟢' : 'Grant Repo Access 🟡'}</span>
            </button>

            {/* "+ New chat" Button replacing "Clear" */}
            <button
              onClick={handleNewChat}
              title="Start a fresh chat conversation"
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: 'rgba(6, 182, 212, 0.3)'
              }}
            >
              <Plus size={14} color="var(--accent-cyan)" />
              <span>New chat</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          {messages.length === 0 && (
            <div style={{
              margin: 'auto',
              maxWidth: '640px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              padding: '40px 20px',
              animation: 'fadeIn 0.25s ease'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '18px',
                background: selectedAgent?.id === 'agent-willow'
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
              }}>
                {selectedAgent?.avatar || '🌿'}
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {selectedAgent?.id === 'agent-willow' ? "How can Willow help you today?" : `Ready to pair with ${selectedAgent?.name}`}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', maxWidth: '480px', margin: 0 }}>
                {selectedAgent?.id === 'agent-willow'
                  ? "Ask any question, design architectures, or tell Willow to coordinate specialist agents to write code, create directories, run test suites, and execute security audits."
                  : `Specialized in ${selectedAgent?.sdlcStage}. Ready to execute tools under ${selectedAgent?.autonomyPolicy} governance policy.`}
              </p>
            </div>
          )}

          {messages.filter(m => m.role === 'user' || m.role === 'assistant').map((msg, idx) => {
            const isUser = msg.role === 'user';
            const hasThought = Boolean(msg.thought || (msg.steps && msg.steps.length > 0) || msg.parallelPlan || msg.toolCall);
            const isThoughtExpanded = expandedThoughts[msg.id];

            return (
              <div
                key={msg.id || idx}
                style={{
                  display: 'flex',
                  gap: '14px',
                  maxWidth: '860px',
                  width: '100%',
                  margin: '0 auto',
                  alignSelf: isUser ? 'flex-end' : 'flex-start'
                }}
              >
                {/* Avatar Icon */}
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '16px',
                  background: isUser 
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
                    : (msg.agentId === 'agent-willow' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--bg-card)'),
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                }}>
                  {isUser ? <User size={16} color="#fff" /> : (msg.avatar || '🤖')}
                </div>

                {/* Content Box */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  
                  {/* Sender Name & Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {isUser ? 'You' : (msg.agentName || selectedAgent?.name)}
                    </span>
                    {!isUser && (msg.modelName || selectedModel?.name) && (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(99, 102, 241, 0.14)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.28)',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        {msg.modelName || selectedModel?.name}
                      </span>
                    )}
                    {!isUser && msg.routingMetadata && (msg.routingMetadata.retried || msg.routingMetadata.failedOver) && (
                      <span
                        title={`Routed via ${msg.routingMetadata.provider} after ${msg.routingMetadata.attempts} attempt(s)`}
                        style={{
                          fontSize: '9.5px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#fcd34d',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}
                      >
                        {msg.routingMetadata.retried ? `🔄 Retried (${msg.routingMetadata.attempts} attempts)` : `⚡ Auto-Failover`}
                      </span>
                    )}
                    {msg.telemetry && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {msg.telemetry.durationMs}ms &bull; {msg.telemetry.totalTokens} tokens
                      </span>
                    )}
                  </div>

                  {/* Chain of Thought / Multi-Agent Deliberation & Tool Trace Dropdown */}
                  {hasThought && (
                    <div style={{
                      backgroundColor: 'rgba(15, 20, 32, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
                      backdropFilter: 'blur(8px)'
                    }}>
                      {/* Accordion Toggle Bar */}
                      <div
                        onClick={() => toggleThought(msg.id)}
                        style={{
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          backgroundColor: isThoughtExpanded ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.015)',
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                          borderBottom: isThoughtExpanded ? '1px solid rgba(255, 255, 255, 0.06)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <Sparkles size={13} color="var(--accent-cyan)" />
                          <strong style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>
                            Thinking Process
                          </strong>

                          {/* Participating Agent Badges */}
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '13px' }}>{msg.avatar || '🌿'}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{msg.agentName || 'Willow'}</span>
                            {msg.subagentResult?.subagent && (
                              <>
                                <ArrowRight size={10} color="var(--text-muted)" />
                                <span style={{ fontSize: '13px' }}>{msg.subagentResult.subagent.avatar || '💻'}</span>
                                <span className="badge badge-emerald" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                                  {msg.subagentResult.subagent.name}
                                </span>
                              </>
                            )}
                            {msg.parallelPlan?.agentDeliverables && (
                              <span className="badge badge-indigo" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                                {msg.parallelPlan.agentDeliverables.length} Parallel Agents Swarm
                              </span>
                            )}
                          </div>

                          {/* Tool Execution Count Pill */}
                          {((msg.subagentResult?.toolsExecuted?.length || 0) + (msg.toolCall ? 1 : 0)) > 0 && (
                            <span className="badge badge-cyan" style={{ fontSize: '9.5px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Wrench size={10} />
                              {msg.subagentResult?.toolsExecuted?.length 
                                ? `${msg.subagentResult.toolsExecuted.length} tool calls executed`
                                : `Tool: ${msg.toolCall?.toolId}`}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {isThoughtExpanded ? 'Collapse' : 'Open thinking of each agent & calls made'}
                          </span>
                          {isThoughtExpanded ? <ChevronDown size={14} color="var(--accent-cyan)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                        </div>
                      </div>

                      {/* Expanded Trajectory View */}
                      {isThoughtExpanded && (
                        <div style={{
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '14px',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)'
                        }}>
                          {/* Agent 1: Lead Orchestrator (Willow) Deliberation */}
                          <div style={{
                            background: 'rgba(16, 185, 129, 0.05)',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>{msg.avatar || '🌿'}</span>
                                <strong style={{ fontSize: '12px', color: 'var(--accent-emerald)' }}>
                                  {msg.agentName || 'Willow'} (Master SDLC Orchestrator)
                                </strong>
                              </div>
                              <span className="badge badge-emerald" style={{ fontSize: '9.5px' }}>Planning & Coordination</span>
                            </div>

                            {/* Willow Thought */}
                            {(msg.thought || msg.steps?.[0]?.thought) && (
                              <div style={{
                                fontSize: '11.5px',
                                color: 'var(--text-secondary)',
                                fontStyle: 'italic',
                                lineHeight: '1.5',
                                paddingLeft: '10px',
                                borderLeft: '2px solid var(--accent-emerald)'
                              }}>
                                <span style={{ color: 'var(--accent-emerald)', fontWeight: 600, fontStyle: 'normal' }}>Orchestration Deliberation: </span>
                                &ldquo;{msg.steps?.[0]?.thought || msg.thought}&rdquo;
                              </div>
                            )}

                            {/* Willow Action */}
                            {msg.toolCall && (
                              <div style={{
                                background: 'rgba(0, 0, 0, 0.4)',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                                  <ArrowRight size={12} />
                                  <span>Action: {msg.toolCall.toolId === 'invoke_agent' ? `Delegated to Specialist Agent (${msg.subagentResult?.subagent?.name || msg.toolCall.parameters?.agentId})` : `Invoked ${msg.toolCall.toolId}`}</span>
                                </div>
                                {msg.toolCall.parameters?.taskDescription && (
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                                    <strong>Delegation Directive:</strong> {msg.toolCall.parameters.taskDescription}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Agent 2: Specialist Agent Deliberation & Autonomous Tool Calls */}
                          {msg.subagentResult && (
                            <div style={{
                              background: 'rgba(6, 182, 212, 0.05)',
                              border: '1px solid rgba(6, 182, 212, 0.2)',
                              borderRadius: '8px',
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '16px' }}>{msg.subagentResult.subagent?.avatar || '💻'}</span>
                                  <div>
                                    <strong style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>
                                      {msg.subagentResult.subagent?.name || 'Specialist Engineer'}
                                    </strong>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                                      ({msg.subagentResult.subagent?.role || 'Implementation Lead'})
                                    </span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {msg.subagentResult.subagent?.modelId && (
                                    <span className="badge badge-indigo" style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>
                                      {msg.subagentResult.subagent.modelId}
                                    </span>
                                  )}
                                  {msg.subagentResult.durationMs && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                      {msg.subagentResult.durationMs}ms
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Specialist Reasoning / Thought */}
                              {msg.subagentResult.reasoning && (
                                <div style={{
                                  fontSize: '11.5px',
                                  color: 'var(--text-secondary)',
                                  fontStyle: 'italic',
                                  lineHeight: '1.5',
                                  paddingLeft: '10px',
                                  borderLeft: '2px solid var(--accent-cyan)'
                                }}>
                                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, fontStyle: 'normal' }}>Deliberation: </span>
                                  &ldquo;{msg.subagentResult.reasoning}&rdquo;
                                </div>
                              )}

                              {/* List of Actual Tools Called by Specialist */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Actual Tool Calls Executed by Specialist:
                                </span>
                                
                                {(() => {
                                  const specialistTools = (msg.subagentResult.toolsExecuted && msg.subagentResult.toolsExecuted.length > 0)
                                    ? msg.subagentResult.toolsExecuted
                                    : (msg.agentTrace || []).filter(t => (t.agentId !== 'agent-willow' || t.status === 'tool_execution' || t.status === 'tool_completed') && t.toolId);

                                  if (specialistTools.length > 0) {
                                    return specialistTools.map((tx, txIdx) => (
                                      <div key={txIdx} style={{
                                        background: 'rgba(0, 0, 0, 0.45)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        borderRadius: '6px',
                                        padding: '8px 12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        fontFamily: 'var(--font-mono)',
                                        fontSize: '11px'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
                                            <Wrench size={12} />
                                            <strong>Action {txIdx + 1}:</strong> <code>{tx.toolId}</code>
                                            {tx.parameters?.filePath && (
                                              <span style={{ color: 'var(--accent-emerald)' }}>({tx.parameters.filePath})</span>
                                            )}
                                            {tx.parameters?.dirPath && (
                                              <span style={{ color: 'var(--accent-amber)' }}>({tx.parameters.dirPath})</span>
                                            )}
                                          </div>
                                          <span className="badge badge-emerald" style={{ fontSize: '9px', padding: '1px 6px' }}>Executed</span>
                                        </div>

                                        {tx.parameters && (
                                          <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '2px' }}>
                                            <strong>Parameters:</strong> {JSON.stringify(tx.parameters)}
                                          </div>
                                        )}
                                        {tx.output && (
                                          <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                                            <strong>Result:</strong> {typeof tx.output === 'object' ? JSON.stringify(tx.output) : String(tx.output)}
                                          </div>
                                        )}
                                      </div>
                                    ));
                                  }
                                  if (msg.subagentResult.toolInvoked) {
                                    return (
                                      <div style={{
                                        background: 'rgba(0, 0, 0, 0.45)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        borderRadius: '6px',
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        fontSize: '11px'
                                      }}>
                                        <Wrench size={12} color="var(--accent-cyan)" />
                                        <span>Invoked: <code>{msg.subagentResult.toolInvoked}</code></span>
                                        <span className="badge badge-emerald" style={{ fontSize: '9px', marginLeft: 'auto' }}>Executed</span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}>
                                      No external tools required. Completed via direct domain synthesis.
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Parallel Agents Breakdown: Each Agent's Thought & Action Taken */}
                          {msg.parallelPlan?.agentDeliverables && msg.parallelPlan.agentDeliverables.length > 0 && (
                            <div style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}>
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: 'var(--accent-emerald)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <Zap size={13} />
                                <span>Parallel Multi-Agent Swarm Breakdown ({msg.parallelPlan.agentDeliverables.length} Agents)</span>
                              </div>

                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                                gap: '10px'
                              }}>
                                {msg.parallelPlan.agentDeliverables.map((d, dIdx) => (
                                  <div
                                    key={d.agentId || dIdx}
                                    style={{
                                      background: 'rgba(15, 20, 32, 0.8)',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      borderRadius: '8px',
                                      padding: '10px 12px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '7px'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '15px' }}>{d.agentAvatar || '🤖'}</span>
                                        <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                                          {d.agentName}
                                        </strong>
                                      </div>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                        {d.durationMs}ms
                                      </span>
                                    </div>

                                    <div style={{ fontSize: '10.5px', color: 'var(--accent-cyan)' }}>
                                      Role: {d.agentRole || 'SDLC Specialist'}
                                    </div>

                                    <div style={{
                                      background: 'rgba(0, 0, 0, 0.35)',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      color: 'var(--text-secondary)',
                                      fontStyle: 'italic',
                                      lineHeight: '1.4'
                                    }}>
                                      <span style={{ color: 'var(--accent-indigo)', fontWeight: 600 }}>Thought: </span>
                                      &ldquo;{d.reasoning || d.task}&rdquo;
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      fontSize: '11px',
                                      color: 'var(--accent-emerald)'
                                    }}>
                                      <CheckCircle2 size={12} />
                                      <span>
                                        <strong>Action Taken:</strong> {d.toolInvoked ? `Executed ${d.toolInvoked}` : 'Domain Analysis & Code Synthesis'}
                                      </span>
                                    </div>

                                    {d.findings && (
                                      <div style={{
                                        fontSize: '10.5px',
                                        color: 'var(--text-muted)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical'
                                      }}>
                                        {d.findings}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Fallback steps if neither subagent nor parallel swarm */}
                          {!msg.subagentResult && !msg.parallelPlan && msg.steps && msg.steps.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {msg.steps.map((st, sIdx) => (
                                <div key={sIdx} style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px',
                                  borderLeft: '2px solid var(--accent-indigo)',
                                  paddingLeft: '10px'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
                                      Step {sIdx + 1}
                                    </span>
                                    {st.toolCall && (
                                      <span className="badge badge-emerald" style={{ fontSize: '10px' }}>
                                        Tool: {st.toolCall.toolId}
                                      </span>
                                    )}
                                  </div>
                                  {st.thought && (
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: '1.5' }}>
                                      &ldquo;{st.thought}&rdquo;
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Main Bubble Content */}
                  <div style={{
                    padding: isUser ? '12px 16px' : '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: isUser ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-secondary)',
                    border: '1px solid',
                    borderColor: isUser ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: isUser ? 'none' : '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}>
                    {/* Attached files / images in message */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: msg.content ? '10px' : '0' }}>
                        {msg.attachments.map((att, aIdx) => {
                          const isImg = att.isImage || (att.type && att.type.startsWith('image/')) || (att.dataUrl && att.dataUrl.startsWith('data:image/'));
                          return (
                            <div key={att.id || aIdx} style={{
                              background: 'rgba(0, 0, 0, 0.45)',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              maxWidth: isImg ? '280px' : '320px',
                              display: 'flex',
                              flexDirection: 'column'
                            }}>
                              {isImg && att.dataUrl ? (
                                <div 
                                  onClick={() => setPreviewModalItem(att)}
                                  style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden', background: '#090d16' }}
                                  title="Click to zoom image"
                                >
                                  <img 
                                    src={att.dataUrl} 
                                    alt={att.name}
                                    style={{
                                      width: '100%',
                                      maxHeight: '180px',
                                      objectFit: 'cover',
                                      display: 'block'
                                    }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: '4px 8px',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '11px',
                                    color: '#fff'
                                  }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
                                    <Maximize2 size={12} color="var(--accent-cyan)" />
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    background: 'rgba(6, 182, 212, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--accent-cyan)',
                                    flexShrink: 0
                                  }}>
                                    {att.name?.match(/\.(js|jsx|ts|tsx|py|html|css|json|sql|sh)$/i) ? <FileCode size={15} /> : <FileText size={15} />}
                                  </div>
                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.name}>
                                      {att.name}
                                    </div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      {att.formattedSize || (att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Attached file')}
                                    </div>
                                  </div>
                                  {att.textContent && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewModalItem(att)}
                                      className="btn btn-secondary"
                                      style={{ padding: '3px 7px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                                      title="View file content"
                                    >
                                      <Eye size={11} /> View
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Render Knowledge Hub Ingested Specification Card if present */}
                    {msg.knowledgeHubDoc && (
                      <div style={{
                        marginBottom: '12px',
                        borderRadius: '11px',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(15, 23, 42, 0.9) 100%)',
                        padding: '12px 15px',
                        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 700, color: '#38bdf8' }}>
                            <span>📚</span>
                            <span>Knowledge Hub Specification Ingested & Indexed</span>
                          </div>
                          <span className="badge badge-cyan" style={{ fontSize: '10px' }}>
                            {msg.knowledgeHubDoc.chunkCount || 1} RAG Chunks
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                          {msg.knowledgeHubDoc.title}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11px', color: '#94a3b8' }}>
                          <span>Doc ID: <code style={{ color: '#bae6fd' }}>{msg.knowledgeHubDoc.documentId}</code></span>
                          {msg.knowledgeHubDoc.savedFilePath && (
                            <span>Repo Path: <code style={{ color: '#bae6fd' }}>{msg.knowledgeHubDoc.savedFilePath}</code></span>
                          )}
                          <span>Available to all swarm agents via <code style={{ color: '#bae6fd' }}>search_knowledge_base</code></span>
                        </div>
                      </div>
                    )}

                    {/* Render Referenced Knowledge Hub Documents (pgvector RAG Citations) if present */}
                    {Array.isArray(msg.ragCitations) && msg.ragCitations.length > 0 && (
                      <div style={{
                        marginBottom: '12px',
                        borderRadius: '10px',
                        border: '1px solid rgba(139, 92, 246, 0.35)',
                        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(15, 23, 42, 0.92) 100%)',
                        padding: '10px 14px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: '#c4b5fd' }}>
                            <span>📚</span>
                            <span>Referenced Knowledge Hub Document{msg.ragCitations.length > 1 ? 's' : ''} (pgvector RAG)</span>
                          </div>
                          <span className="badge badge-purple" style={{ fontSize: '9.5px' }}>
                            {msg.ragCitations.length} Source{msg.ragCitations.length > 1 ? 's' : ''} Cited
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {msg.ragCitations.map((cite, cIdx) => (
                            <div key={cite.documentId || cIdx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'rgba(15, 23, 42, 0.75)',
                              border: '1px solid rgba(139, 92, 246, 0.25)',
                              fontSize: '11px'
                            }}>
                              <FileText size={12} color="#a78bfa" />
                              <span style={{ fontWeight: 600, color: '#f8fafc' }}>{cite.title}</span>
                              <span style={{ color: '#94a3b8' }}>({cite.source})</span>
                              {cite.score && (
                                <span style={{ color: '#34d399', fontWeight: 600 }}>
                                  {(cite.score * 100).toFixed(0)}% match
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Render Inline Parallel Swarm Plan Approval Card if present */}
                    {msg.pendingSwarmApproval && (
                      <div style={{
                        marginBottom: '14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(15, 23, 42, 0.92) 100%)',
                        padding: '14px 16px',
                        boxShadow: '0 8px 22px rgba(0, 0, 0, 0.3)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                            <span>⚡</span>
                            <span>Phase 2: Parallel Multi-Agent Swarm Plan ({msg.pendingSwarmApproval.tasks?.length || 5} Agents)</span>
                          </div>
                          <span className="badge badge-amber" style={{ fontSize: '10px' }}>
                            Awaiting User Approval
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                          {(msg.pendingSwarmApproval.tasks || []).map((t, idx) => (
                            <div key={idx} style={{
                              padding: '7px 10px',
                              borderRadius: '7px',
                              background: 'rgba(15, 23, 42, 0.65)',
                              border: '1px solid rgba(148, 163, 184, 0.15)',
                              fontSize: '11.5px'
                            }}>
                              <div style={{ fontWeight: 600, color: '#a78bfa' }}>{t.agentId}</div>
                              <div style={{ color: '#cbd5e1', marginTop: '2px' }}>{t.task}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            className="btn btn-emerald"
                            style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={async () => {
                              try {
                                await api.resolveApproval(
                                  msg.pendingSwarmApproval.approvalId,
                                  msg.pendingSwarmApproval.executionId,
                                  'approved',
                                  'Approved via inline Parallel Swarm Plan card'
                                );
                              } catch (err) {
                                console.error('Inline approval failed:', err);
                              }
                            }}
                          >
                            <CheckCircle2 size={14} /> Approve Plan & Launch Parallel Swarm
                          </button>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                            Or type <strong style={{ color: '#e2e8f0' }}>"approve"</strong> in chat to start implementation
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Render Structured Deliverable Card if present */}
                    {msg.deliverableSummary && (
                      <div style={{
                        marginBottom: '14px',
                        borderRadius: '12px',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)',
                        padding: '16px 18px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <CheckCircle2 size={18} color="#10b981" />
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                            {msg.deliverableSummary.title || 'Deliverable Summary'}
                          </span>
                          <span className="badge badge-emerald" style={{ marginLeft: 'auto', fontSize: '10px' }}>
                            Ready
                          </span>
                        </div>
                        
                        <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                          {msg.deliverableSummary.summary}
                        </p>

                        {/* Files Created Badges */}
                        {Array.isArray(msg.deliverableSummary.filesCreated) && msg.deliverableSummary.filesCreated.length > 0 && (
                          <div style={{ marginBottom: '14px' }}>
                            <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                              Created Repository Files:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {msg.deliverableSummary.filesCreated.map((file, fIdx) => (
                                <div
                                  key={fIdx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    border: '1px solid rgba(99, 102, 241, 0.35)',
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                    color: '#a5b4fc'
                                  }}
                                >
                                  <FileCode size={13} color="#818cf8" />
                                  <span>{file}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Interactive Chrome Browser Testing Action Button */}
                        {msg.deliverableSummary.readyForTesting && (
                          <div style={{
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Globe size={15} color="#38bdf8" />
                              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
                                Chrome Testing Target: <strong style={{ color: '#38bdf8' }}>{msg.deliverableSummary.targetUrl || 'http://127.0.0.1:5000'}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleExecute(null, `Willow, launch Google Chrome browser to test ${msg.deliverableSummary.targetUrl || 'http://127.0.0.1:5000'}`)}
                              className="btn btn-primary"
                              style={{
                                fontSize: '12px',
                                padding: '6px 14px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                                border: 'none',
                                borderRadius: '6px',
                                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                              }}
                            >
                              <Play size={13} />
                              Launch Chrome Test (HITL Review)
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Antigravity Scratchpad Memory Drawer — Rendered Intelligently Only When Required */}
                    {msg.scratchpad && msg.scratchpad.isActive !== false && (
                      (msg.scratchpad.filesCreated?.length > 0) ||
                      (msg.scratchpad.observations?.length > 0) ||
                      (msg.scratchpad.issuesFound?.length > 0) ||
                      (msg.scratchpad.fixHistory?.length > 0)
                    ) && (
                      <div style={{
                        marginTop: '10px',
                        marginBottom: '10px',
                        borderRadius: '8px',
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        background: 'rgba(15, 23, 42, 0.6)',
                        overflow: 'hidden'
                      }}>
                        <div
                          onClick={() => setExpandedThoughts(prev => ({ ...prev, [`scratchpad_${msg.id || idx}`]: !prev[`scratchpad_${msg.id || idx}`] }))}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            background: 'rgba(255, 255, 255, 0.02)',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Compass size={14} color="#38bdf8" />
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                              Antigravity Scratchpad Memory
                            </span>
                            <span className="badge badge-cyan" style={{ fontSize: '9px', padding: '2px 6px' }}>
                              {msg.scratchpad.currentStage || 'active'}
                            </span>
                          </div>
                          {expandedThoughts[`scratchpad_${msg.id || idx}`] ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
                        </div>

                        {expandedThoughts[`scratchpad_${msg.id || idx}`] && (
                          <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>GOAL:</span>
                              <div style={{ color: '#e2e8f0', marginTop: '2px' }}>{msg.scratchpad.goal}</div>
                            </div>
                            <div>
                              <span style={{ color: '#64748b', fontSize: '11px' }}>ENVIRONMENT:</span>
                              <div style={{ color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px' }}>
                                {msg.scratchpad.activeEnvironment} ({msg.scratchpad.browser || 'Google Chrome'})
                              </div>
                            </div>
                            {msg.scratchpad.plan && msg.scratchpad.plan.length > 0 && (
                              <div>
                                <span style={{ color: '#64748b', fontSize: '11px' }}>EXECUTION PLAN:</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                                  {msg.scratchpad.plan.map((step, sIdx) => (
                                    <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                                      <CheckCircle2 size={12} color="#10b981" />
                                      <span>{step}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {msg.scratchpad.observations && msg.scratchpad.observations.length > 0 && (
                              <div>
                                <span style={{ color: '#64748b', fontSize: '11px' }}>OBSERVATIONS:</span>
                                <div style={{ background: '#070a10', padding: '6px 8px', borderRadius: '4px', marginTop: '4px', fontFamily: 'monospace', fontSize: '11px', color: '#a5f3fc', whiteSpace: 'pre-wrap' }}>
                                  {msg.scratchpad.observations.join('\n')}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {(!msg.deliverableSummary || !msg.content || typeof msg.content === 'string') && (
                      <div style={{ color: '#f1f5f9' }}>
                        {formatMessageContent(msg.content)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Gemini-Style Circular Thinking & Live Agent Accessed Indicator */}
          {isExecuting && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxWidth: '860px',
              width: '100%',
              margin: '0 auto',
              alignSelf: 'flex-start',
              animation: 'fadeIn 0.25s ease'
            }}>
              {/* Collapsible Live Thinking Dropdown Container */}
              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                backdropFilter: 'blur(12px)'
              }}>
                {/* Clickable Header Bar */}
                <div 
                  onClick={() => setIsLiveThinkingOpen(!isLiveThinkingOpen)}
                  style={{
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
                    userSelect: 'none',
                    borderBottom: isLiveThinkingOpen ? '1px solid rgba(255, 255, 255, 0.08)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Circular Halo Spinner */}
                    <div className="gemini-thinking-spinner">
                      <div className="gemini-thinking-inner" />
                    </div>

                    {/* Live Active Agent Tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '15px' }}>{activeExecutingAgent?.avatar || selectedAgent?.avatar || '🌿'}</span>
                      <strong style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
                        {activeExecutingAgent?.agentName || activeExecutingAgent?.name || selectedAgent?.name || 'Willow'}
                      </strong>
                    </div>

                    <span className="badge badge-emerald" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '2px 7px' }}>
                      {activeExecutingAgent?.status === 'delegated' ? 'Delegated Specialist' : (activeExecutingAgent?.status === 'tool_execution' ? `Tool: ${activeExecutingAgent.toolId || 'Running'}` : 'Thinking')}
                    </span>

                    <span style={{ color: 'var(--border-subtle)', margin: '0 1px' }}>•</span>

                    {/* Shimmering Status */}
                    <span className="gemini-shimmer-text" style={{ fontSize: '12px' }}>
                      {activeExecutingAgent?.task
                        ? `Delegated: ${activeExecutingAgent.task.substring(0, 36)}...`
                        : (activeExecutingAgent?.status === 'tool_execution'
                            ? `Executing tool ${activeExecutingAgent.toolName || activeExecutingAgent.toolId}...`
                            : (liveThought ? 'Reasoning autonomously...' : 'Thinking...'))}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {thinkingSeconds}s
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {isLiveThinkingOpen ? 'Collapse' : 'Open live thinking'}
                      {isLiveThinkingOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </div>
                </div>

                {/* Expandable Live Body */}
                {isLiveThinkingOpen && (
                  <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Live Agent and Tool Trace Timeline */}
                    {liveAgentTrace && liveAgentTrace.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Active Agent & Tool Pipeline:
                        </span>
                        {liveAgentTrace.map((tr, idx) => (
                          <div key={tr.id || idx} style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '11.5px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{tr.avatar || '🤖'}</span>
                              <strong style={{ color: 'var(--text-primary)' }}>{tr.agentName}</strong>
                              {tr.toolId ? (
                                <span className="badge badge-cyan" style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                                  Invoked: {tr.toolId}
                                </span>
                              ) : (
                                <span className="badge badge-indigo" style={{ fontSize: '10px' }}>
                                  {tr.status || 'Reasoning'}
                                </span>
                              )}
                              {tr.parameters?.filePath && (
                                <code style={{ fontSize: '10.5px', color: 'var(--accent-emerald)' }}>{tr.parameters.filePath}</code>
                              )}
                              {tr.parameters?.dirPath && (
                                <code style={{ fontSize: '10.5px', color: 'var(--accent-amber)' }}>{tr.parameters.dirPath}</code>
                              )}
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--accent-emerald)' }}>
                              {tr.status === 'completed' || tr.status === 'tool_completed' ? '✓ Done' : '⚡ Running'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Live Chain-of-Thought Stream Box */}
                    {liveThought && (
                      <div style={{
                        padding: '10px 14px',
                        backgroundColor: 'rgba(99, 102, 241, 0.08)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        color: '#cbd5e1',
                        fontFamily: 'var(--font-mono)',
                        lineHeight: '1.5',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}>
                        <Sparkles size={14} color="var(--accent-indigo)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          <strong style={{ color: 'var(--accent-indigo)', marginRight: '6px' }}>Live Reasoning:</strong>
                          {liveThought}
                          <span className="streaming-cursor" style={{ display: 'inline-block', width: '6px', height: '12px', backgroundColor: 'var(--accent-indigo)', marginLeft: '4px', verticalAlign: 'middle' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Real-Time Live Streaming Content Bubble */}
              {streamingContent && (
                <div style={{
                  display: 'flex',
                  gap: '14px',
                  maxWidth: '860px',
                  width: '100%',
                  alignSelf: 'flex-start'
                }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '16px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    {activeExecutingAgent?.avatar || selectedAgent?.avatar || '🌿'}
                  </div>
                  <div style={{
                    flex: 1,
                    padding: '16px 20px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    color: 'var(--text-primary)',
                    fontSize: '13.5px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                  }}>
                    {streamingContent}
                    <span className="streaming-cursor" style={{ display: 'inline-block', width: '8px', height: '15px', backgroundColor: 'var(--accent-cyan)', marginLeft: '4px', verticalAlign: 'text-bottom' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Prompt Input Area */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Repository Authorization Banner if not authorized */}
          {!workspaceInfo?.isAuthorized && (
            <div style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: '12px',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fef3c7' }}>
                <ShieldAlert size={16} color="var(--accent-amber)" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Repository Folder Access Required</strong>: Agents need your permission to create files and folders in your repository (<code style={{ color: 'var(--accent-cyan)' }}>{workspaceInfo?.repoPath || 'Workspace'}</code>).
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenRepoAccess}
                className="btn btn-primary"
                style={{
                  fontSize: '11px',
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                <FolderPlus size={14} />
                <span>Grant Repository Access</span>
              </button>
            </div>
          )}

          {/* Quick Slash Commands / Action Chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { label: '⚡ AutoGen: Plan & Run Parallel Swarm', prompt: 'Willow, please formulate an AutoGen execution plan and invoke the agents in parallel to architect, code, test, and audit a robust JWT authentication system.' },
              { label: '⚡ AutoGen: Parallel Distributed Cache', prompt: 'Willow, plan and invoke the agents in parallel using the AutoGen framework for a high-performance Redis cache layer.' },
              { label: '📁 Willow, create a folder', prompt: 'Willow, please create a new folder named src/modules/auth in the repository.' },
              { label: '📝 Willow, create a file', prompt: 'Willow, please create a file named README_HARNESS.md with harness platform overview in the repository.' },
              { label: '🌿 Ask Willow: How do you work?', prompt: 'Hi Willow! Explain how you orchestrate and coordinate the specialist SDLC agents.' },
              { label: '🧪 Willow, run our QA test suite', prompt: 'Willow, please invoke the QA agent to run our regression test suite and verify coverage.' },
              { label: '🛡️ Willow, run a security scan', prompt: 'Willow, please have the AppSec Auditor scan our codebase for OWASP vulnerabilities and secret leaks.' },
              { label: '💻 Willow, implement a feature', prompt: 'Willow, task the Full-Stack Senior Engineer with implementing a robust rate limiter with Redis caching.' }
            ].map(chip => (
              <button
                key={chip.label}
                onClick={() => setInputPrompt(chip.prompt)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <Code2 size={11} /> {chip.label}
              </button>
            ))}
          </div>

          {/* Attachment Staging Tray */}
          {attachments.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              borderRadius: '8px',
              overflowX: 'auto',
              animation: 'fadeIn 0.2s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 600, flexShrink: 0 }}>
                <Paperclip size={13} />
                <span>Attached ({attachments.length}):</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', flex: 1, overflowX: 'auto', padding: '2px 0' }}>
                {attachments.map((att, aIdx) => (
                  <div key={att.id || aIdx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(0, 0, 0, 0.55)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    flexShrink: 0
                  }}>
                    {att.isImage ? (
                      <img src={att.dataUrl} alt={att.name} style={{ width: '22px', height: '22px', objectFit: 'cover', borderRadius: '4px' }} />
                    ) : (
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        {att.name?.match(/\.(js|jsx|ts|tsx|py|html|css|json|sql|sh)$/i) ? <FileCode size={13} /> : <FileText size={13} />}
                      </span>
                    )}
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }} title={att.name}>
                      {att.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      ({att.formattedSize})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      title="Remove attachment"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setAttachments([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-rose)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {/* Upload File / Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload file or image (or drag & drop)"
              className="btn btn-secondary"
              disabled={isExecuting}
              style={{
                height: '44px',
                padding: '0 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-cyan)';
                e.currentTarget.style.color = 'var(--accent-cyan)';
                e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              }}
            >
              <Paperclip size={17} />
              <span style={{ fontSize: '12px' }}>Upload</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              style={{ display: 'none' }}
            />

            <input
              type="text"
              placeholder={selectedAgent?.id === 'agent-willow' 
                ? (attachments.length > 0 ? "Add instructions for attached files, or press Send to analyze..." : "Ask Willow anything or drag & drop files here...")
                : (attachments.length > 0 ? `Add instructions for ${selectedAgent?.name}...` : `Ask ${selectedAgent?.name} directly or attach files...`)
              }
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              disabled={isExecuting}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: '14px',
                backgroundColor: 'rgba(10, 13, 20, 0.9)'
              }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isExecuting || (!inputPrompt.trim() && attachments.length === 0)}
              style={{ padding: '0 20px', height: '44px' }}
            >
              <Send size={16} /> Send
            </button>
          </form>
        </div>

        {/* Drag & Drop Visual Overlay */}
        {isDragging && (
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            backgroundColor: 'rgba(10, 15, 30, 0.88)',
            backdropFilter: 'blur(8px)',
            border: '2px dashed var(--accent-cyan)',
            borderRadius: '12px',
            margin: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            animation: 'fadeIn 0.15s ease',
            pointerEvents: 'none'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(6, 182, 212, 0.35)'
            }}>
              <Upload size={36} color="var(--accent-cyan)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                Drop files or images here
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--accent-cyan)', margin: 0 }}>
                Attach to your conversation for autonomous AI reasoning & analysis
              </p>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Supports images (PNG, JPG, WebP), source code (.js, .py, .html), documents, configs & data
              </div>
            </div>
          </div>
        )}

        {/* Modal for full image / file inspection */}
        {previewModalItem && (
          <div 
            onClick={() => setPreviewModalItem(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '90vw',
                maxHeight: '90vh',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'rgba(0,0,0,0.3)'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {previewModalItem.name} ({previewModalItem.formattedSize || formatFileSize(previewModalItem.size)})
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewModalItem(null)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <X size={14} /> Close
                </button>
              </div>
              <div style={{ padding: '16px', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
                {previewModalItem.dataUrl && (previewModalItem.isImage || previewModalItem.type?.startsWith('image/')) ? (
                  <img src={previewModalItem.dataUrl} alt={previewModalItem.name} style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px', objectFit: 'contain' }} />
                ) : (
                  <pre style={{ margin: 0, fontSize: '12px', color: '#cbd5e1', fontFamily: 'var(--font-mono)', maxHeight: '75vh', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {previewModalItem.textContent || previewModalItem.snippet || 'Binary file content'}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
