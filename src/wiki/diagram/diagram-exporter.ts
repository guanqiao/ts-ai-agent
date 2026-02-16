import {
  IDiagramExporter,
  ArchitectureDiagram,
  ExportOptions,
  DiagramNode,
  DiagramEdge,
  DiagramLayer,
  DEFAULT_EXPORT_OPTIONS,
} from './types';

export class DiagramExporter implements IDiagramExporter {
  exportToMermaid(diagram: ArchitectureDiagram, options?: ExportOptions): string {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const lines: string[] = [];

    lines.push('```mermaid');

    switch (diagram.type) {
      case 'layered':
        lines.push(this.generateMermaidFlowchart(diagram, opts));
        break;
      case 'component':
        lines.push(this.generateMermaidComponent(diagram, opts));
        break;
      case 'deployment':
        lines.push(this.generateMermaidDeployment(diagram, opts));
        break;
      default:
        lines.push(this.generateMermaidFlowchart(diagram, opts));
    }

    lines.push('```');

    return lines.join('\n');
  }

  exportToSVG(diagram: ArchitectureDiagram, options?: ExportOptions): string {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
    const scale = opts.scale;

    const bounds = this.calculateBounds(diagram);
    const width = (bounds.maxX - bounds.minX + 100) * scale;
    const height = (bounds.maxY - bounds.minY + 100) * scale;

    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${opts.style.colors.edgeDefault}" />
    </marker>
    <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
      <polygon points="0 0, 10 3.5, 0 7" fill="${opts.style.colors.edgeHighlight}" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="${opts.backgroundColor || opts.style.colors.background}" />
`;

    if (diagram.layers.length > 0) {
      svg += this.renderSVGLayers(diagram.layers, diagram.nodes, scale, bounds, opts);
    }

    svg += this.renderSVGEdges(diagram.edges, diagram.nodes, scale, bounds, opts);

    svg += this.renderSVGNodes(diagram.nodes, scale, bounds, opts);

    if (opts.includeMetadata) {
      svg += this.renderSVGMetadata(diagram, width);
    }

    svg += '</svg>';

    return svg;
  }

  async exportToPNG(diagram: ArchitectureDiagram, options?: ExportOptions): Promise<Buffer> {
    const placeholderPng = this.generatePlaceholderPNG(diagram, options);
    return placeholderPng;
  }

  exportToJSON(diagram: ArchitectureDiagram, options?: ExportOptions): string {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

    const exportData = {
      id: diagram.id,
      name: diagram.name,
      description: diagram.description,
      type: diagram.type,
      nodes: diagram.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        position: node.position,
        size: node.size,
        metadata: opts.includeMetadata ? node.metadata : undefined,
      })),
      edges: diagram.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label,
        metadata: opts.includeMetadata ? edge.metadata : undefined,
      })),
      layers: diagram.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        order: layer.order,
        nodes: layer.nodes,
      })),
      metadata: opts.includeMetadata ? diagram.metadata : undefined,
      exportedAt: new Date().toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  exportToDrawIO(diagram: ArchitectureDiagram, _options?: ExportOptions): string {
    let mxGraph = `<mxGraphModel dx="1000" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
`;

    let cellId = 2;
    const nodeIdMap = new Map<string, number>();

    for (const node of diagram.nodes) {
      const currentId = cellId++;
      nodeIdMap.set(node.id, currentId);

      const style = this.getDrawIOStyle(node.type);
      const x = node.position.x;
      const y = node.position.y;
      const width = node.size.width;
      const height = node.size.height;

      mxGraph += `    <mxCell id="${currentId}" value="${this.escapeXml(node.label)}" style="${style}" vertex="1" parent="1">
      <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />
    </mxCell>\n`;
    }

    for (const edge of diagram.edges) {
      const currentId = cellId++;
      const sourceId = nodeIdMap.get(edge.source);
      const targetId = nodeIdMap.get(edge.target);

      if (sourceId && targetId) {
        const edgeStyle = this.getDrawIOEdgeStyle(edge.type);
        mxGraph += `    <mxCell id="${currentId}" value="${edge.label || ''}" style="${edgeStyle}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>\n`;
      }
    }

    mxGraph += `  </root>
</mxGraphModel>`;

    return mxGraph;
  }

  private generateMermaidFlowchart(diagram: ArchitectureDiagram, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('flowchart TB');

    for (const layer of diagram.layers) {
      lines.push(`  subgraph ${layer.id}["${layer.name}"]`);
      for (const nodeId of layer.nodes) {
        const node = diagram.nodes.find((n) => n.id === nodeId);
        if (node) {
          lines.push(`    ${node.id}["${node.label}"]`);
        }
      }
      lines.push('  end');
    }

    for (const node of diagram.nodes) {
      if (!diagram.layers.some((l) => l.nodes.includes(node.id))) {
        lines.push(`  ${node.id}["${node.label}"]`);
      }
    }

    for (const edge of diagram.edges) {
      const arrow = this.getMermaidArrow(edge.type);
      const label = edge.label ? `|${edge.label}|` : '';
      lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`);
    }

    return lines.join('\n');
  }

  private generateMermaidComponent(diagram: ArchitectureDiagram, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('flowchart LR');

    for (const layer of diagram.layers) {
      lines.push(`  subgraph ${layer.id}["${layer.name}"]`);
      for (const nodeId of layer.nodes) {
        const node = diagram.nodes.find((n) => n.id === nodeId);
        if (node) {
          const shape = this.getMermaidNodeShape(node.type);
          lines.push(`    ${node.id}${shape.left}"${node.label}"${shape.right}`);
        }
      }
      lines.push('  end');
    }

    for (const edge of diagram.edges) {
      const arrow = this.getMermaidArrow(edge.type);
      const label = edge.label ? `|${edge.label}|` : '';
      lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`);
    }

    return lines.join('\n');
  }

  private generateMermaidDeployment(diagram: ArchitectureDiagram, _options: ExportOptions): string {
    const lines: string[] = [];
    lines.push('flowchart TB');

    for (const layer of diagram.layers) {
      lines.push(`  subgraph ${layer.id}["${layer.name}"]`);
      for (const nodeId of layer.nodes) {
        const node = diagram.nodes.find((n) => n.id === nodeId);
        if (node) {
          const shape = this.getMermaidNodeShape(node.type);
          lines.push(`    ${node.id}${shape.left}"${node.label}"${shape.right}`);
        }
      }
      lines.push('  end');
    }

    for (const edge of diagram.edges) {
      const arrow = this.getMermaidArrow(edge.type);
      const label = edge.label ? `|${edge.label}|` : '';
      lines.push(`  ${edge.source} ${arrow}${label} ${edge.target}`);
    }

    return lines.join('\n');
  }

  private getMermaidArrow(edgeType: string): string {
    const arrows: Record<string, string> = {
      dependency: '-->',
      dataflow: '==>',
      communication: '-..->',
      inheritance: '--|>',
      implementation: '-..->|>',
    };
    return arrows[edgeType] || '-->';
  }

  private getMermaidNodeShape(nodeType: string): { left: string; right: string } {
    const shapes: Record<string, { left: string; right: string }> = {
      component: { left: '[', right: ']' },
      service: { left: '(', right: ')' },
      database: { left: '[(', right: ')]' },
      external: { left: '{{', right: '}}' },
      container: { left: '[', right: ']' },
      actor: { left: '{', right: '}' },
      layer: { left: '[', right: ']' },
    };
    return shapes[nodeType] || { left: '[', right: ']' };
  }

  private calculateBounds(diagram: ArchitectureDiagram): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of diagram.nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    }

    return { minX, minY, maxX, maxY };
  }

  private renderSVGLayers(
    layers: DiagramLayer[],
    nodes: DiagramNode[],
    scale: number,
    bounds: { minX: number; minY: number },
    options: ExportOptions
  ): string {
    let svg = '';

    for (const layer of layers) {
      const layerNodes = nodes.filter((n) => layer.nodes.includes(n.id));
      if (layerNodes.length === 0) continue;

      const layerBounds = this.calculateLayerBounds(layerNodes);
      const padding = options.style.spacing.layerPadding;

      const x = (layerBounds.minX - padding - bounds.minX) * scale + 20;
      const y = (layerBounds.minY - padding - bounds.minY) * scale + 20;
      const width = (layerBounds.maxX - layerBounds.minX + padding * 2) * scale;
      const height = (layerBounds.maxY - layerBounds.minY + padding * 2) * scale;

      svg += `  <rect x="${x}" y="${y}" width="${width}" height="${height}" 
        fill="${layer.style.backgroundColor}" stroke="${layer.style.borderColor}" stroke-width="2" rx="5" />
  <text x="${x + 10}" y="${y + 20}" font-family="${options.style.fonts.family}" font-size="14" font-weight="bold" fill="${options.style.colors.text}">${layer.name}</text>\n`;
    }

    return svg;
  }

  private calculateLayerBounds(nodes: DiagramNode[]): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const node of nodes) {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + node.size.width);
      maxY = Math.max(maxY, node.position.y + node.size.height);
    }

    return { minX, minY, maxX, maxY };
  }

  private renderSVGNodes(
    nodes: DiagramNode[],
    scale: number,
    bounds: { minX: number; minY: number },
    options: ExportOptions
  ): string {
    let svg = '';

    for (const node of nodes) {
      const x = (node.position.x - bounds.minX) * scale + 20;
      const y = (node.position.y - bounds.minY) * scale + 20;
      const width = node.size.width * scale;
      const height = node.size.height * scale;

      const rx = node.style.borderRadius * scale;

      svg += `  <rect x="${x}" y="${y}" width="${width}" height="${height}" 
        fill="${node.style.backgroundColor}" stroke="${node.style.borderColor}" stroke-width="${node.style.borderWidth}" rx="${rx}" />
  <text x="${x + width / 2}" y="${y + height / 2 + 4}" 
    font-family="${options.style.fonts.family}" font-size="${node.style.fontSize * scale}" 
    fill="${node.style.fontColor}" text-anchor="middle">${this.escapeXml(node.label)}</text>\n`;
    }

    return svg;
  }

  private renderSVGEdges(
    edges: DiagramEdge[],
    nodes: DiagramNode[],
    scale: number,
    bounds: { minX: number; minY: number },
    options: ExportOptions
  ): string {
    let svg = '';
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!source || !target) continue;

      const startX = (source.position.x + source.size.width / 2 - bounds.minX) * scale + 20;
      const startY = (source.position.y + source.size.height - bounds.minY) * scale + 20;
      const endX = (target.position.x + target.size.width / 2 - bounds.minX) * scale + 20;
      const endY = (target.position.y - bounds.minY) * scale + 20;

      const strokeDasharray =
        edge.style.style === 'dashed' ? '5,5' : edge.style.style === 'dotted' ? '2,2' : '';
      const markerEnd = edge.style.arrow === 'forward' ? 'url(#arrowhead)' : '';

      svg += `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
        stroke="${edge.style.color}" stroke-width="${edge.style.width}" 
        ${strokeDasharray ? `stroke-dasharray="${strokeDasharray}"` : ''}
        ${markerEnd ? `marker-end="${markerEnd}"` : ''} />\n`;

      if (edge.label) {
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        svg += `  <text x="${midX}" y="${midY - 5}" font-family="${options.style.fonts.family}" font-size="10" fill="${options.style.colors.textSecondary}" text-anchor="middle">${edge.label}</text>\n`;
      }
    }

    return svg;
  }

  private renderSVGMetadata(diagram: ArchitectureDiagram, width: number): string {
    return `  <text x="${width / 2}" y="20" font-family="Arial" font-size="12" fill="#757575" text-anchor="middle">${diagram.name}</text>\n`;
  }

  private getDrawIOStyle(nodeType: string): string {
    const styles: Record<string, string> = {
      component: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;',
      service: 'ellipse;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;',
      database:
        'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#f8cecc;strokeColor=#b85450;',
      external: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;dashed=1;',
      container: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;',
      actor:
        'shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;fillColor=#ffe6cc;strokeColor=#d79b00;',
      layer: 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;',
    };
    return styles[nodeType] || styles.component;
  }

  private getDrawIOEdgeStyle(edgeType: string): string {
    const styles: Record<string, string> = {
      dependency: 'endArrow=classic;html=1;strokeColor=#666666;',
      dataflow: 'endArrow=classic;html=1;strokeColor=#2196F3;strokeWidth=2;',
      communication: 'endArrow=classic;html=1;strokeColor=#4CAF50;dashed=1;',
      inheritance: 'endArrow=block;html=1;strokeColor=#9C27B0;endFill=0;',
      implementation: 'endArrow=block;html=1;strokeColor=#FF9800;dashed=1;endFill=0;',
    };
    return styles[edgeType] || styles.dependency;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private generatePlaceholderPNG(diagram: ArchitectureDiagram, options?: ExportOptions): Buffer {
    const svgContent = this.exportToSVG(diagram, options);
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const metadata = {
      diagramId: diagram.id,
      diagramName: diagram.name,
      type: diagram.type,
      nodeCount: diagram.nodes.length,
      edgeCount: diagram.edges.length,
      svgLength: svgContent.length,
      note: 'PNG export requires a canvas library. Use SVG or Mermaid format instead.',
    };

    const textContent = JSON.stringify(metadata, null, 2);
    const textBuffer = Buffer.from(textContent, 'utf-8');

    return Buffer.concat([header, Buffer.from('\n'), textBuffer]);
  }
}
