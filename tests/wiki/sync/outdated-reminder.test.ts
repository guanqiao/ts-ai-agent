import { OutdatedReminder } from '../../../src/wiki/sync/outdated-reminder';
import { IWikiStorage, WikiPage, WikiPageMetadata } from '../../../src/wiki/types';
import { Language, DocumentFormat } from '../../../src/types';

describe('OutdatedReminder', () => {
  let reminder: OutdatedReminder;
  let mockWikiStorage: jest.Mocked<IWikiStorage>;
  let mockGitService: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createMockPage = (overrides: any = {}): WikiPage => {
    const baseMetadata: WikiPageMetadata = {
      tags: [],
      category: 'reference',
      sourceFiles: [],
      language: Language.TypeScript,
    };

    const base: WikiPage = {
      id: 'page-1',
      title: 'Test Page',
      slug: 'test-page',
      content: 'Test content',
      format: DocumentFormat.Markdown,
      metadata: baseMetadata,
      sections: [],
      links: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    const result = { ...base, ...overrides };
    if (overrides.metadata) {
      result.metadata = { ...baseMetadata, ...overrides.metadata };
    }

    return result;
  };

  beforeEach(() => {
    mockWikiStorage = {
      save: jest.fn(),
      load: jest.fn(),
      savePage: jest.fn(),
      loadPage: jest.fn(),
      deletePage: jest.fn(),
      listPages: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<IWikiStorage>;

    mockGitService = {
      getCommits: jest.fn().mockResolvedValue([]),
    };

    reminder = new OutdatedReminder(mockWikiStorage as any, mockGitService);
  });

  describe('detectOutdatedDocs', () => {
    it('should detect outdated documentation', async () => {
      mockWikiStorage.listPages.mockResolvedValue([
        createMockPage({
          id: 'page-1',
          title: 'UserService',
          metadata: {
            sourceFiles: ['src/services/user.service.ts'],
          },
          updatedAt: new Date('2024-01-01'),
        }),
      ]);

      mockGitService.getCommits.mockResolvedValue([
        {
          hash: 'abc123',
          date: new Date('2024-03-01'),
          message: 'feat: Update UserService',
        },
      ]);

      const result = await reminder.detectOutdatedDocs();

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].pageId).toBe('page-1');
    });

    it('should return empty array when no outdated docs', async () => {
      mockWikiStorage.listPages.mockResolvedValue([
        createMockPage({
          id: 'page-1',
          title: 'Recent Doc',
          metadata: {
            sourceFiles: ['src/services/new.service.ts'],
          },
          updatedAt: new Date(),
        }),
      ]);

      mockGitService.getCommits.mockResolvedValue([]);

      const result = await reminder.detectOutdatedDocs();

      expect(result).toEqual([]);
    });
  });

  describe('calculateOutdatedScore', () => {
    it('should calculate higher score for older docs', () => {
      const oldDate = new Date('2024-01-01');
      const newDate = new Date();

      const oldScore = reminder.calculateOutdatedScore(oldDate, 10);
      const newScore = reminder.calculateOutdatedScore(newDate, 10);

      expect(oldScore).toBeGreaterThan(newScore);
    });

    it('should calculate higher score for more changes', () => {
      const date = new Date('2024-02-01');

      const lowChangeScore = reminder.calculateOutdatedScore(date, 1);
      const highChangeScore = reminder.calculateOutdatedScore(date, 50);

      expect(highChangeScore).toBeGreaterThan(lowChangeScore);
    });
  });

  describe('generateReminders', () => {
    it('should generate reminders for outdated docs', async () => {
      mockWikiStorage.listPages.mockResolvedValue([
        createMockPage({
          id: 'page-1',
          title: 'Old Doc',
          metadata: {
            sourceFiles: ['src/old.ts'],
          },
          updatedAt: new Date('2024-01-01'),
        }),
      ]);

      mockGitService.getCommits.mockResolvedValue([
        {
          hash: 'abc',
          date: new Date('2024-03-01'),
          message: 'Update old.ts',
        },
      ]);

      const reminders = await reminder.generateReminders();

      expect(reminders).toBeDefined();
      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0].type).toBe('outdated-documentation');
    });

    it('should prioritize high-priority reminders', async () => {
      mockWikiStorage.listPages.mockResolvedValue([
        createMockPage({
          id: 'page-1',
          title: 'Very Old Doc',
          metadata: {
            sourceFiles: ['src/very-old.ts'],
          },
          updatedAt: new Date('2023-01-01'),
        }),
        createMockPage({
          id: 'page-2',
          title: 'Slightly Old Doc',
          metadata: {
            sourceFiles: ['src/slightly-old.ts'],
          },
          updatedAt: new Date('2024-01-01'),
        }),
      ]);

      mockGitService.getCommits.mockResolvedValue([
        { hash: '1', date: new Date('2024-03-01'), message: 'Update' },
      ]);

      const reminders = await reminder.generateReminders();

      expect(reminders[0].priority).toBeGreaterThanOrEqual(reminders[1].priority);
    });
  });

  describe('getUserPreferences', () => {
    it('should return default preferences when none set', () => {
      const prefs = reminder.getUserPreferences();

      expect(prefs).toBeDefined();
      expect(prefs.enabled).toBe(true);
      expect(prefs.threshold).toBeDefined();
    });
  });

  describe('setUserPreferences', () => {
    it('should update user preferences', () => {
      reminder.setUserPreferences({
        enabled: false,
        threshold: 30,
      });

      const prefs = reminder.getUserPreferences();

      expect(prefs.enabled).toBe(false);
      expect(prefs.threshold).toBe(30);
    });
  });

  describe('shouldRemind', () => {
    it('should return false when reminders disabled', () => {
      reminder.setUserPreferences({ enabled: false });

      const shouldRemind = reminder.shouldRemind({
        pageId: 'test',
        outdatedDays: 100,
        changeCount: 50,
      });

      expect(shouldRemind).toBe(false);
    });

    it('should return true when threshold exceeded', () => {
      reminder.setUserPreferences({ enabled: true, threshold: 7 });

      const shouldRemind = reminder.shouldRemind({
        pageId: 'test',
        outdatedDays: 30,
        changeCount: 10,
      });

      expect(shouldRemind).toBe(true);
    });
  });

  describe('formatReminder', () => {
    it('should format reminder message', () => {
      const reminderItem = {
        pageId: 'page-1',
        pageTitle: 'Test Page',
        outdatedDays: 30,
        changeCount: 15,
        priority: 0.8,
        type: 'outdated-documentation' as const,
        lastDocUpdate: new Date('2024-01-01'),
        lastCodeChange: new Date('2024-03-01'),
      };

      const formatted = reminder.formatReminder(reminderItem);

      expect(formatted).toContain('Test Page');
      expect(formatted).toContain('30');
      expect(formatted).toContain('15');
    });
  });
});
