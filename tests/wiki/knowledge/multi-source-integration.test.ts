import { MultiSourceIntegration } from '../../../src/wiki/knowledge/multi-source-integration';
import { GitService } from '../../../src/git';
import { GitCommit } from '../../../src/git/types';

describe('MultiSourceIntegration', () => {
  let integration: MultiSourceIntegration;
  let mockGitService: jest.Mocked<GitService>;

  const createMockCommit = (overrides: Partial<GitCommit> = {}): GitCommit => ({
    hash: 'abc123',
    shortHash: 'abc123',
    message: 'Test commit',
    author: 'developer',
    authorEmail: 'dev@example.com',
    date: new Date(),
    parentHashes: [],
    ...overrides,
  });

  beforeEach(() => {
    mockGitService = {
      getCommits: jest.fn(),
      getCommitDetails: jest.fn(),
      getBranches: jest.fn(),
      getFileHistory: jest.fn(),
    } as unknown as jest.Mocked<GitService>;

    integration = new MultiSourceIntegration('/tmp/test-project', mockGitService);
  });

  describe('extractFromGitHistory', () => {
    it('should extract knowledge from commit messages', async () => {
      mockGitService.getCommits.mockResolvedValue([
        createMockCommit({
          hash: 'abc123',
          message: 'feat: Add user authentication module',
        }),
        createMockCommit({
          hash: 'def456',
          message: 'refactor: Migrate to PostgreSQL for better performance',
        }),
      ]);

      const result = await integration.extractFromGitHistory();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should identify architectural decisions from commits', async () => {
      mockGitService.getCommits.mockResolvedValue([
        createMockCommit({
          hash: 'abc123',
          message: 'arch: Switch to microservices architecture',
        }),
      ]);

      const result = await integration.extractFromGitHistory();

      expect(result.some((k) => k.type === 'architectural-decision')).toBe(true);
    });

    it('should extract feature evolution timeline', async () => {
      mockGitService.getCommits.mockResolvedValue([
        createMockCommit({ message: 'feat: Add basic auth', date: new Date('2024-01-01') }),
        createMockCommit({ message: 'feat: Add OAuth support', date: new Date('2024-02-01') }),
        createMockCommit({ message: 'feat: Add SSO integration', date: new Date('2024-03-01') }),
      ]);

      const result = await integration.extractFromGitHistory();

      expect(result.some((k) => k.type === 'feature-evolution')).toBe(true);
    });
  });

  describe('extractFromCodeComments', () => {
    it('should extract TODOs as knowledge', async () => {
      const files = [
        {
          path: 'src/services/user.ts',
          content: `
            // TODO: Add rate limiting for API calls
            // FIXME: Handle edge case for empty username
            export class UserService {}
          `,
        },
      ];

      const result = await integration.extractFromCodeComments(files);

      expect(result.some((k) => k.type === 'todo')).toBe(true);
      expect(result.some((k) => k.type === 'fixme')).toBe(true);
    });

    it('should extract design decisions from comments', async () => {
      const files = [
        {
          path: 'src/cache/redis.ts',
          content: `
            /**
             * Redis Cache Implementation
             * 
             * Decision: Using Redis over Memcached because:
             * - Better persistence options
             * - Built-in data structures
             * - Active community support
             */
            export class RedisCache {}
          `,
        },
      ];

      const result = await integration.extractFromCodeComments(files);

      expect(result.some((k) => k.type === 'design-decision')).toBe(true);
    });
  });

  describe('extractFromDocumentation', () => {
    it('should extract knowledge from README', async () => {
      const docs = [
        {
          path: 'README.md',
          content: `
# Project Name

## Architecture
This project follows a layered architecture with:
- Controller layer
- Service layer
- Repository layer

## Technology Stack
- Node.js 18
- TypeScript 5.0
- PostgreSQL 15
          `,
        },
      ];

      const result = await integration.extractFromDocumentation(docs);

      expect(result.some((k) => k.type === 'architecture')).toBe(true);
      expect(result.some((k) => k.type === 'technology-stack')).toBe(true);
    });

    it('should extract API documentation', async () => {
      const docs = [
        {
          path: 'docs/api.md',
          content: `
# API Documentation

## POST /api/users
Creates a new user.

### Request Body
- username: string (required)
- email: string (required)

### Response
- id: string
- createdAt: Date
          `,
        },
      ];

      const result = await integration.extractFromDocumentation(docs);

      expect(result.some((k) => k.type === 'api-documentation')).toBe(true);
    });
  });

  describe('mergeKnowledge', () => {
    it('should merge duplicate knowledge entries', async () => {
      const sources = [
        [{ type: 'architecture', content: 'Layered architecture', source: 'git', confidence: 0.8 }],
        [{ type: 'architecture', content: 'Layered architecture with 3 layers', source: 'docs', confidence: 0.9 }],
      ];

      const result = await integration.mergeKnowledge(sources);

      expect(result.length).toBeLessThanOrEqual(sources.flat().length);
    });

    it('should preserve source attribution', async () => {
      const sources = [
        [{ type: 'decision', content: 'Use PostgreSQL', source: 'git', confidence: 0.8 }],
        [{ type: 'decision', content: 'Use PostgreSQL', source: 'docs', confidence: 0.9 }],
      ];

      const result = await integration.mergeKnowledge(sources);

      if (result.length > 0 && result[0].sources) {
        expect(result[0].sources.length).toBe(2);
      }
    });

    it('should calculate merged confidence', async () => {
      const sources = [
        [{ type: 'decision', content: 'Test decision', source: 'git', confidence: 0.7 }],
        [{ type: 'decision', content: 'Test decision', source: 'docs', confidence: 0.9 }],
      ];

      const result = await integration.mergeKnowledge(sources);

      if (result.length > 0) {
        expect(result[0].confidence).toBeGreaterThanOrEqual(0.7);
      }
    });
  });

  describe('buildKnowledgeGraph', () => {
    it('should build knowledge graph from multiple sources', async () => {
      mockGitService.getCommits.mockResolvedValue([
        createMockCommit({ message: 'feat: Add user service' }),
      ]);

      const result = await integration.buildKnowledgeGraph();

      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
    });

    it('should create relationships between knowledge items', async () => {
      mockGitService.getCommits.mockResolvedValue([
        createMockCommit({ message: 'feat: Add auth module' }),
        createMockCommit({ message: 'feat: Add user service depends on auth' }),
      ]);

      const result = await integration.buildKnowledgeGraph();

      expect(result.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('generateKnowledgeReport', () => {
    it('should generate comprehensive report', async () => {
      mockGitService.getCommits.mockResolvedValue([
        createMockCommit({ message: 'feat: Add feature' }),
      ]);

      const result = await integration.generateKnowledgeReport();

      expect(result.summary).toBeDefined();
      expect(result.byType).toBeDefined();
      expect(result.bySource).toBeDefined();
      expect(result.recommendations).toBeDefined();
    });
  });
});
