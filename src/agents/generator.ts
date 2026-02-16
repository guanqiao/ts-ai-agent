import { BaseAgent, LLMService, SYSTEM_PROMPTS, PROMPT_TEMPLATES, renderTemplate } from '../llm';
import {
  AgentContext,
  AgentResult,
  CodeSymbol,
  ParsedFile,
  SymbolKind,
  GeneratedDocument,
  DocumentSection,
  DocumentFormat,
} from '../types';

export class DocGeneratorAgent extends BaseAgent {
  readonly name = 'DocGeneratorAgent';

  constructor(llmService: LLMService) {
    super(llmService);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    try {
      const sections: DocumentSection[] = [];

      sections.push(await this.generateOverviewSection(context));
      sections.push(await this.generateApiReferenceSection(context));
      sections.push(await this.generateArchitectureSection(context));
      sections.push(await this.generateUsageExamplesSection(context));

      const document: GeneratedDocument = {
        title: this.extractProjectName(context),
        description: 'Auto-generated technical documentation',
        sections,
        metadata: {
          generatedAt: new Date(),
          generator: 'TSD-Generator',
          version: '1.0.0',
          sourceFiles: context.parsedFiles.map((f) => f.path),
          language: context.parsedFiles[0]?.language || 'typescript',
        },
        format: context.options.format || DocumentFormat.Markdown,
        raw: '',
      };

      document.raw = this.renderDocument(document);

      return this.createSuccessResult(document.raw, {
        document,
        sectionsCount: sections.length,
      });
    } catch (error) {
      return this.createErrorResult(error instanceof Error ? error.message : String(error));
    }
  }

