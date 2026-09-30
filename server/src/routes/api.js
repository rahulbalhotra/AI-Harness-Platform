const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

module.exports = function(agentFactory, toolRegistry, modelRouter, governanceEngine, agentRuntime, sdlcOrchestrator, mcpManager, broadcast, db = null, knowledgeBaseManager = null, projectManager = null) {

  // ===================== AUTHENTICATION & ACCESS CONTROL =====================
  router.post('/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      const user = await db.authenticateUser(username, password);
      governanceEngine.setActiveUser(user);
      if (typeof broadcast === 'function') {
        broadcast('USER_AUTH_CHANGED', { user, policy: governanceEngine.getPolicy() });
      }
      res.json({ success: true, user });
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  router.post('/auth/register', async (req, res) => {
    try {
      const { username, password, name, email, role } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      const created = await db.createUser({ username, password, name, email, role: role || 'developer' });
      governanceEngine.setActiveUser(created);
      if (typeof broadcast === 'function') {
        broadcast('USER_AUTH_CHANGED', { user: created, policy: governanceEngine.getPolicy() });
      }
      res.status(201).json({ success: true, user: created });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/auth/me', (req, res) => {
    const user = governanceEngine.getActiveUser();
    res.json({
      user,
      policy: governanceEngine.getPolicy()
    });
  });

  router.post('/auth/switch-user', async (req, res) => {
    try {
      const { username } = req.body;
      const users = await db.getUsers();
      const targetUser = users.find(u => u.username === username);
      if (!targetUser) return res.status(404).json({ error: 'User not found' });
      const { password: _, ...sanitized } = targetUser;
      governanceEngine.setActiveUser(sanitized);
      if (typeof broadcast === 'function') {
        broadcast('USER_AUTH_CHANGED', { user: sanitized, policy: governanceEngine.getPolicy() });
      }
      res.json({ success: true, user: sanitized });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== AGENTS =====================
  router.get('/agents', (req, res) => {
    res.json(agentFactory.getAllAgents());
  });

  router.get('/agents/:id', (req, res) => {
    const agent = agentFactory.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  });

  router.get('/agents/:id/versions', async (req, res) => {
    try {
      const versions = await agentFactory.getAgentVersions(req.params.id);
      res.json(versions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/agents/:id/rollback', (req, res) => {
    try {
      const { targetVersion } = req.body;
      if (!targetVersion) return res.status(400).json({ error: 'targetVersion is required' });
      const activeUser = governanceEngine.getActiveUser();
      const perm = governanceEngine.checkUserPermission(activeUser, 'edit_agent');
      if (!perm.allowed) return res.status(403).json({ error: perm.reason });
      
      const rolledBack = agentFactory.rollbackAgentVersion(req.params.id, targetVersion, activeUser);
      if (typeof broadcast === 'function') {
        broadcast('AGENT_UPDATED', rolledBack);
      }
      res.json({ success: true, agent: rolledBack });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/agents', (req, res) => {
    try {
      const activeUser = governanceEngine.getActiveUser();
      const created = agentFactory.createAgent(req.body, activeUser);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/agents/:id', (req, res) => {
    try {
      const activeUser = governanceEngine.getActiveUser();
      const existing = agentFactory.getAgent(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Agent not found' });

      const perm = governanceEngine.checkUserPermission(activeUser, 'edit_agent', existing);
      if (!perm.allowed) {
        return res.status(403).json({ error: perm.reason });
      }

      const updated = agentFactory.updateAgent(req.params.id, req.body, activeUser);
      if (typeof broadcast === 'function') {
        broadcast('AGENT_UPDATED', updated);
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/agents/:id', (req, res) => {
    try {
      const activeUser = governanceEngine.getActiveUser();
      const existing = agentFactory.getAgent(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Agent not found' });

      const perm = governanceEngine.checkUserPermission(activeUser, 'delete_agent', existing);
      if (!perm.allowed) {
        return res.status(403).json({ error: perm.reason });
      }

      const success = agentFactory.deleteAgent(req.params.id);
      if (!success) return res.status(404).json({ error: 'Agent not found' });
      res.json({ success: true, message: 'Agent deleted.' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // "Chat to Create New Agents"
  router.post('/agents/chat-create', async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
      const synthesis = await agentFactory.synthesizeAgentFromPrompt(prompt);
      res.json(synthesis);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== MODELS =====================
  router.get('/models', (req, res) => {
    res.json(modelRouter.getAllModels());
  });

  router.get('/models/active', (req, res) => {
    const { agentId, preferredModelId } = req.query;
    let pref = preferredModelId || null;
    if (!pref && agentId) {
      const ag = agentFactory.getAgent(agentId);
      if (ag) pref = ag.modelId;
    }
    res.json(modelRouter.getRoutingStatus(pref));
  });

  router.post('/models/active', (req, res) => {
    try {
      const { modelId, agentId } = req.body;
      const activeModel = modelRouter.setActiveModel(modelId || 'auto');
      if (agentId && activeModel?.id) {
        const ag = agentFactory.getAgent(agentId);
        if (ag) {
          agentFactory.updateAgent(agentId, { modelId: activeModel.id }, governanceEngine.getActiveUser());
        }
      }
      const status = modelRouter.getRoutingStatus(modelId === 'auto' ? null : modelId);
      if (typeof broadcast === 'function') {
        broadcast('ACTIVE_MODEL_UPDATED', status);
      }
      res.json(status);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/models/retry-policy', (req, res) => {
    try {
      const policy = modelRouter.updateRetryPolicy(req.body || {});
      res.json({ success: true, retryPolicy: policy });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/models', (req, res) => {
    try {
      const registered = modelRouter.registerModel(req.body);
      res.status(201).json(registered);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/models/:id', (req, res) => {
    try {
      const updated = modelRouter.updateModel(req.params.id, req.body || {});
      if (typeof broadcast === 'function') {
        broadcast('MODEL_UPDATED', updated);
        broadcast('ACTIVE_MODEL_UPDATED', modelRouter.getRoutingStatus());
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/models/:id/toggle', (req, res) => {
    const updated = modelRouter.toggleModel(req.params.id, req.body.enabled);
    if (!updated) return res.status(404).json({ error: 'Model not found' });
    if (typeof broadcast === 'function') {
      broadcast('MODEL_UPDATED', updated);
      broadcast('ACTIVE_MODEL_UPDATED', modelRouter.getRoutingStatus());
    }
    res.json(updated);
  });

  router.delete('/models/:id', (req, res) => {
    const success = modelRouter.removeModel(req.params.id);
    if (!success) return res.status(404).json({ error: 'Model not found' });
    if (typeof broadcast === 'function') {
      broadcast('ACTIVE_MODEL_UPDATED', modelRouter.getRoutingStatus());
    }
    res.json({ success: true });
  });

  router.get('/models/keys/status', (req, res) => {
    res.json(modelRouter.getApiKeysConfigured());
  });

  router.get('/models/keys/details/:provider', (req, res) => {
    res.json(modelRouter.getApiKeyDetails(req.params.provider));
  });

  router.post('/models/keys', (req, res) => {
    const { provider, key } = req.body;
    if (provider) {
      modelRouter.setApiKey(provider, key);
      res.json({ success: true, message: `Key configured for ${provider}` });
    } else {
      res.status(400).json({ error: 'Provider is required' });
    }
  });

  router.delete('/models/keys/:provider', (req, res) => {
    const { provider } = req.params;
    modelRouter.deleteApiKey(provider);
    res.json({ success: true, message: `Key deleted for ${provider}` });
  });

  router.post('/models/test-connection', async (req, res) => {
    try {
      const { provider, config } = req.body;
      const result = await modelRouter.testProviderConnection(provider, config);
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  // ===================== TOOLS & MCP =====================
  router.get('/tools', (req, res) => {
    res.json(toolRegistry.getAllTools());
  });

  router.get('/tools/:id/versions', async (req, res) => {
    try {
      const versions = await toolRegistry.getToolVersions(req.params.id);
      res.json(versions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tools/:id/rollback', async (req, res) => {
    try {
      const { targetVersion } = req.body;
      if (!targetVersion) return res.status(400).json({ error: 'targetVersion is required' });
      const activeUser = req.body.user || governanceEngine.getActiveUser();
      if (activeUser?.role === 'viewer') {
        return res.status(403).json({ error: 'Viewers have read-only access and cannot rollback tool versions.' });
      }

      const rolledBack = await toolRegistry.rollbackToolVersion(req.params.id, targetVersion, activeUser);
      if (typeof broadcast === 'function') {
        broadcast('TOOL_UPDATED', rolledBack);
      }
      res.json({ success: true, tool: rolledBack });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/tools', (req, res) => {
    try {
      const activeUser = req.body.user || governanceEngine.getActiveUser();
      const created = toolRegistry.registerTool(req.body, activeUser);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/tools/:id', (req, res) => {
    try {
      const activeUser = req.body.user || governanceEngine.getActiveUser();
      const existing = toolRegistry.getTool(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Tool not found' });

      if (activeUser?.role === 'viewer') {
        return res.status(403).json({ error: 'Viewers have read-only access and cannot modify tool configurations.' });
      }

      const updated = toolRegistry.updateTool(req.params.id, req.body, activeUser);
      if (typeof broadcast === 'function') {
        broadcast('TOOL_UPDATED', updated);
      }
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/tools/:id/toggle', (req, res) => {
    const updated = toolRegistry.toggleTool(req.params.id, req.body.enabled);
    if (!updated) return res.status(404).json({ error: 'Tool not found' });
    res.json(updated);
  });

  router.delete('/tools/:id', (req, res) => {
    try {
      const success = toolRegistry.removeTool(req.params.id);
      if (!success) return res.status(404).json({ error: 'Tool not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/tools/execute', async (req, res) => {
    try {
      const { toolId, parameters } = req.body;
      const result = await toolRegistry.executeTool(toolId, parameters);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // MCP endpoints
  router.get('/mcp/servers', (req, res) => {
    res.json(mcpManager.getAllServers());
  });

  router.post('/mcp/servers', (req, res) => {
    try {
      const server = mcpManager.addServer(req.body);
      res.status(201).json(server);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/mcp/servers/:id', (req, res) => {
    const success = mcpManager.removeServer(req.params.id);
    if (!success) return res.status(404).json({ error: 'Server not found' });
    res.json({ success: true });
  });

  // ===================== CHAT & EXECUTIONS =====================
  router.get('/chat/sessions', (req, res) => {
    res.json(agentRuntime.getAllSessions());
  });

  router.post('/chat/sessions', (req, res) => {
    const { agentId, title } = req.body;
    const session = agentRuntime.createSession(agentId || 'agent-willow', title || 'New chat');
    res.status(201).json(session);
  });

  router.delete('/chat/sessions/:id', (req, res) => {
    const success = agentRuntime.deleteSession(req.params.id);
    res.json({ success });
  });

  router.get('/chat/:sessionId/history', (req, res) => {
    res.json(agentRuntime.getHistory(req.params.sessionId));
  });

  router.post('/chat/execute', async (req, res) => {
    try {
      const { sessionId, agentId, prompt, attachments } = req.body;
      if (!sessionId || !agentId || (!prompt && (!attachments || attachments.length === 0))) {
        return res.status(400).json({ error: 'sessionId, agentId, and prompt or attachments are required' });
      }
      const execution = await agentRuntime.startExecution(
        sessionId,
        agentId,
        prompt || (attachments?.length > 0 ? `Please analyze the attached ${attachments.map(a => a.name).join(', ')}.` : ''),
        { attachments: attachments || [] }
      );
      const history = agentRuntime.getHistory(sessionId);
      res.json({ execution, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/executions/:id', (req, res) => {
    const execState = agentRuntime.getExecution(req.params.id);
    if (!execState) return res.status(404).json({ error: 'Execution not found' });
    res.json(execState);
  });

  // ===================== GOVERNANCE & APPROVALS =====================
  router.get('/governance/policy', (req, res) => {
    res.json({
      policy: governanceEngine.getPolicy(),
      pendingCount: governanceEngine.getPendingApprovals().length
    });
  });

  router.post('/governance/policy', (req, res) => {
    governanceEngine.setPolicy(req.body.policy);
    res.json({ policy: governanceEngine.getPolicy() });
  });

  router.get('/governance/approvals', (req, res) => {
    res.json(governanceEngine.getPendingApprovals());
  });

  router.post('/governance/approvals/:id/resolve', async (req, res) => {
    try {
      const { decision, userComment, executionId } = req.body;
      await agentRuntime.resumeExecution(executionId, req.params.id, decision, userComment);
      res.json({ success: true, approvalId: req.params.id, decision });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/governance/audit', (req, res) => {
    res.json(governanceEngine.getAuditLogs());
  });

  // ===================== SDLC PIPELINES =====================
  router.get('/pipelines', (req, res) => {
    res.json(sdlcOrchestrator.getAllPipelines());
  });

  router.post('/pipelines/trigger', async (req, res) => {
    try {
      const { pipelineId, input } = req.body;
      const runState = await sdlcOrchestrator.triggerPipeline(pipelineId, input);
      res.json(runState);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pipelines/runs', (req, res) => {
    res.json(sdlcOrchestrator.getPipelineRuns());
  });

  // ===================== WORKSPACE FILES =====================
  router.get('/workspace/files', async (req, res) => {
    try {
      const result = await toolRegistry.execListDirectory({ dirPath: '.' });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/workspace/file', async (req, res) => {
    try {
      const filePath = req.query.path;
      if (!filePath) return res.status(400).json({ error: 'path is required' });
      const result = await toolRegistry.execReadFile({ filePath });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/workspace/file', async (req, res) => {
    try {
      const { filePath, content } = req.body;
      const result = await toolRegistry.execWriteFile({ filePath, content });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== WORKSPACE REPOSITORY ACCESS =====================
  router.get('/workspace', (req, res) => {
    res.json(toolRegistry.getWorkspaceInfo());
  });

  router.post('/workspace/authorize', (req, res) => {
    try {
      const { repoPath } = req.body;
      if (!repoPath) {
        return res.status(400).json({ error: 'repoPath is required' });
      }
      const info = toolRegistry.setWorkspaceAccess(repoPath, true);
      governanceEngine.workspaceRoot = info.repoPath;
      if (typeof broadcast === 'function') {
        broadcast('WORKSPACE_UPDATED', info);
      }
      res.json({ success: true, workspace: info });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/workspace/revoke', (req, res) => {
    try {
      const info = toolRegistry.setWorkspaceAccess(null, false);
      if (typeof broadcast === 'function') {
        broadcast('WORKSPACE_UPDATED', info);
      }
      res.json({ success: true, workspace: info });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== DATABASE & POSTGRESQL =====================
  router.get('/db/status', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not initialized' });
      const status = await db.getStatus();
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/db/config', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not initialized' });
      const { connectionString } = req.body;
      if (!connectionString) {
        return res.status(400).json({ error: 'connectionString is required' });
      }
      const result = await db.connectPostgres(connectionString);
      if (typeof broadcast === 'function') {
        broadcast('DB_STATUS_UPDATED', await db.getStatus());
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/db/query', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not initialized' });
      const { sql } = req.body;
      const result = await db.runCustomQuery(sql);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ===================== USERS & PROFILES =====================
  router.get('/users', async (req, res) => {
    try {
      if (!db) return res.json([]);
      const users = await db.getUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not initialized' });
      const created = await db.createUser(req.body);
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ===================== DOCUMENT & CODE VERSIONING =====================
  router.get('/versioning', async (req, res) => {
    try {
      if (!db) return res.json([]);
      const filePath = req.query.path || null;
      const versions = await db.getFileVersions(filePath);
      res.json(versions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/versioning/:id', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not initialized' });
      const ver = await db.getVersion(req.params.id);
      if (!ver) return res.status(404).json({ error: 'Version not found' });
      res.json(ver);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/versioning/rollback', async (req, res) => {
    try {
      const { versionId } = req.body;
      if (!versionId) return res.status(400).json({ error: 'versionId is required' });
      const result = await toolRegistry.execRollbackDocumentVersion({ versionId });
      if (typeof broadcast === 'function') {
        broadcast('VERSION_ROLLED_BACK', result);
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== KNOWLEDGE BASE & RAG =====================
  router.get('/knowledge/documents', async (req, res) => {
    try {
      if (!db) return res.json([]);
      const docs = await db.getKnowledgeDocuments();
      res.json(docs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/knowledge/documents', async (req, res) => {
    try {
      if (!knowledgeBaseManager) return res.status(503).json({ error: 'RAG engine not initialized' });
      const { title, content, tags, source } = req.body;
      const result = await knowledgeBaseManager.ingestDocument({
        title,
        content,
        tags,
        source: source || 'manual'
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/knowledge/documents/:id', async (req, res) => {
    try {
      if (!knowledgeBaseManager) return res.status(503).json({ error: 'RAG engine not initialized' });
      const doc = await knowledgeBaseManager.getDocumentWithContent(req.params.id);
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      res.json(doc);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/knowledge/upload', async (req, res) => {
    try {
      if (!knowledgeBaseManager) return res.status(503).json({ error: 'RAG engine not initialized' });
      const { files, tags } = req.body;
      const items = Array.isArray(files) ? files : [req.body];
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'At least one file payload is required' });
      }
      const results = [];
      for (const item of items) {
        const ingested = await knowledgeBaseManager.ingestUploadedDocument({
          fileName: item.fileName || item.name || 'uploaded_document.txt',
          mimeType: item.mimeType || item.type || '',
          base64Data: item.base64Data || item.dataUrl || '',
          textContent: item.textContent || item.content || '',
          title: item.title || item.fileName || item.name,
          tags: item.tags || tags || []
        });
        results.push(ingested);
        if (typeof broadcast === 'function') {
          broadcast('KNOWLEDGE_DOC_INGESTED', { document: ingested.document, chunkCount: ingested.chunkCount });
        }
      }
      res.status(201).json({
        success: true,
        ingestedCount: results.length,
        results
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/knowledge/documents/:id', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ error: 'Database not initialized' });
      await db.deleteKnowledgeDocument(req.params.id);
      if (knowledgeBaseManager) {
        await knowledgeBaseManager.rebuildIndex();
      }
      res.json({ success: true, message: 'Document deleted from RAG knowledge base.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/knowledge/chunks', async (req, res) => {
    try {
      if (!db) return res.json([]);
      const docId = req.query.documentId || null;
      const chunks = await db.getKnowledgeChunks(docId);
      res.json(chunks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/knowledge/search', async (req, res) => {
    try {
      if (!knowledgeBaseManager) return res.status(503).json({ error: 'RAG engine not initialized' });
      const { query, topK, tags } = req.body;
      const results = await knowledgeBaseManager.search(query, { topK: topK || 5, tags: tags || [] });
      res.json({ query, resultsCount: results.length, results });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/knowledge/ingest-file', async (req, res) => {
    try {
      if (!knowledgeBaseManager) return res.status(503).json({ error: 'RAG engine not initialized' });
      const { filePath, tags } = req.body;
      if (!filePath) return res.status(400).json({ error: 'filePath is required' });
      const fullPath = toolRegistry.resolveWorkspacePath(filePath);
      const result = await knowledgeBaseManager.ingestFile(fullPath, tags || []);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/knowledge/ingest-workspace-defaults', async (req, res) => {
    try {
      if (!knowledgeBaseManager) return res.status(503).json({ error: 'RAG engine not initialized' });
      const ingested = [];
      const defaultDocs = ['README.md', 'package.json'];
      for (const docName of defaultDocs) {
        const fullPath = path.join(toolRegistry.workspaceRoot, docName);
        if (fs.existsSync(fullPath)) {
          const resDoc = await knowledgeBaseManager.ingestFile(fullPath, ['architecture', 'overview']);
          ingested.push({ file: docName, chunks: resDoc.chunkCount });
        }
      }
      res.json({ success: true, ingestedCount: ingested.length, ingested });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ===================== PROJECT MANAGEMENT (JIRA-STYLE) =====================
  router.get('/pm/projects', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const projects = await projectManager.getAllProjects();
      res.json(projects);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pm/projects/:id', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const project = await projectManager.getProject(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(project);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/pm/projects', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const created = await projectManager.createProject(req.body);
      if (typeof broadcast === 'function') {
        broadcast('PROJECT_UPDATED', { action: 'created', project: created });
      }
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/pm/projects/:id', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const updated = await projectManager.updateProject(req.params.id, req.body);
      if (typeof broadcast === 'function') {
        broadcast('PROJECT_UPDATED', { action: 'updated', project: updated });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/pm/stories', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const { projectId, agentId } = req.query;
      let stories = await projectManager.getStories(projectId || null);
      if (agentId) {
        stories = stories.filter(s => s.assignedAgentId === agentId);
      }
      res.json(stories);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/pm/stories', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const created = await projectManager.createStory(req.body);
      if (typeof broadcast === 'function') {
        broadcast('STORY_UPDATED', { action: 'created', story: created });
      }
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/pm/stories/:id', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const updated = await projectManager.updateStory(req.params.id, req.body);
      if (typeof broadcast === 'function') {
        broadcast('STORY_UPDATED', { action: 'updated', story: updated });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/pm/stories/:id/transition', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const { status, agentId, comment } = req.body;
      const existing = await projectManager.getStories();
      const story = existing.find(s => s.id === req.params.id);
      if (!story) return res.status(404).json({ error: 'Story not found' });

      const logText = comment || `Status moved to '${status.toUpperCase()}'${agentId ? ` by ${agentId}` : ''}`;
      const updated = await projectManager.updateStory(story.id, {
        status,
        activityLog: [
          ...(story.activityLog || []),
          { timestamp: new Date().toISOString(), text: logText }
        ]
      });

      if (typeof broadcast === 'function') {
        broadcast('STORY_UPDATED', { action: 'transitioned', story: updated });
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/pm/stories/:id', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      await projectManager.deleteStory(req.params.id);
      if (typeof broadcast === 'function') {
        broadcast('STORY_UPDATED', { action: 'deleted', id: req.params.id });
      }
      res.json({ success: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Agent generates user stories autonomously for a project
  router.post('/pm/generate-stories', async (req, res) => {
    try {
      if (!projectManager) return res.status(503).json({ error: 'ProjectManager not initialized' });
      const { projectId, prompt } = req.body;
      const project = await projectManager.getProject(projectId || 'proj_amazon_clone');
      if (!project) return res.status(404).json({ error: 'Project not found' });

      // Build generation prompt for architect / researcher
      const planText = project.plan ? JSON.stringify(project.plan.phases || []) : '';
      const brdText = project.brd ? project.brd.executiveSummary || '' : '';

      const systemPrompt = `You are an Agile Enterprise Lead Architect and Scrum Master. Given a project, BRD, and project plan, break it down into 3-5 structured Jira-like User Stories.
Respond ONLY with a valid JSON array of objects with the following format:
[
  {
    "title": "Story Title",
    "description": "As a [user], I want [feature] so that [benefit]. Acceptance Criteria: 1... 2...",
    "type": "story", // or "task" or "bug"
    "priority": "highest" // or "high", "medium", "low"
    "assignedAgentId": "agent-senior-engineer", // or agent-researcher, agent-architect, agent-qa-synthesizer, agent-secops-auditor, agent-devops-sre
    "assignedAgentName": "Full-Stack Senior Engineer",
    "avatar": "💻",
    "storyPoints": 5,
    "targetFiles": ["file1.js"]
  }
]`;

      const userContent = `Project: ${project.name}
Description: ${project.description}
BRD Summary: ${brdText}
Project Plan Phases: ${planText}
User Instructions: ${prompt || 'Generate next sprint user stories'}`;

      let storiesData = [];
      try {
        const response = await modelRouter.routeAndCall({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
          ],
          preferredModel: 'gemini-2.5-flash',
          purpose: 'project_story_generation'
        });

        const raw = response.content.replace(/```json/gi, '').replace(/```/g, '').trim();
        storiesData = JSON.parse(raw);
      } catch (genErr) {
        console.warn('AI generation fallback for stories:', genErr.message);
        // Fallback default story
        storiesData = [
          {
            title: `Implement ${prompt || 'Core Module Enhancements'}`,
            description: `Deliver core capabilities as defined in the ${project.name} business requirements.`,
            type: 'story',
            priority: 'high',
            assignedAgentId: 'agent-senior-engineer',
            assignedAgentName: 'Full-Stack Senior Engineer',
            avatar: '💻',
            storyPoints: 5,
            targetFiles: ['src/core/']
          }
        ];
      }

      const createdStories = [];
      if (Array.isArray(storiesData)) {
        for (const s of storiesData) {
          s.projectId = project.id;
          const created = await projectManager.createStory(s);
          createdStories.push(created);
        }
      }

      if (typeof broadcast === 'function') {
        broadcast('STORY_UPDATED', { action: 'batch_created', stories: createdStories });
      }

      res.status(201).json({ success: true, count: createdStories.length, stories: createdStories });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

