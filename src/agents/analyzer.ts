import { BaseAgent, LLMService, SYSTEM_PROMPTS, PROMPT_TEMPLATES, renderTemplate } from '../llm';
import { AgentContext, AgentResult, ParsedFile } from '../types';

export class CodeAnalysisAgent extends BaseAgent {
  readonly name = 'CodeAnalysisAgent';

  constructor(llmService: LLMService) {
    super(llmService);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      const analysisResults: Map<string, string> = new Map();

      for (const file of context.parsedFiles) {
        const analysis = await this.analyzeFile(file);
        analysisResults.set(file.path, analysis);
      }

      const summary = await this.generateSummary(context.parsedFiles, analysisResults);

      return this.createSuccessResult(summary, {
        fileAnalyses: Object.fromEntries(analysisResults),
        totalFiles: context.parsedFiles.length,
      });
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  private async analyzeFile(file: ParsedFile): Promise<string> {
    const codeSample = this.extractCodeSample(file);

    const prompt = renderTemplate(PROMPT_TEMPLATES.analyzeCode, {
      filePath: file.path,
      language: file.language,
      code: codeSample,
    });

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.codeAnalyzer },
      { role: 'user' as const, content: prompt },
    ];

    const analysis = await this.llmService.complete(messages);
    return analysis;
  }

  private async generateSummary(files: ParsedFile[], analyses: Map<string, string>): Promise<string> {
    const fileList = files.map((f) => `- ${f.path} (${f.symbols.length} symbols)`).join('\n');

    const summaryPrompt = `基于以下文件分析结果，生成项目整体架构摘要：

文件列表:
${fileList}

分析结果摘要:
${Array.from(analyses.values())
  .map((a) => a.substring(0, 500) + '...')
  .join('\n\n')}

请生成：
1. 项目架构概述
2. 主要模块说明
3. 核心组件列表
4. 依赖关系图描述`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.codeAnalyzer },
      { role: 'user' as const, content: summaryPrompt },
    ];

    return await this.llmService.complete(messages);
  }

  private extractCodeSample(file: ParsedFile): string {
    if (file.rawContent) {
      const lines = file.rawContent.split('\n');
      if (lines.length > 200) {
        return lines.slice(0, 200).join('\n') + '\n... (truncated)';
      }
      return file.rawContent;
    }

    return file.symbols
      .map((s) => {
        let sample = `${s.kind} ${s.name}`;
        if (s.signature) sample += `\n  Signature: ${s.signature}`;
        if (s.description) sample += `\n  Description: ${s.description}`;
        return sample;
      })
      .join('\n\n');
  }
}
