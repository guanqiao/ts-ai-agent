import {
  buildGenerateOptions,
  buildParseOptions,
} from '@cli/commands';
import { parseLanguage, parseFormat, parseLLMProvider } from '@cli/types';
import { Language, DocumentFormat, LLMProvider } from '@/types';

describe('CLI Commands', () => {
  describe('parseLanguage', () => {
    it('should parse TypeScript language', () => {
      expect(parseLanguage('typescript')).toBe(Language.TypeScript);
      expect(parseLanguage('ts')).toBe(Language.TypeScript);
    });

    it('should parse Java language', () => {
      expect(parseLanguage('java')).toBe(Language.Java);
    });

    it('should default to TypeScript for unknown', () => {
      expect(parseLanguage('unknown')).toBe(Language.TypeScript);
    });

    it('should be case insensitive', () => {
      expect(parseLanguage('TYPESCRIPT')).toBe(Language.TypeScript);
      expect(parseLanguage('Java')).toBe(Language.Java);
    });
  });

  describe('parseFormat', () => {
    it('should parse Markdown format', () => {
      expect(parseFormat('markdown')).toBe(DocumentFormat.Markdown);
      expect(parseFormat('md')).toBe(DocumentFormat.Markdown);
    });

    it('should parse Confluence format', () => {
      expect(parseFormat('confluence')).toBe(DocumentFormat.Confluence);
    });

    it('should parse GitHub Wiki format', () => {
      expect(parseFormat('github-wiki')).toBe(DocumentFormat.GitHubWiki);
      expect(parseFormat('github')).toBe(DocumentFormat.GitHubWiki);
    });

    it('should default to Markdown for unknown', () => {
      expect(parseFormat('unknown')).toBe(DocumentFormat.Markdown);
    });
  });

  describe('parseLLMProvider', () => {
    it('should parse OpenAI provider', () => {
      expect(parseLLMProvider('openai')).toBe(LLMProvider.OpenAI);
    });

    it('should parse Anthropic provider', () => {
      expect(parseLLMProvider('anthropic')).toBe(LLMProvider.Anthropic);
      expect(parseLLMProvider('claude')).toBe(LLMProvider.Anthropic);
    });

    it('should default to OpenAI for unknown', () => {
      expect(parseLLMProvider('unknown')).toBe(LLMProvider.OpenAI);
    });
  });

  describe('buildGenerateOptions', () => {
    it('should build options with defaults', () => {
      const options = buildGenerateOptions({});

      expect(options.output).toBe('./docs');
      expect(options.language).toBe(Language.TypeScript);
      expect(options.format).toBe(DocumentFormat.Markdown);
      expect(options.template).toBe('api');
      expect(options.llm).toBe(LLMProvider.OpenAI);
      expect(options.model).toBe('gpt-4');
      expect(options.includePrivate).toBe(false);
      expect(options.dryRun).toBe(false);
      expect(options.verbose).toBe(false);
    });

    it('should build options with custom values', () => {
      const options = buildGenerateOptions({
        output: './custom-output',
        language: 'java',
        format: 'confluence',
        template: 'custom',
        llm: 'anthropic',
        model: 'claude-3',
        includePrivate: true,
        dryRun: true,
        verbose: true,
      });

      expect(options.output).toBe('./custom-output');
      expect(options.language).toBe(Language.Java);
      expect(options.format).toBe(DocumentFormat.Confluence);
      expect(options.template).toBe('custom');
      expect(options.llm).toBe(LLMProvider.Anthropic);
      expect(options.model).toBe('claude-3');
      expect(options.includePrivate).toBe(true);
      expect(options.dryRun).toBe(true);
      expect(options.verbose).toBe(true);
    });
  });

  describe('buildParseOptions', () => {
    it('should build options with defaults', () => {
      const options = buildParseOptions({});

      expect(options.language).toBe(Language.TypeScript);
      expect(options.format).toBe('json');
      expect(options.includePrivate).toBe(false);
      expect(options.verbose).toBe(false);
    });

    it('should build options with custom values', () => {
      const options = buildParseOptions({
        output: './output.json',
        language: 'java',
        format: 'yaml',
        includePrivate: true,
        verbose: true,
      });

      expect(options.output).toBe('./output.json');
      expect(options.language).toBe(Language.Java);
      expect(options.format).toBe('yaml');
      expect(options.includePrivate).toBe(true);
      expect(options.verbose).toBe(true);
    });
  });
});
