import { ParsedFile, SymbolKind } from '../types';
import { ArchitecturePattern, PatternMatch, IPatternDetector } from './types';

interface PatternRule {
  pattern: ArchitecturePattern;
  directoryIndicators: RegExp[];
  fileIndicators: RegExp[];
  symbolIndicators: {
    kinds: SymbolKind[];
    namePatterns: RegExp[];
  }[];
  dependencyIndicators: string[];
  minConfidence: number;
}

const PATTERN_RULES: PatternRule[] = [
  {
    pattern: 'mvc',
    directoryIndicators: [
      /[\/\\](controllers?|views?|models?)[\/\\]/i,
      /[\/\\]app[\/\\](controllers?|views?|models?)/i,
    ],
    fileIndicators: [/controller/i, /model/i, /view/i],
    symbolIndicators: [
      { kinds: [SymbolKind.Class], namePatterns: [/Controller$/, /Model$/, /View$/] },
    ],
    dependencyIndicators: ['controller->model', 'controller->view'],
    minConfidence: 0.6,
  },
  {
    pattern: 'mvvm',
    directoryIndicators: [
      /[\/\\](viewmodels?|views?|models?)[\/\\]/i,
      /[\/\\]src[\/\\](viewmodels?|views?|models?)/i,
    ],
    fileIndicators: [/viewmodel/i, /view/i, /\.vue$/i],
    symbolIndicators: [{ kinds: [SymbolKind.Class], namePatterns: [/ViewModel$/, /View$/] }],
    dependencyIndicators: ['viewmodel->model', 'view->viewmodel'],
    minConfidence: 0.6,
  },
  {
    pattern: 'microservices',
    directoryIndicators: [/[\/\\]services?[\/\\]/i, /[\/\\]api[\/\\]/i, /[\/\\]gateway[\/\\]/i],
    fileIndicators: [/service$/i, /api$/i, /gateway$/i, /client$/i],
    symbolIndicators: [
      { kinds: [SymbolKind.Class], namePatterns: [/Service$/, /Gateway$/, /Client$/] },
    ],
    dependencyIndicators: ['service->service', 'gateway->service'],
    minConfidence: 0.5,
  },
  {
    pattern: 'layered',
    directoryIndicators: [
      /[\/\\](presentation|business|data|persistence)[\/\\]/i,
      /[\/\\](ui|service|repository|dao)[\/\\]/i,
      /[\/\\](controllers?|services?|repositories?)[\/\\]/i,
    ],
    fileIndicators: [/service$/i, /repository$/i, /dao$/i],
    symbolIndicators: [
      { kinds: [SymbolKind.Class], namePatterns: [/Service$/, /Repository$/, /DAO$/] },
    ],
    dependencyIndicators: ['controller->service', 'service->repository'],
    minConfidence: 0.6,
  },
  {
    pattern: 'event-driven',
    directoryIndicators: [
      /[\/\\](events?|handlers?|listeners?|subscribers?|publishers?)[\/\\]/i,
      /[\/\\](messaging|queue|broker)[\/\\]/i,
    ],
    fileIndicators: [/event$/i, /handler$/i, /listener$/i, /subscriber$/i, /publisher$/i],
    symbolIndicators: [
      {
        kinds: [SymbolKind.Class, SymbolKind.Interface],
        namePatterns: [/Event$/, /Handler$/, /Listener$/, /Subscriber$/, /Publisher$/],
      },
    ],
    dependencyIndicators: ['publisher->event', 'subscriber->event'],
    minConfidence: 0.5,
  },
  {
    pattern: 'hexagonal',
    directoryIndicators: [
      /[\/\\](domain|application|infrastructure|ports?|adapters?)[\/\\]/i,
      /[\/\\](core|entities?|usecases?)[\/\\]/i,
    ],
    fileIndicators: [/port$/i, /adapter$/i, /usecase$/i, /entity$/i],
    symbolIndicators: [
      {
        kinds: [SymbolKind.Class, SymbolKind.Interface],
        namePatterns: [/Port$/, /Adapter$/, /UseCase$/, /Entity$/],
      },
    ],
    dependencyIndicators: ['adapter->port', 'usecase->port'],
    minConfidence: 0.6,
  },
  {
    pattern: 'modular',
    directoryIndicators: [/[\/\\]modules?[\/\\]/i, /[\/\\]features?[\/\\]/i],
    fileIndicators: [/module$/i],
    symbolIndicators: [
      { kinds: [SymbolKind.Class, SymbolKind.Interface], namePatterns: [/Module$/] },
    ],
    dependencyIndicators: ['module->module'],
    minConfidence: 0.5,
  },
  {
    pattern: 'plugin',
    directoryIndicators: [
      /[\/\\]plugins?[\/\\]/i,
      /[\/\\]extensions?[\/\\]/i,
      /[\/\\]addons?[\/\\]/i,
    ],
    fileIndicators: [/plugin$/i, /extension$/i, /addon$/i],
    symbolIndicators: [
      {
        kinds: [SymbolKind.Class, SymbolKind.Interface],
        namePatterns: [/Plugin$/, /Extension$/, /Addon$/],
      },
    ],
    dependencyIndicators: ['plugin->host'],
    minConfidence: 0.5,
  },
];

