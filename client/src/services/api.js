// Client API service for Enterprise AI Harness Engine

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch('/health');
  return await res.json();
}

// Agents
export async function getAgents() {
  const res = await fetch(`${API_BASE}/agents`);
  return await res.json();
}

export async function createAgent(agentData) {
  const res = await fetch(`${API_BASE}/agents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agentData)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create agent');
  }
  return await res.json();
}

export async function updateAgent(agentId, updates) {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update agent');
  }
  return await res.json();
}

export async function getAgentVersions(agentId) {
  const res = await fetch(`${API_BASE}/agents/${agentId}/versions`);
  return await res.json();
}

export async function rollbackAgentVersion(agentId, targetVersion) {
  const res = await fetch(`${API_BASE}/agents/${agentId}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetVersion })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rollback agent version');
  }
  return await res.json();
}

export async function deleteAgent(agentId) {
  const res = await fetch(`${API_BASE}/agents/${agentId}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete agent');
  }
  return await res.json();
}

// "Chat to Create New Agents"
export async function chatCreateAgent(prompt) {
  const res = await fetch(`${API_BASE}/agents/chat-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to synthesize agent');
  }
  return await res.json();
}

// Models
export async function getModels() {
  const res = await fetch(`${API_BASE}/models`);
  return await res.json();
}

export async function getActiveModelStatus(agentId = null) {
  const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : '';
  const res = await fetch(`${API_BASE}/models/active${qs}`);
  return await res.json();
}

export async function setActiveModel(modelId, agentId = null) {
  const res = await fetch(`${API_BASE}/models/active`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId, agentId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to switch active model');
  }
  return await res.json();
}

export async function updateModelRetryPolicy(policy) {
  const res = await fetch(`${API_BASE}/models/retry-policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(policy)
  });
  return await res.json();
}

export async function addModel(modelData) {
  const res = await fetch(`${API_BASE}/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(modelData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add model');
  }
  return await res.json();
}

export async function updateModel(modelId, updates) {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update model configuration');
  }
  return await res.json();
}

export async function toggleModel(modelId, enabled) {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelId)}/toggle`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  return await res.json();
}

export async function deleteModel(modelId) {
  const res = await fetch(`${API_BASE}/models/${modelId}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function saveApiKey(provider, key) {
  const res = await fetch(`${API_BASE}/models/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, key })
  });
  return await res.json();
}

export async function deleteApiKey(provider) {
  const res = await fetch(`${API_BASE}/models/keys/${provider}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function getApiKeyDetails(provider) {
  const res = await fetch(`${API_BASE}/models/keys/details/${provider}`);
  return await res.json();
}

export async function testModelConnection(provider, config = null) {
  const res = await fetch(`${API_BASE}/models/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, config })
  });
  return await res.json();
}


// Tools & MCP
export async function getTools() {
  const res = await fetch(`${API_BASE}/tools`);
  return await res.json();
}

export async function addTool(toolData) {
  const res = await fetch(`${API_BASE}/tools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolData)
  });
  return await res.json();
}

export async function updateTool(toolId, toolData) {
  const res = await fetch(`${API_BASE}/tools/${toolId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toolData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update tool');
  }
  return await res.json();
}

export async function getToolVersions(toolId) {
  const res = await fetch(`${API_BASE}/tools/${toolId}/versions`);
  return await res.json();
}

export async function rollbackToolVersion(toolId, targetVersion) {
  const res = await fetch(`${API_BASE}/tools/${toolId}/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetVersion })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rollback tool version');
  }
  return await res.json();
}

export async function toggleTool(toolId, enabled) {
  const res = await fetch(`${API_BASE}/tools/${toolId}/toggle`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled })
  });
  return await res.json();
}

export async function deleteTool(toolId) {
  const res = await fetch(`${API_BASE}/tools/${toolId}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function executeToolDirectly(toolId, parameters) {
  const res = await fetch(`${API_BASE}/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toolId, parameters })
  });
  return await res.json();
}

export async function getMCPServers() {
  const res = await fetch(`${API_BASE}/mcp/servers`);
  return await res.json();
}

export async function addMCPServer(serverData) {
  const res = await fetch(`${API_BASE}/mcp/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverData)
  });
  return await res.json();
}

export async function deleteMCPServer(serverId) {
  const res = await fetch(`${API_BASE}/mcp/servers/${serverId}`, {
    method: 'DELETE'
  });
  return await res.json();
}

// Chat & Executions
export async function getChatSessions() {
  const res = await fetch(`${API_BASE}/chat/sessions`);
  return await res.json();
}

export async function createChatSession(agentId = 'agent-willow', title = 'New chat') {
  const res = await fetch(`${API_BASE}/chat/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, title })
  });
  return await res.json();
}

