const fs = require('fs');
const path = require('path');

class ProjectManager {
  constructor(db, toolRegistry = null) {
    this.db = db;
    this.toolRegistry = toolRegistry;
    this.init();
  }

  async init() {
    await this.seedDefaultProject();
  }

  async seedDefaultProject() {
    const existing = await this.db.getProjects();
    if (existing.length === 0) {
      const defaultProj = {
        id: 'proj_amazon_clone',
        key: 'AMZN',
        name: 'Amazonia E-Commerce Platform',
        description: 'Full-stack enterprise e-commerce platform with catalog discovery, shopping cart drawer, 1-click checkout, and order history tracking.',
        status: 'in_progress', // 'planning' | 'in_progress' | 'review' | 'completed'
        leadAgentId: 'agent-willow',
        startDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        targetDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
        brd: {
          title: 'Business Requirements Document (BRD) — Amazonia E-Commerce Platform',
          executiveSummary: 'Deliver a scalable, responsive, zero-latency shopping platform matching Amazon-tier user experience.',
          businessGoals: [
            'Enable customers to search 1,000+ items across multi-tier product categories.',
            'Support Prime One-Day delivery tags, dynamic discounts, and star ratings.',
            'Provide persistent shopping cart drawer with instant quantity modification.',
            'Facilitate instant 1-click checkout with confirmed order receipt generation.'
          ],
          targetAudience: 'Global e-commerce shoppers, enterprise buyers, and store administrators.',
          successMetrics: [
            'Cart abandonment rate under 20%.',
            'Sub-100ms API response time for product catalog and checkout.',
            '100% test pass rate with zero OWASP high-severity vulnerabilities.'
          ]
        },
        plan: {
          phases: [
            { id: 'phase_1', name: 'Discovery & Research', status: 'completed', owner: 'agent-researcher', timeline: 'Day 1' },
            { id: 'phase_2', name: 'Architecture & RFC Blueprints', status: 'completed', owner: 'agent-architect', timeline: 'Day 1 - 2' },
            { id: 'phase_3', name: 'Full-Stack Implementation', status: 'in_progress', owner: 'agent-senior-engineer', timeline: 'Day 2 - 3' },
            { id: 'phase_4', name: 'Automated QA & Chrome Browser Testing', status: 'in_progress', owner: 'agent-qa-synthesizer', timeline: 'Day 3 - 4' },
            { id: 'phase_5', name: 'AppSec Audit & Production Release', status: 'todo', owner: 'agent-secops-auditor', timeline: 'Day 4 - 5' }
          ]
        }
      };

      await this.db.saveProject(defaultProj);

      // Seed standard Jira-like stories
      const stories = [
        {
          id: 'AMZN-1',
          projectId: 'proj_amazon_clone',
          title: 'Author Domain PRD & System Architecture Specification',
          description: 'Research core e-commerce capabilities, catalog schemas, and user flows. Ingest PRD into the Knowledge Hub.',
          type: 'story', // 'story' | 'task' | 'bug' | 'epic'
          status: 'done', // 'todo' | 'in_progress' | 'review' | 'done'
          priority: 'highest', // 'highest' | 'high' | 'medium' | 'low'
          assignedAgentId: 'agent-researcher',
          assignedAgentName: 'Product Research & PRD Lead',
          avatar: '🔬',
          storyPoints: 5,
          startDate: new Date(Date.now() - 86400000 * 2).toISOString(),
          dueDate: new Date(Date.now() - 86400000 * 1).toISOString(),
          targetFiles: ['docs/amazon-clone-architecture-prd.md'],
          activityLog: [
            { timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), text: 'Story created and assigned to Product Research Lead.' },
            { timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), text: 'Ingested specification into Knowledge Hub. Story marked Done.' }
          ]
        },
        {
          id: 'AMZN-2',
          projectId: 'proj_amazon_clone',
          title: 'Design Relational E-Commerce Database Schema & API Contracts',
          description: 'Model categories, products, cart_items, and orders tables in SQL. Define OpenAPI endpoints and contracts.',
          type: 'story',
          status: 'done',
          priority: 'highest',
          assignedAgentId: 'agent-architect',
          assignedAgentName: 'System Architect & RFC Lead',
          avatar: '📐',
          storyPoints: 8,
          startDate: new Date(Date.now() - 86400000 * 1).toISOString(),
          dueDate: new Date().toISOString(),
          targetFiles: ['schema/ecommerce_schema.sql', 'docs/api_contracts.json'],
          activityLog: [
            { timestamp: new Date(Date.now() - 86400000 * 1).toISOString(), text: 'Assigned to System Architect. Schema drafted.' },
            { timestamp: new Date().toISOString(), text: 'Schema and API contracts committed to repository.' }
          ]
        },
        {
          id: 'AMZN-3',
          projectId: 'proj_amazon_clone',
          title: 'Build Flask Storefront Backend, Cart REST APIs & Checkout Flow',
          description: 'Implement app.py with routes /api/products, /api/cart, and /api/checkout. Build responsive templates/index.html & static/styles.css.',
          type: 'story',
          status: 'in_progress',
          priority: 'highest',
          assignedAgentId: 'agent-senior-engineer',
          assignedAgentName: 'Full-Stack Senior Engineer',
          avatar: '💻',
          storyPoints: 13,
          startDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          targetFiles: ['app.py', 'templates/index.html', 'static/styles.css', 'requirements.txt'],
          activityLog: [
            { timestamp: new Date().toISOString(), text: 'Started implementation. Created Flask application routes and storefront components.' }
          ]
        },
        {
          id: 'AMZN-4',
          projectId: 'proj_amazon_clone',
          title: 'Synthesize Automated Pytest Suite & Headless Chrome Testing',
          description: 'Write tests/test_amazon_clone.py verifying product search, cart calculation, and order placing.',
          type: 'task',
          status: 'in_progress',
          priority: 'high',
          assignedAgentId: 'agent-qa-synthesizer',
          assignedAgentName: 'QA & Test Synthesizer',
          avatar: '🧪',
          storyPoints: 5,
          startDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          targetFiles: ['tests/test_amazon_clone.py'],
          activityLog: [
            { timestamp: new Date().toISOString(), text: 'Test cases created for cart endpoints and catalog queries.' }
          ]
        },
        {
          id: 'AMZN-5',
          projectId: 'proj_amazon_clone',
          title: 'Execute OWASP SAST Security Audit & Secret Detection',
          description: 'Scan repository for hardcoded credentials, SQL injection, XSS vectors, and enforce security policies.',
          type: 'task',
          status: 'todo',
          priority: 'high',
          assignedAgentId: 'agent-secops-auditor',
          assignedAgentName: 'AppSec & Vulnerability Auditor',
          avatar: '🛡️',
          storyPoints: 3,
          startDate: new Date(Date.now() + 86400000 * 2).toISOString(),
          dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          targetFiles: ['security_audit_report.json'],
          activityLog: [
            { timestamp: new Date().toISOString(), text: 'Scheduled for execution after implementation merge.' }
          ]
        },
        {
          id: 'AMZN-6',
          projectId: 'proj_amazon_clone',
          title: 'Author Multi-Stage Production Dockerfile & Container Manifest',
          description: 'Package Python/Flask environment, set up non-root user, and expose health endpoint for deployment.',
          type: 'task',
          status: 'todo',
          priority: 'medium',
          assignedAgentId: 'agent-devops-sre',
          assignedAgentName: 'Cloud DevOps & Release SRE',
          avatar: '🚀',
          storyPoints: 3,
          startDate: new Date(Date.now() + 86400000 * 3).toISOString(),
          dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
          targetFiles: ['Dockerfile'],
          activityLog: [
            { timestamp: new Date().toISOString(), text: 'Container manifest staged in pipeline.' }
          ]
        }
      ];

