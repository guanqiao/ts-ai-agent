import * as fs from 'fs';
import * as path from 'path';
import { IWikiStorage, WikiDocument, WikiPage, WikiDocumentMetadata, WikiIndex, WikiLanguage } from './types';
import { logger } from '../utils/logger';

interface StoredDocument {
  id: string;
  name: string;
  description?: string;
  metadata: WikiDocumentMetadata;
  createdAt: string;
  updatedAt: string;
}

export class WikiStorage implements IWikiStorage {
  private storagePath: string;
  private wikiLanguage: WikiLanguage;
  private wikiDir: string;
  private indexPath: string;
  private metadataPath: string;
  private documentPath: string;

  constructor(projectPath: string, wikiLanguage: WikiLanguage = WikiLanguage.English) {
    this.storagePath = path.join(projectPath, '.wiki');
    this.wikiLanguage = wikiLanguage;
    const languageDir = path.join(this.storagePath, wikiLanguage);
    this.wikiDir = path.join(languageDir, 'pages');
    this.indexPath = path.join(languageDir, 'index.json');
    this.metadataPath = path.join(languageDir, 'metadata.json');
    this.documentPath = path.join(languageDir, 'document.json');
  }

  async save(document: WikiDocument): Promise<void> {
    await this.ensureStorageExists();

    const storedDoc: StoredDocument = {
      id: document.id,
      name: document.name,
      description: document.description,
      metadata: document.metadata,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
    await fs.promises.writeFile(this.documentPath, JSON.stringify(storedDoc, null, 2));

    const metadata: WikiDocumentMetadata = document.metadata;
    await fs.promises.writeFile(this.metadataPath, JSON.stringify(metadata, null, 2));

    for (const page of document.pages) {
      await this.savePage(page);
    }

    const index: WikiIndex = document.index;
    await fs.promises.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  async load(projectPath: string): Promise<WikiDocument | null> {
    if (!(await this.exists())) {
      return null;
    }

    try {
      let docName: string;
      let docDescription: string | undefined;
      let docId: string;
      let docCreatedAt: Date;
      let docUpdatedAt: Date;

      if (fs.existsSync(this.documentPath)) {
        const docContent = await fs.promises.readFile(this.documentPath, 'utf-8');
        const storedDoc: StoredDocument = JSON.parse(docContent);
        docName = storedDoc.name;
        docDescription = storedDoc.description;
        docId = storedDoc.id;
        docCreatedAt = new Date(storedDoc.createdAt);
        docUpdatedAt = new Date(storedDoc.updatedAt);
      } else {
        const metadataContent = await fs.promises.readFile(this.metadataPath, 'utf-8');
        const metadata: WikiDocumentMetadata = JSON.parse(metadataContent);
        docName = metadata.projectName;
        docDescription = `Wiki documentation for ${metadata.projectName}`;
        docId = this.generateDocumentId(projectPath);
        docCreatedAt = new Date();
        docUpdatedAt = new Date();
      }

      const indexContent = await fs.promises.readFile(this.indexPath, 'utf-8');
      const index: WikiIndex = JSON.parse(indexContent);

      const metadataContent = await fs.promises.readFile(this.metadataPath, 'utf-8');
      const metadata: WikiDocumentMetadata = JSON.parse(metadataContent);

      const pages = await this.listPages();

      return {
        id: docId,
        name: docName,
        description: docDescription,
        pages,
        index,
        metadata,
        createdAt: docCreatedAt,
        updatedAt: docUpdatedAt,
      };
    } catch (error) {
      logger.debug('Failed to load document', { error: String(error) });
      return null;
    }
  }

  async savePage(page: WikiPage): Promise<void> {
    await this.ensureStorageExists();

    const pagePath = this.getPagePath(page.id);
    await fs.promises.writeFile(pagePath, JSON.stringify(page, null, 2));
  }

  async loadPage(pageId: string): Promise<WikiPage | null> {
    const pagePath = this.getPagePath(pageId);

    try {
      const content = await fs.promises.readFile(pagePath, 'utf-8');
      const page: WikiPage = JSON.parse(content);
      page.createdAt = new Date(page.createdAt);
      page.updatedAt = new Date(page.updatedAt);
      return page;
    } catch (error) {
      logger.debug('Failed to load page', { pageId, error: String(error) });
      return null;
    }
  }

  async deletePage(pageId: string): Promise<void> {
    const pagePath = this.getPagePath(pageId);

    try {
      await fs.promises.unlink(pagePath);
    } catch (error) {
      logger.debug('Failed to delete page', { pageId, error: String(error) });
    }
  }

  async listPages(): Promise<WikiPage[]> {
    if (!fs.existsSync(this.wikiDir)) {
      return [];
    }

    const files = await fs.promises.readdir(this.wikiDir);
    const pages: WikiPage[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const pageId = file.replace('.json', '');
        const page = await this.loadPage(pageId);
        if (page) {
          pages.push(page);
        }
      }
    }

    return pages.sort((a, b) => a.title.localeCompare(b.title));
  }

  async exists(): Promise<boolean> {
    return fs.existsSync(this.storagePath) && fs.existsSync(this.metadataPath);
  }

  async exportToMarkdown(outputDir: string): Promise<string[]> {
    const pages = await this.listPages();
    const exportedFiles: string[] = [];

    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }

    for (const page of pages) {
      const fileName = `${page.slug}.md`;
      const filePath = path.join(outputDir, fileName);

      let content = `# ${page.title}\n\n`;

      if (page.metadata.tags.length > 0) {
        content += `**Tags:** ${page.metadata.tags.join(', ')}\n\n`;
      }

      content += page.content;

      if (page.links.length > 0) {
        content += '\n\n## Related\n\n';
        for (const link of page.links) {
          if (link.type === 'internal') {
            content += `- [${link.text}](${link.target}.md)\n`;
          } else {
            content += `- [${link.text}](${link.target})\n`;
          }
        }
      }

      content += `\n\n---\n*Last updated: ${page.updatedAt.toISOString()}*\n`;

      await fs.promises.writeFile(filePath, content);
      exportedFiles.push(filePath);
    }

    const indexPath = path.join(outputDir, 'index.md');
    let indexContent = '# Wiki Index\n\n';

    const pagesByCategory = new Map<string, WikiPage[]>();
    for (const page of pages) {
      const category = page.metadata.category;
      if (!pagesByCategory.has(category)) {
        pagesByCategory.set(category, []);
      }
      pagesByCategory.get(category)!.push(page);
    }

    for (const [category, categoryPages] of pagesByCategory) {
      indexContent += `## ${this.formatCategory(category)}\n\n`;
      for (const page of categoryPages) {
        indexContent += `- [${page.title}](${page.slug}.md)\n`;
      }
      indexContent += '\n';
    }

    await fs.promises.writeFile(indexPath, indexContent);
    exportedFiles.push(indexPath);

    return exportedFiles;
  }

