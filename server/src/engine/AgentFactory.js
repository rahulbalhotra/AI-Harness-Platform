const fs = require('fs');
const path = require('path');

class AgentFactory {
  constructor(toolRegistry, modelRouter, db = null) {
    this.toolRegistry = toolRegistry;
    this.modelRouter = modelRouter;
    this.db = db;
    this.agents = new Map();
    this.persistedAgentsPath = path.join(__dirname, '../data/persistedAgents.json');
    this.loadDefaultAgents();
    this.loadPersistedAgents();
  }

  loadDefaultAgents() {
    const defaultAgentsPath = path.join(__dirname, '../data/defaultAgents.json');
    if (fs.existsSync(defaultAgentsPath)) {
      const data = JSON.parse(fs.readFileSync(defaultAgentsPath, 'utf8'));
      data.forEach(agent => {
        if (!agent.version) agent.version = 1;
        if (!agent.versionHistory) agent.versionHistory = [];
        this.agents.set(agent.id, agent);
      });
    }
  }

  loadPersistedAgents() {
    try {
      if (fs.existsSync(this.persistedAgentsPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistedAgentsPath, 'utf8'));
        if (Array.isArray(data)) {
          data.forEach(agent => {
            this.agents.set(agent.id, agent);
          });
        }
      }
    } catch (e) {
      console.warn('[AgentFactory] Could not load persisted agents:', e.message);
    }
  }

  savePersistedAgents() {
    try {
      const all = Array.from(this.agents.values());
      fs.writeFileSync(this.persistedAgentsPath, JSON.stringify(all, null, 2), 'utf8');
    } catch (e) {
      console.error('[AgentFactory] Failed to save persisted agents:', e);
    }
  }

  getAllAgents() {
    return Array.from(this.agents.values());
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  createAgent(agentConfig, user = null) {
    if (!agentConfig.name || !agentConfig.role) {
      throw new Error('Agent requires a name and role');
    }
    const id = agentConfig.id || `agent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newAgent = {
      id,
      name: agentConfig.name,
      role: agentConfig.role,
      sdlcStage: agentConfig.sdlcStage || 'Development & Coding',
      avatar: agentConfig.avatar || '🤖',
      modelId: agentConfig.modelId || 'gemini-3.8-flash',
      temperature: agentConfig.temperature !== undefined ? agentConfig.temperature : 0.2,
      maxIterations: agentConfig.maxIterations || 10,
      autonomyPolicy: agentConfig.autonomyPolicy || 'request-review',
      systemPrompt: agentConfig.systemPrompt || `You are an expert ${agentConfig.role} in the SDLC Harness.`,
      tools: agentConfig.tools || ['read_file', 'list_directory', 'grep_search'],
      skills: agentConfig.skills || [],
      isBuiltin: false,
      status: 'active',
      version: 1,
      versionHistory: [],
      createdAt: new Date().toISOString()
    };
    this.agents.set(id, newAgent);
    this.savePersistedAgents();

    if (this.db) {
      this.db.recordAgentVersion({
        agentId: id,
        version: 1,
        systemPrompt: newAgent.systemPrompt,
        modelId: newAgent.modelId,
        tools: newAgent.tools,
        autonomyPolicy: newAgent.autonomyPolicy,
        temperature: newAgent.temperature,
        changeSummary: 'Initial agent creation',
        modifiedBy: user?.username || 'admin'
      }).catch(() => {});
    }

    return newAgent;
  }

  updateAgent(agentId, updates, user = null) {
    if (!this.agents.has(agentId)) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    const existing = this.agents.get(agentId);
    const nextVersion = (existing.version || 1) + 1;

    // Record previous version snapshot
    const versionEntry = {
      version: existing.version || 1,
      timestamp: new Date().toISOString(),
      modifiedBy: user?.username || user?.name || 'admin',
      systemPrompt: existing.systemPrompt,
      modelId: existing.modelId,
      tools: existing.tools,
      autonomyPolicy: existing.autonomyPolicy,
      temperature: existing.temperature,
      changeSummary: updates.changeSummary || `Updated system prompt & config (v${existing.version || 1} -> v${nextVersion})`
    };

    const history = [versionEntry, ...(existing.versionHistory || [])];

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // prevent ID overwrite
      isBuiltin: existing.isBuiltin, // preserve builtin status
      version: nextVersion,
      versionHistory: history,
      updatedAt: new Date().toISOString()
    };

    this.agents.set(agentId, updated);
    this.savePersistedAgents();

    if (this.db) {
      this.db.recordAgentVersion({
        agentId,
        version: nextVersion,
        systemPrompt: updated.systemPrompt,
        modelId: updated.modelId,
        tools: updated.tools,
        autonomyPolicy: updated.autonomyPolicy,
        temperature: updated.temperature,
        changeSummary: updates.changeSummary || `Updated agent system prompt & config (v${nextVersion})`,
        modifiedBy: user?.username || 'admin'
      }).catch(e => console.warn('[AgentFactory] DB version save error:', e.message));
    }

    return updated;
  }

  async getAgentVersions(agentId) {
    if (this.db) {
      const dbVersions = await this.db.getAgentVersions(agentId);
      if (dbVersions && dbVersions.length > 0) return dbVersions;
    }
    const agent = this.agents.get(agentId);
    return agent?.versionHistory || [];
  }

  rollbackAgentVersion(agentId, targetVersionNumber, user = null) {
    if (!this.agents.has(agentId)) {
      throw new Error(`Agent with ID ${agentId} not found`);
    }
    const existing = this.agents.get(agentId);
    let target = (existing.versionHistory || []).find(v => (v.version === Number(targetVersionNumber) || v.versionNumber === Number(targetVersionNumber)));
    
    // Also check database if not found directly on agent object
    if (!target && this.db?.memoryStore?.agent_versions) {
      const dbVer = this.db.memoryStore.agent_versions.find(v => v.agent_id === agentId && v.version_number === Number(targetVersionNumber));
      if (dbVer) {
        target = {
          version: dbVer.version_number,
          systemPrompt: dbVer.system_prompt,
          modelId: dbVer.model_id,
          tools: dbVer.tools,
          autonomyPolicy: dbVer.autonomy_policy,
          temperature: dbVer.temperature,
          timestamp: dbVer.created_at
        };
      }
    }

    if (!target) {
      throw new Error(`Version #${targetVersionNumber} not found for agent ${agentId}`);
    }

    return this.updateAgent(agentId, {
      systemPrompt: target.systemPrompt,
      modelId: target.modelId,
      tools: target.tools,
      autonomyPolicy: target.autonomyPolicy,
      temperature: target.temperature,
      changeSummary: `Rolled back to Version #${targetVersionNumber}`
    }, user);
  }

  deleteAgent(agentId) {
    if (this.agents.has(agentId)) {
      const agent = this.agents.get(agentId);
      if (agent.isBuiltin) {
        throw new Error('Cannot delete built-in SDLC core agents. You can edit their prompt or create custom variants.');
      }
      this.agents.delete(agentId);
      this.savePersistedAgents();
      return true;
    }
    return false;
  }

  /**
   * Conversational Agent Creator ("Chat to Create New Agents")
   * Synthesizes a production-grade agent specification from natural language.
   */
  async synthesizeAgentFromPrompt(userInstruction) {
    const prompt = userInstruction.toLowerCase();

    // Heuristic persona extraction
    let role = "Specialist Software Engineer";
    let name = "Custom SDLC Agent";
    let avatar = "🤖";
    let stage = "Development & Coding";
    let recommendedModel = "gemini-3.8-flash";
    let policy = "request-review";
    let tools = ["read_file", "list_directory", "grep_search"];

    if (prompt.includes("database") || prompt.includes("sql") || prompt.includes("postgres") || prompt.includes("migration")) {
      role = "Database & Migration Architect";
      name = "Database Schema & Migration Engineer";
      avatar = "🗄️";
      stage = "Architecture & Design";
      recommendedModel = "gemini-2.5-pro";
      tools = ["read_file", "write_file", "replace_file_content", "grep_search", "git_status_diff"];
      policy = "request-review";
    } else if (prompt.includes("security") || prompt.includes("penetration") || prompt.includes("vulnerab") || prompt.includes("owasp")) {
      role = "Security Vulnerability Auditor";
      name = "DevSecOps Hardening Agent";
      avatar = "🛡️";
      stage = "Security & Compliance";
      recommendedModel = "deepseek-r1";
      tools = ["read_file", "grep_search", "security_audit", "git_status_diff"];
      policy = "always-proceed";
    } else if (prompt.includes("kubernetes") || prompt.includes("helm") || prompt.includes("docker") || prompt.includes("cloud") || prompt.includes("devops")) {
      role = "Cloud & Infrastructure SRE";
      name = "Kubernetes & Cloud Ops Specialist";
      avatar = "☸️";
      stage = "DevOps & CI/CD";
      recommendedModel = "gpt-4o";
      tools = ["read_file", "write_file", "run_command", "git_status_diff"];
      policy = "request-review";
    } else if (prompt.includes("test") || prompt.includes("qa") || prompt.includes("fuzz") || prompt.includes("cypress") || prompt.includes("playwright")) {
      role = "End-to-End Test Synthesizer";
      name = "Autonomous Test & QA Engineer";
      avatar = "🧪";
      stage = "Testing & Verification";
      recommendedModel = "gemini-3.8-flash";
      tools = ["read_file", "write_file", "run_test_suite", "run_command"];
      policy = "always-proceed";
    } else if (prompt.includes("front") || prompt.includes("react") || prompt.includes("css") || prompt.includes("ui") || prompt.includes("ux")) {
      role = "Frontend & Design System Engineer";
      name = "React UI/UX Architect";
      avatar = "🎨";
      stage = "Development & Coding";
      recommendedModel = "claude-3-7-sonnet";
      tools = ["read_file", "write_file", "replace_file_content", "list_directory"];
      policy = "always-proceed";
    } else if (prompt.includes("api") || prompt.includes("graphql") || prompt.includes("backend") || prompt.includes("microservice")) {
      role = "Backend Services Architect";
      name = "High-Throughput API Engineer";
      avatar = "⚡";
      stage = "Development & Coding";
      recommendedModel = "claude-3-7-sonnet";
      tools = ["read_file", "write_file", "replace_file_content", "run_command", "grep_search"];
      policy = "request-review";
    }

    // Model selection overrides
    if (prompt.includes("claude")) recommendedModel = "claude-3-7-sonnet";
    if (prompt.includes("gemini")) recommendedModel = "gemini-3.8-flash";
    if (prompt.includes("gpt") || prompt.includes("openai")) recommendedModel = "gpt-4o";
    if (prompt.includes("deepseek") || prompt.includes("reasoning")) recommendedModel = "deepseek-r1";
    if (prompt.includes("local") || prompt.includes("ollama")) recommendedModel = "ollama-qwen2.5-coder";

    // Policy overrides
    if (prompt.includes("strict") || prompt.includes("cautious") || prompt.includes("safe")) policy = "request-review";
    if (prompt.includes("autonomous") || prompt.includes("unsupervised") || prompt.includes("fast")) policy = "always-proceed";

    const systemPrompt = `You are ${name}, a premier ${role} integrated directly into the Enterprise AI Harness platform for SDLC.
Your mission is to fulfill the user's software engineering requirements with extreme precision, adhering to:
1. Architectural integrity, defensive programming, and zero-breaking-change principles.
2. Rigorous verification and testing of all artifacts before completion.
3. Strict adherence to the '${policy}' execution governance policy.
Specific Focus: ${userInstruction}
Available Harness Tools: ${tools.join(', ')}.`;

    const synthesizedAgent = {
      id: `custom-agent-${Date.now().toString(36)}`,
      name,
      role,
      sdlcStage: stage,
      avatar,
      modelId: recommendedModel,
      temperature: 0.15,
      maxIterations: 10,
      autonomyPolicy: policy,
      systemPrompt,
      tools,
      skills: [],
      isBuiltin: false,
      status: "active"
    };

    return {
      agent: synthesizedAgent,
      rationale: `Synthesized agent based on prompt: "${userInstruction}". Configured with role '${role}', target SDLC stage '${stage}', model '${recommendedModel}', and governance policy '${policy}'.`
    };
  }
}

module.exports = AgentFactory;
