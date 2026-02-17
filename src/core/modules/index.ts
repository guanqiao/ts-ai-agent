export interface DependencyRule {
  from: string;
  to: string;
  allowed: boolean;
}

export interface ModuleInfo {
  name: string;
  dependencies: string[];
}

export interface DependencyCheckResult {
  source: string;
  target: string;
  allowed: boolean;
  reason: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

export class ModuleDependencyChecker {
  private rules: DependencyRule[];

  constructor(rules: DependencyRule[]) {
    this.rules = rules;
  }

  checkDependency(source: string, target: string): DependencyCheckResult {
    const matchingRules = this.rules.filter(
      (r) =>
        (r.from === source || r.from === '*') &&
        (r.to === target || r.to === '*')
    );

    if (matchingRules.length === 0) {
      return {
        source,
        target,
        allowed: false,
        reason: `No rule found for dependency from '${source}' to '${target}'`,
      };
    }

    const specificRule = matchingRules.find((r) => r.from === source && r.to === target);
    if (specificRule) {
      return {
        source,
        target,
        allowed: specificRule.allowed,
        reason: specificRule.allowed
          ? `Dependency allowed by rule`
          : `Dependency from '${source}' to '${target}' is not allowed`,
      };
    }

    const wildcardTarget = matchingRules.find((r) => r.from === source && r.to === '*');
    if (wildcardTarget) {
      return {
        source,
        target,
        allowed: wildcardTarget.allowed,
        reason: wildcardTarget.allowed
          ? `Dependency allowed by wildcard rule`
          : `Dependency from '${source}' to '${target}' is not allowed`,
      };
    }

    const wildcardSource = matchingRules.find((r) => r.from === '*' && r.to === target);
    if (wildcardSource) {
      return {
        source,
        target,
        allowed: wildcardSource.allowed,
        reason: wildcardSource.allowed
          ? `Dependency allowed by wildcard source rule`
          : `Dependency from '${source}' to '${target}' is not allowed`,
      };
    }

    const allWildcard = matchingRules.find((r) => r.from === '*' && r.to === '*');
    if (allWildcard) {
      return {
        source,
        target,
        allowed: allWildcard.allowed,
        reason: allWildcard.allowed
          ? `Dependency allowed by global wildcard rule`
          : `Dependency from '${source}' to '${target}' is not allowed`,
      };
    }

    return {
      source,
      target,
      allowed: false,
      reason: `Dependency from '${source}' to '${target}' is not allowed`,
    };
  }

  checkModule(module: ModuleInfo): DependencyCheckResult[] {
    const results: DependencyCheckResult[] = [];

    for (const dep of module.dependencies) {
      results.push(this.checkDependency(module.name, dep));
    }

    return results;
  }

  getDependencyGraph(modules: ModuleInfo[]): DependencyGraph {
    const nodes = modules.map((m) => m.name);
    const edges: Array<{ from: string; to: string }> = [];

    for (const module of modules) {
      for (const dep of module.dependencies) {
        edges.push({ from: module.name, to: dep });
      }
    }

    return { nodes, edges };
  }

  detectCycles(modules: ModuleInfo[]): string[][] {
    const graph = new Map<string, string[]>();

    for (const module of modules) {
      graph.set(module.name, module.dependencies);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          const cycle = path.slice(cycleStart);
          cycles.push(cycle);
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const module of modules) {
      if (!visited.has(module.name)) {
        dfs(module.name);
      }
    }

    return cycles;
  }
}
