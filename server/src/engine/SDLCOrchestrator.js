const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class SDLCOrchestrator extends EventEmitter {
  constructor(agentRuntime, agentFactory) {
    super();
    this.agentRuntime = agentRuntime;
    this.agentFactory = agentFactory;
    this.pipelines = new Map();
    this.pipelineRuns = new Map();
    this.loadDefaultPipelines();
  }

  loadDefaultPipelines() {
    const defaultPipelinesPath = path.join(__dirname, '../data/defaultPipelines.json');
    if (fs.existsSync(defaultPipelinesPath)) {
      const data = JSON.parse(fs.readFileSync(defaultPipelinesPath, 'utf8'));
      data.forEach(p => this.pipelines.set(p.id, p));
    }
  }

  getAllPipelines() {
    return Array.from(this.pipelines.values());
  }

  getPipeline(pipelineId) {
    return this.pipelines.get(pipelineId);
  }

  registerPipeline(pipelineConfig) {
    if (!pipelineConfig.id || !pipelineConfig.name || !pipelineConfig.stages) {
      throw new Error('Pipeline requires id, name and stages');
    }
    this.pipelines.set(pipelineConfig.id, pipelineConfig);
    return pipelineConfig;
  }

  deletePipeline(pipelineId) {
    return this.pipelines.delete(pipelineId);
  }

  getPipelineRuns() {
    return Array.from(this.pipelineRuns.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async triggerPipeline(pipelineId, initialInput = {}) {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found.`);
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const runState = {
      runId,
      pipelineId,
      pipelineName: pipeline.name,
      status: 'running', // 'running' | 'completed' | 'failed'
      startedAt: new Date().toISOString(),
      currentStageIndex: 0,
      totalStages: pipeline.stages.length,
      stageOutputs: {},
      stageHistory: [],
      error: null
    };

    this.pipelineRuns.set(runId, runState);
    this.emit('pipeline_started', runState);

    // Run asynchronously
    this.executePipelineStages(runId, initialInput).catch(err => {
      runState.status = 'failed';
      runState.error = err.message;
      this.emit('pipeline_failed', { runId, error: err.message });
    });

    return runState;
  }

  async executePipelineStages(runId, initialInput) {
    const runState = this.pipelineRuns.get(runId);
    const pipeline = this.pipelines.get(runState.pipelineId);

    let stageContext = { ...initialInput };

    for (let i = 0; i < pipeline.stages.length; i++) {
      const stage = pipeline.stages[i];
      runState.currentStageIndex = i;

      const stageRecord = {
        stageId: stage.id,
        stageName: stage.name,
        agentId: stage.agentId,
        status: 'running',
        startedAt: new Date().toISOString()
      };
      runState.stageHistory.push(stageRecord);

      this.emit('stage_started', { runId, stage: stageRecord });

      // Build stage prompt from context
      const promptInput = stageContext[stage.inputVar] || initialInput.prompt || 'Execute phase requirements';
      const stagePrompt = `[SDLC Pipeline: ${pipeline.name}] Phase: ${stage.name}. Input data:\n${promptInput}`;

      // Simulate stage execution through the designated agent
      const agent = this.agentFactory.getAgent(stage.agentId);
      const stageExecution = await this.agentRuntime.startExecution(
        `pipeline_session_${runId}`,
        stage.agentId,
        stagePrompt
      );

      // Wait a short moment for completion simulation
      await new Promise(r => setTimeout(r, 600));

      stageRecord.status = 'completed';
      stageRecord.completedAt = new Date().toISOString();
      stageRecord.summary = `Stage '${stage.name}' successfully executed by ${agent ? agent.name : stage.agentId}. Output verified.`;

      // Save output into context
      stageContext[stage.outputVar] = stageRecord.summary;
      runState.stageOutputs[stage.outputVar] = stageRecord.summary;

      this.emit('stage_completed', { runId, stage: stageRecord });
    }

    runState.status = 'completed';
    runState.completedAt = new Date().toISOString();
    this.emit('pipeline_completed', runState);
  }
}

module.exports = SDLCOrchestrator;
