const fs = require('fs');
const path = require('path');

class GovernanceEngine {
  constructor(workspaceRoot, toolRegistry = null) {
    this.workspaceRoot = workspaceRoot || process.cwd();
    this.toolRegistry = toolRegistry;
    this.isAuthorized = false;
    this.policy = 'request-review';
    this.activeUser = { id: 'usr_admin', username: 'admin', role: 'admin', name: 'Enterprise Admin' };
    this.pendingApprovals = new Map();
    this.auditLogs = [];
    
    // Accidental Data Loss Prevention (ADLP) patterns
    this.blockedCommandPatterns = [
      /rm\s+-rf\s+[\/\\]/i,
      /del\s+\/[fF]\s+\/[sS]\s+\/[qQ]\s+[cC]:\\/i,
      /format\s+[a-zA-Z]:/i,
      /drop\s+database/i,
      /drop\s+table/i,
      /git\s+reset\s+--hard\s+origin/i,
      /mkfs/i,
      /dd\s+if=/i,
      /:(){ :|:& };:/i // fork bomb
    ];
  }

  isPathWithinWorkspace(targetPath) {
    if (!targetPath) return true;
    const wsRoot = (typeof this.toolRegistry?.workspaceRoot === 'string' && this.toolRegistry.workspaceRoot)
      || (typeof this.workspaceRoot === 'string' && this.workspaceRoot)
      || process.cwd();
    try {
      const resolvedTarget = path.resolve(wsRoot, targetPath);
      const resolvedRoot = path.resolve(wsRoot);
      return resolvedTarget.toLowerCase().startsWith(resolvedRoot.toLowerCase());
    } catch (e) {
      return false;
    }
  }

  setActiveUser(user) {
    if (user) {
      this.activeUser = user;
      this.logAudit('USER_SWITCHED', { username: user.username, role: user.role });
    }
  }

  getActiveUser() {
    return this.activeUser;
  }

  checkUserPermission(user, action, target = null) {
    const role = user?.role || this.activeUser?.role || 'developer';

    if (action === 'change_policy') {
      if (role !== 'admin') {
        return { allowed: false, reason: 'Only administrators with the "admin" role can modify global governance policies.' };
      }
    }

    if (action === 'edit_agent') {
      if (role === 'viewer') {
        return { allowed: false, reason: 'Viewers have read-only access and cannot modify agent specifications.' };
      }
      if (role === 'developer' && target?.isBuiltin) {
        return { allowed: false, reason: 'Developers cannot modify core built-in agents. Please contact a Lead Architect or Admin.' };
      }
    }

    if (action === 'delete_agent') {
      if (role === 'viewer' || role === 'developer') {
        return { allowed: false, reason: 'Only Lead Architects and Admins can delete agents.' };
      }
    }

    if (action === 'execute_tool') {
      if (role === 'viewer') {
        const toolId = target?.toolId || '';
        if (['run_command', 'write_file', 'create_directory', 'replace_file_content', 'rollback_document_version'].includes(toolId)) {
          return { allowed: false, reason: `Viewers have read-only access and are not permitted to execute '${toolId}'.` };
        }
      }
    }

    return { allowed: true };
  }

  setPolicy(policy, user = null) {
    const u = user || this.activeUser;
    const perm = this.checkUserPermission(u, 'change_policy');
    if (!perm.allowed) {
      throw new Error(perm.reason);
    }
    if (['always-proceed', 'request-review', 'sandbox-strict'].includes(policy)) {
      this.policy = policy;
      this.logAudit('POLICY_CHANGED', { newPolicy: policy, changedBy: u?.username || 'admin' });
    }
  }

  getPolicy() {
    return this.policy;
  }