  async exportToGitHubWiki(outputDir: string): Promise<string[]> {
    return this.exportToMarkdown(outputDir);
  }

  async getPageBySlug(slug: string): Promise<WikiPage | null> {
    const pages = await this.listPages();
    return pages.find((p) => p.slug === slug) || null;
  }

  async getPagesByCategory(category: string): Promise<WikiPage[]> {
    const pages = await this.listPages();
    return pages.filter((p) => p.metadata.category === category);
  }

  async getPagesByTag(tag: string): Promise<WikiPage[]> {
    const pages = await this.listPages();
    return pages.filter((p) => p.metadata.tags.includes(tag));
  }

  async searchPages(query: string): Promise<WikiPage[]> {
    const pages = await this.listPages();
    const lowerQuery = query.toLowerCase();

    return pages.filter((page) => {
      const titleMatch = page.title.toLowerCase().includes(lowerQuery);
      const contentMatch = page.content.toLowerCase().includes(lowerQuery);
      const tagMatch = page.metadata.tags.some((t) => t.toLowerCase().includes(lowerQuery));

      return titleMatch || contentMatch || tagMatch;
    });
  }

  private async ensureStorageExists(): Promise<void> {
    if (!fs.existsSync(this.storagePath)) {
      await fs.promises.mkdir(this.storagePath, { recursive: true });
    }

    if (!fs.existsSync(this.wikiDir)) {
      await fs.promises.mkdir(this.wikiDir, { recursive: true });
    }
  }

  private getPagePath(pageId: string): string {
    return path.join(this.wikiDir, `${pageId}.json`);
  }

  private generateDocumentId(projectPath: string): string {
    const hash = require('crypto')
      .createHash('md5')
      .update(projectPath)
      .digest('hex')
      .substring(0, 8);
    return `wiki-${hash}`;
  }

  private formatCategory(category: string): string {
    return category
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
