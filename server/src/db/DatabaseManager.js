const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DatabaseManager {
  constructor(options = {}) {
    this.dataPath = options.dataPath || path.join(__dirname, '..', 'data', 'harness_enterprise_db.json');
    this.pgConnectionString = options.connectionString || process.env.DATABASE_URL || null;
    this.pgPool = null;
    this.engine = 'embedded'; // 'postgres' | 'embedded'
    this.isConnected = false;
    this.lastError = null;

    // In-memory relational store (mirrors PostgreSQL tables)
    this.store = {
      users: [],
      sessions: [],
      messages: [],
      document_versions: [],
      knowledge_documents: [],
      knowledge_chunks: [],
      agent_versions: [],
      tool_versions: []
    };

    this.init();
  }

  async init() {
    this.loadEmbeddedStore();
    this.seedDefaults();

    if (this.pgConnectionString) {
      await this.connectPostgres(this.pgConnectionString);
    }
  }

  loadEmbeddedStore() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf8');
        const parsed = JSON.parse(raw);
        this.store = {
          users: parsed.users || [],
          sessions: parsed.sessions || [],
          messages: parsed.messages || [],
          document_versions: parsed.document_versions || [],
          knowledge_documents: parsed.knowledge_documents || [],
          knowledge_chunks: parsed.knowledge_chunks || [],
          agent_versions: parsed.agent_versions || [],
          tool_versions: parsed.tool_versions || []
        };
      }
    } catch (err) {
      console.warn('[DatabaseManager] Failed to load embedded database, initializing fresh store:', err.message);
    }
  }

  saveEmbeddedStore() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(this.store, null, 2), 'utf8');
    } catch (err) {
      console.error('[DatabaseManager] Failed to save embedded database:', err.message);
    }
  }

  seedDefaults() {
    const defaultUsers = [
      {
        id: 'usr_admin',
        username: 'admin',
        password: 'admin123',
        name: 'Enterprise SecOps & Platform Admin',
        email: 'admin@enterprise.ai',
        role: 'admin',
        preferences: {
          theme: 'dark',
          defaultAgent: 'agent-willow',
          autoRag: true,
          hitlLevel: 'always-proceed'
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'usr_lead_architect',
        username: 'lead_dev',
        password: 'lead123',
        name: 'Lead System Architect',
        email: 'architect@enterprise.ai',
        role: 'lead',
        preferences: {
          theme: 'dark',
          defaultAgent: 'agent-willow',
          autoRag: true,
          hitlLevel: 'request-review'
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'usr_developer',
        username: 'developer',
        password: 'dev123',
        name: 'Senior Full-Stack Engineer',
        email: 'dev@enterprise.ai',
        role: 'developer',
        preferences: {
          theme: 'dark',
          defaultAgent: 'agent-senior-engineer',
          autoRag: true,
          hitlLevel: 'request-review'
        },
        created_at: new Date().toISOString()
      },
      {
        id: 'usr_viewer',
        username: 'viewer',
        password: 'viewer123',
        name: 'Security & Compliance Auditor',
        email: 'auditor@enterprise.ai',
        role: 'viewer',
        preferences: {
          theme: 'dark',
          defaultAgent: 'agent-willow',
          autoRag: true,
          hitlLevel: 'sandbox-strict'
        },
        created_at: new Date().toISOString()
      }
    ];

    for (const u of defaultUsers) {
      if (!this.store.users.some(existing => existing.username === u.username)) {
        this.store.users.push(u);
      }
    }

    if (this.store.sessions.length === 0) {
      const defaultSession = {
        id: 'session_default_init',
        user_id: 'usr_lead_architect',
        agent_id: 'agent-willow',
        title: '🌿 Enterprise SDLC Planning & Architecture',
        pinned: true,
        tags: ['sdlc', 'architecture', 'willow'],
        metadata: { framework: 'autogen', ragEnabled: true },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0
      };
      this.store.sessions.push(defaultSession);
    }

    this.saveEmbeddedStore();
  }

  // --- PostgreSQL Integration ---

  async connectPostgres(connectionString) {
    try {
      if (this.pgPool) {
        await this.pgPool.end().catch(() => {});
      }

      this.pgPool = new Pool({
        connectionString,
        connectionTimeoutMillis: 4000,
        ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
      });

      const client = await this.pgPool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.pgConnectionString = connectionString;
      this.engine = 'postgres';
      this.isConnected = true;
      this.lastError = null;

      await this.runPostgresMigrations();
      console.log('[DatabaseManager] Successfully connected to PostgreSQL database!');
      return { success: true, message: 'Connected to PostgreSQL' };
    } catch (err) {
      this.lastError = err.message;
      this.engine = 'embedded';
      this.isConnected = false;
      console.warn('[DatabaseManager] PostgreSQL connection unavailable. Operating in resilient Embedded Relational mode:', err.message);
      return { success: false, error: err.message, fallback: 'embedded' };
    }
  }

  async runPostgresMigrations() {
    if (!this.pgPool) return;

    const migrationSql = `
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL,
        email VARCHAR(128),
        role VARCHAR(32) DEFAULT 'developer',
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        agent_id VARCHAR(64) NOT NULL,
        title VARCHAR(256) NOT NULL,
        pinned BOOLEAN DEFAULT FALSE,
        tags JSONB DEFAULT '[]',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) REFERENCES sessions(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL,
        content TEXT,
        thought TEXT,
        tool_calls JSONB DEFAULT '[]',
        model_used VARCHAR(64),
        latency_ms INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        cost_usd NUMERIC(10, 6) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS document_versions (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64),
        file_path VARCHAR(512) NOT NULL,
        version_number INTEGER NOT NULL,
        diff_content TEXT,
        full_content TEXT,
        change_summary TEXT,
        created_by_agent VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(32) DEFAULT 'active'
      );

      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(256) NOT NULL,
        source VARCHAR(512) NOT NULL,
        source_type VARCHAR(64) NOT NULL,
        tags JSONB DEFAULT '[]',
        doc_metadata JSONB DEFAULT '{}',
        chunk_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id VARCHAR(64) PRIMARY KEY,
        document_id VARCHAR(64) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding JSONB,
        token_count INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_doc_versions_file ON document_versions(file_path);
      CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id);

      CREATE TABLE IF NOT EXISTS tool_versions (
        id VARCHAR(64) PRIMARY KEY,
        tool_id VARCHAR(128) NOT NULL,
        version_number INTEGER NOT NULL,
        name VARCHAR(256) NOT NULL,
        description TEXT,
        category VARCHAR(64),
        risk_level VARCHAR(32),
        requires_approval BOOLEAN DEFAULT false,
        enabled BOOLEAN DEFAULT true,
        parameters JSONB DEFAULT '{}',
        change_summary TEXT,
        author VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tool_versions_tool ON tool_versions(tool_id);
    `;

    try {
      await this.pgPool.query(migrationSql);
      console.log('[DatabaseManager] PostgreSQL migrations applied successfully.');
    } catch (err) {
      console.error('[DatabaseManager] Error running PostgreSQL migrations:', err.message);
    }
  }

  // --- Users CRUD ---

  async getUsers() {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query('SELECT * FROM users ORDER BY created_at ASC');
        return res.rows;
      } catch (err) {
        console.error('[DB getUsers pg error]:', err.message);
      }
    }
    return this.store.users;
  }

  async getUser(id) {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query('SELECT * FROM users WHERE id = $1', [id]);
        return res.rows[0] || null;
      } catch (err) {
        console.error('[DB getUser pg error]:', err.message);
      }
    }
    return this.store.users.find(u => u.id === id) || null;
  }

  async createUser(user) {
    const record = {
      id: user.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: user.username || `user_${Date.now()}`,
      password: user.password || 'dev123',
      name: user.name || 'Enterprise Developer',
      email: user.email || '',
      role: user.role || 'developer',
      preferences: user.preferences || {},
      created_at: new Date().toISOString()
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO users (id, username, password, name, email, role, preferences, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [record.id, record.username, record.password, record.name, record.email, record.role, JSON.stringify(record.preferences), record.created_at]
        );
      } catch (err) {
        console.error('[DB createUser pg error]:', err.message);
      }
    }

    this.store.users.push(record);
    this.saveEmbeddedStore();
    const { password: _, ...sanitized } = record;
    return sanitized;
  }

  async authenticateUser(username, password) {
    const users = await this.getUsers();
    const user = users.find(u => u.username === username);
    if (!user) {
      throw new Error(`User '${username}' not found.`);
    }
    if (user.password && user.password !== password) {
      throw new Error('Incorrect password provided.');
    }
    const { password: _, ...sanitized } = user;
    return sanitized;
  }

  // --- Agent Prompt & Config Versioning ---

  async recordAgentVersion(versionData) {
    const record = {
      id: `aver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      agent_id: versionData.agentId,
      version_number: versionData.version || 1,
      system_prompt: versionData.systemPrompt || '',
      model_id: versionData.modelId || '',
      tools: versionData.tools || [],
      autonomy_policy: versionData.autonomyPolicy || 'request-review',
      temperature: versionData.temperature !== undefined ? versionData.temperature : 0.2,
      change_summary: versionData.changeSummary || 'System prompt and agent configuration updated',
      modified_by: versionData.modifiedBy || 'admin',
      created_at: new Date().toISOString()
    };

    if (this.engine === 'postgres' && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO agent_versions (id, agent_id, version_number, system_prompt, model_id, tools, autonomy_policy, temperature, change_summary, modified_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            record.id, record.agent_id, record.version_number, record.system_prompt,
            record.model_id, JSON.stringify(record.tools), record.autonomy_policy,
            record.temperature, record.change_summary, record.modified_by, record.created_at
          ]
        );
      } catch (err) {
        console.error('[DB recordAgentVersion pg error]:', err.message);
      }
    }

    if (!this.store.agent_versions) this.store.agent_versions = [];
    this.store.agent_versions.push(record);
    this.saveEmbeddedStore();
    return record;
  }

  async getAgentVersions(agentId) {
    if (this.engine === 'postgres' && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM agent_versions WHERE agent_id = $1 ORDER BY version_number DESC, created_at DESC',
          [agentId]
        );
        return res.rows.map(r => ({
          ...r,
          tools: typeof r.tools === 'string' ? JSON.parse(r.tools) : r.tools
        }));
      } catch (err) {
        console.error('[DB getAgentVersions pg error]:', err.message);
      }
    }

    const list = (this.store.agent_versions || []).filter(v => v.agent_id === agentId);
    return list.sort((a, b) => b.version_number - a.version_number);
  }

  // --- Tool Specification & Parameter Versioning ---

  async recordToolVersion(versionData) {
    const record = {
      id: `tver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tool_id: versionData.toolId,
      version_number: versionData.version || 1,
      name: versionData.name || '',
      description: versionData.description || '',
      category: versionData.category || 'custom',
      risk_level: versionData.riskLevel || 'medium',
      requires_approval: versionData.requiresApproval !== undefined ? !!versionData.requiresApproval : true,
      enabled: versionData.enabled !== undefined ? !!versionData.enabled : true,
      parameters: versionData.parameters || {},
      change_summary: versionData.changeSummary || 'Tool specification updated',
      modified_by: versionData.author || versionData.modifiedBy || 'admin',
      created_at: new Date().toISOString()
    };

    if (this.engine === 'postgres' && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO tool_versions (id, tool_id, version_number, name, description, category, risk_level, requires_approval, enabled, parameters, change_summary, modified_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            record.id, record.tool_id, record.version_number, record.name,
            record.description, record.category, record.risk_level,
            record.requires_approval, record.enabled, JSON.stringify(record.parameters),
            record.change_summary, record.modified_by, record.created_at
          ]
        );
      } catch (err) {
        console.error('[DB recordToolVersion pg error]:', err.message);
      }
    }

    if (!this.store.tool_versions) this.store.tool_versions = [];
    this.store.tool_versions.push(record);
    this.saveEmbeddedStore();
    return record;
  }

  async getToolVersions(toolId) {
    if (this.engine === 'postgres' && this.pgPool) {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM tool_versions WHERE tool_id = $1 ORDER BY version_number DESC, created_at DESC',
          [toolId]
        );
        return res.rows.map(r => ({
          ...r,
          parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : r.parameters
        }));
      } catch (err) {
        console.error('[DB getToolVersions pg error]:', err.message);
      }
    }

    const list = (this.store.tool_versions || []).filter(v => v.tool_id === toolId);
    return list.sort((a, b) => b.version_number - a.version_number);
  }

  // --- Sessions CRUD ---

  async getSessions(userId = null) {
    if (this.engine === 'postgres') {
      try {
        let q = 'SELECT * FROM sessions';
        const params = [];
        if (userId) {
          q += ' WHERE user_id = $1';
          params.push(userId);
        }
        q += ' ORDER BY pinned DESC, updated_at DESC';
        const res = await this.pgPool.query(q, params);
        return res.rows;
      } catch (err) {
        console.error('[DB getSessions pg error]:', err.message);
      }
    }

    let sessions = [...this.store.sessions];
    if (userId) {
      sessions = sessions.filter(s => s.user_id === userId);
    }
    return sessions.sort((a, b) => {
      if (a.pinned !== b.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
  }

  async getSession(id) {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query('SELECT * FROM sessions WHERE id = $1', [id]);
        return res.rows[0] || null;
      } catch (err) {
        console.error('[DB getSession pg error]:', err.message);
      }
    }
    return this.store.sessions.find(s => s.id === id) || null;
  }

  async createSession(sessionData) {
    const session = {
      id: sessionData.id || `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: sessionData.user_id || 'usr_lead_architect',
      agent_id: sessionData.agent_id || 'agent-willow',
      title: sessionData.title || 'New SDLC Session',
      pinned: sessionData.pinned || false,
      tags: sessionData.tags || ['sdlc'],
      metadata: sessionData.metadata || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO sessions (id, user_id, agent_id, title, pinned, tags, metadata, created_at, updated_at, message_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            session.id, session.user_id, session.agent_id, session.title,
            session.pinned, JSON.stringify(session.tags), JSON.stringify(session.metadata),
            session.created_at, session.updated_at, session.message_count
          ]
        );
      } catch (err) {
        console.error('[DB createSession pg error]:', err.message);
      }
    }

    this.store.sessions.push(session);
    this.saveEmbeddedStore();
    return session;
  }

  async updateSession(id, updates) {
    const now = new Date().toISOString();
    if (this.engine === 'postgres') {
      try {
        const fields = [];
        const params = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
          fields.push(`${key} = $${idx}`);
          params.push(typeof val === 'object' ? JSON.stringify(val) : val);
          idx++;
        }
        fields.push(`updated_at = $${idx}`);
        params.push(now);
        idx++;
        params.push(id);

        await this.pgPool.query(
          `UPDATE sessions SET ${fields.join(', ')} WHERE id = $${idx}`,
          params
        );
      } catch (err) {
        console.error('[DB updateSession pg error]:', err.message);
      }
    }

    const idx = this.store.sessions.findIndex(s => s.id === id);
    if (idx !== -1) {
      this.store.sessions[idx] = {
        ...this.store.sessions[idx],
        ...updates,
        updated_at: now
      };
      this.saveEmbeddedStore();
      return this.store.sessions[idx];
    }
    return null;
  }

  async deleteSession(id) {
    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query('DELETE FROM sessions WHERE id = $1', [id]);
      } catch (err) {
        console.error('[DB deleteSession pg error]:', err.message);
      }
    }

    this.store.sessions = this.store.sessions.filter(s => s.id !== id);
    this.store.messages = this.store.messages.filter(m => m.session_id !== id);
    this.saveEmbeddedStore();
    return true;
  }

  // --- Messages & Conversation History CRUD ---

  async getMessages(sessionId) {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at ASC',
          [sessionId]
        );
        return res.rows.map(r => ({
          ...r,
          tool_calls: typeof r.tool_calls === 'string' ? JSON.parse(r.tool_calls) : r.tool_calls
        }));
      } catch (err) {
        console.error('[DB getMessages pg error]:', err.message);
      }
    }

    return this.store.messages
      .filter(m => m.session_id === sessionId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  async addMessage(msg) {
    const record = {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      session_id: msg.session_id,
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || ''),
      thought: msg.thought || null,
      tool_calls: msg.tool_calls || [],
      model_used: msg.model_used || null,
      latency_ms: msg.latency_ms || 0,
      tokens_used: msg.tokens_used || 0,
      cost_usd: msg.cost_usd || 0,
      created_at: new Date().toISOString()
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO messages (id, session_id, role, content, thought, tool_calls, model_used, latency_ms, tokens_used, cost_usd, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            record.id, record.session_id, record.role, record.content, record.thought,
            JSON.stringify(record.tool_calls), record.model_used, record.latency_ms,
            record.tokens_used, record.cost_usd, record.created_at
          ]
        );
        await this.pgPool.query(
          'UPDATE sessions SET message_count = message_count + 1, updated_at = NOW() WHERE id = $1',
          [record.session_id]
        );
      } catch (err) {
        console.error('[DB addMessage pg error]:', err.message);
      }
    }

    this.store.messages.push(record);

    // Update session message count in embedded store
    const sIdx = this.store.sessions.findIndex(s => s.id === record.session_id);
    if (sIdx !== -1) {
      this.store.sessions[sIdx].message_count = (this.store.sessions[sIdx].message_count || 0) + 1;
      this.store.sessions[sIdx].updated_at = record.created_at;
    }

    this.saveEmbeddedStore();
    return record;
  }

  // --- Document Versioning CRUD ---

  async recordFileVersion({ sessionId, filePath, diffContent, fullContent, changeSummary, agentId }) {
    const existingVersions = await this.getFileVersions(filePath);
    const versionNumber = existingVersions.length + 1;

    const record = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      session_id: sessionId || null,
      file_path: filePath,
      version_number: versionNumber,
      diff_content: diffContent || '',
      full_content: fullContent || '',
      change_summary: changeSummary || `Modified by ${agentId || 'agent'}`,
      created_by_agent: agentId || 'agent-senior-engineer',
      created_at: new Date().toISOString(),
      status: 'active'
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO document_versions (id, session_id, file_path, version_number, diff_content, full_content, change_summary, created_by_agent, created_at, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            record.id, record.session_id, record.file_path, record.version_number,
            record.diff_content, record.full_content, record.change_summary,
            record.created_by_agent, record.created_at, record.status
          ]
        );
      } catch (err) {
        console.error('[DB recordFileVersion pg error]:', err.message);
      }
    }

    this.store.document_versions.push(record);
    this.saveEmbeddedStore();
    return record;
  }

  async getFileVersions(filePath = null) {
    if (this.engine === 'postgres') {
      try {
        let q = 'SELECT * FROM document_versions';
        const params = [];
        if (filePath) {
          q += ' WHERE file_path = $1';
          params.push(filePath);
        }
        q += ' ORDER BY version_number DESC, created_at DESC';
        const res = await this.pgPool.query(q, params);
        return res.rows;
      } catch (err) {
        console.error('[DB getFileVersions pg error]:', err.message);
      }
    }

    let list = [...this.store.document_versions];
    if (filePath) {
      list = list.filter(v => v.file_path === filePath);
    }
    return list.sort((a, b) => b.version_number - a.version_number);
  }

  async getVersion(versionId) {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query('SELECT * FROM document_versions WHERE id = $1', [versionId]);
        return res.rows[0] || null;
      } catch (err) {
        console.error('[DB getVersion pg error]:', err.message);
      }
    }
    return this.store.document_versions.find(v => v.id === versionId) || null;
  }

  // --- Knowledge Documents & RAG Chunks CRUD ---

  async saveKnowledgeDocument(doc) {
    const record = {
      id: doc.id || `kdoc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: doc.title || 'Untitled Document',
      source: doc.source || 'manual',
      source_type: doc.source_type || 'markdown',
      tags: doc.tags || [],
      doc_metadata: doc.doc_metadata || {},
      chunk_count: doc.chunk_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO knowledge_documents (id, title, source, source_type, tags, doc_metadata, chunk_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            record.id, record.title, record.source, record.source_type,
            JSON.stringify(record.tags), JSON.stringify(record.doc_metadata),
            record.chunk_count, record.created_at, record.updated_at
          ]
        );
      } catch (err) {
        console.error('[DB saveKnowledgeDocument pg error]:', err.message);
      }
    }

    this.store.knowledge_documents.push(record);
    this.saveEmbeddedStore();
    return record;
  }

  async getKnowledgeDocuments() {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query('SELECT * FROM knowledge_documents ORDER BY updated_at DESC');
        return res.rows;
      } catch (err) {
        console.error('[DB getKnowledgeDocuments pg error]:', err.message);
      }
    }
    return [...this.store.knowledge_documents].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  }

  async deleteKnowledgeDocument(docId) {
    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query('DELETE FROM knowledge_documents WHERE id = $1', [docId]);
      } catch (err) {
        console.error('[DB deleteKnowledgeDocument pg error]:', err.message);
      }
    }

    this.store.knowledge_documents = this.store.knowledge_documents.filter(d => d.id !== docId);
    this.store.knowledge_chunks = this.store.knowledge_chunks.filter(c => c.document_id !== docId);
    this.saveEmbeddedStore();
    return true;
  }

  async saveKnowledgeChunks(chunks) {
    if (!chunks || chunks.length === 0) return [];

    if (this.engine === 'postgres') {
      try {
        for (const chunk of chunks) {
          await this.pgPool.query(
            `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, embedding, token_count, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              chunk.id, chunk.document_id, chunk.chunk_index, chunk.content,
              JSON.stringify(chunk.embedding || []), chunk.token_count || 0,
              JSON.stringify(chunk.metadata || {}), chunk.created_at || new Date().toISOString()
            ]
          );
        }
      } catch (err) {
        console.error('[DB saveKnowledgeChunks pg error]:', err.message);
      }
    }

    this.store.knowledge_chunks.push(...chunks);
    this.saveEmbeddedStore();
    return chunks;
  }

  async getKnowledgeChunks(documentId = null) {
    if (this.engine === 'postgres') {
      try {
        let q = 'SELECT * FROM knowledge_chunks';
        const params = [];
        if (documentId) {
          q += ' WHERE document_id = $1';
          params.push(documentId);
        }
        q += ' ORDER BY chunk_index ASC';
        const res = await this.pgPool.query(q, params);
        return res.rows.map(r => ({
          ...r,
          embedding: typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding,
          metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata
        }));
      } catch (err) {
        console.error('[DB getKnowledgeChunks pg error]:', err.message);
      }
    }

    let chunks = [...this.store.knowledge_chunks];
    if (documentId) {
      chunks = chunks.filter(c => c.document_id === documentId);
    }
    return chunks.sort((a, b) => a.chunk_index - b.chunk_index);
  }

  // --- Tool Versions CRUD ---

  async recordToolVersion(versionData) {
    const record = {
      id: `tver_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tool_id: versionData.toolId,
      version_number: versionData.version || 1,
      name: versionData.name || '',
      description: versionData.description || '',
      category: versionData.category || 'custom',
      risk_level: versionData.riskLevel || 'medium',
      requires_approval: versionData.requiresApproval !== undefined ? !!versionData.requiresApproval : false,
      enabled: versionData.enabled !== undefined ? !!versionData.enabled : true,
      parameters: versionData.parameters || {},
      change_summary: versionData.changeSummary || 'Tool updated',
      author: versionData.author || 'system',
      created_at: new Date().toISOString()
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO tool_versions (id, tool_id, version_number, name, description, category, risk_level, requires_approval, enabled, parameters, change_summary, author, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            record.id, record.tool_id, record.version_number, record.name, record.description,
            record.category, record.risk_level, record.requires_approval, record.enabled,
            JSON.stringify(record.parameters), record.change_summary, record.author, record.created_at
          ]
        );
      } catch (err) {
        console.error('[DB recordToolVersion pg error]:', err.message);
      }
    }

    if (!this.store.tool_versions) {
      this.store.tool_versions = [];
    }
    this.store.tool_versions.push(record);
    this.saveEmbeddedStore();
    return record;
  }

  async getToolVersions(toolId) {
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query(
          'SELECT * FROM tool_versions WHERE tool_id = $1 ORDER BY version_number DESC, created_at DESC',
          [toolId]
        );
        return res.rows.map(r => ({
          version: r.version_number,
          versionNumber: r.version_number,
          id: r.id,
          toolId: r.tool_id,
          name: r.name,
          description: r.description,
          category: r.category,
          riskLevel: r.risk_level,
          requiresApproval: r.requires_approval,
          enabled: r.enabled,
          parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : (r.parameters || {}),
          changeSummary: r.change_summary,
          author: r.author,
          timestamp: r.created_at
        }));
      } catch (err) {
        console.error('[DB getToolVersions pg error]:', err.message);
      }
    }

    const list = (this.store.tool_versions || []).filter(v => v.tool_id === toolId);
    return list.map(r => ({
      version: r.version_number,
      versionNumber: r.version_number,
      id: r.id,
      toolId: r.tool_id,
      name: r.name,
      description: r.description,
      category: r.category,
      riskLevel: r.risk_level,
      requiresApproval: r.requires_approval,
      enabled: r.enabled,
      parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters) : (r.parameters || {}),
      changeSummary: r.change_summary,
      author: r.author,
      timestamp: r.created_at
    })).sort((a, b) => b.version - a.version);
  }

  // --- Telemetry & Diagnostics ---

  async getStatus() {
    return {
      engine: this.engine,
      isConnected: this.engine === 'postgres' ? this.isConnected : true,
      pgConnectionString: this.pgConnectionString ? this.pgConnectionString.replace(/:[^:@]+@/, ':***@') : null,
      lastError: this.lastError,
      tableStats: {
        users: this.store.users.length,
        sessions: this.store.sessions.length,
        messages: this.store.messages.length,
        document_versions: this.store.document_versions.length,
        knowledge_documents: this.store.knowledge_documents.length,
        knowledge_chunks: this.store.knowledge_chunks.length
      }
    };
  }

  async runCustomQuery(sql) {
    const trimmed = (sql || '').trim();
    if (!trimmed) throw new Error('Query string cannot be empty');

    if (this.engine === 'postgres' && this.pgPool) {
      const res = await this.pgPool.query(sql);
      return {
        rows: res.rows,
        rowCount: res.rowCount,
        fields: res.fields?.map(f => f.name) || []
      };
    }

    // Diagnostic emulator for embedded mode
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('select')) {
      for (const table of ['users', 'sessions', 'messages', 'document_versions', 'knowledge_documents', 'knowledge_chunks']) {
        if (lower.includes(`from ${table}`)) {
          return {
            rows: this.store[table].slice(0, 100),
            rowCount: this.store[table].length,
            fields: Object.keys(this.store[table][0] || {})
          };
        }
      }
    }

    return {
      rows: [{ message: 'Query executed on embedded relational engine', mode: 'embedded' }],
      rowCount: 1,
      fields: ['message', 'mode']
    };
  }
}

module.exports = DatabaseManager;