      for (const story of stories) {
        await this.db.saveStory(story);
      }
    }
  }

  async getAllProjects() {
    return this.db.getProjects();
  }

  async getProject(id) {
    const proj = await this.db.getProject(id);
    if (!proj) return null;
    const stories = await this.db.getStories(id);
    return {
      ...proj,
      stories
    };
  }

  async createProject(projectData) {
    const id = projectData.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const key = (projectData.key || projectData.name?.substring(0, 4) || 'PROJ').toUpperCase().replace(/[^A-Z]/g, '');
    const record = {
      id,
      key,
      name: projectData.name || 'Untitled Project',
      description: projectData.description || '',
      status: projectData.status || 'planning',
      leadAgentId: projectData.leadAgentId || 'agent-willow',
      startDate: projectData.startDate || new Date().toISOString().split('T')[0],
      targetDate: projectData.targetDate || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      brd: projectData.brd || {
        title: `${projectData.name} — Business Requirements Document`,
        executiveSummary: projectData.description || 'Project requirements and operational vision.',
        businessGoals: [],
        targetAudience: 'Enterprise stakeholders',
        successMetrics: []
      },
      plan: projectData.plan || {
        phases: [
          { id: 'p1', name: 'Discovery & Research', status: 'in_progress', owner: 'agent-researcher', timeline: 'Week 1' },
          { id: 'p2', name: 'Architecture & System RFC', status: 'todo', owner: 'agent-architect', timeline: 'Week 1' },
          { id: 'p3', name: 'Implementation & Coding', status: 'todo', owner: 'agent-senior-engineer', timeline: 'Week 2' },
          { id: 'p4', name: 'Testing & Release Verification', status: 'todo', owner: 'agent-qa-synthesizer', timeline: 'Week 2' }
        ]
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.db.saveProject(record);
  }

  async updateProject(id, updates) {
    return this.db.updateProject(id, updates);
  }

  async getStories(projectId = null) {
    return this.db.getStories(projectId);
  }

  async createStory(storyData) {
    const projId = storyData.projectId || 'proj_amazon_clone';
    const proj = await this.db.getProject(projId);
    const existing = await this.db.getStories(projId);
    const count = existing.length + 1;
    const keyPrefix = proj?.key || 'TASK';
    const id = storyData.id || `${keyPrefix}-${count}`;

    const record = {
      id,
      projectId: projId,
      title: storyData.title || 'Untitled User Story',
      description: storyData.description || '',
      type: storyData.type || 'story',
      status: storyData.status || 'todo',
      priority: storyData.priority || 'medium',
      assignedAgentId: storyData.assignedAgentId || 'agent-senior-engineer',
      assignedAgentName: storyData.assignedAgentName || 'Full-Stack Senior Engineer',
      avatar: storyData.avatar || '💻',
      storyPoints: storyData.storyPoints || 3,
      startDate: storyData.startDate || new Date().toISOString(),
      dueDate: storyData.dueDate || new Date(Date.now() + 86400000 * 3).toISOString(),
      targetFiles: Array.isArray(storyData.targetFiles) ? storyData.targetFiles : [],
      activityLog: [
        { timestamp: new Date().toISOString(), text: `Created by ${storyData.assignedAgentName || 'Agent'}.` }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return this.db.saveStory(record);
  }

  async updateStory(id, updates) {
    return this.db.updateStory(id, updates);
  }

  async deleteStory(id) {
    return this.db.deleteStory(id);
  }

  /**
   * Helper called by AgentRuntime when agents start or finish tasks so the Jira board updates in real time!
   */
  async recordAgentStoryProgress(agentId, storyIdOrKey, newStatus, logText, targetFile = null) {
    const stories = await this.db.getStories();
    const story = stories.find(s => s.id === storyIdOrKey || s.assignedAgentId === agentId);
    if (!story) return null;

    const updates = {
      status: newStatus || story.status,
      updated_at: new Date().toISOString()
    };

    if (targetFile && !story.targetFiles?.includes(targetFile)) {
      updates.targetFiles = [...(story.targetFiles || []), targetFile];
    }

    const newLog = {
      timestamp: new Date().toISOString(),
      text: logText || `Status transitioned to ${newStatus} by ${agentId}.`
    };
    updates.activityLog = [...(story.activityLog || []), newLog];

    return this.db.updateStory(story.id, updates);
  }
}

module.exports = ProjectManager;
