import { ParsedFile, SymbolKind } from '../../types';

export interface IntentResult {
  primaryIntent: string;
  confidence: number;
  patterns: string[];
  architecturalLayer: string;
  dependencies: string[];
  secondaryIntents: string[];
}

export interface DecisionRationale {
  type: 'decision' | 'trade-off' | 'constraint' | 'preference';
  rationale: string;
  context?: string;
  confidence: number;
}

export interface ImplicitKnowledge {
  type: string;
  content: string;
  evidence: string[];
  confidence: number;
}

export interface DomainResult {
  domain: string;
  domains: string[];
  confidence: number;
}

export interface KnowledgeReport {
  intents: Array<{ file: string; intent: IntentResult }>;
  patterns: string[];
  architecturalLayers: string[];
  domains: string[];
  implicitKnowledge: ImplicitKnowledge[];
}

const ARCHITECTURAL_LAYERS = [
  { pattern: /controller|handler|endpoint/i, layer: 'controller' },
  { pattern: /service|manager|facade/i, layer: 'service' },
  { pattern: /repository|dao|data|store/i, layer: 'repository' },
  { pattern: /model|entity|domain/i, layer: 'model' },
  { pattern: /util|helper|common/i, layer: 'utility' },
  { pattern: /middleware|interceptor|filter/i, layer: 'middleware' },
];

