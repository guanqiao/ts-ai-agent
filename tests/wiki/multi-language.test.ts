import { WikiStorage } from '../../src/wiki/wiki-storage';
import { WikiPage, WikiDocument, WikiLanguage, WikiOptions } from '../../src/wiki/types';
import { DocumentFormat, Language } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('Wiki Multi-Language Support', () => {
  const testStoragePath = path.join(__dirname, 'test-multi-lang-wiki');

  beforeEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testStoragePath)) {
      fs.rmSync(testStoragePath, { recursive: true, force: true });
    }
  });

  describe('WikiLanguage Enum', () => {
    it('should have English and Chinese language options', () => {
      expect(WikiLanguage.English).toBe('en');
      expect(WikiLanguage.Chinese).toBe('zh');
    });
  });

  describe('WikiOptions with wikiLanguages', () => {
    it('should accept wikiLanguages configuration', () => {
      const options: WikiOptions = {
        outputDir: './wiki',
        format: DocumentFormat.Markdown,
        wikiLanguages: [WikiLanguage.English, WikiLanguage.Chinese],
      };

      expect(options.wikiLanguages).toEqual([WikiLanguage.English, WikiLanguage.Chinese]);
    });

    it('should default to undefined when wikiLanguages not provided', () => {
      const options: WikiOptions = {
        outputDir: './wiki',
        format: DocumentFormat.Markdown,
      };

      expect(options.wikiLanguages).toBeUndefined();
    });
  });

  describe('WikiStorage with multi-language', () => {
    it('should save and load English wiki document', async () => {
      const storage = new WikiStorage(testStoragePath, WikiLanguage.English);
      const document: WikiDocument = {
        id: 'test-wiki-en',
        name: 'Test Wiki (English)',
        description: 'An English test wiki',
        pages: [],
        index: {
          pages: [],
          categories: [],
          searchIndex: [],
        },
        metadata: {
          projectName: 'Test Project',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 0,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.save(document);
      const loaded = await storage.load(testStoragePath);

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('Test Wiki (English)');
      expect(fs.existsSync(path.join(testStoragePath, '.wiki', 'en'))).toBe(true);
    });

    it('should save and load Chinese wiki document', async () => {
      const storage = new WikiStorage(testStoragePath, WikiLanguage.Chinese);
      const document: WikiDocument = {
        id: 'test-wiki-zh',
        name: '测试 Wiki (中文)',
        description: '一个中文测试 wiki',
        pages: [],
        index: {
          pages: [],
          categories: [],
          searchIndex: [],
        },
        metadata: {
          projectName: '测试项目',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 0,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.save(document);
      const loaded = await storage.load(testStoragePath);

      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe('测试 Wiki (中文)');
      expect(fs.existsSync(path.join(testStoragePath, '.wiki', 'zh'))).toBe(true);
    });

    it('should create separate directories for each language', async () => {
      const storageEn = new WikiStorage(testStoragePath, WikiLanguage.English);
      const storageZh = new WikiStorage(testStoragePath, WikiLanguage.Chinese);

      const docEn: WikiDocument = {
        id: 'en',
        name: 'English Wiki',
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

      const docZh: WikiDocument = {
        id: 'zh',
        name: '中文 Wiki',
        pages: [],
        index: { pages: [], categories: [], searchIndex: [] },
        metadata: {
          projectName: '测试',
          generator: 'tsd-generator',
          generatorVersion: '1.0.0',
          totalFiles: 0,
          totalSymbols: 0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageEn.save(docEn);
      await storageZh.save(docZh);

      expect(fs.existsSync(path.join(testStoragePath, '.wiki', 'en'))).toBe(true);
      expect(fs.existsSync(path.join(testStoragePath, '.wiki', 'zh'))).toBe(true);
    });
  });

  describe('WikiPage with wikiLanguage metadata', () => {
    it('should support wikiLanguage in page metadata', async () => {
      const storage = new WikiStorage(testStoragePath, WikiLanguage.Chinese);
      const page: WikiPage = {
        id: 'test-page-zh',
        title: '测试页面',
        slug: 'test-page',
        content: '# 测试\n\n这是一个测试页面。',
        format: DocumentFormat.Markdown,
        metadata: {
          tags: ['test', '中文'],
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

      await storage.savePage(page);
      const loaded = await storage.loadPage('test-page-zh');

      expect(loaded).toBeDefined();
      expect(loaded?.title).toBe('测试页面');
    });
  });
});
