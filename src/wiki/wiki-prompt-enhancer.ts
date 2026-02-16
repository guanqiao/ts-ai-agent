import { LLMService } from '../llm';
import { WikiContext } from './types';
import {
  IPromptEnhancer,
  EnhancedPrompt,
  PromptAddition,
} from './types';

export class WikiPromptEnhancer implements IPromptEnhancer {
  private llmService: LLMService | null = null;
  private templates: Map<string, string> = new Map();

  constructor(llmService?: LLMService) {
    this.llmService = llmService || null;
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    this.templates.set('code-review', `Please review the following code for:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Security concerns

Code:
{code}

Context:
{context}`);

    this.templates.set('explain', `Please explain the following code in detail:
- What does it do?
- How does it work?
- What are the key concepts?

Code:
{code}

Additional context:
{context}`);

    this.templates.set('refactor', `Please suggest refactoring improvements for the following code:
- Code organization
- Design patterns
- Performance optimizations
- Readability improvements

Code:
{code}

Current architecture:
{context}`);

    this.templates.set('test', `Please generate tests for the following code:
- Unit tests for all functions
- Edge cases to consider
- Mock dependencies if needed

Code:
{code}

Project context:
{context}`);
  }

  async enhance(prompt: string, context?: WikiContext): Promise<EnhancedPrompt> {
    const additions: PromptAddition[] = [];
    const contextParts: string[] = [];

    if (context) {
      const archAddition = this.addArchitectureContext(context);
      if (archAddition) {
        additions.push(archAddition);
        contextParts.push(archAddition.content);
      }

      const depAddition = this.addDependencyContext(context);
      if (depAddition) {
        additions.push(depAddition);
        contextParts.push(depAddition.content);
      }
    }

    let enhanced = prompt;
    if (contextParts.length > 0) {
      enhanced = `${prompt}\n\nContext:\n${contextParts.join('\n\n')}`;
    }

    if (this.llmService && contextParts.length > 0) {
      try {
        enhanced = await this.refinePrompt(enhanced, prompt);
      } catch {
        // Keep the basic enhancement
      }
    }

    return {
      original: prompt,
      enhanced,
      additions,
      context: contextParts,
    };
  }

  async getSuggestions(partialPrompt: string): Promise<string[]> {
    const suggestions: string[] = [];

    const templateKeys = Array.from(this.templates.keys());
    for (const key of templateKeys) {
      if (key.startsWith(partialPrompt.toLowerCase())) {
        suggestions.push(key);
      }
    }

    const commonPrompts = [
      'explain this code',
      'review this code',
      'refactor this code',
      'generate tests for',
      'optimize this function',
      'add documentation to',
      'find bugs in',
      'simplify this logic',
    ];

    for (const common of commonPrompts) {
      if (common.startsWith(partialPrompt.toLowerCase()) && !suggestions.includes(common)) {
        suggestions.push(common);
      }
    }

    return suggestions.slice(0, 5);
  }

  addTemplate(name: string, template: string): void {
    this.templates.set(name.toLowerCase(), template);
  }

  getTemplates(): Map<string, string> {
    return new Map(this.templates);
  }

  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  private addArchitectureContext(context: WikiContext): PromptAddition | null {
    if (!context.architecture) return null;

    const arch = context.architecture;
    const content = `Architecture Pattern: ${arch.pattern.pattern}
Layers: ${arch.layers.map((l: { name: string }) => l.name).join(', ')}
Key Modules: ${arch.modules.slice(0, 5).map((m: { name: string }) => m.name).join(', ')}`;

    return {
      type: 'architecture',
      content,
      source: 'architecture-analysis',
    };
  }

  private addDependencyContext(context: WikiContext): PromptAddition | null {
    if (!context.architecture?.dependencyGraph) return null;

    const graph = context.architecture.dependencyGraph;
    const topModules = Object.entries(graph.nodes)
      .sort((a, b) => (b[1] as { dependencies: string[] }).dependencies.length - (a[1] as { dependencies: string[] }).dependencies.length)
      .slice(0, 5);

    if (topModules.length === 0) return null;

    const content = `Key Dependencies:
${topModules.map(([name, node]) => `- ${name}: ${(node as { dependencies: string[] }).dependencies.length} dependencies`).join('\n')}`;

    return {
      type: 'dependency',
      content,
      source: 'dependency-graph',
    };
  }

  private async refinePrompt(enhanced: string, original: string): Promise<string> {
    if (!this.llmService) return enhanced;

    const messages = [
      {
        role: 'system' as const,
        content: 'You are a prompt engineering assistant. Refine the following prompt to be clearer and more effective while preserving the original intent. Return only the refined prompt.',
      },
      {
        role: 'user' as const,
        content: `Original: ${original}\n\nWith context: ${enhanced}\n\nRefine this prompt:`,
      },
    ];

    return await this.llmService.complete(messages);
  }

  applyTemplate(templateName: string, variables: Record<string, string>): string {
    const template = this.templates.get(templateName.toLowerCase());
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }

    return result;
  }

  async enhanceWithHistory(
    prompt: string,
    context: WikiContext | undefined,
    conversationHistory: string[]
  ): Promise<EnhancedPrompt> {
    const baseEnhancement = await this.enhance(prompt, context);

    if (conversationHistory.length > 0) {
      const historyContext = `Previous conversation context:\n${conversationHistory.slice(-3).join('\n')}`;
      baseEnhancement.additions.push({
        type: 'dependency',
        content: historyContext,
        source: 'conversation-history',
      });
      baseEnhancement.context.push(historyContext);
      baseEnhancement.enhanced = `${baseEnhancement.enhanced}\n\n${historyContext}`;
    }

    return baseEnhancement;
  }

  getTemplate(name: string): string | undefined {
    return this.templates.get(name.toLowerCase());
  }

  removeTemplate(name: string): boolean {
    return this.templates.delete(name.toLowerCase());
  }
}
