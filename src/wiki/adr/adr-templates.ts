import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import {
  ADRTemplate,
  ADRTemplateVariable,
  IADRTemplates,
  DEFAULT_ADR_TEMPLATE,
  LIGHTWEIGHT_ADR_TEMPLATE,
  TECH_CHOICE_ADR_TEMPLATE,
} from './types';

export class ADRTemplates implements IADRTemplates {
  private templatesPath: string;
  private templates: Map<string, ADRTemplate> = new Map();

  constructor(projectPath: string) {
    this.templatesPath = path.join(projectPath, '.wiki', 'adr-templates.json');
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates(): void {
    this.templates.set(DEFAULT_ADR_TEMPLATE.id, DEFAULT_ADR_TEMPLATE);
    this.templates.set(LIGHTWEIGHT_ADR_TEMPLATE.id, LIGHTWEIGHT_ADR_TEMPLATE);
    this.templates.set(TECH_CHOICE_ADR_TEMPLATE.id, TECH_CHOICE_ADR_TEMPLATE);
  }

  async initialize(): Promise<void> {
    await this.loadCustomTemplates();
  }

  private async loadCustomTemplates(): Promise<void> {
    try {
      const data = await fs.readFile(this.templatesPath, 'utf-8');
      const customTemplates: ADRTemplate[] = JSON.parse(data);
      for (const template of customTemplates) {
        template.createdAt = new Date(template.createdAt);
        template.updatedAt = new Date(template.updatedAt);
        this.templates.set(template.id, template);
      }
    } catch {
      // No custom templates file
    }
  }

  private async saveCustomTemplates(): Promise<void> {
    const customTemplates = Array.from(this.templates.values()).filter((t) => !t.isDefault);

    if (customTemplates.length === 0) {
      try {
        await fs.unlink(this.templatesPath);
      } catch {
        // File may not exist
      }
      return;
    }

    const dir = path.dirname(this.templatesPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.templatesPath, JSON.stringify(customTemplates, null, 2), 'utf-8');
  }

  async getTemplates(): Promise<ADRTemplate[]> {
    return Array.from(this.templates.values()).sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  async getTemplate(id: string): Promise<ADRTemplate | null> {
    return this.templates.get(id) || null;
  }

  async getDefaultTemplate(): Promise<ADRTemplate> {
    return DEFAULT_ADR_TEMPLATE;
  }

  async addTemplate(
    templateData: Omit<ADRTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ADRTemplate> {
    const now = new Date();
    const template: ADRTemplate = {
      ...templateData,
      id: this.generateId(),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    this.templates.set(template.id, template);
    await this.saveCustomTemplates();

    return template;
  }

  async removeTemplate(id: string): Promise<boolean> {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    if (template.isDefault) {
      throw new Error('Cannot remove default templates');
    }

    this.templates.delete(id);
    await this.saveCustomTemplates();

    return true;
  }

  async updateTemplate(
    id: string,
    updates: Partial<Omit<ADRTemplate, 'id' | 'createdAt' | 'isDefault'>>
  ): Promise<ADRTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template ${id} not found`);
    }

    const updatedTemplate: ADRTemplate = {
      ...template,
      ...updates,
      updatedAt: new Date(),
    };

    this.templates.set(id, updatedTemplate);

    if (!template.isDefault) {
      await this.saveCustomTemplates();
    }

    return updatedTemplate;
  }

  async fillTemplate(templateId: string, variables: Record<string, string>): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    let content = template.content;

    for (const variable of template.variables) {
      const value = variables[variable.name] || variable.defaultValue || '';
      const placeholder = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      content = content.replace(placeholder, value);
    }

    content = content.replace(/\{\{[^}]+\}\}/g, '');

    return content;
  }

  async validateTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return { valid: false, errors: [`Template ${templateId} not found`] };
    }

    const errors: string[] = [];

    for (const variable of template.variables) {
      if (variable.required) {
        const value = variables[variable.name];
        if (!value || value.trim() === '') {
          errors.push(`Required variable '${variable.name}' is missing or empty`);
        }
      }

      if (variable.type === 'list' && variable.options && variables[variable.name]) {
        if (!variable.options.includes(variables[variable.name])) {
          errors.push(`Variable '${variable.name}' must be one of: ${variable.options.join(', ')}`);
        }
      }

      if (variable.type === 'date' && variables[variable.name]) {
        const dateValue = variables[variable.name];
        if (isNaN(Date.parse(dateValue))) {
          errors.push(`Variable '${variable.name}' must be a valid date`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async createFromTemplate(
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ content: string; valid: boolean; errors: string[] }> {
    const validation = await this.validateTemplate(templateId, variables);

    if (!validation.valid) {
      return {
        content: '',
        valid: false,
        errors: validation.errors,
      };
    }

    const content = await this.fillTemplate(templateId, variables);

    return {
      content,
      valid: true,
      errors: [],
    };
  }

  async getTemplateVariables(templateId: string): Promise<ADRTemplateVariable[]> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      return [];
    }
    return template.variables;
  }

  async duplicateTemplate(templateId: string, newName: string): Promise<ADRTemplate> {
    const sourceTemplate = await this.getTemplate(templateId);
    if (!sourceTemplate) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.addTemplate({
      name: newName,
      description: sourceTemplate.description,
      content: sourceTemplate.content,
      variables: [...sourceTemplate.variables],
      isDefault: false,
    });
  }

  async exportTemplate(templateId: string): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return JSON.stringify(template, null, 2);
  }

  async importTemplate(jsonData: string): Promise<ADRTemplate> {
    try {
      const templateData = JSON.parse(jsonData);

      if (!templateData.name || !templateData.content) {
        throw new Error('Invalid template format: missing required fields');
      }

      return this.addTemplate({
        name: templateData.name,
        description: templateData.description || '',
        content: templateData.content,
        variables: templateData.variables || [],
        isDefault: false,
      });
    } catch (error) {
      throw new Error(`Failed to import template: ${(error as Error).message}`);
    }
  }

  async getTemplatesByTag(tag: string): Promise<ADRTemplate[]> {
    const allTemplates = await this.getTemplates();
    return allTemplates.filter((t) =>
      t.variables.some((v) => v.name.toLowerCase().includes(tag.toLowerCase()))
    );
  }

  async searchTemplates(query: string): Promise<ADRTemplate[]> {
    const lowerQuery = query.toLowerCase();
    const allTemplates = await this.getTemplates();

    return allTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery)
    );
  }

  private generateId(): string {
    return `template-${crypto.randomBytes(8).toString('hex')}`;
  }

  getTemplateCount(): number {
    return this.templates.size;
  }

  getCustomTemplateCount(): number {
    return Array.from(this.templates.values()).filter((t) => !t.isDefault).length;
  }
}