export class PatternDetector implements IPatternDetector {
  detect(files: ParsedFile[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    for (const rule of PATTERN_RULES) {
      const indicators = this.getIndicators(rule.pattern, files);
      const confidence = this.calculateConfidence(rule, files, indicators);

      if (confidence >= rule.minConfidence) {
        matches.push({
          pattern: rule.pattern,
          confidence,
          indicators,
        });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);

    if (matches.length === 0) {
      matches.push({
        pattern: 'unknown',
        confidence: 0,
        indicators: ['Unable to determine architecture pattern'],
      });
    }

    return matches;
  }

  getIndicators(pattern: ArchitecturePattern, files: ParsedFile[]): string[] {
    const rule = PATTERN_RULES.find((r) => r.pattern === pattern);
    if (!rule) return [];

    const indicators: string[] = [];

    for (const file of files) {
      const filePath = file.path.replace(/\\/g, '/');

      for (const dirPattern of rule.directoryIndicators) {
        if (dirPattern.test(filePath)) {
          indicators.push(`Directory pattern matched: ${dirPattern.source} in ${filePath}`);
        }
      }

      for (const filePattern of rule.fileIndicators) {
        if (filePattern.test(filePath)) {
          indicators.push(`File pattern matched: ${filePattern.source} in ${filePath}`);
        }
      }

      for (const symbol of file.symbols) {
        for (const symbolIndicator of rule.symbolIndicators) {
          if (symbolIndicator.kinds.includes(symbol.kind)) {
            for (const namePattern of symbolIndicator.namePatterns) {
              if (namePattern.test(symbol.name)) {
                indicators.push(`Symbol pattern matched: ${symbol.name} (${symbol.kind})`);
              }
            }
          }
        }
      }
    }

    return [...new Set(indicators)];
  }

  private calculateConfidence(
    rule: PatternRule,
    files: ParsedFile[],
    indicators: string[]
  ): number {
    if (indicators.length === 0) return 0;

    let directoryScore = 0;
    let fileScore = 0;
    let symbolScore = 0;

    for (const file of files) {
      const filePath = file.path.replace(/\\/g, '/');

      for (const dirPattern of rule.directoryIndicators) {
        if (dirPattern.test(filePath)) {
          directoryScore++;
          break;
        }
      }

      for (const filePattern of rule.fileIndicators) {
        if (filePattern.test(filePath)) {
          fileScore++;
          break;
        }
      }

      for (const symbol of file.symbols) {
        for (const symbolIndicator of rule.symbolIndicators) {
          if (symbolIndicator.kinds.includes(symbol.kind)) {
            for (const namePattern of symbolIndicator.namePatterns) {
              if (namePattern.test(symbol.name)) {
                symbolScore++;
                break;
              }
            }
          }
        }
      }
    }

    const totalFiles = files.length;
    const directoryRatio = Math.min(directoryScore / Math.max(totalFiles * 0.1, 1), 1);
    const fileRatio = Math.min(fileScore / Math.max(totalFiles * 0.2, 1), 1);
    const symbolRatio = Math.min(symbolScore / Math.max(totalFiles * 0.3, 1), 1);

    const weights = {
      directory: 0.4,
      file: 0.3,
      symbol: 0.3,
    };

    return (
      directoryRatio * weights.directory + fileRatio * weights.file + symbolRatio * weights.symbol
    );
  }

  detectMultiplePatterns(files: ParsedFile[]): PatternMatch[] {
    const allMatches = this.detect(files);
    return allMatches.filter((m) => m.confidence >= 0.3);
  }

  getPrimaryPattern(files: ParsedFile[]): PatternMatch {
    const matches = this.detect(files);
    return matches[0];
  }

  hasPattern(files: ParsedFile[], pattern: ArchitecturePattern): boolean {
    const matches = this.detect(files);
    return matches.some((m) => m.pattern === pattern && m.confidence >= 0.5);
  }
}
