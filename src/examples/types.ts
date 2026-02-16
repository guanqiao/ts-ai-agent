import { Language } from '../types';

export interface CodeExample {
  id: string;
  title: string;
  description?: string;
  code: string;
  language: Language | string;
  source: ExampleSource;
  tags: string[];
  relatedSymbols: string[];
  output?: string;
  explanation?: string;
  complexity: 'basic' | 'intermediate' | 'advanced';
}

export interface ExampleSource {
  type: 'test' | 'documentation' | 'source' | 'external';
  filePath: string;
  lineStart: number;
  lineEnd: number;
  functionName?: string;
  testName?: string;
}

export interface ExampleGroup {
  name: string;
  description?: string;
  examples: CodeExample[];
  relatedSymbol?: string;
}

export interface ExampleCollection {
  symbolName: string;
  symbolKind: string;
  examples: CodeExample[];
  groups: ExampleGroup[];
}

export interface ExampleExtractionConfig {
  includeTests: boolean;
  includeComments: boolean;
  includeDocStrings: boolean;
  minLines: number;
  maxLines: number;
  languages: Language[];
  excludePatterns: string[];
  preferCompleteFunctions: boolean;
}

export interface TestFileInfo {
  path: string;
  language: Language;
  testFunctions: TestFunction[];
  setupCode?: string;
  teardownCode?: string;
}

export interface TestFunction {
  name: string;
  description?: string;
  code: string;
  lineStart: number;
  lineEnd: number;
  assertions: string[];
  inputs?: string;
  expectedOutput?: string;
  isAsync: boolean;
  isSkipped: boolean;
}

export interface IExampleExtractor {
  extract(files: string[], config: ExampleExtractionConfig): Promise<CodeExample[]>;
  extractFromTest(testFile: TestFileInfo): CodeExample[];
  extractFromSource(sourceFile: string): Promise<CodeExample[]>;
}

export interface ITestParser {
  parse(filePath: string): Promise<TestFileInfo>;
  parseTestFunction(code: string, language: Language): TestFunction[];
}

export interface IExampleIntegrator {
  integrate(examples: CodeExample[], documentPath: string): Promise<void>;
  generateExampleSection(examples: CodeExample[]): string;
}

export const DEFAULT_EXTRACTION_CONFIG: ExampleExtractionConfig = {
  includeTests: true,
  includeComments: true,
  includeDocStrings: true,
  minLines: 3,
  maxLines: 100,
  languages: [Language.TypeScript, Language.JavaScript],
  excludePatterns: ['node_modules', 'dist', 'build', '**/*.d.ts'],
  preferCompleteFunctions: true,
};

export const EXAMPLE_TEMPLATES: Record<string, string> = {
  typescript: `// Example: {title}
// {description}

{code}

// Output:
// {output}`,
  javascript: `// Example: {title}
// {description}

{code}

// Output:
// {output}`,
  python: `# Example: {title}
# {description}

{code}

# Output:
# {output}`,
};
