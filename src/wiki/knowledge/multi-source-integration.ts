import { GitService } from '../../git';

export interface KnowledgeItem {
  type: string;
  content: string;
  source: string;
  confidence: number;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
  sources?: string[];
}

export interface MultiSourceKnowledgeGraph {
  nodes: MultiSourceKnowledgeNode[];
  edges: MultiSourceKnowledgeEdge[];
}

export interface MultiSourceKnowledgeNode {
  id: string;
  type: string;
  content: string;
  sources: string[];
  confidence: number;
}

export interface MultiSourceKnowledgeEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface KnowledgeReport {
  summary: string;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  recommendations: string[];
  items: KnowledgeItem[];
}

export interface FileContent {
  path: string;
  content: string;
}

export class MultiSourceIntegration {
  private _projectPath: string;
  private gitService: GitService;

  constructor(projectPath: string, gitService: GitService) {
    this._projectPath = projectPath;
    this.gitService = gitService;
  }

  get projectPath(): string {
    return this._projectPath;
  }

  async extractFromGitHistory(): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = [];

    try {
      const commits = await this.gitService.getCommits(this._projectPath, { maxCount: 100 });

      for (const commit of commits) {
        const message = commit.message.toLowerCase();

        if (message.includes('arch:') || message.includes('architecture')) {
          items.push({
            type: 'architectural-decision',
            content: commit.message,
            source: 'git',
            confidence: 0.8,
            timestamp: commit.date,
            metadata: { commitHash: commit.hash, author: commit.author },
          });
        }

        if (message.startsWith('feat:') || message.startsWith('feature:')) {
          items.push({
            type: 'feature-evolution',
            content: commit.message.replace(/^feat(ure)?:\s*/i, ''),
            source: 'git',
            confidence: 0.7,
            timestamp: commit.date,
            metadata: { commitHash: commit.hash },
          });
        }

        if (message.startsWith('refactor:')) {
          items.push({
            type: 'refactoring',
            content: commit.message.replace(/^refactor:\s*/i, ''),
            source: 'git',
            confidence: 0.6,
            timestamp: commit.date,
            metadata: { commitHash: commit.hash },
          });
        }
      }
    } catch {
      return items;
    }

