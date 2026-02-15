import { DocumentGenerator, MarkdownGenerator, ConfluenceGenerator } from '../../src/generators/markdown';
import { GeneratedDocument, DocumentFormat, SymbolKind, Language } from '../../src/types';

describe('MarkdownGenerator', () => {
  let generator: MarkdownGenerator;

  beforeEach(() => {
    generator = new MarkdownGenerator();
  });

  it('should generate markdown document', () => {
    const document: GeneratedDocument = {
      title: 'Test Document',
      description: 'A test document',
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          content: 'This is the overview section.',
          level: 1,
        },
        {
          id: 'api',
          title: 'API Reference',
          content: 'API documentation here.',
          level: 1,
          subsections: [
            {
              id: 'classes',
              title: 'Classes',
              content: 'Class documentation.',
              level: 2,
            },
          ],
        },
      ],
      metadata: {
        generatedAt: new Date('2024-01-01'),
        generator: 'TSD-Generator',
        version: '1.0.0',
        sourceFiles: ['test.ts'],
        language: Language.TypeScript,
      },
      format: DocumentFormat.Markdown,
      raw: '',
    };

    const result = generator.generate(document);

    expect(result).toContain('# Test Document');
    expect(result).toContain('## 目录');
    expect(result).toContain('## Overview');
    expect(result).toContain('## API Reference');
    expect(result).toContain('### Classes');
    expect(result).toContain('TSD-Generator');
  });
});

describe('ConfluenceGenerator', () => {
  let generator: ConfluenceGenerator;

  beforeEach(() => {
    generator = new ConfluenceGenerator();
  });

  it('should generate confluence format', () => {
    const document: GeneratedDocument = {
      title: 'Test Document',
      description: 'A test document',
      sections: [
        {
          id: 'overview',
          title: 'Overview',
          content: 'This is the overview section.',
          level: 1,
        },
      ],
      metadata: {
        generatedAt: new Date(),
        generator: 'TSD-Generator',
        version: '1.0.0',
        sourceFiles: ['test.ts'],
        language: Language.TypeScript,
      },
      format: DocumentFormat.Confluence,
      raw: '',
    };

    const result = generator.generate(document);

    expect(result).toContain('h1. Test Document');
    expect(result).toContain('{quote}');
    expect(result).toContain('{toc}');
  });
});

describe('DocumentGenerator', () => {
  let generator: DocumentGenerator;

  beforeEach(() => {
    generator = new DocumentGenerator();
  });

  it('should generate symbol documentation', () => {
    const symbol = {
      name: 'UserService',
      kind: SymbolKind.Class,
      location: { file: 'test.ts', line: 1 },
      description: 'Service for managing users',
      members: [
        { name: 'getUser', kind: SymbolKind.Method, type: 'User', location: { file: 'test.ts', line: 1 } },
        { name: 'addUser', kind: SymbolKind.Method, type: 'void', location: { file: 'test.ts', line: 1 } },
      ],
    };

    const result = generator.generateSymbolDoc(symbol);

    expect(result).toContain('## UserService');
    expect(result).toContain('Service for managing users');
    expect(result).toContain('#### getUser');
    expect(result).toContain('#### addUser');
  });

  it('should generate symbol with parameters', () => {
    const symbol = {
      name: 'formatDate',
      kind: SymbolKind.Function,
      location: { file: 'test.ts', line: 1 },
      parameters: [
        { name: 'date', type: 'Date', description: 'The date to format' },
        { name: 'format', type: 'string', optional: true, defaultValue: "'YYYY-MM-DD'" },
      ],
      returnType: 'string',
    };

    const result = generator.generateSymbolDoc(symbol);

    expect(result).toContain('## formatDate');
    expect(result).toContain('### 参数');
    expect(result).toContain('date');
    expect(result).toContain('Date');
    expect(result).toContain('### 返回值');
    expect(result).toContain('string');
  });
});
