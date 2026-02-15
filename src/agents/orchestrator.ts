import { LLMService } from '../llm';
import { CodeAnalysisAgent } from './analyzer';
import { DocGeneratorAgent } from './generator';
import { ReviewAgent } from './reviewer';
import { AgentContext, AgentResult, LLMConfig } from '../types';

export { CodeAnalysisAgent } from './analyzer';
export { DocGeneratorAgent } from './generator';
export { ReviewAgent } from './reviewer';

export interface OrchestratorResult {
  analysis: AgentResult;
  generation: AgentResult;
  review?: AgentResult;
  finalDocument: string;
}

export class AgentOrchestrator {
  private llmService: LLMService;
  private analyzerAgent: CodeAnalysisAgent;
  private generatorAgent: DocGeneratorAgent;
  private reviewerAgent: ReviewAgent;

  constructor(config: LLMConfig) {
    this.llmService = new LLMService(config);
    this.analyzerAgent = new CodeAnalysisAgent(this.llmService);
    this.generatorAgent = new DocGeneratorAgent(this.llmService);
    this.reviewerAgent = new ReviewAgent(this.llmService);
  }

  async run(context: AgentContext): Promise<OrchestratorResult> {
    const analysis = await this.analyzerAgent.execute(context);

    if (!analysis.success) {
      throw new Error(`Analysis failed: ${analysis.error}`);
    }

    context.cache = context.cache || new Map();
    context.cache.set('analysisResult', analysis.output);

    const generation = await this.generatorAgent.execute(context);

    if (!generation.success) {
      throw new Error(`Generation failed: ${generation.error}`);
    }

    context.cache.set('generatorResult', generation.output);

    let review: AgentResult | undefined;
    if (context.options.verbose) {
      review = await this.reviewerAgent.execute(context);
    }

    return {
      analysis,
      generation,
      review,
      finalDocument: generation.output || '',
    };
  }

  async analyzeOnly(context: AgentContext): Promise<AgentResult> {
    return await this.analyzerAgent.execute(context);
  }

  async generateOnly(context: AgentContext, analysisResult: string): Promise<AgentResult> {
    context.cache = context.cache || new Map();
    context.cache.set('analysisResult', analysisResult);
    return await this.generatorAgent.execute(context);
  }
}
