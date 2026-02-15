import { SYSTEM_PROMPTS, PROMPT_TEMPLATES, renderTemplate } from '../../src/llm/prompts';

describe('Prompts', () => {
  describe('SYSTEM_PROMPTS', () => {
    it('should have code analyzer prompt', () => {
      expect(SYSTEM_PROMPTS.codeAnalyzer).toBeDefined();
      expect(SYSTEM_PROMPTS.codeAnalyzer).toContain('架构设计');
      expect(SYSTEM_PROMPTS.codeAnalyzer).toContain('设计模式');
    });

    it('should have doc generator prompt', () => {
      expect(SYSTEM_PROMPTS.docGenerator).toBeDefined();
      expect(SYSTEM_PROMPTS.docGenerator).toContain('准确性');
      expect(SYSTEM_PROMPTS.docGenerator).toContain('完整性');
    });

    it('should have reviewer prompt', () => {
      expect(SYSTEM_PROMPTS.reviewer).toBeDefined();
      expect(SYSTEM_PROMPTS.reviewer).toContain('内容完整性');
      expect(SYSTEM_PROMPTS.reviewer).toContain('技术准确性');
    });
  });

  describe('PROMPT_TEMPLATES', () => {
    it('should have analyze code template', () => {
      expect(PROMPT_TEMPLATES.analyzeCode).toBeDefined();
      expect(PROMPT_TEMPLATES.analyzeCode).toContain('{filePath}');
      expect(PROMPT_TEMPLATES.analyzeCode).toContain('{language}');
      expect(PROMPT_TEMPLATES.analyzeCode).toContain('{code}');
    });

    it('should have generate class doc template', () => {
      expect(PROMPT_TEMPLATES.generateClassDoc).toBeDefined();
      expect(PROMPT_TEMPLATES.generateClassDoc).toContain('{className}');
      expect(PROMPT_TEMPLATES.generateClassDoc).toContain('{members}');
    });

    it('should have generate API doc template', () => {
      expect(PROMPT_TEMPLATES.generateApiDoc).toBeDefined();
      expect(PROMPT_TEMPLATES.generateApiDoc).toContain('{apiName}');
      expect(PROMPT_TEMPLATES.generateApiDoc).toContain('{signature}');
    });

    it('should have review document template', () => {
      expect(PROMPT_TEMPLATES.reviewDocument).toBeDefined();
      expect(PROMPT_TEMPLATES.reviewDocument).toContain('{title}');
      expect(PROMPT_TEMPLATES.reviewDocument).toContain('{document}');
    });
  });

  describe('renderTemplate', () => {
    it('should replace single variable', () => {
      const template = 'Hello, {name}!';
      const result = renderTemplate(template, { name: 'World' });

      expect(result).toBe('Hello, World!');
    });

    it('should replace multiple variables', () => {
      const template = '{greeting}, {name}! Today is {day}.';
      const result = renderTemplate(template, { greeting: 'Hello', name: 'User', day: 'Monday' });

      expect(result).toBe('Hello, User! Today is Monday.');
    });

    it('should replace repeated variables', () => {
      const template = '{name} is {name}.';
      const result = renderTemplate(template, { name: 'Test' });

      expect(result).toBe('Test is Test.');
    });
  });
});
