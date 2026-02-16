import * as crypto from 'crypto';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramCluster,
  NodeShape,
  EdgeType,
  MermaidOptions,
  DEFAULT_MERMAID_OPTIONS,
} from './types';

export class MermaidGenerator {
  private options: MermaidOptions;

  constructor(options?: Partial<MermaidOptions>) {
    this.options = { ...DEFAULT_MERMAID_OPTIONS, ...options };
  }

  export(diagram: Diagram): string {
    switch (diagram.type) {
      case 'flowchart':
        return this.exportFlowchart(diagram);
      case 'sequence':
        return this.exportSequence(diagram);
      case 'class':
        return this.exportClassDiagram(diagram);
      case 'architecture':
      case 'dependency':
        return this.exportFlowchart(diagram);
      case 'state':
        return this.exportStateDiagram(diagram);
      case 'er':
        return this.exportERDiagram(diagram);
      default:
        return this.exportFlowchart(diagram);
    }
  }

  private exportFlowchart(diagram: Diagram): string {
    const lines: string[] = [];
    const direction = this.getFlowchartDirection(diagram);

    lines.push(`\`\`\`mermaid`);
    lines.push(`flowchart ${direction}`);

    for (const cluster of diagram.clusters) {
      lines.push(this.exportCluster(cluster));
    }

    for (const node of diagram.nodes) {
      const cluster = diagram.clusters.find((c) => c.nodes.includes(node.id));
      if (!cluster) {
        lines.push(`  ${this.exportNode(node)}`);
      }
    }

    for (const edge of diagram.edges) {
      lines.push(`  ${this.exportEdge(edge)}`);
    }

    lines.push(`\`\`\``);

    return lines.join('\n');
  }

  private exportSequence(diagram: Diagram): string {
    const lines: string[] = [];

    lines.push(`\`\`\`mermaid`);
    lines.push('sequenceDiagram');

    const participants = diagram.nodes.filter(
      (n) => n.type === 'class' || n.type === 'module' || n.type === 'external'
    );

    for (const participant of participants) {
      lines.push(`  participant ${this.sanitizeId(participant.id)} as ${participant.label}`);
    }

    for (const edge of diagram.edges) {
      const arrow = this.getSequenceArrow(edge.type);
      lines.push(
        `  ${this.sanitizeId(edge.source)}${arrow}${this.sanitizeId(edge.target)}: ${edge.label || ''}`
      );
    }

    lines.push(`\`\`\``);

    return lines.join('\n');
  }

  private exportClassDiagram(diagram: Diagram): string {
    const lines: string[] = [];

    lines.push(`\`\`\`mermaid`);
    lines.push('classDiagram');

    for (const node of diagram.nodes) {
      if (node.type === 'class' || node.type === 'interface') {
        lines.push(`  ${this.exportClassNode(node)}`);
      }
    }

    for (const edge of diagram.edges) {
      lines.push(`  ${this.exportClassEdge(edge)}`);
    }

    lines.push(`\`\`\``);

    return lines.join('\n');
  }

  private exportStateDiagram(diagram: Diagram): string {
    const lines: string[] = [];

    lines.push(`\`\`\`mermaid`);
    lines.push('stateDiagram-v2');

    for (const node of diagram.nodes) {
      lines.push(`  ${this.sanitizeId(node.id)} : ${node.label}`);
    }

    for (const edge of diagram.edges) {
      lines.push(
        `  ${this.sanitizeId(edge.source)} --> ${this.sanitizeId(edge.target)} : ${edge.label || ''}`
      );
    }

    lines.push(`\`\`\``);

    return lines.join('\n');
  }

  private exportERDiagram(diagram: Diagram): string {
    const lines: string[] = [];

    lines.push(`\`\`\`mermaid`);
    lines.push('erDiagram');

    for (const node of diagram.nodes) {
      lines.push(`  ${this.sanitizeId(node.id)} {`);
      lines.push(`    ${node.type} ${this.sanitizeLabel(node.label)}`);
      lines.push(`  }`);
    }

    for (const edge of diagram.edges) {
      const relationship = this.getERRelationship(edge.type);
      lines.push(
        `  ${this.sanitizeId(edge.source)} ${relationship} ${this.sanitizeId(edge.target)} : ${edge.label || 'relates to'}`
      );
    }

    lines.push(`\`\`\``);

    return lines.join('\n');
  }

  private exportNode(node: DiagramNode): string {
    const id = this.sanitizeId(node.id);
    const label = this.sanitizeLabel(node.label);
    const shape = node.shape || this.getDefaultShape(node.type);

    switch (shape) {
      case 'rounded':
        return `${id}(${label})`;
      case 'circle':
        return `${id}((${label}))`;
      case 'diamond':
        return `${id}{${label}}`;
      case 'hexagon':
        return `${id}{{${label}}}`;
      case 'parallelogram':
        return `${id}[/${label}/]`;
      case 'cylinder':
        return `${id}[(${label})]`;
      case 'rectangle':
      default:
        return `${id}[${label}]`;
    }
  }

