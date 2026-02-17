import { ModuleDependencyChecker, DependencyRule, ModuleInfo } from '@core/modules';

describe('ModuleDependencyChecker', () => {
  let checker: ModuleDependencyChecker;

  beforeEach(() => {
    const rules: DependencyRule[] = [
      { from: 'core', to: '*', allowed: true },
      { from: 'llm', to: 'core', allowed: true },
      { from: 'llm', to: 'types', allowed: true },
      { from: 'llm', to: 'agents', allowed: false },
      { from: 'agents', to: 'core', allowed: true },
      { from: 'agents', to: 'llm', allowed: true },
      { from: 'agents', to: 'wiki', allowed: false },
      { from: 'wiki', to: 'core', allowed: true },
      { from: 'wiki', to: 'llm', allowed: true },
      { from: 'wiki', to: 'agents', allowed: true },
      { from: 'cli', to: '*', allowed: true },
    ];

    checker = new ModuleDependencyChecker(rules);
  });

  describe('checkDependency', () => {
    it('should allow core to depend on any module', () => {
      const result = checker.checkDependency('core', 'llm');

      expect(result.allowed).toBe(true);
    });

    it('should allow llm to depend on core', () => {
      const result = checker.checkDependency('llm', 'core');

      expect(result.allowed).toBe(true);
    });

    it('should not allow llm to depend on agents', () => {
      const result = checker.checkDependency('llm', 'agents');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    it('should not allow agents to depend on wiki', () => {
      const result = checker.checkDependency('agents', 'wiki');

      expect(result.allowed).toBe(false);
    });

    it('should allow cli to depend on any module', () => {
      const result = checker.checkDependency('cli', 'wiki');

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkModule', () => {
    it('should check all dependencies of a module', () => {
      const module: ModuleInfo = {
        name: 'llm',
        dependencies: ['core', 'types', 'agents'],
      };

      const results = checker.checkModule(module);

      expect(results.length).toBe(3);
      const failedResults = results.filter((r) => !r.allowed);
      expect(failedResults.length).toBe(1);
      expect(failedResults[0].target).toBe('agents');
    });
  });

  describe('getDependencyGraph', () => {
    it('should return dependency graph', () => {
      const modules: ModuleInfo[] = [
        { name: 'core', dependencies: [] },
        { name: 'llm', dependencies: ['core'] },
        { name: 'agents', dependencies: ['core', 'llm'] },
      ];

      const graph = checker.getDependencyGraph(modules);

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(3);
    });
  });

  describe('detectCycles', () => {
    it('should detect no cycles in acyclic graph', () => {
      const modules: ModuleInfo[] = [
        { name: 'core', dependencies: [] },
        { name: 'llm', dependencies: ['core'] },
        { name: 'agents', dependencies: ['core', 'llm'] },
      ];

      const cycles = checker.detectCycles(modules);

      expect(cycles).toHaveLength(0);
    });

    it('should detect cycles in cyclic graph', () => {
      const modules: ModuleInfo[] = [
        { name: 'a', dependencies: ['b'] },
        { name: 'b', dependencies: ['c'] },
        { name: 'c', dependencies: ['a'] },
      ];

      const cycles = checker.detectCycles(modules);

      expect(cycles.length).toBeGreaterThan(0);
    });
  });
});
