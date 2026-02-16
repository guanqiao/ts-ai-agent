import * as fs from 'fs';
import { Language } from '../types';
import {
  ITestParser,
  TestFileInfo,
  TestFunction,
} from './types';

export class TestParser implements ITestParser {
  async parse(filePath: string): Promise<TestFileInfo> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const language = this.detectLanguage(filePath);

    const testFunctions = this.parseTestFunction(content, language);

    const setupCode = this.extractSetupCode(content, language);
    const teardownCode = this.extractTeardownCode(content, language);

    return {
      path: filePath,
      language,
      testFunctions,
      setupCode,
      teardownCode,
    };
  }

  parseTestFunction(code: string, language: Language): TestFunction[] {
    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        return this.parseJestTests(code);
      case Language.Python:
        return this.parsePytestTests(code);
      case Language.Java:
        return this.parseJUnitTests(code);
      default:
        return this.parseJestTests(code);
    }
  }

  private parseJestTests(code: string): TestFunction[] {
    const tests: TestFunction[] = [];

    const patterns = [
      {
        regex: /(it|test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g,
        isAsync: (match: RegExpExecArray) => !!match[3],
      },
      {
        regex: /(it|test)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\(?\s*([\s\S]*?)\s*\)?\s*\)/g,
        isAsync: (match: RegExpExecArray) => !!match[3],
      },
      {
        regex: /(it|test)\.skip\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g,
        isAsync: (match: RegExpExecArray) => !!match[3],
        isSkipped: true,
      },
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(code)) !== null) {
        const name = match[2];
        const testCode = match[4] || '';
        const lineStart = code.substring(0, match.index).split('\n').length;

        const assertions = this.extractAssertions(testCode, 'jest');

        tests.push({
          name,
          code: this.extractFullTestCode(code, match.index),
          lineStart,
          lineEnd: lineStart + testCode.split('\n').length,
          assertions,
          isAsync: pattern.isAsync(match),
          isSkipped: (pattern as any).isSkipped || false,
        });
      }
    }

    return tests;
  }

  private parsePytestTests(code: string): TestFunction[] {
    const tests: TestFunction[] = [];

    const functionPattern = /(?:async\s+)?def\s+(test_\w+)\s*\(([^)]*)\)\s*:\s*\n((?:[ \t]+[^\n]*\n)*)/g;

    let match;
    while ((match = functionPattern.exec(code)) !== null) {
      const name = match[1];
      const params = match[2];
      const testCode = match[3];
      const lineStart = code.substring(0, match.index).split('\n').length;

      const assertions = this.extractAssertions(testCode, 'pytest');

      tests.push({
        name,
        description: this.extractDocstring(testCode),
        code: match[0],
        lineStart,
        lineEnd: lineStart + testCode.split('\n').length,
        assertions,
        inputs: params || undefined,
        isAsync: match[0].includes('async def'),
        isSkipped: testCode.includes('@pytest.mark.skip'),
      });
    }

    return tests;
  }

  private parseJUnitTests(code: string): TestFunction[] {
    const tests: TestFunction[] = [];

    const methodPattern = /@(Test|BeforeEach|AfterEach|BeforeAll|AfterAll)\s*(?:\n\s*)*(?:public\s+)?(?:static\s+)?void\s+(\w+)\s*\(\s*\)\s*(?:throws\s+[\w\s,]+)?\s*\{([\s\S]*?)\}/g;

    let match;
    while ((match = methodPattern.exec(code)) !== null) {
      const annotation = match[1];
      const name = match[2];
      const testCode = match[3];

      if (annotation === 'Test') {
        const lineStart = code.substring(0, match.index).split('\n').length;

        const assertions = this.extractAssertions(testCode, 'junit');

        tests.push({
          name,
          code: match[0],
          lineStart,
          lineEnd: lineStart + testCode.split('\n').length,
          assertions,
          isAsync: false,
          isSkipped: testCode.includes('@Disabled') || testCode.includes('@Ignore'),
        });
      }
    }

    return tests;
  }

  private extractAssertions(code: string, framework: string): string[] {
    const assertions: string[] = [];

    const patterns: Record<string, RegExp[]> = {
      jest: [
        /expect\s*\([^)]+\)\.(?:toBe|toEqual|toBeTruthy|toBeFalsy|toContain|toHaveLength|toThrow|toMatch|toBeDefined|toBeNull)\s*\([^)]*\)/g,
        /assert\s*\([^)]+\)/g,
      ],
      pytest: [
        /assert\s+[\s\S]+?(?=\n|$)/g,
      ],
      junit: [
        /assertEquals\s*\([^)]+\)/g,
        /assertTrue\s*\([^)]+\)/g,
        /assertFalse\s*\([^)]+\)/g,
        /assertNotNull\s*\([^)]+\)/g,
        /assertThrows\s*\([^)]+\)/g,
      ],
    };

    const frameworkPatterns = patterns[framework] || patterns.jest;

    for (const pattern of frameworkPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        assertions.push(match[0].trim());
      }
    }

    return assertions;
  }

  private extractFullTestCode(code: string, startIndex: number): string {
    let braceCount = 0;
    let inTest = false;
    let testCode = '';

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i];

      if (char === '{') {
        braceCount++;
        inTest = true;
      } else if (char === '}') {
        braceCount--;
      }

      if (inTest) {
        testCode += char;
      }

      if (inTest && braceCount === 0) {
        break;
      }
    }

    return testCode.trim();
  }

  private extractDocstring(code: string): string | undefined {
    const docstringMatch = code.match(/"""([\s\S]*?)"""/);
    return docstringMatch ? docstringMatch[1].trim() : undefined;
  }

  private extractSetupCode(code: string, language: Language): string | undefined {
    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        const beforeEachMatch = code.match(/beforeEach\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
        return beforeEachMatch ? beforeEachMatch[1].trim() : undefined;

      case Language.Python:
        const setupMatch = code.match(/def\s+setup\s*\([^)]*\)\s*:\s*\n((?:[ \t]+[^\n]*\n)*)/);
        return setupMatch ? setupMatch[0] : undefined;

      default:
        return undefined;
    }
  }

  private extractTeardownCode(code: string, language: Language): string | undefined {
    switch (language) {
      case Language.TypeScript:
      case Language.JavaScript:
        const afterEachMatch = code.match(/afterEach\s*\(\s*(?:async\s*)?\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/);
        return afterEachMatch ? afterEachMatch[1].trim() : undefined;

      case Language.Python:
        const teardownMatch = code.match(/def\s+teardown\s*\([^)]*\)\s*:\s*\n((?:[ \t]+[^\n]*\n)*)/);
        return teardownMatch ? teardownMatch[0] : undefined;

      default:
        return undefined;
    }
  }

  private detectLanguage(filePath: string): Language {
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'ts':
      case 'tsx':
        return Language.TypeScript;
      case 'js':
      case 'jsx':
        return Language.JavaScript;
      case 'py':
        return Language.Python;
      case 'java':
        return Language.Java;
      default:
        return Language.TypeScript;
    }
  }
}
