import { KnowledgeGraphService } from '../../../src/wiki/knowledge/knowledge-graph-service';

describe('KnowledgeGraphService', () => {
  let service: KnowledgeGraphService;

  beforeEach(() => {
    service = new KnowledgeGraphService();
  });

  describe('build', () => {
    it('should build an empty knowledge graph', async () => {
      const graph = await service.build();

      expect(graph).toBeDefined();
      expect(graph.nodes).toBeInstanceOf(Array);
      expect(graph.edges).toBeInstanceOf(Array);
      expect(graph.clusters).toBeInstanceOf(Array);
      expect(graph.metadata).toBeDefined();
      expect(graph.metadata.totalNodes).toBe(0);
      expect(graph.metadata.totalEdges).toBe(0);
      expect(graph.metadata.totalClusters).toBe(0);
      expect(graph.metadata.buildTime).toBeInstanceOf(Date);
    });
  });

  describe('query', () => {
    it('should query the knowledge graph', async () => {
      // First build the graph
      await service.build();

      const results = await service.query('test');

      expect(results).toBeInstanceOf(Array);
    });

    it('should query with limit option', async () => {
      await service.build();

      const results = await service.query('test', { limit: 5 });

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should query with types filter', async () => {
      await service.build();

      const results = await service.query('test', { types: ['concept', 'api'] });

      expect(results).toBeInstanceOf(Array);
    });

    it('should query with clusters filter', async () => {
      await service.build();

      const results = await service.query('test', { clusters: ['cluster1'] });

      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('export', () => {
    it('should export to JSON format', async () => {
      await service.build();

      const jsonOutput = await service.export('json');
      expect(jsonOutput).toBeDefined();
      expect(typeof jsonOutput).toBe('string');

      const parsed = JSON.parse(jsonOutput);
      expect(parsed).toHaveProperty('nodes');
      expect(parsed).toHaveProperty('edges');
      expect(parsed).toHaveProperty('clusters');
      expect(parsed).toHaveProperty('metadata');
    });

    it('should export to CSV format', async () => {
      await service.build();

      const csvOutput = await service.export('csv');
      expect(csvOutput).toBeDefined();
      expect(typeof csvOutput).toBe('string');
      expect(csvOutput).toContain('id,type,title,description,tags,weight,relatedCount');
    });

    it('should export to GraphML format', async () => {
      await service.build();

      const graphmlOutput = await service.export('graphml');
      expect(graphmlOutput).toBeDefined();
      expect(typeof graphmlOutput).toBe('string');
      expect(graphmlOutput).toContain('<graphml');
      expect(graphmlOutput).toContain('</graphml>');
    });

    it('should throw error for unsupported format', async () => {
      await service.build();

      // @ts-ignore - Testing invalid format
      await expect(service.export('invalid')).rejects.toThrow('Unsupported export format: invalid');
    });
  });

  describe('getRelatedNodes', () => {
    it('should get related nodes', async () => {
      await service.build();

      const relatedNodes = await service.getRelatedNodes('node1');
      expect(relatedNodes).toBeInstanceOf(Array);
    });

    it('should get related nodes with limit', async () => {
      await service.build();

      const relatedNodes = await service.getRelatedNodes('node1', 5);
      expect(relatedNodes).toBeInstanceOf(Array);
      expect(relatedNodes.length).toBeLessThanOrEqual(5);
    });
  });

  describe('getClusters', () => {
    it('should get clusters', async () => {
      await service.build();

      const clusters = await service.getClusters();
      expect(clusters).toBeInstanceOf(Array);
    });
  });

  describe('getNodeById', () => {
    it('should get node by id', async () => {
      await service.build();

      const node = await service.getNodeById('node1');
      expect(node).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should throw error when graph not built', async () => {
      await expect(service.query('test')).rejects.toThrow('Knowledge graph not built yet');
      await expect(service.export('json')).rejects.toThrow('Knowledge graph not built yet');
      await expect(service.getRelatedNodes('node1')).rejects.toThrow('Knowledge graph not built yet');
      await expect(service.getClusters()).rejects.toThrow('Knowledge graph not built yet');
      await expect(service.getNodeById('node1')).rejects.toThrow('Knowledge graph not built yet');
    });
  });
});
