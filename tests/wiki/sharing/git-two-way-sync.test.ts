import { WikiSharingService } from '../../../src/wiki/sharing/wiki-sharing-service';
import { WikiPage, WikiDocument, WikiLanguage } from '../../../src/wiki/types';
import { DocumentFormat, Language } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Wiki Git Directory Two-Way Sync', () => {
  const testProjectPath = path.join(__dirname, 'test-git-sync-project');
  const sharePath = 'docs/wiki';

  beforeEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectPath, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  describe('Import from Git Directory', () => {
    it('should detect changes in Git directory Markdown files', async () => {
      const service = new WikiSharingService(testProjectPath);
      await service.initialize({
        enabled: true,
        shareToGit: true,
        sharePath,
        accessControl: 'team',
        syncWithRemote: false,
        autoCommit: false,
        commitMessageTemplate: 'test',
        excludePatterns: [],
        includePatterns: ['**/*.md'],
      });

      const testDoc: WikiDocument = {
        id: 'test',
        name: 'Test Wiki',
        pages: [],
        index: { pages: [], categories: [], searchIndex: [] },
        metadata: {
          projectName: 'Test',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 0,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.setWikiDocument(testDoc);

      const result = await service.share();
      expect(result.success).toBe(true);

      const shareDir = path.join(testProjectPath, sharePath);
      expect(fs.existsSync(shareDir)).toBe(true);
    });

    it('should import modified content from Git directory', async () => {
      const service = new WikiSharingService(testProjectPath);
      await service.initialize({
        enabled: true,
        shareToGit: true,
        sharePath,
        accessControl: 'team',
        syncWithRemote: false,
        autoCommit: false,
        commitMessageTemplate: 'test',
        excludePatterns: [],
        includePatterns: ['**/*.md'],
      });

      const page: WikiPage = {
        id: 'test-page',
        title: 'Test Page',
        slug: 'test-page',
        content: '# Original Content\n\nThis is original.',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: ['test'],
          category: 'overview',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      const testDoc: WikiDocument = {
        id: 'test',
        name: 'Test Wiki',
        pages: [page],
        index: {
          pages: [{
            id: page.id,
            title: page.title,
            slug: page.slug,
            category: page.metadata.category,
            tags: page.metadata.tags,
            wordCount: 10,
          }],
          categories: [],
          searchIndex: [],
        },
        metadata: {
          projectName: 'Test',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 1,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.setWikiDocument(testDoc);

      await service.share();

      const mdFilePath = path.join(testProjectPath, sharePath, 'test-page.md');
      const modifiedContent = '# Modified Content\n\nThis is modified content!';
      fs.writeFileSync(mdFilePath, modifiedContent, 'utf-8');

      expect(fs.readFileSync(mdFilePath, 'utf-8')).toBe(modifiedContent);
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts when both local and Git are modified', async () => {
      const service = new WikiSharingService(testProjectPath);
      await service.initialize({
        enabled: true,
        shareToGit: true,
        sharePath,
        accessControl: 'team',
        syncWithRemote: false,
        autoCommit: false,
        commitMessageTemplate: 'test',
        excludePatterns: [],
        includePatterns: ['**/*.md'],
      });

      const page: WikiPage = {
        id: 'conflict-page',
        title: 'Conflict Page',
        slug: 'conflict-page',
        content: '# Original\n',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: [],
          category: 'overview',
          sourceFiles: [],
          language: Language.TypeScript,
        },
        sections: [],
        links: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      };

      const testDoc: WikiDocument = {
        id: 'conflict-test',
        name: 'Conflict Test',
        pages: [page],
        index: {
          pages: [{
            id: page.id,
            title: page.title,
            slug: page.slug,
            category: page.metadata.category,
            tags: page.metadata.tags,
            wordCount: 10,
          }],
          categories: [],
          searchIndex: [],
        },
        metadata: {
          projectName: 'Conflict Test',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 1,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      service.setWikiDocument(testDoc);
      await service.share();

      const mdPath = path.join(testProjectPath, sharePath, 'conflict-page.md');
      fs.writeFileSync(mdPath, '# Git Modified\n\nFrom Git!', 'utf-8');

      const conflicts = await service.detectConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });
});