    return items;
  }

  async extractFromCodeComments(files: FileContent[]): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = [];

    for (const file of files) {
      const todos = this.extractPattern(file.content, /\/\/\s*TODO:\s*(.+)/gi, 'todo');
      const fixmes = this.extractPattern(file.content, /\/\/\s*FIXME:\s*(.+)/gi, 'fixme');
      const decisions = this.extractDesignDecisions(file.content);

      items.push(
        ...todos.map((t) => ({ ...t, source: 'code-comment', metadata: { file: file.path } })),
        ...fixmes.map((f) => ({ ...f, source: 'code-comment', metadata: { file: file.path } })),
        ...decisions.map((d) => ({ ...d, source: 'code-comment', metadata: { file: file.path } }))
      );
    }

    return items;
  }

  async extractFromDocumentation(docs: FileContent[]): Promise<KnowledgeItem[]> {
    const items: KnowledgeItem[] = [];

    for (const doc of docs) {
      const architecture = this.extractArchitecture(doc.content);
      const techStack = this.extractTechStack(doc.content);
      const apiDocs = this.extractApiDocs(doc.content);

      items.push(
        ...architecture.map((a) => ({
          ...a,
          source: 'documentation',
          metadata: { file: doc.path },
        })),
        ...techStack.map((t) => ({
          ...t,
          source: 'documentation',
          metadata: { file: doc.path },
        })),
        ...apiDocs.map((a) => ({
          ...a,
          source: 'documentation',
          metadata: { file: doc.path },
        }))
      );
    }

    return items;
  }

  async mergeKnowledge(sources: KnowledgeItem[][]): Promise<KnowledgeItem[]> {
    const merged: Map<string, KnowledgeItem> = new Map();

    for (const source of sources) {
      for (const item of source) {
        const key = `${item.type}:${this.normalizeContent(item.content)}`;

        if (merged.has(key)) {
          const existing = merged.get(key)!;
          existing.sources = existing.sources || [existing.source];
          existing.sources.push(item.source);
          existing.confidence = Math.max(existing.confidence, item.confidence);
        } else {
          merged.set(key, { ...item });
        }
      }
    }

    return Array.from(merged.values());
  }

  async buildKnowledgeGraph(): Promise<MultiSourceKnowledgeGraph> {
    const nodes: MultiSourceKnowledgeNode[] = [];
    const edges: MultiSourceKnowledgeEdge[] = [];

    const gitKnowledge = await this.extractFromGitHistory();

    for (const item of gitKnowledge) {
      nodes.push({
        id: this.generateId(),
        type: item.type,
        content: item.content,
        sources: [item.source],
        confidence: item.confidence,
      });
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateSimilarity(nodes[i].content, nodes[j].content);
        if (similarity > 0.3) {
          edges.push({
            source: nodes[i].id,
            target: nodes[j].id,
            relationship: 'related',
            weight: similarity,
          });
        }
      }
    }

    return { nodes, edges };
  }

  async generateKnowledgeReport(): Promise<KnowledgeReport> {
    const gitKnowledge = await this.extractFromGitHistory();

    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const item of gitKnowledge) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      bySource[item.source] = (bySource[item.source] || 0) + 1;
    }

    const recommendations = this.generateRecommendations(gitKnowledge);

    return {
      summary: `Extracted ${gitKnowledge.length} knowledge items from ${Object.keys(bySource).length} sources`,
      byType,
      bySource,
      recommendations,
      items: gitKnowledge,
    };
  }

  private extractPattern(content: string, regex: RegExp, type: string): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      items.push({
        type,
        content: match[1].trim(),
        source: 'code-comment',
        confidence: 0.7,
      });
    }

    return items;
  }

  private extractDesignDecisions(content: string): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];
    const blockCommentRegex = /\/\*\*[\s\S]*?\*\//g;
    let match;

    while ((match = blockCommentRegex.exec(content)) !== null) {
      const comment = match[0];

      if (
        comment.toLowerCase().includes('decision') ||
        comment.toLowerCase().includes('because') ||
        comment.toLowerCase().includes('rationale')
      ) {
        const cleanComment = comment
          .replace(/\/\*\*/g, '')
          .replace(/\*\//g, '')
          .replace(/^\s*\*\s?/gm, '')
          .trim();

        items.push({
          type: 'design-decision',
          content: cleanComment.substring(0, 500),
          source: 'code-comment',
          confidence: 0.8,
        });
      }
    }

    return items;
  }

  private extractArchitecture(content: string): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];

    if (content.toLowerCase().includes('architecture')) {
      const archMatch = content.match(/##\s*Architecture[\s\S]*?(?=##|$)/i);
      if (archMatch) {
        items.push({
          type: 'architecture',
          content: archMatch[0].trim(),
          source: 'documentation',
          confidence: 0.9,
        });
      }
    }

    return items;
  }

  private extractTechStack(content: string): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];

    if (content.toLowerCase().includes('technology') || content.toLowerCase().includes('stack')) {
      const stackMatch = content.match(/##\s*(?:Technology\s*)?Stack[\s\S]*?(?=##|$)/i);
      if (stackMatch) {
        items.push({
          type: 'technology-stack',
          content: stackMatch[0].trim(),
          source: 'documentation',
          confidence: 0.85,
        });
      }
    }

    return items;
  }

  private extractApiDocs(content: string): KnowledgeItem[] {
    const items: KnowledgeItem[] = [];
    const apiRegex = /##\s*(GET|POST|PUT|DELETE|PATCH)\s+(\/\S+)/gi;
    let match;

    while ((match = apiRegex.exec(content)) !== null) {
      items.push({
        type: 'api-documentation',
        content: `${match[1]} ${match[2]}`,
        source: 'documentation',
        confidence: 0.9,
      });
    }

    return items;
  }

  private normalizeContent(content: string): string {
    return content.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private generateId(): string {
    return `kn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateRecommendations(items: KnowledgeItem[]): string[] {
    const recommendations: string[] = [];

    const types = new Set(items.map((i) => i.type));

    if (!types.has('architectural-decision')) {
      recommendations.push('Consider documenting architectural decisions in commit messages');
    }

    if (!types.has('design-decision')) {
      recommendations.push('Add design decision comments in code for better knowledge capture');
    }

    const todoCount = items.filter((i) => i.type === 'todo').length;
    if (todoCount > 5) {
      recommendations.push(`Review and address ${todoCount} TODOs in the codebase`);
    }

    return recommendations;
  }
}