  checkCommandSafety(command) {
    for (const pattern of this.blockedCommandPatterns) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          reason: `Blocked by Accidental Data Loss Prevention (ADLP) policy: Matches forbidden destructive pattern '${pattern.source}'`
        };
      }
    }
    return { allowed: true };
  }

  requiresApproval(toolId, toolParams = {}, toolMeta = null, user = null) {
    const u = user || this.activeUser;
    const role = u?.role || 'developer';

    // Viewer role: all mutating actions require approval or are sandbox-strict
    if (role === 'viewer') {
      return true;
    }

    // Accidental Data Loss Prevention (ADLP) patterns always checked on shell commands
    if (toolId === 'run_command') {
      const safety = this.checkCommandSafety(toolParams?.command || '');
      if (!safety.allowed) return true;
    }

    // If policy is sandbox-strict, everything mutating requires approval
    if (this.policy === 'sandbox-strict') {
      return true;
    }

    // CHECK REPO AUTHORIZATION:
    // When the user has authorized the repo path, file/directory creations & writes
    // inside the authorized repository are pre-approved and do NOT prompt repeatedly!
    const isRepoAuthorized = Boolean(
      this.toolRegistry?.isAuthorized || 
      this.isAuthorized || 
      (this.toolRegistry && typeof this.toolRegistry.getWorkspaceInfo === 'function' && this.toolRegistry.getWorkspaceInfo()?.isAuthorized)
    );
    const isFileCreationOrWrite = ['write_file', 'create_directory', 'replace_file_content'].includes(toolId);

    if (isRepoAuthorized && isFileCreationOrWrite) {
      const targetPath = toolParams?.filePath || toolParams?.file_path || toolParams?.path || toolParams?.file || toolParams?.targetFile || toolParams?.dirPath || toolParams?.dir_path || '';
      if (this.isPathWithinWorkspace(targetPath)) {
        this.logAudit('REPO_PREAUTHORIZED_ACTION', {
          toolId,
          targetPath,
          status: 'bypassed_approval',
          reason: 'Repository folder is authorized by user'
        });
        return false;
      }
    }

    // Admin role in always-proceed: bypasses approval
    if (role === 'admin' && this.policy === 'always-proceed') {
      return false;
    }

    // Default 'request-review' for other tools
    if (toolMeta && toolMeta.requiresApproval) {
      return true;
    }

    if (toolId === 'run_command' || toolId === 'launch_browser_test' || toolId === 'run_environment_test') {
      return true;
    }

    return false;
  }

  createApprovalRequest(executionId, agentId, toolId, parameters, toolMeta) {
    const approvalId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const request = {
      approvalId,
      executionId,
      agentId,
      toolId,
      toolName: toolMeta ? toolMeta.name : toolId,
      category: toolMeta ? toolMeta.category : 'general',
      riskLevel: toolMeta ? toolMeta.riskLevel : 'medium',
      parameters,
      status: 'pending', // 'pending' | 'approved' | 'rejected'
      createdAt: new Date().toISOString()
    };

    this.pendingApprovals.set(approvalId, request);
    this.logAudit('APPROVAL_REQUESTED', { approvalId, toolId, parameters });
    return request;
  }

  resolveApproval(approvalId, status, userComment = '') {
    if (!this.pendingApprovals.has(approvalId)) {
      return null;
    }
    const req = this.pendingApprovals.get(approvalId);
    req.status = status; // 'approved' | 'rejected'
    req.resolvedAt = new Date().toISOString();
    req.userComment = userComment;

    this.logAudit(status === 'approved' ? 'APPROVAL_GRANTED' : 'APPROVAL_DENIED', {
      approvalId,
      toolId: req.toolId,
      userComment
    });

    return req;
  }

  getPendingApprovals() {
    return Array.from(this.pendingApprovals.values()).filter(a => a.status === 'pending');
  }

  logAudit(action, details = {}) {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action,
      details
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return entry;
  }

  getAuditLogs(limit = 50) {
    return this.auditLogs.slice(0, limit);
  }
}

module.exports = GovernanceEngine;