  private exportEdge(edge: DiagramEdge): string {
    const source = this.sanitizeId(edge.source);
    const target = this.sanitizeId(edge.target);
    const label = edge.label ? `|${this.sanitizeLabel(edge.label)}|` : '';

    const arrow = this.getEdgeArrow(edge.type, edge.style?.line);

    return `${source} ${arrow} ${target}${label}`;
  }

  private exportCluster(cluster: DiagramCluster): string {
    const lines: string[] = [];

    lines.push(`  subgraph ${this.sanitizeId(cluster.id)} [${cluster.label}]`);

    for (const nodeId of cluster.nodes) {
      lines.push(`    ${this.sanitizeId(nodeId)}`);
    }

    lines.push('  end');

    return lines.join('\n');
  }

  private exportClassNode(node: DiagramNode): string {
    const lines: string[] = [];
    const keyword = node.type === 'interface' ? '<<interface>>' : '';

    lines.push(`  class ${this.sanitizeId(node.id)} {`);
    if (keyword) {
      lines.push(`    ${keyword}`);
    }
    lines.push(`  }`);

    return lines.join('\n');
  }

  private exportClassEdge(edge: DiagramEdge): string {
    const source = this.sanitizeId(edge.source);
    const target = this.sanitizeId(edge.target);
    const label = edge.label || '';

    switch (edge.type) {
      case 'inheritance':
        return `${source} --|> ${target} : ${label}`;
      case 'implementation':
        return `${source} ..|> ${target} : ${label}`;
      case 'composition':
        return `${source} *-- ${target} : ${label}`;
      case 'aggregation':
        return `${source} o-- ${target} : ${label}`;
      case 'dependency':
        return `${source} ..> ${target} : ${label}`;
      case 'association':
      default:
        return `${source} --> ${target} : ${label}`;
    }
  }

  private getFlowchartDirection(diagram: Diagram): string {
    const metadata = diagram.metadata as unknown as { direction?: string };
    if (metadata?.direction) {
      switch (metadata.direction) {
        case 'left-right':
          return 'LR';
        case 'bottom-top':
          return 'BT';
        case 'right-left':
          return 'RL';
        case 'top-bottom':
        default:
          return 'TB';
      }
    }
    return 'TB';
  }

  private getEdgeArrow(type: EdgeType, lineStyle?: 'solid' | 'dashed' | 'dotted'): string {
    const baseArrows: Record<EdgeType, string> = {
      association: '-->',
      dependency: '-.->',
      inheritance: '-->',
      implementation: '-.->',
      composition: '-->',
      aggregation: '-->',
      flow: '-->',
      data: '-->',
    };

    let arrow = baseArrows[type] || '-->';

    if (lineStyle === 'dashed') {
      arrow = arrow.replace('--', '-.-');
    } else if (lineStyle === 'dotted') {
      arrow = arrow.replace('--', '-.-');
    }

    return arrow;
  }

  private getSequenceArrow(type: EdgeType): string {
    switch (type) {
      case 'dependency':
      case 'implementation':
        return '-.->>';
      case 'association':
        return '-->>';
      case 'flow':
      case 'data':
      default:
        return '->>';
    }
  }

  private getERRelationship(type: EdgeType): string {
    switch (type) {
      case 'composition':
        return '*--';
      case 'aggregation':
        return 'o--';
      case 'inheritance':
      case 'implementation':
        return '|o--';
      case 'dependency':
        return '}o--';
      case 'association':
      default:
        return '||--';
    }
  }

  private getDefaultShape(type: string): NodeShape {
    switch (type) {
      case 'decision':
        return 'diamond';
      case 'database':
        return 'cylinder';
      case 'process':
        return 'rounded';
      case 'external':
        return 'hexagon';
      default:
        return 'rectangle';
    }
  }

  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
  }

  private sanitizeLabel(label: string): string {
    return label.replace(/"/g, "'").replace(/\n/g, ' ');
  }

  generateDiagramId(): string {
    return `diagram-${crypto.randomBytes(4).toString('hex')}`;
  }

  wrapWithCodeBlock(code: string, language: string = 'mermaid'): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  addTitle(code: string, title: string): string {
    return `%% ${title}\n${code}`;
  }

  addComment(code: string, comment: string): string {
    return `%% ${comment}\n${code}`;
  }

  setOptions(options: Partial<MermaidOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): MermaidOptions {
    return { ...this.options };
  }
}