const DESIGN_PATTERNS = [
  { pattern: /singleton|getInstance/i, name: 'singleton' },
  { pattern: /factory|create[A-Z]/i, name: 'factory' },
  { pattern: /builder|with[A-Z]|build\(\)/i, name: 'builder' },
  { pattern: /observer|subscribe|emit|on\(/i, name: 'observer' },
  { pattern: /strategy|strategy/i, name: 'strategy' },
  { pattern: /adapter|adapt/i, name: 'adapter' },
  { pattern: /decorator|wrap/i, name: 'decorator' },
  { pattern: /proxy/i, name: 'proxy' },
];

const BUSINESS_DOMAINS: Record<string, string[]> = {
  finance: ['payment', 'invoice', 'refund', 'transaction', 'billing', 'checkout'],
  user: ['user', 'auth', 'login', 'account', 'profile', 'permission'],
  ecommerce: ['product', 'cart', 'order', 'inventory', 'shipping'],
  communication: ['message', 'notification', 'email', 'chat', 'comment'],
  content: ['article', 'post', 'media', 'document', 'file'],
  analytics: ['report', 'metric', 'dashboard', 'tracking', 'analytics'],
};

export class IntentInference {
  async inferIntent(file: ParsedFile): Promise<IntentResult> {
    const content = file.rawContent || '';
    const fileName = file.path.split('/').pop() || file.path;

    const primaryIntent = this.extractPrimaryIntent(fileName, content, file.symbols);
    const patterns = this.detectPatterns(content);
    const architecturalLayer = this.detectArchitecturalLayer(fileName, content);
    const dependencies = this.extractDependencies(content);
    const secondaryIntents = this.extractSecondaryIntents(file.symbols);

    const confidence = this.calculateConfidence(primaryIntent, patterns, file.symbols);

    return {
      primaryIntent,
      confidence,
      patterns,
      architecturalLayer,
      dependencies,
      secondaryIntents,
    };
  }

  async inferDecisionRationale(file: ParsedFile): Promise<DecisionRationale[]> {
    const content = file.rawContent || '';
    const rationales: DecisionRationale[] = [];

    const decisionPatterns = [
      {
        regex: /(?:using|chose|selected|adopted)\s+(\w+)(?:\s+because|for|due to)?\s*:?\s*([^\n]+)/gi,
        type: 'decision' as const,
      },
      {
        regex: /(?:trade-?off|权衡)[\s:：]*([^\n]+)/gi,
        type: 'trade-off' as const,
      },
      {
        regex: /(?:constraint|limitation|限制)[\s:：]*([^\n]+)/gi,
        type: 'constraint' as const,
      },
    ];

    for (const { regex, type } of decisionPatterns) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        rationales.push({
          type,
          rationale: match[0].trim(),
          context: match[1] || undefined,
          confidence: 0.7,
        });
      }
    }

    const commentBlocks = this.extractCommentBlocks(content);
    for (const block of commentBlocks) {
      if (this.containsRationale(block)) {
        rationales.push({
          type: 'decision',
          rationale: block.trim(),
          confidence: 0.6,
        });
      }
    }

    return rationales;
  }

  async extractImplicitKnowledge(files: ParsedFile[]): Promise<ImplicitKnowledge[]> {
    const knowledge: ImplicitKnowledge[] = [];

    knowledge.push(...this.extractNamingConventions(files));
    knowledge.push(...this.extractArchitecturalPatterns(files));
    knowledge.push(...this.extractCommonDependencies(files));

    return knowledge;
  }

  async inferBusinessDomain(files: ParsedFile[]): Promise<DomainResult> {
    const domainScores: Map<string, number> = new Map();

    for (const file of files) {
      const fileName = file.path.toLowerCase();
      const content = (file.rawContent || '').toLowerCase();

      for (const [domain, keywords] of Object.entries(BUSINESS_DOMAINS)) {
        for (const keyword of keywords) {
          if (fileName.includes(keyword) || content.includes(keyword)) {
            domainScores.set(domain, (domainScores.get(domain) || 0) + 1);
          }
        }
      }
    }

    const sortedDomains = Array.from(domainScores.entries())
      .sort((a, b) => b[1] - a[1]);

    const primaryDomain = sortedDomains[0]?.[0] || 'general';
    const allDomains = sortedDomains.slice(0, 3).map(([d]) => d);
    const confidence = sortedDomains.length > 0 ? sortedDomains[0][1] / files.length : 0;

    return {
      domain: primaryDomain,
      domains: allDomains,
      confidence: Math.min(confidence, 1),
    };
  }

  async generateKnowledgeReport(files: ParsedFile[]): Promise<KnowledgeReport> {
    const intents: Array<{ file: string; intent: IntentResult }> = [];
    const allPatterns = new Set<string>();
    const allLayers = new Set<string>();

    for (const file of files) {
      const intent = await this.inferIntent(file);
      intents.push({ file: file.path, intent });

      intent.patterns.forEach((p) => allPatterns.add(p));
      allLayers.add(intent.architecturalLayer);
    }

    const domainResult = await this.inferBusinessDomain(files);
    const implicitKnowledge = await this.extractImplicitKnowledge(files);

    return {
      intents,
      patterns: Array.from(allPatterns),
      architecturalLayers: Array.from(allLayers),
      domains: domainResult.domains,
      implicitKnowledge,
    };
  }

  private extractPrimaryIntent(
    fileName: string,
    content: string,
    symbols: ParsedFile['symbols']
  ): string {
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    const parts = nameWithoutExt.split(/[._-]/);

    const meaningfulParts = parts.filter(
      (p) => !['src', 'lib', 'dist', 'index', 'main', 'app'].includes(p.toLowerCase())
    );

    if (symbols.length > 0) {
      const mainSymbol = symbols.find((s) =>
        [SymbolKind.Class, SymbolKind.Function, SymbolKind.Interface].includes(s.kind)
      );

      if (mainSymbol) {
        const words = this.splitCamelCase(mainSymbol.name);
        meaningfulParts.push(...words);
      }
    }

    const docComments = this.extractCommentBlocks(content);
    if (docComments.length > 0) {
      const firstDoc = docComments[0];
      const intentMatch = firstDoc.match(/(?:provides?|handles?|manages?|implements?)\s+([^\n.]+)/i);
      if (intentMatch) {
        return intentMatch[1].trim();
      }
    }

    return meaningfulParts.join(' ').toLowerCase() || 'unknown';
  }

  private detectPatterns(content: string): string[] {
    const patterns: string[] = [];

    for (const { pattern, name } of DESIGN_PATTERNS) {
      if (pattern.test(content)) {
        patterns.push(name);
      }
    }

    return patterns;
  }

  private detectArchitecturalLayer(fileName: string, content: string): string {
    for (const { pattern, layer } of ARCHITECTURAL_LAYERS) {
      if (pattern.test(fileName) || pattern.test(content)) {
        return layer;
      }
    }

    return 'unknown';
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];

    const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }

    return dependencies;
  }

  private extractSecondaryIntents(symbols: ParsedFile['symbols']): string[] {
    const intents: string[] = [];

    for (const symbol of symbols) {
      if (symbol.kind === SymbolKind.Method || symbol.kind === SymbolKind.Function) {
        const words = this.splitCamelCase(symbol.name);
        if (words.length > 0) {
          intents.push(words.join(' '));
        }
      }
    }

    return intents.slice(0, 5);
  }

  private calculateConfidence(
    intent: string,
    patterns: string[],
    symbols: ParsedFile['symbols']
  ): number {
    let confidence = 0.3;

    if (intent !== 'unknown') {
      confidence += 0.2;
    }

    if (patterns.length > 0) {
      confidence += 0.2;
    }

    if (symbols.length > 0) {
      confidence += 0.2;
    }

    const hasDocumentation = symbols.some((s) => s.documentation);
    if (hasDocumentation) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  private extractCommentBlocks(content: string): string[] {
    const blocks: string[] = [];

    const multiLineRegex = /\/\*\*?[\s\S]*?\*\//g;
    let match;

    while ((match = multiLineRegex.exec(content)) !== null) {
      blocks.push(match[0]);
    }

    const singleLineRegex = /\/\/.*$/gm;
    while ((match = singleLineRegex.exec(content)) !== null) {
      blocks.push(match[0]);
    }

    return blocks;
  }

  private containsRationale(text: string): boolean {
    const rationaleKeywords = [
      'because',
      'due to',
      'for',
      'since',
      'in order to',
      'so that',
      'trade-off',
      '权衡',
      '原因',
      '决策',
    ];

    return rationaleKeywords.some((k) => text.toLowerCase().includes(k));
  }

  private extractNamingConventions(files: ParsedFile[]): ImplicitKnowledge[] {
    const knowledge: ImplicitKnowledge[] = [];
    const namingPatterns: Map<string, number> = new Map();

    for (const file of files) {
      const fileName = file.path.split('/').pop() || '';

      if (fileName.includes('.service.')) {
        namingPatterns.set('service-suffix', (namingPatterns.get('service-suffix') || 0) + 1);
      }
      if (fileName.includes('.controller.')) {
        namingPatterns.set('controller-suffix', (namingPatterns.get('controller-suffix') || 0) + 1);
      }
      if (fileName.includes('.repository.')) {
        namingPatterns.set('repository-suffix', (namingPatterns.get('repository-suffix') || 0) + 1);
      }

      for (const symbol of file.symbols) {
        if (symbol.name.includes('Service')) {
          namingPatterns.set('service-suffix-class', (namingPatterns.get('service-suffix-class') || 0) + 1);
        }
        if (symbol.name.includes('Controller')) {
          namingPatterns.set('controller-suffix-class', (namingPatterns.get('controller-suffix-class') || 0) + 1);
        }
      }
    }

    for (const [pattern, count] of namingPatterns) {
      if (count >= 2) {
        knowledge.push({
          type: 'naming-convention',
          content: `Project uses ${pattern} naming convention`,
          evidence: [`Found ${count} occurrences`],
          confidence: Math.min(count / files.length + 0.5, 1),
        });
      }
    }

    return knowledge;
  }

  private extractArchitecturalPatterns(files: ParsedFile[]): ImplicitKnowledge[] {
    const knowledge: ImplicitKnowledge[] = [];
    const layers = new Set<string>();

    for (const file of files) {
      const layer = this.detectArchitecturalLayer(file.path, '');
      if (layer !== 'unknown') {
        layers.add(layer);
      }
    }

    if (layers.has('controller') && layers.has('service') && layers.has('repository')) {
      knowledge.push({
        type: 'architectural-pattern',
        content: 'Project follows layered architecture with Controller-Service-Repository pattern',
        evidence: Array.from(layers),
        confidence: 0.85,
      });
    } else if (layers.size >= 2) {
      knowledge.push({
        type: 'architectural-pattern',
        content: `Project has multiple layers: ${Array.from(layers).join(', ')}`,
        evidence: Array.from(layers),
        confidence: 0.7,
      });
    }

    return knowledge;
  }

  private extractCommonDependencies(files: ParsedFile[]): ImplicitKnowledge[] {
    const knowledge: ImplicitKnowledge[] = [];
    const dependencyCounts: Map<string, number> = new Map();

    for (const file of files) {
      const deps = this.extractDependencies(file.rawContent || '');
      for (const dep of deps) {
        dependencyCounts.set(dep, (dependencyCounts.get(dep) || 0) + 1);
      }
    }

    const commonDeps = Array.from(dependencyCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [dep, count] of commonDeps) {
      knowledge.push({
        type: 'common-dependency',
        content: `Common dependency: ${dep} used in ${count} files`,
        evidence: [`Used ${count} times`],
        confidence: Math.min(count / files.length + 0.5, 1),
      });
    }

    return knowledge;
  }

  private splitCamelCase(str: string): string[] {
    return str
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[\s_-]+/)
      .filter((s) => s.length > 0);
  }
}