export async function deleteChatSession(sessionId) {
  const res = await fetch(`${API_BASE}/chat/sessions/${sessionId}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function getChatHistory(sessionId) {
  const res = await fetch(`${API_BASE}/chat/${sessionId}/history`);
  return await res.json();
}

export async function executeChat(sessionId, agentId, prompt, attachments = []) {
  const res = await fetch(`${API_BASE}/chat/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, agentId, prompt, attachments })
  });
  return await res.json();
}

// Governance & Approvals
export async function getGovernancePolicy() {
  const res = await fetch(`${API_BASE}/governance/policy`);
  return await res.json();
}

export async function setGovernancePolicy(policy) {
  const res = await fetch(`${API_BASE}/governance/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy })
  });
  return await res.json();
}

export async function getPendingApprovals() {
  const res = await fetch(`${API_BASE}/governance/approvals`);
  return await res.json();
}

export async function resolveApproval(approvalId, executionId, decision, userComment = '') {
  const res = await fetch(`${API_BASE}/governance/approvals/${approvalId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executionId, decision, userComment })
  });
  return await res.json();
}

export async function getAuditLogs() {
  const res = await fetch(`${API_BASE}/governance/audit`);
  return await res.json();
}

// Pipelines
export async function getPipelines() {
  const res = await fetch(`${API_BASE}/pipelines`);
  return await res.json();
}

export async function triggerPipeline(pipelineId, input = {}) {
  const res = await fetch(`${API_BASE}/pipelines/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pipelineId, input })
  });
  return await res.json();
}

export async function getPipelineRuns() {
  const res = await fetch(`${API_BASE}/pipelines/runs`);
  return await res.json();
}

// Workspace Files
export async function getWorkspaceFiles() {
  const res = await fetch(`${API_BASE}/workspace/files`);
  return await res.json();
}

export async function readWorkspaceFile(path) {
  const res = await fetch(`${API_BASE}/workspace/file?path=${encodeURIComponent(path)}`);
  return await res.json();
}

export async function saveWorkspaceFile(filePath, content) {
  const res = await fetch(`${API_BASE}/workspace/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, content })
  });
  return await res.json();
}

// Workspace Repository Authorization
export async function getWorkspaceInfo() {
  const res = await fetch(`${API_BASE}/workspace`);
  return await res.json();
}

export async function authorizeWorkspaceFolder(repoPath) {
  const res = await fetch(`${API_BASE}/workspace/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoPath })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to authorize workspace repository folder');
  }
  return await res.json();
}

export async function revokeWorkspaceAccess() {
  const res = await fetch(`${API_BASE}/workspace/revoke`, {
    method: 'POST'
  });
  return await res.json();
}

// Database & PostgreSQL
export async function getDbStatus() {
  const res = await fetch(`${API_BASE}/db/status`);
  return await res.json();
}

export async function updateDbConfig(connectionString) {
  const res = await fetch(`${API_BASE}/db/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ connectionString })
  });
  return await res.json();
}

export async function runDbQuery(sql) {
  const res = await fetch(`${API_BASE}/db/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'SQL Query failed');
  }
  return await res.json();
}

// Users
export async function getUsers() {
  const res = await fetch(`${API_BASE}/users`);
  return await res.json();
}

export async function createUser(userData) {
  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return await res.json();
}

// Document Versioning & Snapshots
export async function getFileVersions(filePath = null) {
  const url = filePath ? `${API_BASE}/versioning?path=${encodeURIComponent(filePath)}` : `${API_BASE}/versioning`;
  const res = await fetch(url);
  return await res.json();
}

export async function getVersionDetails(versionId) {
  const res = await fetch(`${API_BASE}/versioning/${versionId}`);
  return await res.json();
}

export async function rollbackFileVersion(versionId) {
  const res = await fetch(`${API_BASE}/versioning/rollback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rollback version');
  }
  return await res.json();
}

// Knowledge Base & RAG
export async function getKnowledgeDocuments() {
  const res = await fetch(`${API_BASE}/knowledge/documents`);
  return await res.json();
}

export async function getKnowledgeDocumentById(docId) {
  const res = await fetch(`${API_BASE}/knowledge/documents/${encodeURIComponent(docId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch document content');
  }
  return await res.json();
}

export async function uploadKnowledgeDocuments(files, tags = []) {
  const res = await fetch(`${API_BASE}/knowledge/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files, tags })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to ingest uploaded documents');
  }
  return await res.json();
}

