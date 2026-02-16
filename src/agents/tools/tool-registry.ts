import { Tool, ToolDefinition } from './types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  clear(): void {
    this.tools.clear();
  }

  get size(): number {
    return this.tools.size;
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  getToolByName(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getToolsByCategory(_category: string): Tool[] {
    return this.list();
  }
}