  private async generateOverviewSection(context: AgentContext): Promise<DocumentSection> {
    const symbols = this.getAllSymbols(context.parsedFiles);
    const stats = this.calculateStats(symbols);

    const prompt = `请为以下代码库生成项目概述文档：

统计信息:
- 文件数量: ${context.parsedFiles.length}
- 类数量: ${stats.classes}
- 接口数量: ${stats.interfaces}
- 函数数量: ${stats.functions}
- 其他符号: ${stats.others}

主要类/接口:
${symbols
  .filter((s) => s.kind === SymbolKind.Class || s.kind === SymbolKind.Interface)
  .slice(0, 10)
  .map((s) => `- ${s.name}: ${s.description || '无描述'}`)
  .join('\n')}

请生成：
1. 项目简介
2. 核心功能
3. 技术栈`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.docGenerator },
      { role: 'user' as const, content: prompt },
    ];

    const content = await this.llmService.complete(messages);

    return {
      id: 'overview',
      title: '项目概述',
      content,
      level: 1,
    };
  }

  private async generateApiReferenceSection(context: AgentContext): Promise<DocumentSection> {
    const symbols = this.getAllSymbols(context.parsedFiles);
    const publicSymbols = symbols.filter(
      (s) => !s.modifiers?.includes('private') && !s.modifiers?.includes('protected')
    );

    const subsections: DocumentSection[] = [];

    const classes = publicSymbols.filter((s) => s.kind === SymbolKind.Class);
    if (classes.length > 0) {
      subsections.push(await this.generateClassDocsSection(classes));
    }

    const interfaces = publicSymbols.filter((s) => s.kind === SymbolKind.Interface);
    if (interfaces.length > 0) {
      subsections.push(this.generateInterfaceDocsSection(interfaces));
    }

    const functions = publicSymbols.filter((s) => s.kind === SymbolKind.Function);
    if (functions.length > 0) {
      subsections.push(this.generateFunctionDocsSection(functions));
    }

    return {
      id: 'api-reference',
      title: 'API 参考',
      content: '本节包含所有公共 API 的详细文档。',
      level: 1,
      subsections,
    };
  }

  private async generateClassDocsSection(classes: CodeSymbol[]): Promise<DocumentSection> {
    const classDocs = await Promise.all(
      classes.slice(0, 20).map(async (cls) => {
        return await this.generateClassDoc(cls);
      })
    );

    return {
      id: 'classes',
      title: '类',
      content: classDocs.join('\n\n---\n\n'),
      level: 2,
    };
  }

  private async generateClassDoc(cls: CodeSymbol): Promise<string> {
    const membersInfo = cls.members
      ?.map((m) => {
        let info = `- **${m.name}** (${m.kind})`;
        if (m.type) info += `: ${m.type}`;
        if (m.description) info += `\n  ${m.description}`;
        return info;
      })
      .join('\n');

    const prompt = renderTemplate(PROMPT_TEMPLATES.generateClassDoc, {
      className: cls.name,
      classType: cls.kind,
      language: 'typescript',
      classCode: cls.signature || `class ${cls.name} { ... }`,
      members: membersInfo || '无成员',
    });

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.docGenerator },
      { role: 'user' as const, content: prompt },
    ];

    return await this.llmService.complete(messages);
  }

  private generateInterfaceDocsSection(interfaces: CodeSymbol[]): DocumentSection {
    const interfaceDocs = interfaces
      .slice(0, 20)
      .map((int) => {
        let doc = `### ${int.name}\n\n`;
        if (int.description) doc += `${int.description}\n\n`;
        if (int.generics && int.generics.length > 0) {
          doc += `**泛型参数:** ${int.generics.map((g) => g.name).join(', ')}\n\n`;
        }
        if (int.extends && int.extends.length > 0) {
          doc += `**继承:** ${int.extends.join(', ')}\n\n`;
        }
        if (int.members && int.members.length > 0) {
          doc += '**属性:**\n\n';
          int.members.forEach((m) => {
            doc += `- \`${m.name}\`${m.type ? `: ${m.type}` : ''}`;
            doc += '\n';
          });
        }
        return doc;
      })
      .join('\n\n');

    return {
      id: 'interfaces',
      title: '接口',
      content: interfaceDocs,
      level: 2,
    };
  }

  private generateFunctionDocsSection(functions: CodeSymbol[]): DocumentSection {
    const functionDocs = functions
      .slice(0, 30)
      .map((fn) => {
        let doc = `### ${fn.name}\n\n`;
        if (fn.signature) {
          doc += '```typescript\n';
          doc += fn.signature;
          doc += '\n```\n\n';
        }
        if (fn.description) doc += `${fn.description}\n\n`;
        if (fn.parameters && fn.parameters.length > 0) {
          doc += '**参数:**\n\n';
          doc += '| 名称 | 类型 | 描述 |\n';
          doc += '|------|------|------|\n';
          fn.parameters.forEach((p) => {
            doc += `| ${p.name} | ${p.type} | ${p.description || '-'} |\n`;
          });
          doc += '\n';
        }
        if (fn.returnType) {
          doc += `**返回值:** ${fn.returnType}\n\n`;
        }
        return doc;
      })
      .join('\n\n---\n\n');

    return {
      id: 'functions',
      title: '函数',
      content: functionDocs,
      level: 2,
    };
  }

  private async generateArchitectureSection(context: AgentContext): Promise<DocumentSection> {
    const imports = context.parsedFiles.flatMap((f) => f.imports);
    const externalDeps = imports.filter((i) => i.isExternal);
    const uniqueDeps = [...new Set(externalDeps.map((i) => i.source))];

    const prompt = `请分析以下代码库的架构：

文件数量: ${context.parsedFiles.length}
外部依赖: ${uniqueDeps.slice(0, 20).join(', ')}

主要模块:
${context.parsedFiles
  .slice(0, 10)
  .map((f) => `- ${f.path}`)
  .join('\n')}

请生成：
1. 架构图描述（使用文本描述）
2. 模块划分说明
3. 依赖关系说明
4. 数据流描述`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.docGenerator },
      { role: 'user' as const, content: prompt },
    ];

    const content = await this.llmService.complete(messages);

    return {
      id: 'architecture',
      title: '架构设计',
      content,
      level: 1,
    };
  }

  private async generateUsageExamplesSection(context: AgentContext): Promise<DocumentSection> {
    const mainExports = context.parsedFiles.flatMap((f) => f.exports).slice(0, 10);
    const symbols = this.getAllSymbols(context.parsedFiles);
    const mainClasses = symbols.filter((s) => s.kind === SymbolKind.Class).slice(0, 5);

    const prompt = `请为以下代码库生成使用示例：

主要导出:
${mainExports.map((e) => `- ${e.name}`).join('\n')}

主要类:
${mainClasses.map((c) => `- ${c.name}: ${c.description || '无描述'}`).join('\n')}

请生成：
1. 快速开始指南
2. 基本使用示例
3. 高级用法示例
4. 最佳实践建议`;

    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPTS.docGenerator },
      { role: 'user' as const, content: prompt },
    ];

    const content = await this.llmService.complete(messages);

    return {
      id: 'usage-examples',
      title: '使用指南',
      content,
      level: 1,
    };
  }

  private getAllSymbols(files: ParsedFile[]): CodeSymbol[] {
    return files.flatMap((f) => f.symbols);
  }

  private calculateStats(symbols: CodeSymbol[]): {
    classes: number;
    interfaces: number;
    functions: number;
    others: number;
  } {
    return {
      classes: symbols.filter((s) => s.kind === SymbolKind.Class).length,
      interfaces: symbols.filter((s) => s.kind === SymbolKind.Interface).length,
      functions: symbols.filter((s) => s.kind === SymbolKind.Function).length,
      others: symbols.filter(
        (s) => ![SymbolKind.Class, SymbolKind.Interface, SymbolKind.Function].includes(s.kind)
      ).length,
    };
  }

  private extractProjectName(context: AgentContext): string {
    const firstFile = context.parsedFiles[0];
    if (!firstFile) return 'Project Documentation';

    const parts = firstFile.path.split(/[/\\]/);
    const projectIndex = parts.findIndex((p) => p === 'src' || p === 'lib');
    if (projectIndex > 0) {
      return parts[projectIndex - 1];
    }

    return parts[parts.length - 2] || 'Project';
  }

  private renderDocument(document: GeneratedDocument): string {
    const lines: string[] = [];

    lines.push(`# ${document.title}\n`);
    if (document.description) {
      lines.push(`${document.description}\n`);
    }

    lines.push('## 目录\n');
    for (const section of document.sections) {
      lines.push(`- [${section.title}](#${section.id})`);
      if (section.subsections) {
        for (const sub of section.subsections) {
          lines.push(`  - [${sub.title}](#${sub.id})`);
        }
      }
    }
    lines.push('');

    for (const section of document.sections) {
      lines.push(`## ${section.title}\n`);
      lines.push(`${section.content}\n`);

      if (section.subsections) {
        for (const sub of section.subsections) {
          lines.push(`### ${sub.title}\n`);
          lines.push(`${sub.content}\n`);
        }
      }
    }

    lines.push('\n---\n');
    lines.push(`*文档生成时间: ${document.metadata.generatedAt.toISOString()}*`);
    lines.push(`*生成器: ${document.metadata.generator} v${document.metadata.version}*`);

    return lines.join('\n');
  }
}
