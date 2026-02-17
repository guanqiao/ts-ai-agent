import { LLMService } from '../llm';
import { CodeAnalysisAgent } from './analyzer';
import { DocGeneratorAgent } from './generator';
import { ReviewAgent } from './reviewer';
import { ToolPlanner, ToolPlan, PlanStep } from './tools/planner';
import { AgentContext, AgentResult, LLMConfig } from '../types';

export { CodeAnalysisAgent } from './analyzer';
export { DocGeneratorAgent } from './generator';
export { ReviewAgent } from './reviewer';

export interface OrchestratorResult {
  analysis: AgentResult;
  generation: AgentResult;
  review?: AgentResult;
  finalDocument: string;
  plan?: ToolPlan;
  executionLog?: ExecutionLogEntry[];
}

export interface ExecutionLogEntry {
  step: number;
  agent: string;
  action: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  error?: string;
}

export interface OrchestratorOptions {
  enablePlanning?: boolean;
  parallelExecution?: boolean;
  verbose?: boolean;
  timeout?: number;
}

export class AgentOrchestrator {
  private llmService: LLMService;
  private analyzerAgent: CodeAnalysisAgent;
  private generatorAgent: DocGeneratorAgent;
  private reviewerAgent: ReviewAgent;
  private toolPlanner: ToolPlanner;
  private executionLog: ExecutionLogEntry[] = [];

  constructor(config: LLMConfig) {
    this.llmService = new LLMService(config);
    this.analyzerAgent = new CodeAnalysisAgent(this.llmService);
    this.generatorAgent = new DocGeneratorAgent(this.llmService);
    this.reviewerAgent = new ReviewAgent(this.llmService);
    this.toolPlanner = new ToolPlanner(this.getAvailableTools());
  }

  async run(context: AgentContext, options: OrchestratorOptions = {}): Promise<OrchestratorResult> {
    const { enablePlanning = false, parallelExecution = false, verbose = false } = options;

    this.executionLog = [];

    if (enablePlanning) {
      const plan = await this.createExecutionPlan(context);
      return this.executeWithPlan(context, plan, options);
    }

    if (parallelExecution) {
      return this.executeParallel(context, verbose);
    }

    return this.executeSequential(context, verbose);
  }

  private async executeSequential(
    context: AgentContext,
    verbose: boolean
  ): Promise<OrchestratorResult> {
    const startTime = Date.now();

    const analysis = await this.logExecution('analyzer', 'execute', async () => {
      return await this.analyzerAgent.execute(context);
    });

    if (!analysis.success) {
      throw new Error(`Analysis failed: ${analysis.error}`);
    }

    context.cache = context.cache || new Map();
    context.cache.set('analysisResult', analysis.output);

    const generation = await this.logExecution('generator', 'execute', async () => {
      return await this.generatorAgent.execute(context);
    });

    if (!generation.success) {
      throw new Error(`Generation failed: ${generation.error}`);
    }

    context.cache.set('generatorResult', generation.output);

    let review: AgentResult | undefined;
    if (verbose) {
      review = await this.logExecution('reviewer', 'execute', async () => {
        return await this.reviewerAgent.execute(context);
      });
    }

    return {
      analysis,
      generation,
      review,
      finalDocument: generation.output || '',
      executionLog: this.executionLog,
    };
  }

  private async executeParallel(
    context: AgentContext,
    verbose: boolean
  ): Promise<OrchestratorResult> {
    context.cache = context.cache || new Map();

    const [analysis, reviewResult] = await Promise.all([
      this.logExecution('analyzer', 'execute', async () => {
        return await this.analyzerAgent.execute(context);
      }),
      verbose
        ? this.logExecution('reviewer', 'execute', async () => {
            return await this.reviewerAgent.execute(context);
          })
        : Promise.resolve(undefined),
    ]);

    if (!analysis.success) {
      throw new Error(`Analysis failed: ${analysis.error}`);
    }

    context.cache.set('analysisResult', analysis.output);

    const generation = await this.logExecution('generator', 'execute', async () => {
      return await this.generatorAgent.execute(context);
    });

    if (!generation.success) {
      throw new Error(`Generation failed: ${generation.error}`);
    }

    return {
      analysis,
      generation,
      review: reviewResult,
      finalDocument: generation.output || '',
      executionLog: this.executionLog,
    };
  }

