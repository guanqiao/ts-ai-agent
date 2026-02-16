import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import {
  IWikiTemplates,
  WikiTemplate,
  TemplateCategory,
  TemplateMetadata,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';

export class WikiTemplates implements IWikiTemplates {
  private templates: Map<string, WikiTemplate> = new Map();
  private templateDir: string;
  private initialized: boolean = false;

  constructor(projectPath: string) {
    this.templateDir = path.join(projectPath, '.wiki', 'templates');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.loadBuiltinTemplates();
    await this.loadCustomTemplates();
    this.initialized = true;
  }

  async getTemplate(id: string): Promise<WikiTemplate | null> {
    await this.ensureInitialized();
    return this.templates.get(id) || null;
  }

  async getTemplates(category?: TemplateCategory): Promise<WikiTemplate[]> {
    await this.ensureInitialized();
    const all = Array.from(this.templates.values());

    if (category) {
      return all.filter((t) => t.category === category);
    }

    return all;
  }

  async applyTemplate(templateId: string, variables: Record<string, unknown>): Promise<string> {
    await this.ensureInitialized();

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const validation = this.validateTemplateVariables(template, variables);
    if (!validation.valid) {
      throw new Error(`Invalid variables: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    let content = template.content;

    for (const variable of template.variables) {
      const value = variables[variable.name] ?? variable.defaultValue ?? '';
      const placeholder = `{{${variable.name}}}`;
      content = content.replace(new RegExp(this.escapeRegex(placeholder), 'g'), String(value));
    }

    template.metadata.usageCount++;
    this.templates.set(templateId, template);

    return content;
  }

  async createTemplate(template: Omit<WikiTemplate, 'id' | 'metadata'>): Promise<WikiTemplate> {
    await this.ensureInitialized();

    const validation = this.validateTemplate({
      ...template,
      id: '',
      metadata: this.createDefaultMetadata(),
    } as WikiTemplate);

    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const id = this.generateTemplateId(template.name);
    const newTemplate: WikiTemplate = {
      ...template,
      id,
      metadata: this.createDefaultMetadata(),
    };

    this.templates.set(id, newTemplate);
    await this.saveTemplate(newTemplate);

    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<WikiTemplate>): Promise<WikiTemplate> {
    await this.ensureInitialized();

    const existing = this.templates.get(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    const updated: WikiTemplate = {
      ...existing,
      ...updates,
      id,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
        updatedAt: new Date(),
      },
    };

    const validation = this.validateTemplate(updated);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    this.templates.set(id, updated);
    await this.saveTemplate(updated);

    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.ensureInitialized();

    const template = this.templates.get(id);
    if (!template) {
      return;
    }

    if (template.category !== 'custom') {
      throw new Error('Cannot delete built-in templates');
    }

    this.templates.delete(id);

    const templatePath = path.join(this.templateDir, `${id}.json`);
    try {
      await fs.unlink(templatePath);
    } catch {
      // File might not exist
    }
  }

  validateTemplate(template: WikiTemplate): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Template name is required',
        code: 'REQUIRED',
      });
    }

    if (!template.content || template.content.trim().length === 0) {
      errors.push({
        field: 'content',
        message: 'Template content is required',
        code: 'REQUIRED',
      });
    }

    const variableNames = new Set<string>();
    for (const variable of template.variables) {
      if (variableNames.has(variable.name)) {
        errors.push({
          field: `variables.${variable.name}`,
          message: `Duplicate variable name: ${variable.name}`,
          code: 'DUPLICATE',
        });
      }
      variableNames.add(variable.name);

      if (!variable.name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        errors.push({
          field: `variables.${variable.name}`,
          message: `Invalid variable name: ${variable.name}`,
          code: 'INVALID_FORMAT',
        });
      }

      const placeholderPattern = `{{${variable.name}}}`;
      if (!template.content.includes(placeholderPattern)) {
        warnings.push({
          field: `variables.${variable.name}`,
          message: `Variable ${variable.name} is not used in template content`,
          suggestion: `Add {{${variable.name}}} to the template content or remove the variable`,
        });
      }
    }

    const placeholders = template.content.match(/\{\{[^}]+\}\}/g) || [];
    for (const placeholder of placeholders) {
      const varName = placeholder.slice(2, -2).trim();
      if (!variableNames.has(varName)) {
        warnings.push({
          field: 'content',
          message: `Placeholder {{${varName}}} has no matching variable definition`,
          suggestion: `Add a variable definition for ${varName}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateTemplateVariables(
    template: WikiTemplate,
    variables: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    for (const variable of template.variables) {
      const value = variables[variable.name];

      if (variable.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: variable.name,
          message: `Variable ${variable.name} is required`,
          code: 'REQUIRED',
        });
        continue;
      }

      if (value !== undefined && value !== null && variable.validation) {
        const validation = variable.validation;

        if (typeof value === 'string') {
          if (validation.minLength !== undefined && value.length < validation.minLength) {
            errors.push({
              field: variable.name,
              message: `${variable.name} must be at least ${validation.minLength} characters`,
              code: 'MIN_LENGTH',
            });
          }

          if (validation.maxLength !== undefined && value.length > validation.maxLength) {
            errors.push({
              field: variable.name,
              message: `${variable.name} must be at most ${validation.maxLength} characters`,
              code: 'MAX_LENGTH',
            });
          }

          if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
            errors.push({
              field: variable.name,
              message: `${variable.name} does not match required pattern`,
              code: 'PATTERN',
            });
          }
        }

        if (typeof value === 'number') {
          if (validation.min !== undefined && value < validation.min) {
            errors.push({
              field: variable.name,
              message: `${variable.name} must be at least ${validation.min}`,
              code: 'MIN',
            });
          }

          if (validation.max !== undefined && value > validation.max) {
            errors.push({
              field: variable.name,
              message: `${variable.name} must be at most ${validation.max}`,
              code: 'MAX',
            });
          }
        }
      }

      if (variable.options && value !== undefined) {
        const options = Array.isArray(value) ? value : [value];
        for (const opt of options) {
          if (!variable.options.includes(String(opt))) {
            errors.push({
              field: variable.name,
              message: `Invalid option: ${opt}`,
              code: 'INVALID_OPTION',
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async loadBuiltinTemplates(): Promise<void> {
    const builtinTemplates = this.getBuiltinTemplates();
    for (const template of builtinTemplates) {
      this.templates.set(template.id, template);
    }
  }

  private async loadCustomTemplates(): Promise<void> {
    try {
      await fs.mkdir(this.templateDir, { recursive: true });
      const files = await fs.readdir(this.templateDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.templateDir, file), 'utf-8');
            const template = JSON.parse(content) as WikiTemplate;
            template.metadata = {
              ...template.metadata,
              createdAt: new Date(template.metadata.createdAt),
              updatedAt: new Date(template.metadata.updatedAt),
            };
            this.templates.set(template.id, template);
          } catch {
            // Skip invalid template files
          }
        }
      }
    } catch {
      // Directory doesn't exist yet
    }
  }

  private async saveTemplate(template: WikiTemplate): Promise<void> {
    await fs.mkdir(this.templateDir, { recursive: true });
    const templatePath = path.join(this.templateDir, `${template.id}.json`);
    await fs.writeFile(templatePath, JSON.stringify(template, null, 2));
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private generateTemplateId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const hash = crypto.randomBytes(4).toString('hex');
    return `template-${slug}-${hash}`;
  }

  private createDefaultMetadata(): TemplateMetadata {
    return {
      version: '1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
      usageCount: 0,
    };
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private getBuiltinTemplates(): WikiTemplate[] {
    return [
      {
        id: 'template-api-doc',
        name: 'API Documentation',
        description: 'Template for documenting API endpoints',
        category: 'api',
        content: `# {{name}}

## Overview

{{description}}

## Endpoint

\`\`\`{{method}} {{path}}\`\`\`

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
{{#each parameters}}
| {{name}} | {{type}} | {{required}} | {{description}} |
{{/each}}

## Request Example

\`\`\`{{requestFormat}}
{{requestExample}}
\`\`\`

## Response

### Success Response

\`\`\`{{responseFormat}}
{{responseExample}}
\`\`\`

### Error Responses

{{#each errors}}
#### {{code}}

{{description}}

\`\`\`json
{
  "error": "{{code}}",
  "message": "{{message}}"
}
\`\`\`

{{/each}}

## Notes

{{notes}}
`,
        variables: [
          { name: 'name', label: 'API Name', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'text', required: true },
          {
            name: 'method',
            label: 'HTTP Method',
            type: 'select',
            required: true,
            options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          },
          { name: 'path', label: 'Endpoint Path', type: 'text', required: true },
          {
            name: 'requestFormat',
            label: 'Request Format',
            type: 'select',
            required: false,
            options: ['json', 'xml', 'form'],
            defaultValue: 'json',
          },
          { name: 'requestExample', label: 'Request Example', type: 'text', required: false },
          {
            name: 'responseFormat',
            label: 'Response Format',
            type: 'select',
            required: false,
            options: ['json', 'xml'],
            defaultValue: 'json',
          },
          { name: 'responseExample', label: 'Response Example', type: 'text', required: false },
          { name: 'notes', label: 'Additional Notes', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['api', 'documentation'],
          usageCount: 0,
        },
      },
      {
        id: 'template-module-doc',
        name: 'Module Documentation',
        description: 'Template for documenting a module or component',
        category: 'module',
        content: `# Module: {{name}}

## Overview

{{description}}

## Installation

\`\`\`bash
{{installCommand}}
\`\`\`

## Usage

\`\`\`{{language}}
{{usageExample}}
\`\`\`

## API Reference

{{#each exports}}
### {{name}}

{{description}}

\`\`\`{{../language}}
{{signature}}
\`\`\`

{{/each}}

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
{{#each configOptions}}
| {{name}} | {{type}} | {{default}} | {{description}} |
{{/each}}

## Dependencies

{{#each dependencies}}
- **{{name}}** ({{version}}): {{description}}
{{/each}}

## Examples

{{examples}}

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
`,
        variables: [
          { name: 'name', label: 'Module Name', type: 'text', required: true },
          { name: 'description', label: 'Description', type: 'text', required: true },
          {
            name: 'language',
            label: 'Language',
            type: 'select',
            required: true,
            options: ['typescript', 'javascript', 'python', 'java', 'go'],
            defaultValue: 'typescript',
          },
          {
            name: 'installCommand',
            label: 'Install Command',
            type: 'text',
            required: false,
            defaultValue: 'npm install {{name}}',
          },
          { name: 'usageExample', label: 'Usage Example', type: 'text', required: false },
          { name: 'examples', label: 'Additional Examples', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['module', 'component', 'documentation'],
          usageCount: 0,
        },
      },
      {
        id: 'template-architecture-doc',
        name: 'Architecture Document',
        description: 'Template for architecture documentation',
        category: 'architecture',
        content: `# Architecture: {{title}}

## Overview

{{overview}}

## Goals

{{#each goals}}
- {{this}}
{{/each}}

## Non-Goals

{{#each nonGoals}}
- {{this}}
{{/each}}

## Current Architecture

{{currentArchitecture}}

## Proposed Changes

{{proposedChanges}}

## Alternatives Considered

{{#each alternatives}}
### {{name}}

{{description}}

**Pros:**
{{#each pros}}
- {{this}}
{{/each}}

**Cons:**
{{#each cons}}
- {{this}}
{{/each}}

{{/each}}

## Migration Plan

{{migrationPlan}}

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
{{#each risks}}
| {{description}} | {{impact}} | {{mitigation}} |
{{/each}}

## Timeline

{{timeline}}

## Open Questions

{{#each questions}}
- {{this}}
{{/each}}

## References

{{#each references}}
- [{{title}}]({{url}})
{{/each}}
`,
        variables: [
          { name: 'title', label: 'Document Title', type: 'text', required: true },
          { name: 'overview', label: 'Overview', type: 'text', required: true },
          {
            name: 'currentArchitecture',
            label: 'Current Architecture',
            type: 'text',
            required: false,
          },
          { name: 'proposedChanges', label: 'Proposed Changes', type: 'text', required: false },
          { name: 'migrationPlan', label: 'Migration Plan', type: 'text', required: false },
          { name: 'timeline', label: 'Timeline', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['architecture', 'design', 'documentation'],
          usageCount: 0,
        },
      },
      {
        id: 'template-changelog',
        name: 'Changelog',
        description: 'Template for changelog entries',
        category: 'changelog',
        content: `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [{{version}}] - {{date}}

### Added
{{#each added}}
- {{this}}
{{/each}}

### Changed
{{#each changed}}
- {{this}}
{{/each}}

### Deprecated
{{#each deprecated}}
- {{this}}
{{/each}}

### Removed
{{#each removed}}
- {{this}}
{{/each}}

### Fixed
{{#each fixed}}
- {{this}}
{{/each}}

### Security
{{#each security}}
- {{this}}
{{/each}}
`,
        variables: [
          {
            name: 'version',
            label: 'Version',
            type: 'text',
            required: true,
            validation: { pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9]+)?$' },
          },
          { name: 'date', label: 'Release Date', type: 'date', required: true },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['changelog', 'version', 'release'],
          usageCount: 0,
        },
      },
      {
        id: 'template-guide',
        name: 'User Guide',
        description: 'Template for user guides and tutorials',
        category: 'guide',
        content: `# {{title}}

## Introduction

{{introduction}}

## Prerequisites

{{#each prerequisites}}
- {{this}}
{{/each}}

## Quick Start

{{quickStart}}

## Step-by-Step Guide

{{#each steps}}
### Step {{number}}: {{title}}

{{description}}

{{#if code}}
\`\`\`{{../language}}
{{code}}
\`\`\`
{{/if}}

{{/each}}

## Common Use Cases

{{#each useCases}}
### {{title}}

{{description}}

\`\`\`{{../language}}
{{example}}
\`\`\`

{{/each}}

## Troubleshooting

{{#each troubleshooting}}
### {{problem}}

**Solution:** {{solution}}

{{/each}}

## FAQ

{{#each faq}}
### Q: {{question}}

**A:** {{answer}}

{{/each}}

## Next Steps

{{nextSteps}}

## Additional Resources

{{#each resources}}
- [{{title}}]({{url}})
{{/each}}
`,
        variables: [
          { name: 'title', label: 'Guide Title', type: 'text', required: true },
          { name: 'introduction', label: 'Introduction', type: 'text', required: true },
          { name: 'quickStart', label: 'Quick Start', type: 'text', required: false },
          {
            name: 'language',
            label: 'Code Language',
            type: 'select',
            required: false,
            options: ['typescript', 'javascript', 'python', 'java', 'go', 'bash'],
            defaultValue: 'typescript',
          },
          { name: 'nextSteps', label: 'Next Steps', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['guide', 'tutorial', 'documentation'],
          usageCount: 0,
        },
      },
    ];
  }
}
