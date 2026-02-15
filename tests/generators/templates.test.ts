import { TemplateEngine, BUILTIN_TEMPLATES } from '../../src/generators/templates';
import { SymbolKind } from '../../src/types';

describe('TemplateEngine', () => {
  let engine: TemplateEngine;

  beforeEach(() => {
    engine = new TemplateEngine();
  });

  describe('render', () => {
    it('should render simple variables', () => {
      const template = 'Hello, {{name}}!';
      const result = engine.render(template, { name: 'World' });

      expect(result).toBe('Hello, World!');
    });

    it('should render multiple variables', () => {
      const template = '{{greeting}}, {{name}}! Today is {{day}}.';
      const result = engine.render(template, { greeting: 'Hello', name: 'User', day: 'Monday' });

      expect(result).toBe('Hello, User! Today is Monday.');
    });

    it('should render arrays as lists', () => {
      const template = 'Items: {{items}}';
      const result = engine.render(template, { items: ['a', 'b', 'c'] });

      expect(result).toContain('- a');
      expect(result).toContain('- b');
      expect(result).toContain('- c');
    });
  });

  describe('templates', () => {
    it('should have built-in templates', () => {
      expect(BUILTIN_TEMPLATES.api).toBeDefined();
      expect(BUILTIN_TEMPLATES.architecture).toBeDefined();
      expect(BUILTIN_TEMPLATES.wiki).toBeDefined();
      expect(BUILTIN_TEMPLATES.readme).toBeDefined();
    });

    it('should list templates', () => {
      const templates = engine.listTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some((t) => t.name === 'API Documentation')).toBe(true);
    });

    it('should get template by name', () => {
      const template = engine.getTemplate('api');

      expect(template).toBeDefined();
      expect(template?.name).toBe('API Documentation');
    });
  });

  describe('renderSymbolTemplate', () => {
    it('should render symbol documentation', () => {
      const symbol = {
        name: 'UserService',
        kind: SymbolKind.Class,
        location: { file: 'test.ts', line: 1 },
        description: 'Service for managing users',
      };

      const result = engine.renderSymbolTemplate(symbol);

      expect(result).toContain('# UserService');
      expect(result).toContain('Service for managing users');
    });

    it('should render symbol with parameters', () => {
      const symbol = {
        name: 'getUser',
        kind: SymbolKind.Method,
        location: { file: 'test.ts', line: 1 },
        parameters: [{ name: 'id', type: 'string' }],
        returnType: 'User',
      };

      const result = engine.renderSymbolTemplate(symbol);

      expect(result).toContain('# getUser');
      expect(result).toContain('## Parameters');
      expect(result).toContain('## Returns');
    });
  });

  describe('helpers', () => {
    it('should register and use capitalize helper', () => {
      engine.registerHelper('testCap', (str: unknown) => {
        if (typeof str !== 'string') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
      });

      const template = '{{testCap hello}}';
      const result = engine.render(template, {});

      expect(result).toBe('Hello');
    });

    it('should register and use lowercase helper', () => {
      engine.registerHelper('testLower', (str: unknown) => {
        if (typeof str !== 'string') return '';
        return str.toLowerCase();
      });

      const template = '{{testLower HELLO}}';
      const result = engine.render(template, {});

      expect(result).toBe('hello');
    });

    it('should register and use code helper', () => {
      engine.registerHelper('testCode', (str: unknown) => {
        if (typeof str !== 'string') return '';
        return `\`${str}\``;
      });

      const template = '{{testCode variable}}';
      const result = engine.render(template, {});

      expect(result).toBe('`variable`');
    });
  });
});
