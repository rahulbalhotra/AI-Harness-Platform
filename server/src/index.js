require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const GovernanceEngine = require('./engine/GovernanceEngine');
const ToolRegistry = require('./engine/ToolRegistry');
const ModelRouter = require('./engine/ModelRouter');
const MCPManager = require('./engine/MCPManager');
const AgentFactory = require('./engine/AgentFactory');
const AgentRuntime = require('./engine/AgentRuntime');
const SDLCOrchestrator = require('./engine/SDLCOrchestrator');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 4000;
const WORKSPACE_ROOT = path.resolve(__dirname, '../../');

// Broadcast helper to all connected UI clients
function broadcast(type, payload) {
  const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Initialize Harness Subsystems
const DatabaseManager = require('./db/DatabaseManager');
const KnowledgeBaseManager = require('./engine/KnowledgeBaseManager');

const db = new DatabaseManager();
const governanceEngine = new GovernanceEngine(WORKSPACE_ROOT);
const toolRegistry = new ToolRegistry(WORKSPACE_ROOT, { db });
governanceEngine.toolRegistry = toolRegistry;
governanceEngine.workspaceRoot = toolRegistry.workspaceRoot;
governanceEngine.isAuthorized = toolRegistry.isAuthorized;

const modelRouter = new ModelRouter(toolRegistry);
const knowledgeBaseManager = new KnowledgeBaseManager(db, modelRouter);
toolRegistry.setKnowledgeBaseManager(knowledgeBaseManager);

const mcpManager = new MCPManager();
const agentFactory = new AgentFactory(toolRegistry, modelRouter, db);
const agentRuntime = new AgentRuntime(
  agentFactory,
  toolRegistry,
  modelRouter,
  governanceEngine,
  mcpManager,
  db,
  knowledgeBaseManager
);
const sdlcOrchestrator = new SDLCOrchestrator(agentRuntime, agentFactory);

// Auto-seed default workspace documents into RAG on startup
setTimeout(async () => {
  try {
    const docs = await db.getKnowledgeDocuments();
    if (docs.length === 0) {
      const readmePath = path.join(WORKSPACE_ROOT, 'README.md');
      if (fs.existsSync(readmePath)) {
        await knowledgeBaseManager.ingestFile(readmePath, ['overview', 'architecture', 'readme']);
        console.log('[RAG] Initialized default knowledge base with README.md');
      }
    }
  } catch (e) {
    console.warn('[RAG] Auto-seed error:', e.message);
  }
}, 1000);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// REST Routes
app.use('/api', apiRoutes(
  agentFactory,
  toolRegistry,
  modelRouter,
  governanceEngine,
  agentRuntime,
  sdlcOrchestrator,
  mcpManager,
  broadcast,
  db,
  knowledgeBaseManager
));

// Serve static frontend build if present
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}




// System Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Enterprise AI Harness Platform for SDLC',
    version: '1.0.0',
    workspaceRoot: WORKSPACE_ROOT,
    activeAgents: agentFactory.getAllAgents().length,
    activeModels: modelRouter.getAllModels().length,
    activeTools: toolRegistry.getAllTools().length,
    activeMCPServers: mcpManager.getAllServers().length,
    governancePolicy: governanceEngine.getPolicy()
  });
});

agentRuntime.on('agent_accessed', (data) => broadcast('AGENT_ACCESSED', data));
agentRuntime.on('agent_trace_update', (data) => broadcast('AGENT_TRACE_UPDATE', data));
agentRuntime.on('stream_chunk', (data) => broadcast('STREAM_CHUNK', data));
agentRuntime.on('execution_started', (data) => broadcast('EXECUTION_STARTED', data));
agentRuntime.on('step_started', (data) => broadcast('STEP_STARTED', data));
agentRuntime.on('step_update', (data) => broadcast('STEP_UPDATE', data));
agentRuntime.on('tool_executing', (data) => broadcast('TOOL_EXECUTING', data));
agentRuntime.on('approval_required', (data) => broadcast('APPROVAL_REQUIRED', data));
agentRuntime.on('tool_completed', (data) => broadcast('TOOL_COMPLETED', data));
agentRuntime.on('subagent_invoked', (data) => broadcast('SUBAGENT_INVOKED', data));
agentRuntime.on('subagent_completed', (data) => broadcast('SUBAGENT_COMPLETED', data));
agentRuntime.on('autogen_plan_generated', (data) => broadcast('AUTOGEN_PLAN_GENERATED', data));
agentRuntime.on('parallel_agent_started', (data) => broadcast('PARALLEL_AGENT_STARTED', data));
agentRuntime.on('parallel_agent_progress', (data) => broadcast('PARALLEL_AGENT_PROGRESS', data));
agentRuntime.on('parallel_agent_completed', (data) => broadcast('PARALLEL_AGENT_COMPLETED', data));
agentRuntime.on('autogen_swarm_completed', (data) => broadcast('AUTOGEN_SWARM_COMPLETED', data));
agentRuntime.on('execution_resumed', (data) => broadcast('EXECUTION_RESUMED', data));
agentRuntime.on('rag_context_injected', (data) => broadcast('RAG_CONTEXT_INJECTED', data));
agentRuntime.on('execution_completed', (data) => broadcast('EXECUTION_COMPLETED', data));
agentRuntime.on('execution_failed', (data) => broadcast('EXECUTION_FAILED', data));

sdlcOrchestrator.on('pipeline_started', (data) => broadcast('PIPELINE_STARTED', data));
sdlcOrchestrator.on('stage_started', (data) => broadcast('STAGE_STARTED', data));
sdlcOrchestrator.on('stage_completed', (data) => broadcast('STAGE_COMPLETED', data));
sdlcOrchestrator.on('pipeline_completed', (data) => broadcast('PIPELINE_COMPLETED', data));
sdlcOrchestrator.on('pipeline_failed', (data) => broadcast('PIPELINE_FAILED', data));

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    payload: {
      message: 'Connected to Enterprise AI Harness Engine WebSocket',
      workspaceRoot: toolRegistry.workspaceRoot,
      workspace: toolRegistry.getWorkspaceInfo(),
      policy: governanceEngine.getPolicy(),
      pendingApprovals: governanceEngine.getPendingApprovals()
    }
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {}
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Enterprise AI Harness Engine running on port ${PORT}`);
  console.log(`📁 Workspace: ${WORKSPACE_ROOT}`);
  console.log(`🛡️ Governance Policy: ${governanceEngine.getPolicy()}`);
  console.log(`=======================================================`);
});