  private async createExecutionPlan(context: AgentContext): Promise<ToolPlan> {
    const task = this.buildTaskFromContext(context);
    return await this.toolPlanner.createPlan(task);
  }

  private async executeWithPlan(
    context: AgentContext,
    plan: ToolPlan,
    options: OrchestratorOptions
  ): Promise<OrchestratorResult> {
    const validation = this.toolPlanner.validatePlan(plan);
    if (!validation.valid) {
      throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
    }

    context.cache = context.cache || new Map();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      await this.executePlanStep(step, context, i);
    }

    const analysis = context.cache.get('analysisResult') as AgentResult;
    const generation = context.cache.get('generatorResult') as AgentResult;

    return {
      analysis: analysis || { success: false, error: 'No analysis result' },
      generation: generation || { success: false, error: 'No generation result' },
      finalDocument: generation?.output || '',
      plan,
      executionLog: this.executionLog,
    };
  }

  private async executePlanStep(
    step: PlanStep,
    context: AgentContext,
    stepIndex: number
  ): Promise<void> {
    context.cache = context.cache || new Map();
    
    switch (step.tool) {
      case 'analyze':
        const analysisResult = await this.logExecution('analyzer', step.tool, async () => {
          return await this.analyzerAgent.execute(context);
        });
        context.cache.set('analysisResult', analysisResult);
        break;

      case 'generate':
        const generationResult = await this.logExecution('generator', step.tool, async () => {
          return await this.generatorAgent.execute(context);
        });
        context.cache.set('generatorResult', generationResult);
        break;

      case 'review':
        const reviewResult = await this.logExecution('reviewer', step.tool, async () => {
          return await this.reviewerAgent.execute(context);
        });
        context.cache.set('reviewResult', reviewResult);
        break;

      default:
        console.warn(`Unknown tool in plan step ${stepIndex}: ${step.tool}`);
    }
  }

  private async logExecution<T>(
    agent: string,
    action: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const entry: Partial<ExecutionLogEntry> = {
      step: this.executionLog.length,
      agent,
      action,
      timestamp: new Date(),
    };

    try {
      const result = await operation();
      entry.duration = Date.now() - startTime;
      entry.success = true;
      this.executionLog.push(entry as ExecutionLogEntry);
      return result;
    } catch (error) {
      entry.duration = Date.now() - startTime;
      entry.success = false;
      entry.error = error instanceof Error ? error.message : String(error);
      this.executionLog.push(entry as ExecutionLogEntry);
      throw error;
    }
  }

  private buildTaskFromContext(context: AgentContext): string {
    const parts: string[] = [];

    if (context.workingDirectory) {
      parts.push(`Analyze project at ${context.workingDirectory}`);
    }

    if (context.parsedFiles && context.parsedFiles.length > 0) {
      const filePaths = context.parsedFiles.slice(0, 5).map(f => f.path);
      parts.push(`Focus on files: ${filePaths.join(', ')}${context.parsedFiles.length > 5 ? ' and more' : ''}`);
    }

    if (context.options?.verbose) {
      parts.push('Include detailed review');
    }

    return parts.join('. ') || 'Generate documentation for the project';
  }

  private getAvailableTools() {
    return [
      {
        name: 'analyze',
        description: 'Analyze source code structure and extract metadata',
        parameters: [
          { name: 'projectPath', type: 'string' as const, description: 'Project path to analyze', required: true },
        ],
      },
      {
        name: 'generate',
        description: 'Generate documentation from analysis results',
        parameters: [
          { name: 'analysisResult', type: 'string' as const, description: 'Analysis result from previous step', required: true },
        ],
      },
      {
        name: 'review',
        description: 'Review generated documentation for quality',
        parameters: [
          { name: 'document', type: 'string' as const, description: 'Document to review', required: true },
        ],
      },
    ];
  }

  async analyzeOnly(context: AgentContext): Promise<AgentResult> {
    return await this.analyzerAgent.execute(context);
  }

  async generateOnly(context: AgentContext, analysisResult: string): Promise<AgentResult> {
    context.cache = context.cache || new Map();
    context.cache.set('analysisResult', analysisResult);
    return await this.generatorAgent.execute(context);
  }

  getExecutionLog(): ExecutionLogEntry[] {
    return [...this.executionLog];
  }
}
