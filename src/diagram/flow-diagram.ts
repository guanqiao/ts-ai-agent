import * as crypto from 'crypto';
import { ParsedFile, SymbolKind } from '../types';
import {
  Diagram,
  DiagramNode,
  DiagramEdge,
  DiagramCluster,
  DiagramMetadata,
  FlowDiagramConfig,
  DEFAULT_FLOW_CONFIG,
} from './types';
import { MermaidGenerator } from './mermaid-generator';

export interface FlowStep {
  id: string;
  label: string;
  type: 'start' | 'end' | 'process' | 'decision' | 'io' | 'subprocess';
  next?: string;
  branches?: { condition: string; target: string }[];
}

export class FlowDiagramGenerator {
  private config: FlowDiagramConfig;
  private mermaidGenerator: MermaidGenerator;

  constructor(config?: Partial<FlowDiagramConfig>) {
    this.config = { ...DEFAULT_FLOW_CONFIG, ...config };
    this.mermaidGenerator = new MermaidGenerator();
  }

  async generateFromSteps(steps: FlowStep[], title: string = 'Flow Diagram'): Promise<Diagram> {
    const nodes: DiagramNode[] = [];
    const edges: DiagramEdge[] = [];
    const clusters: DiagramCluster[] = [];

    for (const step of steps) {
      nodes.push({
        id: step.id,
        label: step.label,
        type: this.mapStepType(step.type),
        shape: this.getShapeForType(step.type),
      });

      if (step.next) {
        edges.push({
          id: `edge-${step.id}-${step.next}`,
          source: step.id,
          target: step.next,
          type: 'flow',
        });
      }

      if (step.branches) {
        for (const branch of step.branches) {
          edges.push({
            id: `edge-${step.id}-${branch.target}`,
            source: step.id,
            target: branch.target,
            type: 'flow',
            label: branch.condition,
          });
        }
      }
    }

    const metadata: DiagramMetadata = {
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0.0',
      sourceFiles: [],
      generator: 'flow-diagram-generator',
    };

    return {
      id: this.generateDiagramId(),
      type: 'flowchart',
      title,
      nodes,
      edges,
      clusters,
      metadata,
    };
  }

  async generateFromFunction(parsedFiles: ParsedFile[], functionName: string): Promise<Diagram> {
    const steps: FlowStep[] = [];

    for (const file of parsedFiles) {
      const func = file.symbols.find(
        (s) => s.kind === SymbolKind.Function && s.name === functionName
      );

      if (func) {
        this.extractFlowFromFunction(func, steps);
        break;
      }
    }

    return this.generateFromSteps(steps, `Flow: ${functionName}`);
  }

  async generateFromCodeFlow(codeFlow: string, title: string = 'Code Flow'): Promise<Diagram> {
    const steps = this.parseCodeFlow(codeFlow);
    return this.generateFromSteps(steps, title);
  }

  private extractFlowFromFunction(func: any, steps: FlowStep[]): void {
    steps.push({
      id: 'start',
      label: 'Start',
      type: 'start',
    });

    if (func.parameters && func.parameters.length > 0) {
      steps.push({
        id: 'input',
        label: `Input: ${func.parameters.map((p: any) => p.name).join(', ')}`,
        type: 'io',
        next: 'process',
      });
    }

    steps.push({
      id: 'process',
      label: func.description || `Execute ${func.name}`,
      type: 'process',
      next: 'output',
    });

    if (func.returnType) {
      steps.push({
        id: 'output',
        label: `Return: ${func.returnType}`,
        type: 'io',
        next: 'end',
      });
    }

    steps.push({
      id: 'end',
      label: 'End',
      type: 'end',
    });

    if (steps.length > 1 && !steps[0].next) {
      steps[0].next = steps[1].id;
    }
  }

  private parseCodeFlow(codeFlow: string): FlowStep[] {
    const steps: FlowStep[] = [];
    const lines = codeFlow.split('\n').filter((l) => l.trim());

    let stepId = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let type: FlowStep['type'] = 'process';
      const label = trimmed;

      if (trimmed.toLowerCase().startsWith('start') || trimmed.toLowerCase().startsWith('begin')) {
        type = 'start';
      } else if (
        trimmed.toLowerCase().startsWith('end') ||
        trimmed.toLowerCase().startsWith('stop')
      ) {
        type = 'end';
      } else if (trimmed.includes('?') || trimmed.toLowerCase().startsWith('if')) {
        type = 'decision';
      } else if (
        trimmed.toLowerCase().startsWith('input') ||
        trimmed.toLowerCase().startsWith('output')
      ) {
        type = 'io';
      } else if (
        trimmed.toLowerCase().startsWith('call') ||
        trimmed.toLowerCase().startsWith('invoke')
      ) {
        type = 'subprocess';
      }

      const id = `step-${stepId++}`;
      steps.push({ id, label, type });

      if (steps.length > 1) {
        steps[steps.length - 2].next = id;
      }
    }

    return steps;
  }

  private mapStepType(type: string): 'process' | 'decision' | 'database' | 'external' {
    switch (type) {
      case 'decision':
        return 'decision';
      case 'io':
        return 'database';
      case 'subprocess':
        return 'external';
      default:
        return 'process';
    }
  }

  private getShapeForType(
    type: string
  ): 'rounded' | 'diamond' | 'parallelogram' | 'hexagon' | 'circle' {
    switch (type) {
      case 'start':
      case 'end':
        return 'circle';
      case 'decision':
        return 'diamond';
      case 'io':
        return 'parallelogram';
      case 'subprocess':
        return 'hexagon';
      default:
        return 'rounded';
    }
  }

  private generateDiagramId(): string {
    return `flow-diagram-${crypto.randomBytes(4).toString('hex')}`;
  }

  export(diagram: Diagram): string {
    return this.mermaidGenerator.export(diagram);
  }

  setConfig(config: Partial<FlowDiagramConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): FlowDiagramConfig {
    return { ...this.config };
  }

  generateMermaidCode(steps: FlowStep[], title?: string): Promise<string> {
    return this.generateFromSteps(steps, title).then((diagram) => this.export(diagram));
  }

  createSimpleFlow(labels: string[]): Promise<Diagram> {
    const steps: FlowStep[] = labels.map((label, index) => ({
      id: `step-${index}`,
      label,
      type: index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'process',
      next: index < labels.length - 1 ? `step-${index + 1}` : undefined,
    }));

    return this.generateFromSteps(steps);
  }

  createDecisionFlow(
    startLabel: string,
    decisionLabel: string,
    yesBranch: string[],
    noBranch: string[]
  ): Promise<Diagram> {
    const steps: FlowStep[] = [
      { id: 'start', label: startLabel, type: 'start', next: 'decision' },
      {
        id: 'decision',
        label: decisionLabel,
        type: 'decision',
        branches: [
          { condition: 'Yes', target: 'yes-0' },
          { condition: 'No', target: 'no-0' },
        ],
      },
    ];

    yesBranch.forEach((label, index) => {
      steps.push({
        id: `yes-${index}`,
        label,
        type: 'process',
        next: index < yesBranch.length - 1 ? `yes-${index + 1}` : 'end',
      });
    });

    noBranch.forEach((label, index) => {
      steps.push({
        id: `no-${index}`,
        label,
        type: 'process',
        next: index < noBranch.length - 1 ? `no-${index + 1}` : 'end',
      });
    });

    steps.push({ id: 'end', label: 'End', type: 'end' });

    return this.generateFromSteps(steps);
  }
}