export async function createKnowledgeDocument(docData) {
  const res = await fetch(`${API_BASE}/knowledge/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData)
  });
  return await res.json();
}

export async function deleteKnowledgeDocument(docId) {
  const res = await fetch(`${API_BASE}/knowledge/documents/${docId}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function searchKnowledgeBase(query, topK = 5, tags = []) {
  const res = await fetch(`${API_BASE}/knowledge/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, topK, tags })
  });
  return await res.json();
}

export async function ingestWorkspaceFile(filePath, tags = []) {
  const res = await fetch(`${API_BASE}/knowledge/ingest-file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, tags })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to ingest file');
  }
  return await res.json();
}

export async function ingestWorkspaceDefaults() {
  const res = await fetch(`${API_BASE}/knowledge/ingest-workspace-defaults`, {
    method: 'POST'
  });
  return await res.json();
}

// Authentication & Identity
export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  return await res.json();
}

export async function registerUser(userData) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed');
  }
  return await res.json();
}

export async function getAuthMe() {
  const res = await fetch(`${API_BASE}/auth/me`);
  return await res.json();
}

export async function switchUser(username) {
  const res = await fetch(`${API_BASE}/auth/switch-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to switch user');
  }
  return await res.json();
}

// Project Management & Jira Board API
export async function getProjects() {
  const res = await fetch(`${API_BASE}/pm/projects`);
  return await res.json();
}

export async function getProject(id) {
  const res = await fetch(`${API_BASE}/pm/projects/${id}`);
  if (!res.ok) throw new Error('Project not found');
  return await res.json();
}

export async function createProject(projectData) {
  const res = await fetch(`${API_BASE}/pm/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(projectData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create project');
  }
  return await res.json();
}

export async function updateProject(id, updates) {
  const res = await fetch(`${API_BASE}/pm/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update project');
  }
  return await res.json();
}

export async function getStories(projectId = null, agentId = null) {
  const params = new URLSearchParams();
  if (projectId) params.append('projectId', projectId);
  if (agentId) params.append('agentId', agentId);
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/pm/stories${queryStr}`);
  return await res.json();
}

export async function createStory(storyData) {
  const res = await fetch(`${API_BASE}/pm/stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(storyData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create story');
  }
  return await res.json();
}

export async function updateStory(id, updates) {
  const res = await fetch(`${API_BASE}/pm/stories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update story');
  }
  return await res.json();
}

export async function transitionStory(id, status, agentId = null, comment = null) {
  const res = await fetch(`${API_BASE}/pm/stories/${id}/transition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, agentId, comment })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to transition story');
  }
  return await res.json();
}

export async function deleteStory(id) {
  const res = await fetch(`${API_BASE}/pm/stories/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete story');
  }
  return await res.json();
}

export async function generateStories(projectId, prompt) {
  const res = await fetch(`${API_BASE}/pm/generate-stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, prompt })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate stories');
  }
  return await res.json();
}

// ===================== OBSERVABILITY & TELEMETRY =====================

export async function getTelemetryOverview(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/telemetry/overview?${query}`);
  if (!res.ok) throw new Error('Failed to fetch telemetry overview');
  return await res.json();
}

export async function getTelemetryTraces(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/telemetry/traces?${query}`);
  if (!res.ok) throw new Error('Failed to fetch telemetry traces');
  return await res.json();
}

export async function getTraceDetail(traceId) {
  const res = await fetch(`${API_BASE}/telemetry/traces/${traceId}`);
  if (!res.ok) throw new Error('Failed to fetch trace details');
  return await res.json();
}

export async function simulateTelemetryTraffic(count = 3) {
  const res = await fetch(`${API_BASE}/telemetry/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count })
  });
  if (!res.ok) throw new Error('Failed to simulate telemetry traffic');
  return await res.json();
}

export async function clearTelemetryTraces() {
  const res = await fetch(`${API_BASE}/telemetry/traces`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to clear telemetry traces');
  return await res.json();
}

export async function exportTelemetryData() {
  window.open(`${API_BASE}/telemetry/export`, '_blank');
}

// ===================== DATABASE HEALTH & INTEGRITY =====================

export async function getDatabaseHealth() {
  const res = await fetch(`${API_BASE}/database/status`);
  if (!res.ok) throw new Error('Failed to fetch database health');
  return await res.json();
}

export async function createDatabaseBackup() {
  const res = await fetch(`${API_BASE}/database/backup`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to create snapshot backup');
  return await res.json();
}

export async function verifyDatabaseIntegrity() {
  const res = await fetch(`${API_BASE}/database/verify`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to verify database integrity');
  return await res.json();
}


