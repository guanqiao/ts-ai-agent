import { IParser, ParseResult, ParserOptions, ParsedFile, Language } from '../interfaces';

export abstract class BaseParser implements IParser {
  abstract readonly language: Language;

  abstract parse(filePath: string, options?: ParserOptions): Promise<ParsedFile>;

  abstract parseDirectory(dirPath: string, options?: ParserOptions): Promise<ParseResult>;

  abstract isSupported(filePath: string): boolean;

  protected shouldExclude(filePath: string, options?: ParserOptions): boolean {
    if (!options?.excludePatterns) return false;
    return options.excludePatterns.some((pattern: string) => filePath.includes(pattern));
  }

  protected shouldInclude(filePath: string, options?: ParserOptions): boolean {
    if (!options?.includePatterns || options.includePatterns.length === 0) return true;
    return options.includePatterns.some((pattern: string) => filePath.includes(pattern));
  }

  protected getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  protected createEmptyResult(): ParseResult {
    return {
      files: [],
      summary: {
        totalFiles: 0,
        totalSymbols: 0,
        byKind: {} as Record<string, number>,
        byLanguage: {} as Record<string, number>,
        parseTime: 0,
      },
      errors: [],
    };
  }
}
