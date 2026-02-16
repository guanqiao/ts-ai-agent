import { DocumentTemplate, CodeSymbol, ParsedFile } from '../types';

export const BUILTIN_TEMPLATES: Record<string, DocumentTemplate> = {
  api: {
    name: 'API Documentation',
    description: 'Standard API documentation template',
    sections: [
      { id: 'overview', title: 'Overview', template: 'overview', required: true, order: 1 },
      { id: 'classes', title: 'Classes', template: 'class-list', required: true, order: 2 },
      {
        id: 'interfaces',
        title: 'Interfaces',
        template: 'interface-list',
        required: true,
        order: 3,
      },
      { id: 'functions', title: 'Functions', template: 'function-list', required: true, order: 4 },
      { id: 'types', title: 'Type Definitions', template: 'type-list', required: false, order: 5 },
      { id: 'examples', title: 'Examples', template: 'examples', required: false, order: 6 },
    ],
  },

  architecture: {
    name: 'Architecture Documentation',
    description: 'System architecture and design documentation',
    sections: [
      {
        id: 'overview',
        title: 'System Overview',
        template: 'system-overview',
        required: true,
        order: 1,
      },
      { id: 'modules', title: 'Module Structure', template: 'modules', required: true, order: 2 },
      {
        id: 'dependencies',
        title: 'Dependencies',
        template: 'dependencies',
        required: true,
        order: 3,
      },
      { id: 'data-flow', title: 'Data Flow', template: 'data-flow', required: false, order: 4 },
      {
        id: 'design-decisions',
        title: 'Design Decisions',
        template: 'design-decisions',
        required: false,
        order: 5,
      },
    ],
  },

  wiki: {
    name: 'Wiki Documentation',
    description: 'General wiki page template',
    sections: [
      { id: 'summary', title: 'Summary', template: 'summary', required: true, order: 1 },
      { id: 'details', title: 'Details', template: 'details', required: true, order: 2 },
      { id: 'usage', title: 'Usage', template: 'usage', required: true, order: 3 },
      { id: 'references', title: 'References', template: 'references', required: false, order: 4 },
    ],
  },

  readme: {
    name: 'README',
    description: 'Project README template',
    sections: [
      { id: 'title', title: 'Title', template: 'title', required: true, order: 1 },
      {
        id: 'description',
        title: 'Description',
        template: 'description',
        required: true,
        order: 2,
      },
      {
        id: 'installation',
        title: 'Installation',
        template: 'installation',
        required: true,
        order: 3,
      },
      {
        id: 'quick-start',
        title: 'Quick Start',
        template: 'quick-start',
        required: true,
        order: 4,
      },
      { id: 'api', title: 'API Reference', template: 'api-reference', required: false, order: 5 },
      {
        id: 'contributing',
        title: 'Contributing',
        template: 'contributing',
        required: false,
        order: 6,
      },
      { id: 'license', title: 'License', template: 'license', required: false, order: 7 },
    ],
  },
};

export class TemplateEngine {
  private templates: Map<string, DocumentTemplate>;
  private helpers: Map<string, (...args: unknown[]) => string>;

  constructor() {
    this.templates = new Map(Object.entries(BUILTIN_TEMPLATES));
    this.helpers = new Map();

    this.registerHelper('capitalize', (str: unknown) => {
      if (typeof str !== 'string') return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    this.registerHelper('lowercase', (str: unknown) => {
      if (typeof str !== 'string') return '';
      return str.toLowerCase();
    });

    this.registerHelper('code', (str: unknown) => {
      if (typeof str !== 'string') return '';
      return `\`${str}\``;
    });

    this.registerHelper('link', (text: unknown, url: unknown) => {
      return `[${text}](${url})`;
    });
  }

  registerHelper(name: string, fn: (...args: unknown[]) => string): void {
    this.helpers.set(name, fn);
  }

  registerTemplate(template: DocumentTemplate): void {
    this.templates.set(template.name, template);
  }

  getTemplate(name: string): DocumentTemplate | undefined {
    return this.templates.get(name);
  }

  listTemplates(): DocumentTemplate[] {
    return Array.from(this.templates.values());
  }

  render(templateContent: string, context: Record<string, unknown>): string {
    let result = templateContent;

    for (const [key, value] of Object.entries(context)) {
      const placeholder = `{{${key}}}`;

      if (typeof value === 'string' || typeof value === 'number') {
        result = result.replace(new RegExp(this.escapeRegex(placeholder), 'g'), String(value));
      } else if (Array.isArray(value)) {
        const listContent = value.map((item) => `- ${item}`).join('\n');
        result = result.replace(new RegExp(this.escapeRegex(placeholder), 'g'), listContent);
      } else if (typeof value === 'object' && value !== null) {
        result = result.replace(
          new RegExp(this.escapeRegex(placeholder), 'g'),
          JSON.stringify(value, null, 2)
        );
      }
    }

    for (const [name, fn] of this.helpers) {
      const helperPattern = new RegExp(`{{${name}\\s+([^}]+)}}`, 'g');
      result = result.replace(helperPattern, (_, arg) => fn(arg.trim()));
    }

    result = result.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (_, key, content) => {
      return context[key] ? content : '';
    });

    result = result.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (_, key, content) => {
      const items = context[key];
      if (!Array.isArray(items)) return '';

      return items
        .map((item) => {
          let itemContent = content;
          for (const [k, v] of Object.entries(item)) {
            itemContent = itemContent.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
          }
          return itemContent;
        })
        .join('\n');
    });

    return result;
  }

  renderSymbolTemplate(symbol: CodeSymbol): string {
    const template = `# {{name}}

{{#if description}}
{{description}}
{{/if}}

{{#if signature}}
\`\`\`typescript
{{signature}}
\`\`\`
{{/if}}

{{#if parameters}}
## Parameters

| Name | Type | Optional | Default | Description |
|------|------|----------|---------|-------------|
{{#each parameters}}
| {{name}} | {{type}} | {{optional}} | {{defaultValue}} | {{description}} |
{{/each}}
{{/if}}

{{#if returnType}}
## Returns

\`{{returnType}}\`
{{/if}}

{{#if members}}
## Members

{{#each members}}
### {{name}}

{{#if type}}
Type: \`{{type}}\`
{{/if}}

{{#if description}}
{{description}}
{{/if}}

{{/each}}
{{/if}}
`;

    return this.render(template, {
      ...symbol,
      parameters: symbol.parameters?.map((p) => ({
        ...p,
        optional: p.optional ? 'Yes' : 'No',
        defaultValue: p.defaultValue || '-',
        description: p.description || '-',
      })),
    });
  }

  renderFileTemplate(file: ParsedFile): string {
    const template = `# {{name}}

**Path**: {{path}}
**Language**: {{language}}
**Symbols**: {{symbolCount}}

{{#if imports}}
## Imports

{{imports}}
{{/if}}

{{#if exports}}
## Exports

{{exports}}
{{/if}}

{{#if symbols}}
## Symbols

{{symbols}}
{{/if}}
`;

    return this.render(template, {
      name: file.path.split(/[/\\]/).pop(),
      path: file.path,
      language: file.language,
      symbolCount: file.symbols.length,
      imports: file.imports.map((i) => `- ${i.source}`).join('\n'),
      exports: file.exports.map((e) => `- ${e.name}`).join('\n'),
      symbols: file.symbols.map((s) => `- **${s.name}** (${s.kind})`).join('\n'),
    });
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
