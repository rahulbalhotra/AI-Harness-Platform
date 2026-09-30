import React, { useState, useEffect, useMemo } from 'react';
import {
  Kanban,
  FileText,
  Calendar,
  Users,
  Plus,
  Search,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  Tag,
  ArrowRight,
  Filter,
  Layers,
  X,
  Send,
  Trash2,
  RefreshCw,
  ExternalLink,
  Target,
  FileCode,
  Zap,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';

import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  getStories,
  createStory,
  updateStory,
  transitionStory,
  deleteStory,
  generateStories
} from '../services/api';

const STATUS_COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.25)', icon: Clock },
  { id: 'in_progress', label: 'In Progress', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.3)', icon: PlayCircle },
  { id: 'review', label: 'Review & QA', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.3)', icon: AlertCircle },
  { id: 'done', label: 'Done', color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.3)', icon: CheckCircle2 }
];

const PRIORITY_CONFIG = {
  highest: { label: 'Highest', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', icon: '🔺' },
  high: { label: 'High', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)', icon: '🔼' },
  medium: { label: 'Medium', color: '#facc15', bg: 'rgba(250, 204, 21, 0.15)', icon: '⏸️' },
  low: { label: 'Low', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', icon: '🔽' }
};

const TYPE_CONFIG = {
  story: { label: 'Story', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)', icon: '📗' },
  task: { label: 'Task', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', icon: '☑️' },
  bug: { label: 'Bug', color: '#f87171', bg: 'rgba(248, 113, 113, 0.15)', icon: '🐞' },
  epic: { label: 'Epic', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', icon: '⚡' }
};

export default function ProjectManagementHub({
  agents = [],
  activeAgentId = null,
  currentUser = null,
  isConnected = true
}) {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [currentProject, setCurrentProject] = useState(null);
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState('board'); // 'board' | 'brd' | 'plan' | 'roster'

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Modals & Drawers
  const [selectedStory, setSelectedStory] = useState(null);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [commentText, setCommentText] = useState('');

  // New Story Form State
  const [newStory, setNewStory] = useState({
    title: '',
    description: '',
    type: 'story',
    priority: 'high',
    assignedAgentId: 'agent-senior-engineer',
    storyPoints: 5,
    startDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    targetFiles: ''
  });

  // Load Initial Data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const projList = await getProjects();
      setProjects(projList);
      if (projList.length > 0) {
        const activeId = selectedProjectId || projList[0].id;
        setSelectedProjectId(activeId);
        const detailed = await getProject(activeId);
        setCurrentProject(detailed);
        setStories(detailed.stories || []);
      }
    } catch (err) {
      console.error('Failed loading project management data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    const fetchProj = async () => {
      try {
        const detailed = await getProject(selectedProjectId);
        setCurrentProject(detailed);
        setStories(detailed.stories || []);
      } catch (err) {
        console.error('Failed fetching project:', err);
      }
    };
    fetchProj();
  }, [selectedProjectId]);

  // WebSocket Live Listener
  useEffect(() => {
    const handleWsMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'STORY_UPDATED' || data.type === 'PARALLEL_AGENT_STARTED' || data.type === 'PARALLEL_AGENT_COMPLETED') {
          // Refresh stories silently
          if (selectedProjectId) {
            getStories(selectedProjectId).then(updated => {
              if (Array.isArray(updated)) setStories(updated);
            }).catch(() => {});
          }
        } else if (data.type === 'PROJECT_UPDATED') {
          getProjects().then(projs => setProjects(projs)).catch(() => {});
          if (selectedProjectId) {
            getProject(selectedProjectId).then(p => setCurrentProject(p)).catch(() => {});
          }
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWsMessage);
    return () => window.removeEventListener('message', handleWsMessage);
  }, [selectedProjectId]);

  // Filtered stories for board
  const filteredStories = useMemo(() => {
    return stories.filter(story => {
      if (agentFilter !== 'all' && story.assignedAgentId !== agentFilter) return false;
      if (typeFilter !== 'all' && story.type !== typeFilter) return false;
      if (priorityFilter !== 'all' && story.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = story.title?.toLowerCase().includes(q);
        const matchKey = story.id?.toLowerCase().includes(q);
        const matchDesc = story.description?.toLowerCase().includes(q);
        const matchAgent = story.assignedAgentName?.toLowerCase().includes(q);
        if (!matchTitle && !matchKey && !matchDesc && !matchAgent) return false;
      }
      return true;
    });
  }, [stories, agentFilter, typeFilter, priorityFilter, searchQuery]);

  // Progress metrics
  const totalPoints = useMemo(() => stories.reduce((sum, s) => sum + (Number(s.storyPoints) || 0), 0), [stories]);
  const completedPoints = useMemo(() => stories.filter(s => s.status === 'done').reduce((sum, s) => sum + (Number(s.storyPoints) || 0), 0), [stories]);
  const progressPercent = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

  // Handle Quick Status Transition
  const handleTransition = async (storyId, newStatus) => {
    try {
      const updated = await transitionStory(storyId, newStatus, currentUser?.name || 'Operator');
      setStories(prev => prev.map(s => s.id === storyId ? updated : s));
      if (selectedStory?.id === storyId) {
        setSelectedStory(updated);
      }
    } catch (err) {
      alert(`Error updating story status: ${err.message}`);
    }
  };

  // Move Next / Prev Column
  const handleMoveColumn = (story, direction) => {
    const statusOrder = ['todo', 'in_progress', 'review', 'done'];
    const currentIndex = statusOrder.indexOf(story.status);
    if (currentIndex === -1) return;
    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= 0 && targetIndex < statusOrder.length) {
      handleTransition(story.id, statusOrder[targetIndex]);
    }
  };

  // Create Story Submission
  const handleCreateStorySubmit = async (e) => {
    e.preventDefault();
    if (!newStory.title.trim()) return;

    try {
      const assigned = agents.find(a => a.id === newStory.assignedAgentId) || {
        name: 'Specialist Agent',
        avatar: '🤖'
      };

      const files = newStory.targetFiles
        .split(',')
        .map(f => f.trim())
        .filter(Boolean);

      const created = await createStory({
        projectId: selectedProjectId,
        title: newStory.title,
        description: newStory.description,
        type: newStory.type,
        priority: newStory.priority,
        assignedAgentId: newStory.assignedAgentId,
        assignedAgentName: assigned.name,
        avatar: assigned.avatar,
        storyPoints: Number(newStory.storyPoints) || 3,
        startDate: new Date(newStory.startDate).toISOString(),
        dueDate: new Date(newStory.dueDate).toISOString(),
        targetFiles: files
      });

      setStories(prev => [...prev, created]);
      setIsCreateStoryOpen(false);
      setNewStory({
        title: '',
        description: '',
        type: 'story',
        priority: 'high',
        assignedAgentId: 'agent-senior-engineer',
        storyPoints: 5,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        targetFiles: ''
      });
    } catch (err) {
      alert(`Failed to create story: ${err.message}`);
    }
  };

  // Autonomous AI Story Generation
  const handleGenerateStories = async () => {
    try {
      setIsGenerating(true);
      const res = await generateStories(selectedProjectId, aiPrompt);
      if (res.stories && res.stories.length > 0) {
        setStories(prev => [...prev, ...res.stories]);
        setIsAIGeneratorOpen(false);
        setAiPrompt('');
      }
    } catch (err) {
      alert(`AI generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Add Comment to Active Story
  const handleAddComment = async () => {
    if (!commentText.trim() || !selectedStory) return;
    try {
      const updatedLog = [
        ...(selectedStory.activityLog || []),
        {
          timestamp: new Date().toISOString(),
          text: `[${currentUser?.name || 'Operator'}] ${commentText.trim()}`
        }
      ];
      const updated = await updateStory(selectedStory.id, { activityLog: updatedLog });
      setSelectedStory(updated);
      setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
      setCommentText('');
    } catch (err) {
      alert(`Failed to add comment: ${err.message}`);
    }
  };

  // Delete Story
  const handleDeleteStory = async (storyId) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    try {
      await deleteStory(storyId);
      setStories(prev => prev.filter(s => s.id !== storyId));
      if (selectedStory?.id === storyId) setSelectedStory(null);
    } catch (err) {
      alert(`Failed to delete story: ${err.message}`);
    }
  };

  // Calculate timeline days remaining
  const getTimelineInfo = (start, due) => {
    if (!due) return { label: 'No due date', isOverdue: false };
    const dueDate = new Date(due);
    const now = new Date();
    const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { label: 'Due today', isOverdue: false };
    return { label: `${diffDays}d remaining`, isOverdue: false };
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* ===================== TOP HEADER / PROJECT TOOLBAR ===================== */}
      <div style={{
        padding: '14px 20px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Project Icon & Name */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #6366f1, #38bdf8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '16px',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)'
            }}>
              {currentProject?.key || 'PRJ'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                      [{p.key}] {p.name}
                    </option>
                  ))}
                </select>

                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(52, 211, 153, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'pulse 1.5s infinite' }} />
                  Live Sync
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Lead: <strong style={{ color: '#c7d2fe' }}>Willow (Autonomous SDLC Orchestrator)</strong> • {stories.length} User Stories • {totalPoints} Story Points
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '160px',
            paddingLeft: '16px',
            borderLeft: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span>Sprint Progress</span>
              <strong style={{ color: '#38bdf8' }}>{progressPercent}%</strong>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: 'rgba(255, 255, 255, 0.1)',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8, #34d399)',
                transition: 'width 0.4s ease'
              }} />
            </div>
          </div>
        </div>

        {/* View Switcher Navigation */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          padding: '3px',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)'
        }}>
          {[
            { id: 'board', label: 'Kanban Board', icon: Kanban },
            { id: 'brd', label: 'BRD & Requirements', icon: FileText },
            { id: 'plan', label: 'Project Plan & Gantt', icon: Calendar },
            { id: 'roster', label: 'Agent Swarm Roster', icon: Users }
          ].map(view => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isActive ? 'var(--accent-indigo)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} />
                {view.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsAIGeneratorOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '6px',
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.35)',
              color: '#c084fc',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Sparkles size={14} />
            AI Story Generator
          </button>

          <button
            onClick={() => setIsCreateStoryOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '6px',
              background: 'var(--accent-indigo)',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}
          >
            <Plus size={14} />
            Create Issue
          </button>
        </div>
      </div>

      {/* ===================== VIEW 1: KANBAN BOARD ===================== */}
      {activeView === 'board' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Filters Bar */}
          <div style={{
            padding: '10px 20px',
            backgroundColor: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
              <div style={{
                position: 'relative',
                flex: 1,
                maxWidth: '300px'
              }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter stories, keys, or files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Agent Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Agent:</span>
                <select
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Agents</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Priority:</span>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Priorities</option>
                  <option value="highest">🔺 Highest</option>
                  <option value="high">🔼 High</option>
                  <option value="medium">⏸️ Medium</option>
                  <option value="low">🔽 Low</option>
                </select>
              </div>

              {/* Type Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">All Types</option>
                  <option value="story">📗 Story</option>
                  <option value="task">☑️ Task</option>
                  <option value="bug">🐞 Bug</option>
                  <option value="epic">⚡ Epic</option>
                </select>
              </div>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filteredStories.length} of {stories.length} issues
            </div>
          </div>

          {/* Kanban Columns Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '14px',
            padding: '16px 20px',
            flex: 1,
            overflowX: 'auto',
            overflowY: 'hidden',
            backgroundColor: 'var(--bg-primary)'
          }}>
            {STATUS_COLUMNS.map(col => {
              const colStories = filteredStories.filter(s => s.status === col.id);
              const colPoints = colStories.reduce((acc, s) => acc + (Number(s.storyPoints) || 0), 0);
              const Icon = col.icon;

              return (
                <div
                  key={col.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '10px',
                    border: `1px solid ${col.border}`,
                    overflow: 'hidden'
                  }}
                >
                  {/* Column Header */}
                  <div style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: col.bg
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon size={16} color={col.color} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {col.label}
                      </span>
                      <span style={{
                        fontSize: '11px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--text-secondary)'
                      }}>
                        {colStories.length}
                      </span>
                    </div>

                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {colPoints} pts
                    </span>
                  </div>

                  {/* Stories Scroll Container */}
                  <div style={{
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    flex: 1,
                    overflowY: 'auto'
                  }}>
                    {colStories.length === 0 ? (
                      <div style={{
                        padding: '30px 10px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: '8px'
                      }}>
                        No issues in {col.label}
                      </div>
                    ) : (
                      colStories.map(story => {
                        const priorityInfo = PRIORITY_CONFIG[story.priority] || PRIORITY_CONFIG.medium;
                        const typeInfo = TYPE_CONFIG[story.type] || TYPE_CONFIG.story;
                        const timeline = getTimelineInfo(story.startDate, story.dueDate);

                        return (
                          <div
                            key={story.id}
                            onClick={() => setSelectedStory(story)}
                            style={{
                              padding: '12px',
                              backgroundColor: 'var(--bg-tertiary)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-subtle)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            {/* Card Top: Key, Type, Priority */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  color: '#818cf8',
                                  fontFamily: 'var(--font-mono)'
                                }}>
                                  {story.id}
                                </span>
                                <span style={{
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: typeInfo.bg,
                                  color: typeInfo.color,
                                  fontWeight: 600
                                }}>
                                  {typeInfo.icon} {typeInfo.label}
                                </span>
                              </div>

                              <span style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: priorityInfo.bg,
                                color: priorityInfo.color,
                                fontWeight: 600
                              }}>
                                {priorityInfo.icon} {priorityInfo.label}
                              </span>
                            </div>

                            {/* Title */}
                            <div style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              lineHeight: 1.3
                            }}>
                              {story.title}
                            </div>

                            {/* Target Files Pills */}
                            {story.targetFiles && story.targetFiles.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {story.targetFiles.slice(0, 2).map((f, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      color: 'var(--text-secondary)',
                                      fontFamily: 'var(--font-mono)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                  >
                                    <FileCode size={10} />
                                    {f.split('/').pop()}
                                  </span>
                                ))}
                                {story.targetFiles.length > 2 && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                    +{story.targetFiles.length - 2} more
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Card Footer: Assigned Agent & Timeline */}
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingTop: '6px',
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                              marginTop: '2px'
                            }}>
                              {/* Agent Pill */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                padding: '2px 6px',
                                borderRadius: '12px'
                              }}>
                                <span style={{ fontSize: '12px' }}>{story.avatar || '🤖'}</span>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  color: 'var(--text-secondary)',
                                  maxWidth: '100px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {story.assignedAgentName?.split(' ')[0] || 'Agent'}
                                </span>
                              </div>

                              {/* Story Points & Timeline */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  fontSize: '10px',
                                  color: timeline.isOverdue ? '#f87171' : 'var(--text-muted)',
                                  fontWeight: timeline.isOverdue ? 600 : 400
                                }}>
                                  {timeline.label}
                                </span>
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  background: 'rgba(99, 102, 241, 0.2)',
                                  color: '#a5b4fc'
                                }}>
                                  {story.storyPoints}p
                                </span>
                              </div>
                            </div>

                            {/* Quick Move Buttons */}
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingTop: '4px'
                              }}
                            >
                              <button
                                disabled={col.id === 'todo'}
                                onClick={() => handleMoveColumn(story, 'prev')}
                                title="Move Back"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: col.id === 'todo' ? 'transparent' : 'var(--text-muted)',
                                  cursor: col.id === 'todo' ? 'default' : 'pointer',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                <ChevronLeft size={14} />
                              </button>

                              <button
                                disabled={col.id === 'done'}
                                onClick={() => handleMoveColumn(story, 'next')}
                                title="Advance Issue"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: col.id === 'done' ? 'transparent' : '#38bdf8',
                                  cursor: col.id === 'done' ? 'default' : 'pointer',
                                  padding: '2px 4px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  fontSize: '10px',
                                  fontWeight: 600
                                }}
                              >
                                Advance <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: BRD & REQUIREMENTS ===================== */}
      {activeView === 'brd' && (
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div style={{
            maxWidth: '900px',
            margin: '0 auto',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '28px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--accent-indigo)',
                  letterSpacing: '0.05em'
                }}>
                  Business Requirements Document (BRD)
                </span>
                <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '6px 0', color: 'var(--text-primary)' }}>
                  {currentProject?.brd?.title || `${currentProject?.name} — Requirements Specification`}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Maintained autonomously by 🔬 <strong>Product Research Lead (agent-researcher)</strong> and ingested into Knowledge Hub.
                </p>
              </div>

              <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                background: 'rgba(52, 211, 153, 0.15)',
                color: '#34d399',
                fontSize: '12px',
                fontWeight: 600
              }}>
                Approved & Baselined
              </span>
            </div>

            {/* Executive Summary */}
            <div style={{
              backgroundColor: 'var(--bg-tertiary)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '20px',
              borderLeft: '4px solid var(--accent-indigo)'
            }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: '#c7d2fe' }}>
                Executive Summary
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {currentProject?.brd?.executiveSummary || currentProject?.description}
              </p>
            </div>

            {/* Business Goals */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Target size={16} color="#38bdf8" /> Core Business Goals
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(currentProject?.brd?.businessGoals || [
                  'Deliver 1,000+ item catalog search and categorization.',
                  'Real-time persistent shopping cart drawer.',
                  'Instant 1-click checkout with order receipts.'
                ]).map((goal, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '13px'
                  }}>
                    <CheckCircle2 size={16} color="#34d399" />
                    <span>{goal}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Target Audience & Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#facc15', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} /> Target Audience
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {currentProject?.brd?.targetAudience || 'Enterprise consumers, Prime members, and administration staff.'}
                </p>
              </div>

              <div style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)'
              }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <TrendingUp size={14} /> Success Metrics (KPIs)
                </h4>
                <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '18px', lineHeight: 1.6 }}>
                  {(currentProject?.brd?.successMetrics || [
                    'Cart abandonment rate < 20%',
                    'Sub-100ms API response time',
                    'Zero high-severity OWASP findings'
                  ]).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 3: PROJECT PLAN & TIMELINE (GANTT) ===================== */}
      {activeView === 'plan' && (
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div style={{
            maxWidth: '1000px',
            margin: '0 auto',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '24px'
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Multi-Stage Project Plan & Autonomous Roadmap
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Chronological phase execution orchestrated across specialist agents with milestone delivery targets.
              </p>
            </div>

            {/* Phases List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(currentProject?.plan?.phases || [
                { id: 'p1', name: 'Discovery & Research', status: 'completed', owner: 'agent-researcher', timeline: 'Day 1' },
                { id: 'p2', name: 'Architecture & RFC Blueprints', status: 'completed', owner: 'agent-architect', timeline: 'Day 1 - 2' },
                { id: 'p3', name: 'Full-Stack Implementation', status: 'in_progress', owner: 'agent-senior-engineer', timeline: 'Day 2 - 3' },
                { id: 'p4', name: 'Automated QA & Browser Testing', status: 'in_progress', owner: 'agent-qa-synthesizer', timeline: 'Day 3 - 4' },
                { id: 'p5', name: 'AppSec Audit & Production Release', status: 'todo', owner: 'agent-secops-auditor', timeline: 'Day 4 - 5' }
              ]).map((phase, idx) => {
                const ownerAgent = agents.find(a => a.id === phase.owner) || {
                  name: phase.owner,
                  avatar: '🤖',
                  role: 'Specialist'
                };

                const isDone = phase.status === 'completed';
                const isWorking = phase.status === 'in_progress';

                return (
                  <div
                    key={phase.id || idx}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: `1px solid ${isWorking ? 'rgba(56, 189, 248, 0.4)' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isDone ? 'rgba(52, 211, 153, 0.2)' : (isWorking ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)'),
                        color: isDone ? '#34d399' : (isWorking ? '#38bdf8' : 'var(--text-muted)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px'
                      }}>
                        {idx + 1}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {phase.name}
                          </h4>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: isDone ? 'rgba(52, 211, 153, 0.15)' : (isWorking ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                            color: isDone ? '#34d399' : (isWorking ? '#38bdf8' : 'var(--text-muted)'),
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {phase.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Timeline: <strong>{phase.timeline}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Owner Agent Badge */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid var(--border-subtle)'
                    }}>
                      <span style={{ fontSize: '16px' }}>{ownerAgent.avatar}</span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {ownerAgent.name}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {ownerAgent.role}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 4: AGENT WORKLOAD ROSTER ===================== */}
      {activeView === 'roster' && (
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Autonomous Agent Swarm Roster & Live Story Assignments
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Real-time tracking of which specialist agent is allocated to which user story, workload, and delivery status.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '16px'
            }}>
              {agents.map(agent => {
                const assignedStories = stories.filter(s => s.assignedAgentId === agent.id);
                const activeStories = assignedStories.filter(s => s.status === 'in_progress');
                const doneStories = assignedStories.filter(s => s.status === 'done');
                const points = assignedStories.reduce((acc, s) => acc + (Number(s.storyPoints) || 0), 0);

                return (
                  <div
                    key={agent.id}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px'
                        }}>
                          {agent.avatar}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {agent.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {agent.role}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: activeStories.length > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: activeStories.length > 0 ? '#38bdf8' : 'var(--text-muted)',
                        fontWeight: 600
                      }}>
                        {activeStories.length > 0 ? '⚡ Working' : 'Standby'}
                      </span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-tertiary)',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Total Issues</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{assignedStories.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>In Progress</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8' }}>{activeStories.length}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Done</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>{doneStories.length}</div>
                      </div>
                    </div>

                    {/* Current Assigned Stories */}
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Active Tasks & Stories:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {assignedStories.length === 0 ? (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No active issues assigned.
                          </div>
                        ) : (
                          assignedStories.map(st => (
                            <div
                              key={st.id}
                              onClick={() => setSelectedStory(st)}
                              style={{
                                padding: '6px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                fontSize: '11px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, color: '#818cf8', fontFamily: 'var(--font-mono)' }}>{st.id}</span>
                                <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {st.title}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: STATUS_COLUMNS.find(c => c.id === st.status)?.bg || 'transparent',
                                color: STATUS_COLUMNS.find(c => c.id === st.status)?.color || '#fff'
                              }}>
                                {st.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================== STORY DETAIL MODAL / DRAWER ===================== */}
      {selectedStory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000
        }}>
          <div style={{
            width: '650px',
            maxWidth: '90vw',
            height: '100%',
            backgroundColor: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '-4px 0 25px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Drawer Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: '#818cf8'
                }}>
                  {selectedStory.id}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>•</span>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: TYPE_CONFIG[selectedStory.type]?.bg,
                  color: TYPE_CONFIG[selectedStory.type]?.color,
                  fontWeight: 600
                }}>
                  {TYPE_CONFIG[selectedStory.type]?.icon} {TYPE_CONFIG[selectedStory.type]?.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => handleDeleteStory(selectedStory.id)}
                  title="Delete Story"
                  style={{
                    background: 'rgba(248, 113, 113, 0.1)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    color: '#f87171',
                    borderRadius: '6px',
                    padding: '6px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={() => setSelectedStory(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body Scroll */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Title */}
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {selectedStory.title}
                </h2>
              </div>

              {/* Status & Attributes Control Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                padding: '14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)'
              }}>
                {/* Status Dropdown */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Status</div>
                  <select
                    value={selectedStory.status}
                    onChange={(e) => handleTransition(selectedStory.id, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <option value="todo">Clock To Do</option>
                    <option value="in_progress">▶️ In Progress</option>
                    <option value="review">⚠️ Review & QA</option>
                    <option value="done">✅ Done</option>
                  </select>
                </div>

                {/* Assigned Agent */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Assigned Agent</div>
                  <select
                    value={selectedStory.assignedAgentId || ''}
                    onChange={async (e) => {
                      const newAgent = agents.find(a => a.id === e.target.value);
                      if (newAgent) {
                        const updated = await updateStory(selectedStory.id, {
                          assignedAgentId: newAgent.id,
                          assignedAgentName: newAgent.name,
                          avatar: newAgent.avatar
                        });
                        setSelectedStory(updated);
                        setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Priority</div>
                  <select
                    value={selectedStory.priority}
                    onChange={async (e) => {
                      const updated = await updateStory(selectedStory.id, { priority: e.target.value });
                      setSelectedStory(updated);
                      setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="highest">🔺 Highest</option>
                    <option value="high">🔼 High</option>
                    <option value="medium">⏸️ Medium</option>
                    <option value="low">🔽 Low</option>
                  </select>
                </div>

                {/* Story Points */}
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Story Points</div>
                  <input
                    type="number"
                    value={selectedStory.storyPoints || 0}
                    onChange={async (e) => {
                      const pts = Number(e.target.value) || 0;
                      const updated = await updateStory(selectedStory.id, { storyPoints: pts });
                      setSelectedStory(updated);
                      setStories(prev => prev.map(s => s.id === updated.id ? updated : s));
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Description & Acceptance Criteria
                </h4>
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-tertiary)',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  border: '1px solid var(--border-subtle)'
                }}>
                  {selectedStory.description || 'No detailed description provided.'}
                </div>
              </div>

              {/* Target Files */}
              {selectedStory.targetFiles && selectedStory.targetFiles.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Target Codebase Files
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedStory.targetFiles.map((f, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#7dd3fc',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        📄 {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Log & Agent Work Feed */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Activity & Agent Execution Feed
                </h4>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  {(selectedStory.activityLog || []).map((item, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '10px', marginBottom: '2px' }}>
                        <span>Update #{i + 1}</span>
                        <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ color: 'var(--text-primary)' }}>
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Comment Input */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Add comment or status note..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleAddComment}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: 'var(--accent-indigo)',
                      border: 'none',
                      color: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CREATE ISSUE MODAL ===================== */}
      {isCreateStoryOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px',
          overflowY: 'auto'
        }}>
          <div style={{
            width: '560px',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 32px)',
            maxHeight: 'calc(100dvh - 32px)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            margin: 'auto',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Create Issue / User Story
              </h3>
              <button
                onClick={() => setIsCreateStoryOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStorySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Build Payment Gateway Webhook Handler"
                  value={newStory.title}
                  onChange={(e) => setNewStory({ ...newStory, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '13px'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Description / Acceptance Criteria
                </label>
                <textarea
                  rows={3}
                  placeholder="As a customer, I want to receive instant notifications..."
                  value={newStory.description}
                  onChange={(e) => setNewStory({ ...newStory, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Type
                  </label>
                  <select
                    value={newStory.type}
                    onChange={(e) => setNewStory({ ...newStory, type: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  >
                    <option value="story">📗 Story</option>
                    <option value="task">☑️ Task</option>
                    <option value="bug">🐞 Bug</option>
                    <option value="epic">⚡ Epic</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    value={newStory.priority}
                    onChange={(e) => setNewStory({ ...newStory, priority: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  >
                    <option value="highest">🔺 Highest</option>
                    <option value="high">🔼 High</option>
                    <option value="medium">⏸️ Medium</option>
                    <option value="low">🔽 Low</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Story Points
                  </label>
                  <input
                    type="number"
                    value={newStory.storyPoints}
                    onChange={(e) => setNewStory({ ...newStory, storyPoints: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Assign to Specialist Agent
                </label>
                <select
                  value={newStory.assignedAgentId}
                  onChange={(e) => setNewStory({ ...newStory, assignedAgentId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px'
                  }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name} ({a.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Target Files (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="app.py, routes/cart.py, static/cart.js"
                  value={newStory.targetFiles}
                  onChange={(e) => setNewStory({ ...newStory, targetFiles: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateStoryOpen(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    background: 'var(--accent-indigo)',
                    border: 'none',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Create Story
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== AUTONOMOUS AI STORY GENERATOR MODAL ===================== */}
      {isAIGeneratorOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px',
          overflowY: 'auto'
        }}>
          <div style={{
            width: '520px',
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 32px)',
            maxHeight: 'calc(100dvh - 32px)',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            margin: 'auto',
            boxShadow: '0 16px 40px rgba(139, 92, 246, 0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#c084fc" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Autonomous AI Story Generator
                </h3>
              </div>
              <button
                onClick={() => setIsAIGeneratorOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              The Agile Architecture Lead will parse the project BRD, architecture requirements, and milestone plan to synthesize 3-5 structured Jira user stories with agent assignments and point sizing.
            </p>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Additional Guidance or Specific Feature Focus (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Generate stories for user order history, email confirmations, and automated load testing..."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '12px'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsAIGeneratorOpen(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                disabled={isGenerating}
                onClick={handleGenerateStories}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  cursor: isGenerating ? 'not-allowed' : 'pointer'
                }}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Generating Stories...
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    Synthesize User Stories
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
