import { ChangelogGenerator } from '../../src/changelog/changelog-generator';
import { 
  ChangelogEntry, 
  ChangelogConfig, 
  ChangeType, 
  Changelog,
  ChangelogVersion,
  DEFAULT_CHANGELOG_CONFIG,
  ConventionalCommit,
  CommitReference,
} from '../../src/changelog/types';

describe('ChangelogGenerator', () => {
  let generator: ChangelogGenerator;
  let config: ChangelogConfig;

  beforeEach(() => {
    config = { ...DEFAULT_CHANGELOG_CONFIG };
    generator = new ChangelogGenerator(config);
  });

  describe('generate', () => {
    it('should generate changelog from commits', async () => {
      const commits: ConventionalCommit[] = [
        {
          type: 'feat',
          description: 'Add new feature',
          raw: 'feat: Add new feature',
          hash: 'abc123',
          author: 'Test Author',
          date: new Date('2024-01-15'),
        },
        {
          type: 'fix',
          description: 'Fix bug in parser',
          scope: 'parser',
          raw: 'fix(parser): Fix bug in parser',
          hash: 'def456',
          author: 'Test Author',
          date: new Date('2024-01-15'),
        },
      ];

      const result = await generator.generate(commits, config);

      expect(result).toBeDefined();
      expect(result.title).toBe('Changelog');
      expect(result.versions).toBeDefined();
    });

    it('should handle empty commits', async () => {
      const result = await generator.generate([], config);

      expect(result).toBeDefined();
      expect(result.versions).toBeDefined();
    });

    it('should handle breaking changes', async () => {
      const commits: ConventionalCommit[] = [
        {
          type: 'feat',
          description: 'Breaking API change',
          breakingChange: true,
          breakingChangeNote: 'API endpoint renamed',
          raw: 'feat!: Breaking API change',
          hash: 'abc123',
          author: 'Test Author',
          date: new Date('2024-01-15'),
        },
      ];

      const result = await generator.generate(commits, config);

      expect(result).toBeDefined();
    });
  });

  describe('generateForVersion', () => {
    it('should generate version section', async () => {
      const commits: ConventionalCommit[] = [
        {
          type: 'feat',
          description: 'New feature',
          raw: 'feat: New feature',
          hash: 'abc123',
          author: 'Test Author',
          date: new Date('2024-01-15'),
        },
      ];

      const result = await generator.generateForVersion(commits, '1.0.0');

      expect(result).toBeDefined();
      expect(result.version).toBe('1.0.0');
      expect(result.sections).toBeDefined();
    });
  });
});

describe('ChangelogEntry', () => {
  it('should have required properties', () => {
    const commit: CommitReference = {
      hash: 'abc123def456',
      shortHash: 'abc123',
    };

    const entry: ChangelogEntry = {
      type: 'feat',
      description: 'Test feature',
      breaking: false,
      commit,
    };

    expect(entry.type).toBe('feat');
    expect(entry.description).toBe('Test feature');
    expect(entry.breaking).toBe(false);
    expect(entry.commit.hash).toBe('abc123def456');
  });

  it('should support optional properties', () => {
    const commit: CommitReference = {
      hash: 'abc123',
      shortHash: 'abc',
      url: 'https://github.com/test/test/commit/abc123',
    };

    const entry: ChangelogEntry = {
      type: 'fix',
      scope: 'parser',
      description: 'Fix parsing bug',
      breaking: false,
      commit,
      issues: ['#123', '#456'],
    };

    expect(entry.scope).toBe('parser');
    expect(entry.issues).toEqual(['#123', '#456']);
  });
});

describe('ChangeType', () => {
  it('should support all conventional commit types', () => {
    const types: ChangeType[] = [
      'feat',
      'fix',
      'docs',
      'style',
      'refactor',
      'perf',
      'test',
      'build',
      'ci',
      'chore',
      'revert',
    ];

    types.forEach(type => {
      expect(['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']).toContain(type);
    });
  });
});

describe('DEFAULT_CHANGELOG_CONFIG', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_CHANGELOG_CONFIG.title).toBe('Changelog');
    expect(DEFAULT_CHANGELOG_CONFIG.includeUnreleased).toBe(true);
    expect(DEFAULT_CHANGELOG_CONFIG.includeCommitLinks).toBe(true);
    expect(DEFAULT_CHANGELOG_CONFIG.maxVersions).toBe(50);
  });

  it('should have all change types configured', () => {
    expect(DEFAULT_CHANGELOG_CONFIG.types.length).toBe(11);
    expect(DEFAULT_CHANGELOG_CONFIG.types.find(t => t.type === 'feat')).toBeDefined();
    expect(DEFAULT_CHANGELOG_CONFIG.types.find(t => t.type === 'fix')).toBeDefined();
  });
});

describe('ConventionalCommit', () => {
  it('should have required properties', () => {
    const commit: ConventionalCommit = {
      type: 'feat',
      description: 'Add feature',
      raw: 'feat: Add feature',
      hash: 'abc123',
      author: 'Test Author',
      date: new Date(),
    };

    expect(commit.type).toBe('feat');
    expect(commit.description).toBe('Add feature');
    expect(commit.hash).toBe('abc123');
    expect(commit.author).toBe('Test Author');
  });

  it('should support optional properties', () => {
    const commit: ConventionalCommit = {
      type: 'feat',
      scope: 'core',
      description: 'Add feature',
      body: 'Detailed description',
      breakingChange: true,
      breakingChangeNote: 'API changed',
      issues: ['#123'],
      raw: 'feat(core)!: Add feature\n\nDetailed description\n\nBREAKING CHANGE: API changed',
      hash: 'abc123',
      author: 'Test Author',
      date: new Date(),
    };

    expect(commit.scope).toBe('core');
    expect(commit.body).toBe('Detailed description');
    expect(commit.breakingChangeNote).toBe('API changed');
    expect(commit.issues).toEqual(['#123']);
  });
});

describe('ChangelogVersion', () => {
  it('should have correct structure', () => {
    const version: ChangelogVersion = {
      version: '1.0.0',
      date: new Date('2024-01-15'),
      sections: [],
    };

    expect(version.version).toBe('1.0.0');
    expect(version.sections).toEqual([]);
  });
});

describe('Changelog', () => {
  it('should have correct structure', () => {
    const changelog: Changelog = {
      title: 'Changelog',
      versions: [],
      unreleased: [],
      generatedAt: new Date(),
    };

    expect(changelog.title).toBe('Changelog');
    expect(changelog.versions).toEqual([]);
    expect(changelog.unreleased).toEqual([]);
  });
});
