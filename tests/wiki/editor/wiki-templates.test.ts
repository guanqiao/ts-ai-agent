import * as path from 'path';
import * as fs from 'fs';
import { WikiTemplates } from '../../../src/wiki/editor/wiki-templates';
import { WikiTemplate, TemplateCategory } from '../../../src/wiki/editor/types';

describe('WikiTemplates', () => {
  let templates: WikiTemplates;
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = path.join(__dirname, 'test-templates-project');
    
    if (!fs.existsSync(testProjectPath)) {
      fs.mkdirSync(testProjectPath, { recursive: true });
    }

    templates = new WikiTemplates(testProjectPath);
    await templates.initialize();
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('initialize', () => {
    it('should load built-in templates', async () => {
      const allTemplates = await templates.getTemplates();
      expect(allTemplates.length).toBeGreaterThan(0);
    });

    it('should load custom templates from directory', async () => {
      // Create a custom template file
      const templateDir = path.join(testProjectPath, '.wiki', 'templates');
      fs.mkdirSync(templateDir, { recursive: true });
      
      const customTemplate: WikiTemplate = {
        id: 'custom-test',
        name: 'Custom Test Template',
        description: 'A custom template',
        category: 'custom',
        content: '# {{title}}\n\n{{content}}',
        variables: [
          { name: 'title', label: 'Title', type: 'text', required: true },
          { name: 'content', label: 'Content', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['custom'],
          usageCount: 0,
        },
      };
      
      fs.writeFileSync(
        path.join(templateDir, 'custom-test.json'),
        JSON.stringify(customTemplate, null, 2)
      );

      // Create new instance to test loading
      const newTemplates = new WikiTemplates(testProjectPath);
      await newTemplates.initialize();
      
      const allTemplates = await newTemplates.getTemplates();
      expect(allTemplates.some(t => t.id === 'custom-test')).toBe(true);
    });

    it('should be idempotent', async () => {
      await templates.initialize();
      await templates.initialize();
      
      const allTemplates = await templates.getTemplates();
      expect(allTemplates.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplate', () => {
    it('should return template by id', async () => {
      const template = await templates.getTemplate('template-api-doc');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('API Documentation');
      expect(template?.category).toBe('api');
    });

    it('should return null for non-existent template', async () => {
      const template = await templates.getTemplate('non-existent');
      expect(template).toBeNull();
    });
  });

  describe('getTemplates', () => {
    it('should return all templates', async () => {
      const allTemplates = await templates.getTemplates();
      
      expect(allTemplates.length).toBeGreaterThan(0);
    });

    it('should filter by category', async () => {
      const apiTemplates = await templates.getTemplates('api' as TemplateCategory);
      
      expect(apiTemplates.every(t => t.category === 'api')).toBe(true);
    });

    it('should include built-in templates', async () => {
      const allTemplates = await templates.getTemplates();
      
      expect(allTemplates.some(t => t.id === 'template-api-doc')).toBe(true);
      expect(allTemplates.some(t => t.id === 'template-module-doc')).toBe(true);
    });
  });

  describe('applyTemplate', () => {
    it('should apply template with variables', async () => {
      const result = await templates.applyTemplate('template-api-doc', {
        name: 'Get User',
        description: 'Retrieves a user by ID',
        method: 'GET',
        path: '/api/users/{id}',
      });

      expect(result).toContain('# Get User');
      expect(result).toContain('Retrieves a user by ID');
      expect(result).toContain('GET');
      expect(result).toContain('/api/users/{id}');
    });

    it('should use default values for missing variables', async () => {
      const result = await templates.applyTemplate('template-api-doc', {
        name: 'Test API',
        description: 'Test description',
        method: 'GET',
        path: '/test',
      });

      // requestFormat has default value 'json'
      expect(result).toContain('json');
    });

    it('should throw error for non-existent template', async () => {
      await expect(
        templates.applyTemplate('non-existent', {})
      ).rejects.toThrow('Template not found');
    });

    it('should throw error for missing required variables', async () => {
      await expect(
        templates.applyTemplate('template-api-doc', {
          // Missing required 'name' variable
          description: 'Test',
        })
      ).rejects.toThrow('Invalid variables');
    });

    it('should increment usage count', async () => {
      const templateBefore = await templates.getTemplate('template-api-doc');
      const usageCountBefore = templateBefore?.metadata.usageCount || 0;

      await templates.applyTemplate('template-api-doc', {
        name: 'Test',
        description: 'Test',
        method: 'GET',
        path: '/test',
      });

      const templateAfter = await templates.getTemplate('template-api-doc');
      expect(templateAfter?.metadata.usageCount).toBe(usageCountBefore + 1);
    });
  });

  describe('createTemplate', () => {
    it('should create a new custom template', async () => {
      const newTemplate = await templates.createTemplate({
        name: 'My Custom Template',
        description: 'A custom template for testing',
        category: 'custom',
        content: '# {{title}}\n\n{{body}}',
        variables: [
          { name: 'title', label: 'Title', type: 'text', required: true },
          { name: 'body', label: 'Body', type: 'text', required: false },
        ],
      });

      expect(newTemplate).toBeDefined();
      expect(newTemplate.id).toBeDefined();
      expect(newTemplate.name).toBe('My Custom Template');
      expect(newTemplate.category).toBe('custom');
      expect(newTemplate.metadata.usageCount).toBe(0);
    });

    it('should save template to file', async () => {
      const newTemplate = await templates.createTemplate({
        name: 'File Test Template',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [{ name: 'title', label: 'Title', type: 'text', required: true }],
      });

      const templatePath = path.join(testProjectPath, '.wiki', 'templates', `${newTemplate.id}.json`);
      expect(fs.existsSync(templatePath)).toBe(true);
    });

    it('should throw error for invalid template', async () => {
      await expect(
        templates.createTemplate({
          name: '', // Empty name
          description: 'Test',
          category: 'custom',
          content: '# Test',
          variables: [],
        })
      ).rejects.toThrow('Invalid template');
    });

    it('should throw error for duplicate variable names', async () => {
      await expect(
        templates.createTemplate({
          name: 'Duplicate Test',
          description: 'Test',
          category: 'custom',
          content: '# {{title}}',
          variables: [
            { name: 'title', label: 'Title 1', type: 'text', required: true },
            { name: 'title', label: 'Title 2', type: 'text', required: true },
          ],
        })
      ).rejects.toThrow('Invalid template');
    });
  });

  describe('updateTemplate', () => {
    it('should update existing template', async () => {
      const template = await templates.createTemplate({
        name: 'Update Test',
        description: 'Original',
        category: 'custom',
        content: '# {{title}}',
        variables: [{ name: 'title', label: 'Title', type: 'text', required: true }],
      });

      const updated = await templates.updateTemplate(template.id, {
        description: 'Updated description',
      });

      expect(updated.description).toBe('Updated description');
      expect(updated.name).toBe('Update Test'); // Unchanged
    });

    it('should update metadata', async () => {
      const template = await templates.createTemplate({
        name: 'Metadata Test',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [{ name: 'title', label: 'Title', type: 'text', required: true }],
      });

      const originalUpdatedAt = template.metadata.updatedAt;
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await templates.updateTemplate(template.id, {
        description: 'Updated',
      });

      expect(updated.metadata.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should throw error for non-existent template', async () => {
      await expect(
        templates.updateTemplate('non-existent', { description: 'New' })
      ).rejects.toThrow('Template not found');
    });

    it('should validate updated template', async () => {
      const template = await templates.createTemplate({
        name: 'Validation Test',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [{ name: 'title', label: 'Title', type: 'text', required: true }],
      });

      await expect(
        templates.updateTemplate(template.id, {
          name: '', // Invalid: empty name
        })
      ).rejects.toThrow('Invalid template');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete custom template', async () => {
      const template = await templates.createTemplate({
        name: 'Delete Test',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [{ name: 'title', label: 'Title', type: 'text', required: true }],
      });

      await templates.deleteTemplate(template.id);

      const deleted = await templates.getTemplate(template.id);
      expect(deleted).toBeNull();
    });

    it('should delete template file', async () => {
      const template = await templates.createTemplate({
        name: 'File Delete Test',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [{ name: 'title', label: 'Title', type: 'text', required: true }],
      });

      const templatePath = path.join(testProjectPath, '.wiki', 'templates', `${template.id}.json`);
      expect(fs.existsSync(templatePath)).toBe(true);

      await templates.deleteTemplate(template.id);

      expect(fs.existsSync(templatePath)).toBe(false);
    });

    it('should not delete built-in templates', async () => {
      await expect(
        templates.deleteTemplate('template-api-doc')
      ).rejects.toThrow('Cannot delete built-in templates');
    });

    it('should handle deleting non-existent template gracefully', async () => {
      await expect(
        templates.deleteTemplate('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('validateTemplate', () => {
    it('should validate valid template', async () => {
      const template: WikiTemplate = {
        id: 'test',
        name: 'Valid Template',
        description: 'A valid template',
        category: 'custom',
        content: '# {{title}}\n\n{{content}}',
        variables: [
          { name: 'title', label: 'Title', type: 'text', required: true },
          { name: 'content', label: 'Content', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      };

      const result = templates.validateTemplate(template);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should report missing name', async () => {
      const template: WikiTemplate = {
        id: 'test',
        name: '',
        description: 'Test',
        category: 'custom',
        content: '# Test',
        variables: [],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      };

      const result = templates.validateTemplate(template);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });

    it('should report missing content', async () => {
      const template: WikiTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        content: '',
        variables: [],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      };

      const result = templates.validateTemplate(template);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'content')).toBe(true);
    });

    it('should report invalid variable names', async () => {
      const template: WikiTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        content: '# {{123invalid}}',
        variables: [
          { name: '123invalid', label: 'Invalid', type: 'text', required: true },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      };

      const result = templates.validateTemplate(template);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field.includes('variables'))).toBe(true);
    });

    it('should warn about unused variables', async () => {
      const template: WikiTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        content: '# Title', // No {{unused}} placeholder
        variables: [
          { name: 'unused', label: 'Unused', type: 'text', required: false },
        ],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      };

      const result = templates.validateTemplate(template);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.field.includes('unused'))).toBe(true);
    });

    it('should warn about undefined placeholders', async () => {
      const template: WikiTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'custom',
        content: '# {{undefined}}', // No variable defined
        variables: [],
        metadata: {
          version: '1.0.0',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          usageCount: 0,
        },
      };

      const result = templates.validateTemplate(template);
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('undefined'))).toBe(true);
    });
  });

  describe('variable validation', () => {
    it('should validate string minLength', async () => {
      const template = await templates.createTemplate({
        name: 'Min Length Test',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [
          { 
            name: 'title', 
            label: 'Title', 
            type: 'text', 
            required: true,
            validation: { minLength: 5 },
          },
        ],
      });

      await expect(
        templates.applyTemplate(template.id, { title: 'Hi' }) // Too short
      ).rejects.toThrow('Invalid variables');
    });

    it('should validate string maxLength', async () => {
      const template = await templates.createTemplate({
        name: 'Max Length Test',
        description: 'Test',
        category: 'custom',
        content: '# {{title}}',
        variables: [
          { 
            name: 'title', 
            label: 'Title', 
            type: 'text', 
            required: true,
            validation: { maxLength: 10 },
          },
        ],
      });

      await expect(
        templates.applyTemplate(template.id, { title: 'This is a very long title' }) // Too long
      ).rejects.toThrow('Invalid variables');
    });

    it('should validate pattern', async () => {
      const template = await templates.createTemplate({
        name: 'Pattern Test',
        description: 'Test',
        category: 'custom',
        content: '# {{version}}',
        variables: [
          { 
            name: 'version', 
            label: 'Version', 
            type: 'text', 
            required: true,
            validation: { pattern: '^\\d+\\.\\d+\\.\\d+$' },
          },
        ],
      });

      await expect(
        templates.applyTemplate(template.id, { version: 'invalid' })
      ).rejects.toThrow('Invalid variables');

      const result = await templates.applyTemplate(template.id, { version: '1.2.3' });
      expect(result).toContain('1.2.3');
    });

    it('should validate number min/max', async () => {
      const template = await templates.createTemplate({
        name: 'Number Test',
        description: 'Test',
        category: 'custom',
        content: 'Count: {{count}}',
        variables: [
          { 
            name: 'count', 
            label: 'Count', 
            type: 'number', 
            required: true,
            validation: { min: 0, max: 100 },
          },
        ],
      });

      await expect(
        templates.applyTemplate(template.id, { count: -1 })
      ).rejects.toThrow('Invalid variables');

      await expect(
        templates.applyTemplate(template.id, { count: 101 })
      ).rejects.toThrow('Invalid variables');
    });

    it('should validate options', async () => {
      const template = await templates.createTemplate({
        name: 'Options Test',
        description: 'Test',
        category: 'custom',
        content: 'Method: {{method}}',
        variables: [
          { 
            name: 'method', 
            label: 'Method', 
            type: 'select', 
            required: true,
            options: ['GET', 'POST', 'PUT', 'DELETE'],
          },
        ],
      });

      await expect(
        templates.applyTemplate(template.id, { method: 'PATCH' }) // Invalid option
      ).rejects.toThrow('Invalid variables');

      const result = await templates.applyTemplate(template.id, { method: 'GET' });
      expect(result).toContain('GET');
    });
  });

  describe('built-in templates', () => {
    it('should have API documentation template', async () => {
      const template = await templates.getTemplate('template-api-doc');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('API Documentation');
      expect(template?.category).toBe('api');
      expect(template?.variables.length).toBeGreaterThan(0);
    });

    it('should have module documentation template', async () => {
      const template = await templates.getTemplate('template-module-doc');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Module Documentation');
      expect(template?.category).toBe('module');
    });

    it('should have architecture document template', async () => {
      const template = await templates.getTemplate('template-architecture-doc');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Architecture Document');
      expect(template?.category).toBe('architecture');
    });

    it('should have changelog template', async () => {
      const template = await templates.getTemplate('template-changelog');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('Changelog');
      expect(template?.category).toBe('changelog');
    });

    it('should have user guide template', async () => {
      const template = await templates.getTemplate('template-guide');
      
      expect(template).toBeDefined();
      expect(template?.name).toBe('User Guide');
      expect(template?.category).toBe('guide');
    });
  });
});
