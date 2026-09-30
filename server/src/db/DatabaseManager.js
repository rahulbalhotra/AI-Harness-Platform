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
    this.pgVectorEnabled = false;
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
      tool_versions: [],
      projects: [],
      stories: []
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
          tool_versions: parsed.tool_versions || [],
          projects: parsed.projects || [],
          stories: parsed.stories || []
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
        full_content TEXT,
        tags JSONB DEFAULT '[]',
        doc_metadata JSONB DEFAULT '{}',
        chunk_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE knowledge_documents ADD COLUMN IF NOT EXISTS full_content TEXT;

      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id VARCHAR(64) PRIMARY KEY,
        document_id VARCHAR(64) REFERENCES knowledge_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding JSONB,
        embedding_vector JSONB,
        token_count INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding_vector JSONB;

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

      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(64) PRIMARY KEY,
        key VARCHAR(16) NOT NULL,
        name VARCHAR(256) NOT NULL,
        description TEXT,
        status VARCHAR(32) DEFAULT 'planning',
        lead_agent_id VARCHAR(64),
        start_date VARCHAR(32),
        target_date VARCHAR(32),
        brd JSONB DEFAULT '{}',
        plan JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stories (
        id VARCHAR(64) PRIMARY KEY,
        project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(256) NOT NULL,
        description TEXT,
        type VARCHAR(32) DEFAULT 'story',
        status VARCHAR(32) DEFAULT 'todo',
        priority VARCHAR(32) DEFAULT 'medium',
        assigned_agent_id VARCHAR(64),
        assigned_agent_name VARCHAR(128),
        avatar VARCHAR(16),
        story_points INTEGER DEFAULT 3,
        start_date TIMESTAMP WITH TIME ZONE,
        due_date TIMESTAMP WITH TIME ZONE,
        target_files JSONB DEFAULT '[]',
        activity_log JSONB DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_stories_project ON stories(project_id);
      CREATE INDEX IF NOT EXISTS idx_stories_agent ON stories(assigned_agent_id);
      CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
    `;

    try {
      await this.pgPool.query(migrationSql);
      try {
        await this.pgPool.query('CREATE EXTENSION IF NOT EXISTS vector;');
        await this.pgPool.query('ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS pgvector_embedding vector(384);');
        await this.pgPool.query('CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_pgvec ON knowledge_chunks USING hnsw (pgvector_embedding vector_cosine_ops);');
        this.pgVectorEnabled = true;
        console.log('[DatabaseManager] pgvector extension and HNSW vector(384) index active.');
      } catch (vecErr) {
        this.pgVectorEnabled = false;
        console.log('[DatabaseManager] pgvector extension not installed on Postgres instance; using hybrid JSONB vector(384) cosine similarity.');
      }
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
      full_content: doc.full_content || doc.content || '',
      tags: doc.tags || [],
      doc_metadata: doc.doc_metadata || {},
      chunk_count: doc.chunk_count || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.engine === 'postgres') {
      try {
        await this.pgPool.query(
          `INSERT INTO knowledge_documents (id, title, source, source_type, full_content, tags, doc_metadata, chunk_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            record.id, record.title, record.source, record.source_type,
            record.full_content, JSON.stringify(record.tags), JSON.stringify(record.doc_metadata),
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

  async getKnowledgeDocumentById(docId) {
    let doc = null;
    if (this.engine === 'postgres') {
      try {
        const res = await this.pgPool.query('SELECT * FROM knowledge_documents WHERE id = $1', [docId]);
        doc = res.rows[0] || null;
      } catch (err) {
        console.error('[DB getKnowledgeDocumentById pg error]:', err.message);
      }
    }
    if (!doc) {
      doc = this.store.knowledge_documents.find(d => d.id === docId) || null;
    }
    if (!doc) return null;

    const chunks = await this.getKnowledgeChunks(docId);
    const reconstructedContent = doc.full_content || chunks.map(c => c.content).join('\n\n');
    return {
      ...doc,
      full_content: reconstructedContent,
      chunks
    };
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
          if (this.pgVectorEnabled && Array.isArray(chunk.embedding_vector)) {
            const vecLiteral = `[${chunk.embedding_vector.join(',')}]`;
            await this.pgPool.query(
              `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, embedding, embedding_vector, pgvector_embedding, token_count, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7::vector, $8, $9, $10)`,
              [
                chunk.id, chunk.document_id, chunk.chunk_index, chunk.content,
                JSON.stringify(chunk.embedding || {}), JSON.stringify(chunk.embedding_vector || []),
                vecLiteral, chunk.token_count || 0,
                JSON.stringify(chunk.metadata || {}), chunk.created_at || new Date().toISOString()
              ]
            );
          } else {
            await this.pgPool.query(
              `INSERT INTO knowledge_chunks (id, document_id, chunk_index, content, embedding, embedding_vector, token_count, metadata, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [
                chunk.id, chunk.document_id, chunk.chunk_index, chunk.content,
                JSON.stringify(chunk.embedding || {}), JSON.stringify(chunk.embedding_vector || []),
                chunk.token_count || 0,
                JSON.stringify(chunk.metadata || {}), chunk.created_at || new Date().toISOString()
              ]
            );
          }
        }
      } catch (err) {
        console.error('[DB saveKnowledgeChunks pg error]:', err.message);
      }
    }

    this.store.knowledge_chunks.push(...chunks);
    this.saveEmbeddedStore();
    return chunks;
  }

  async searchPgVector(queryVector, topK = 5) {
    if (this.engine === 'postgres' && this.pgVectorEnabled && Array.isArray(queryVector)) {
      try {
        const vecLiteral = `[${queryVector.join(',')}]`;
        const res = await this.pgPool.query(
          `SELECT c.*, d.title AS document_title, d.source AS document_source, d.source_type, d.tags AS document_tags,
                  1 - (c.pgvector_embedding <=> $1::vector) AS cosine_score
           FROM knowledge_chunks c
           LEFT JOIN knowledge_documents d ON d.id = c.document_id
           WHERE c.pgvector_embedding IS NOT NULL
           ORDER BY c.pgvector_embedding <=> $1::vector
           LIMIT $2`,
          [vecLiteral, topK]
        );
        return res.rows;
      } catch (err) {
        console.warn('[DB searchPgVector fallback]:', err.message);
      }
    }
    return null;
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

  // --- Projects & User Stories (Jira-style PM Module) CRUD ---

  async saveProject(proj) {
    const record = {
      id: proj.id,
      key: proj.key || 'PROJ',
      name: proj.name || 'Untitled Project',
      description: proj.description || '',
      status: proj.status || 'planning',
      lead_agent_id: proj.leadAgentId || proj.lead_agent_id || 'agent-willow',
      start_date: proj.startDate || proj.start_date || new Date().toISOString().split('T')[0],
      target_date: proj.targetDate || proj.target_date || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      brd: proj.brd || {},
      plan: proj.plan || {},
      created_at: proj.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.engine === 'postgres' && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO projects (id, key, name, description, status, lead_agent_id, start_date, target_date, brd, plan, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, description = EXCLUDED.description, status = EXCLUDED.status,
             brd = EXCLUDED.brd, plan = EXCLUDED.plan, updated_at = NOW()`,
          [
            record.id, record.key, record.name, record.description, record.status,
            record.lead_agent_id, record.start_date, record.target_date,
            JSON.stringify(record.brd), JSON.stringify(record.plan),
            record.created_at, record.updated_at
          ]
        );
      } catch (err) {
        console.error('[DB saveProject pg error]:', err.message);
      }
    }

    if (!this.store.projects) this.store.projects = [];
    const idx = this.store.projects.findIndex(p => p.id === record.id);
    if (idx !== -1) {
      this.store.projects[idx] = { ...this.store.projects[idx], ...record };
    } else {
      this.store.projects.push(record);
    }
    this.saveEmbeddedStore();
    return record;
  }

  async getProjects() {
    if (this.engine === 'postgres' && this.pgPool) {
      try {
        const res = await this.pgPool.query('SELECT * FROM projects ORDER BY updated_at DESC');
        return res.rows.map(r => ({
          ...r,
          leadAgentId: r.lead_agent_id,
          startDate: r.start_date,
          targetDate: r.target_date,
          brd: typeof r.brd === 'string' ? JSON.parse(r.brd) : (r.brd || {}),
          plan: typeof r.plan === 'string' ? JSON.parse(r.plan) : (r.plan || {})
        }));
      } catch (err) {
        console.error('[DB getProjects pg error]:', err.message);
      }
    }

    return (this.store.projects || []).map(r => ({
      ...r,
      leadAgentId: r.lead_agent_id || r.leadAgentId,
      startDate: r.start_date || r.startDate,
      targetDate: r.target_date || r.targetDate
    }));
  }

  async getProject(id) {
    const list = await this.getProjects();
    return list.find(p => p.id === id) || null;
  }

  async updateProject(id, updates) {
    const proj = await this.getProject(id);
    if (!proj) return null;
    const merged = { ...proj, ...updates, updated_at: new Date().toISOString() };
    return this.saveProject(merged);
  }

  async saveStory(story) {
    const record = {
      id: story.id,
      project_id: story.projectId || story.project_id || 'proj_amazon_clone',
      title: story.title || 'Untitled User Story',
      description: story.description || '',
      type: story.type || 'story',
      status: story.status || 'todo',
      priority: story.priority || 'medium',
      assigned_agent_id: story.assignedAgentId || story.assigned_agent_id || 'agent-senior-engineer',
      assigned_agent_name: story.assignedAgentName || story.assigned_agent_name || 'Full-Stack Senior Engineer',
      avatar: story.avatar || '💻',
      story_points: story.storyPoints ?? story.story_points ?? 3,
      start_date: story.startDate || story.start_date || new Date().toISOString(),
      due_date: story.dueDate || story.due_date || new Date(Date.now() + 86400000 * 3).toISOString(),
      target_files: story.targetFiles || story.target_files || [],
      activity_log: story.activityLog || story.activity_log || [],
      created_at: story.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.engine === 'postgres' && this.pgPool) {
      try {
        await this.pgPool.query(
          `INSERT INTO stories (id, project_id, title, description, type, status, priority, assigned_agent_id, assigned_agent_name, avatar, story_points, start_date, due_date, target_files, activity_log, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           ON CONFLICT (id) DO UPDATE SET
             title = EXCLUDED.title, description = EXCLUDED.description, type = EXCLUDED.type,
             status = EXCLUDED.status, priority = EXCLUDED.priority, assigned_agent_id = EXCLUDED.assigned_agent_id,
             assigned_agent_name = EXCLUDED.assigned_agent_name, avatar = EXCLUDED.avatar,
             story_points = EXCLUDED.story_points, due_date = EXCLUDED.due_date,
             target_files = EXCLUDED.target_files, activity_log = EXCLUDED.activity_log, updated_at = NOW()`,
          [
            record.id, record.project_id, record.title, record.description, record.type,
            record.status, record.priority, record.assigned_agent_id, record.assigned_agent_name,
            record.avatar, record.story_points, record.start_date, record.due_date,
            JSON.stringify(record.target_files), JSON.stringify(record.activity_log),
            record.created_at, record.updated_at
          ]
        );
      } catch (err) {
        console.error('[DB saveStory pg error]:', err.message);
      }
    }

    if (!this.store.stories) this.store.stories = [];
    const idx = this.store.stories.findIndex(s => s.id === record.id);
    if (idx !== -1) {
      this.store.stories[idx] = { ...this.store.stories[idx], ...record };
    } else {
      this.store.stories.push(record);
    }
    this.saveEmbeddedStore();
    return this.sanitizeStory(record);
  }

  async getStories(projectId = null) {
    if (this.engine === 'postgres' && this.pgPool) {
      try {
        let q = 'SELECT * FROM stories';
        const params = [];
        if (projectId) {
          q += ' WHERE project_id = $1';
          params.push(projectId);
        }
        q += ' ORDER BY created_at ASC';
        const res = await this.pgPool.query(q, params);
        return res.rows.map(r => this.sanitizeStory(r));
      } catch (err) {
        console.error('[DB getStories pg error]:', err.message);
      }
    }

    let list = this.store.stories || [];
    if (projectId) {
      list = list.filter(s => (s.project_id || s.projectId) === projectId);
    }
    return list.map(s => this.sanitizeStory(s));
  }

  async updateStory(id, updates) {
    const stories = await this.getStories();
    const story = stories.find(s => s.id === id);
    if (!story) return null;
    const merged = { ...story, ...updates, updated_at: new Date().toISOString() };
    return this.saveStory(merged);
  }

  async deleteStory(id) {
    if (this.engine === 'postgres' && this.pgPool) {
      try {
        await this.pgPool.query('DELETE FROM stories WHERE id = $1', [id]);
      } catch (err) {
        console.error('[DB deleteStory pg error]:', err.message);
      }
    }

    if (this.store.stories) {
      this.store.stories = this.store.stories.filter(s => s.id !== id);
      this.saveEmbeddedStore();
    }
    return true;
  }

  sanitizeStory(record) {
    return {
      id: record.id,
      projectId: record.project_id || record.projectId,
      title: record.title,
      description: record.description,
      type: record.type,
      status: record.status,
      priority: record.priority,
      assignedAgentId: record.assigned_agent_id || record.assignedAgentId,
      assignedAgentName: record.assigned_agent_name || record.assignedAgentName,
      avatar: record.avatar,
      storyPoints: record.story_points ?? record.storyPoints ?? 3,
      startDate: record.start_date || record.startDate,
      dueDate: record.due_date || record.dueDate,
      targetFiles: typeof record.target_files === 'string' ? JSON.parse(record.target_files) : (record.target_files || record.targetFiles || []),
      activityLog: typeof record.activity_log === 'string' ? JSON.parse(record.activity_log) : (record.activity_log || record.activityLog || []),
      created_at: record.created_at,
      updated_at: record.updated_at
    };
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
