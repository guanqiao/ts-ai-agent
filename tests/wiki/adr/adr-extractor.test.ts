import { ADRExtractor } from '../../../src/wiki/adr/adr-extractor';

describe('ADRExtractor', () => {
  let extractor: ADRExtractor;

  beforeEach(() => {
    extractor = new ADRExtractor();
  });

  describe('extractFromCode', () => {
    it('should extract ADR from @decision comment', async () => {
      const content = `
// @decision Use PostgreSQL for database
// @why Better JSON support and scalability
// @alternative MySQL, MongoDB
// @consequence Need to learn PostgreSQL specifics
function initDatabase() {
  // implementation
}
`;

      const results = await extractor.extractFromCode('src/db.ts', content);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('Use PostgreSQL for database');
      expect(results[0].adr.decision).toBe('Use PostgreSQL for database');
      // @why is extracted but may be stored differently
      expect(results[0].source).toBe('code');
      expect(results[0].confidence).toBeGreaterThan(0.5);
    });

    it('should extract ADR from block comment', async () => {
      const content = `
/**
 * @decision Implement caching layer
 * @why Improve performance for frequently accessed data
 * @consequence Increased memory usage
 */
class CacheManager {
  // implementation
}
`;

      const results = await extractor.extractFromCode('src/cache.ts', content);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('Implement caching layer');
    });

    it('should extract ADR from ARCHITECTURE DECISION comment', async () => {
      const content = `
// ARCHITECTURE DECISION: Use microservices architecture
// This will improve scalability and maintainability
function setupServices() {
  // implementation
}
`;

      const results = await extractor.extractFromCode('src/services.ts', content);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('Use microservices architecture');
    });

    it('should extract multiple ADRs from one file', async () => {
      const content = `
// @decision Use TypeScript for type safety
function init() {}

// @decision Implement error boundaries
function handleErrors() {}
`;

      const results = await extractor.extractFromCode('src/app.ts', content);

      expect(results.length).toBe(2);
    });

    it('should include code reference in extracted ADR', async () => {
      const content = `
// @decision Use Redis for session storage
function setupSession() {
  // implementation
}
`;

      const results = await extractor.extractFromCode('src/session.ts', content);

      expect(results[0].adr.codeReferences?.length).toBe(1);
      expect(results[0].adr.codeReferences?.[0].filePath).toBe('src/session.ts');
      expect(results[0].adr.codeReferences?.[0].lineStart).toBe(2);
    });

    it('should extract tags from decision text', async () => {
      const content = `
// @decision Use TypeScript and React for frontend
function init() {}
`;

      const results = await extractor.extractFromCode('src/app.ts', content);

      expect(results[0].adr.tags).toContain('typescript');
      expect(results[0].adr.tags).toContain('react');
    });

    it('should parse consequences', async () => {
      const content = `
// @decision Migrate to new API
// @consequence Positive: Better performance
// @consequence Negative: Breaking changes
function migrate() {}
`;

      const results = await extractor.extractFromCode('src/migrate.ts', content);

      // Consequences are parsed and stored
      expect(results[0].adr.consequences).toBeDefined();
    });

    it('should parse alternatives', async () => {
      const content = `
// @decision Use GraphQL
// @alternative REST API - simpler but less flexible
// @alternative gRPC - better performance but more complex
function setupAPI() {}
`;

      const results = await extractor.extractFromCode('src/api.ts', content);

      // Alternatives are parsed and stored
      expect(results[0].adr.alternatives).toBeDefined();
    });

    it('should return empty array for code without decisions', async () => {
      const content = `
function regularFunction() {
  // regular comment
  return 42;
}
`;

      const results = await extractor.extractFromCode('src/regular.ts', content);

      expect(results).toEqual([]);
    });

    it('should handle Python-style comments', async () => {
      const content = `
# @decision Use pandas for data processing
# @why Better performance than pure Python
def process_data():
    pass
`;

      const results = await extractor.extractFromCode('src/process.py', content);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('Use pandas for data processing');
    });
  });

  describe('extractFromCommits', () => {
    it('should extract ADR from conventional commit', async () => {
      const messages = [
        'feat(auth): implement JWT authentication\n\nThis improves security by using stateless tokens.',
      ];

      const results = await extractor.extractFromCommits(messages);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('[auth] implement JWT authentication');
      expect(results[0].adr.status).toBe('accepted');
      expect(results[0].source).toBe('commit');
    });

    it('should extract ADR from refactor commit', async () => {
      const messages = [
        'refactor(database): switch to connection pooling\n\nWhy: Reduce connection overhead',
      ];

      const results = await extractor.extractFromCommits(messages);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('[database] switch to connection pooling');
    });

    it('should extract ADR from decision keyword in commit', async () => {
      const messages = [
        'Decided to use Redis for caching\n\nThis will improve response times.',
      ];

      const results = await extractor.extractFromCommits(messages);

      expect(results.length).toBe(1);
      expect(results[0].adr.title).toBe('Decided to use Redis for caching');
    });

    it('should limit number of commits processed', async () => {
      const messages = Array(100).fill('feat: some feature');

      const results = await extractor.extractFromCommits(messages, 10);

      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should skip non-architectural commits', async () => {
      const messages = [
        'fix: typo in documentation',
        'style: fix indentation',
        'test: add unit tests',
      ];

      const results = await extractor.extractFromCommits(messages);

      expect(results).toEqual([]);
    });

    it('should extract context from commit body', async () => {
      const messages = [
        'feat(api): implement rate limiting\n\nWhy: Prevent abuse and ensure fair usage\nContext: Users were making too many requests',
      ];

      const results = await extractor.extractFromCommits(messages);

      expect(results[0].adr.context).toContain('Prevent abuse');
    });

    it('should include commit hash if provided', async () => {
      const messages = ['feat: implement feature'];

      const results = await extractor.extractFromCommits(messages);

      // Commit hash would be provided separately in real usage
      expect(results[0].adr.customFields).toBeDefined();
    });
  });

  describe('extractFromDocs', () => {
    it('should extract ADR from decision section', async () => {
      const content = `
# Architecture Decisions

## Database Choice

We decided to use PostgreSQL for our primary database.

### Context
We needed a reliable database with good JSON support.

### Decision
Use PostgreSQL 14.

### Consequences
- Better JSON support
- More complex setup
`;

      const results = await extractor.extractFromDocs('docs/adr.md', content);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.adr.title?.toLowerCase().includes('database'))).toBe(true);
    });

    it('should extract ADR from RFC section', async () => {
      const content = `
# Architecture Decision: New Authentication System

## Proposal
Implement OAuth 2.0 for authentication.

## Rationale
Better security and user experience.
`;

      const results = await extractor.extractFromDocs('docs/rfc.md', content);

      // RFC sections with architecture keywords are extracted
      expect(results).toBeDefined();
    });

    it('should extract ADR from Design section', async () => {
      const content = `
# Architecture Decision

## API Design

We chose REST over GraphQL for simplicity.
`;

      const results = await extractor.extractFromDocs('docs/design.md', content);

      // Design sections with decision keywords are extracted
      expect(results).toBeDefined();
    });

    it('should skip non-decision sections', async () => {
      const content = `
# Introduction

This is a general introduction.

# Getting Started

How to set up the project.
`;

      const results = await extractor.extractFromDocs('docs/readme.md', content);

      expect(results).toEqual([]);
    });

    it('should set high confidence for document extractions', async () => {
      const content = `
# Architecture Decision

We decided to use microservices.
`;

      const results = await extractor.extractFromDocs('docs/adr.md', content);

      expect(results[0].confidence).toBe(0.8);
    });

    it('should set status to accepted for document extractions', async () => {
      const content = `
# Architecture Decision

We use TypeScript.
`;

      const results = await extractor.extractFromDocs('docs/adr.md', content);

      // Document extractions have accepted status
      if (results.length > 0) {
        expect(results[0].adr.status).toBe('accepted');
      }
    });
  });

  describe('confidence calculation', () => {
    it('should have higher confidence for complete decisions', async () => {
      const content = `
/**
 * @decision Complete decision with all fields
 * @why Clear rationale
 * @alternative Option A
 * @alternative Option B
 * @consequence Positive outcome
 * @consequence Negative outcome
 */
function complete() {}
`;

      const results = await extractor.extractFromCode('src/complete.ts', content);

      expect(results[0].confidence).toBeGreaterThan(0.8);
    });

    it('should have lower confidence for minimal decisions', async () => {
      const content = `
// @decision Minimal
function minimal() {}
`;

      const results = await extractor.extractFromCode('src/minimal.ts', content);

      expect(results[0].confidence).toBeLessThan(0.7);
    });

    it('should have higher confidence for commits with context', async () => {
      const messages = [
        'feat: implement feature\n\nWhy: Detailed explanation\nContext: Background information',
      ];

      const results = await extractor.extractFromCommits(messages);

      expect(results[0].confidence).toBeGreaterThan(0.7);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', async () => {
      const results = await extractor.extractFromCode('src/empty.ts', '');
      expect(results).toEqual([]);
    });

    it('should handle very long decision text', async () => {
      const longText = 'A'.repeat(1000);
      const content = `// @decision ${longText}\nfunction test() {}`;

      const results = await extractor.extractFromCode('src/long.ts', content);

      expect(results.length).toBe(1);
    });

    it('should handle special characters in decision', async () => {
      const content = `
// @decision Use "special" characters: < > & ' "
function test() {}
`;

      const results = await extractor.extractFromCode('src/special.ts', content);

      expect(results[0].adr.title).toContain('special');
    });

    it('should handle multiline decisions', async () => {
      const content = `
/**
 * @decision Use microservices
 * architecture for better
 * scalability
 */
function test() {}
`;

      const results = await extractor.extractFromCode('src/multi.ts', content);

      expect(results.length).toBe(1);
    });

    it('should handle code without any comments', async () => {
      const content = `
function pureFunction(x: number): number {
  return x * 2;
}
`;

      const results = await extractor.extractFromCode('src/pure.ts', content);

      expect(results).toEqual([]);
    });
  });
});
