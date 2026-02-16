import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import {
  ArchitectureDecisionRecord,
  ADRStatus,
  ADRFilter,
  CodeReference,
  IADRService,
} from './types';

interface PageLink {
  adrId: string;
  pageId: string;
  linkedAt: Date;
}

export class ADRService implements IADRService {
  private adrsPath: string;
  private linksPath: string;
  private adrs: Map<string, ArchitectureDecisionRecord> = new Map();
  private pageLinks: Map<string, Set<string>> = new Map();
  private codeLinks: Map<string, CodeReference[]> = new Map();

  constructor(projectPath: string) {
    this.adrsPath = path.join(projectPath, '.wiki', 'adr');
    this.linksPath = path.join(projectPath, '.wiki', 'adr-links.json');
  }

  async initialize(): Promise<void> {
    await this.loadADRs();
    await this.loadLinks();
  }

  private async loadADRs(): Promise<void> {
    try {
      const files = await fs.readdir(this.adrsPath);
      for (const file of files) {
        if (file.endsWith('.json') && file.startsWith('adr-')) {
          const filePath = path.join(this.adrsPath, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const adr: ArchitectureDecisionRecord = JSON.parse(data);
          adr.date = new Date(adr.date);
          adr.createdAt = new Date(adr.createdAt);
          adr.updatedAt = new Date(adr.updatedAt);
          this.adrs.set(adr.id, adr);
        }
      }
    } catch {
      this.adrs.clear();
    }
  }

  private async saveADR(adr: ArchitectureDecisionRecord): Promise<void> {
    await fs.mkdir(this.adrsPath, { recursive: true });
    const filePath = path.join(this.adrsPath, `adr-${adr.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(adr, null, 2), 'utf-8');
  }

  private async deleteADRFile(id: string): Promise<void> {
    const filePath = path.join(this.adrsPath, `adr-${id}.json`);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist
    }
  }

  private async loadLinks(): Promise<void> {
    try {
      const data = await fs.readFile(this.linksPath, 'utf-8');
      const links: { pageLinks: PageLink[]; codeLinks: [string, CodeReference[]][] } =
        JSON.parse(data);

      for (const link of links.pageLinks) {
        if (!this.pageLinks.has(link.adrId)) {
          this.pageLinks.set(link.adrId, new Set());
        }
        this.pageLinks.get(link.adrId)!.add(link.pageId);
      }

      for (const [adrId, refs] of links.codeLinks) {
        this.codeLinks.set(adrId, refs);
      }
    } catch {
      this.pageLinks.clear();
      this.codeLinks.clear();
    }
  }

  private async saveLinks(): Promise<void> {
    const dir = path.dirname(this.linksPath);
    await fs.mkdir(dir, { recursive: true });

    const pageLinks: PageLink[] = [];
    for (const [adrId, pageIds] of this.pageLinks) {
      for (const pageId of pageIds) {
        pageLinks.push({ adrId, pageId, linkedAt: new Date() });
      }
    }

    const codeLinks = Array.from(this.codeLinks.entries());

    await fs.writeFile(this.linksPath, JSON.stringify({ pageLinks, codeLinks }, null, 2), 'utf-8');
  }

  async create(
    adrData: Omit<ArchitectureDecisionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ArchitectureDecisionRecord> {
    const now = new Date();
    const adr: ArchitectureDecisionRecord = {
      ...adrData,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    };

    this.adrs.set(adr.id, adr);
    await this.saveADR(adr);

    return adr;
  }

  async update(
    id: string,
    updates: Partial<ArchitectureDecisionRecord>
  ): Promise<ArchitectureDecisionRecord> {
    const adr = this.adrs.get(id);
    if (!adr) {
      throw new Error(`ADR ${id} not found`);
    }

    const restrictedFields = ['id', 'createdAt', 'createdBy'];
    for (const field of restrictedFields) {
      if (field in updates) {
        delete (updates as any)[field];
      }
    }

    const updatedAdr: ArchitectureDecisionRecord = {
      ...adr,
      ...updates,
      updatedAt: new Date(),
    };

    this.adrs.set(id, updatedAdr);
    await this.saveADR(updatedAdr);

    return updatedAdr;
  }

  async get(id: string): Promise<ArchitectureDecisionRecord | null> {
    return this.adrs.get(id) || null;
  }

  async list(filter?: ADRFilter): Promise<ArchitectureDecisionRecord[]> {
    let results = Array.from(this.adrs.values());

    if (filter) {
      if (filter.status && filter.status.length > 0) {
        results = results.filter((adr) => filter.status!.includes(adr.status));
      }

      if (filter.tags && filter.tags.length > 0) {
        results = results.filter((adr) => filter.tags!.some((tag) => adr.tags.includes(tag)));
      }

      if (filter.createdBy) {
        results = results.filter((adr) => adr.createdBy === filter.createdBy);
      }

      if (filter.dateFrom) {
        results = results.filter((adr) => adr.date >= filter.dateFrom!);
      }

      if (filter.dateTo) {
        results = results.filter((adr) => adr.date <= filter.dateTo!);
      }

      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        results = results.filter(
          (adr) =>
            adr.title.toLowerCase().includes(query) ||
            adr.context.toLowerCase().includes(query) ||
            adr.decision.toLowerCase().includes(query)
        );
      }
    }

    return results.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async delete(id: string): Promise<boolean> {
    const adr = this.adrs.get(id);
    if (!adr) {
      return false;
    }

    this.adrs.delete(id);
    this.pageLinks.delete(id);
    this.codeLinks.delete(id);

    await this.deleteADRFile(id);
    await this.saveLinks();

    return true;
  }

  async propose(
    title: string,
    context: string,
    decision: string,
    createdBy: string
  ): Promise<ArchitectureDecisionRecord> {
    return this.create({
      title,
      status: 'proposed',
      date: new Date(),
      decisionMakers: [createdBy],
      context,
      decision,
      consequences: { positive: [], negative: [], neutral: [] },
      alternatives: [],
      links: [],
      codeReferences: [],
      tags: [],
      customFields: {},
      createdBy,
      updatedBy: createdBy,
    });
  }

  async accept(id: string, acceptedBy: string): Promise<ArchitectureDecisionRecord> {
    const adr = this.adrs.get(id);
    if (!adr) {
      throw new Error(`ADR ${id} not found`);
    }

    if (adr.status !== 'proposed') {
      throw new Error(`Cannot accept ADR with status ${adr.status}`);
    }

    return this.update(id, {
      status: 'accepted',
      updatedBy: acceptedBy,
      decisionMakers: [...new Set([...adr.decisionMakers, acceptedBy])],
    });
  }

  async deprecate(
    id: string,
    reason: string,
    deprecatedBy: string
  ): Promise<ArchitectureDecisionRecord> {
    const adr = this.adrs.get(id);
    if (!adr) {
      throw new Error(`ADR ${id} not found`);
    }

    if (adr.status !== 'accepted') {
      throw new Error(`Cannot deprecate ADR with status ${adr.status}`);
    }

    return this.update(id, {
      status: 'deprecated',
      updatedBy: deprecatedBy,
      customFields: { ...adr.customFields, deprecationReason: reason },
    });
  }

  async supersede(oldId: string, newId: string): Promise<void> {
    const oldAdr = this.adrs.get(oldId);
    const newAdr = this.adrs.get(newId);

    if (!oldAdr || !newAdr) {
      throw new Error('Both ADRs must exist');
    }

    oldAdr.status = 'superseded';
    oldAdr.links.push({
      type: 'superseded-by',
      adrId: newId,
      adrTitle: newAdr.title,
    });
    oldAdr.updatedAt = new Date();

    newAdr.links.push({
      type: 'supersedes',
      adrId: oldId,
      adrTitle: oldAdr.title,
    });
    newAdr.updatedAt = new Date();

    await this.saveADR(oldAdr);
    await this.saveADR(newAdr);
  }

  async reject(
    id: string,
    reason: string,
    rejectedBy: string
  ): Promise<ArchitectureDecisionRecord> {
    const adr = this.adrs.get(id);
    if (!adr) {
      throw new Error(`ADR ${id} not found`);
    }

    if (adr.status !== 'proposed') {
      throw new Error(`Cannot reject ADR with status ${adr.status}`);
    }

    return this.update(id, {
      status: 'rejected',
      updatedBy: rejectedBy,
      customFields: { ...adr.customFields, rejectionReason: reason },
    });
  }

  async linkToPage(adrId: string, pageId: string): Promise<void> {
    const adr = this.adrs.get(adrId);
    if (!adr) {
      throw new Error(`ADR ${adrId} not found`);
    }

    if (!this.pageLinks.has(adrId)) {
      this.pageLinks.set(adrId, new Set());
    }
    this.pageLinks.get(adrId)!.add(pageId);

    await this.saveLinks();
  }

  async unlinkFromPage(adrId: string, pageId: string): Promise<void> {
    const pageLinkSet = this.pageLinks.get(adrId);
    if (pageLinkSet) {
      pageLinkSet.delete(pageId);
      if (pageLinkSet.size === 0) {
        this.pageLinks.delete(adrId);
      }
      await this.saveLinks();
    }
  }

  async linkToCode(adrId: string, reference: CodeReference): Promise<void> {
    const adr = this.adrs.get(adrId);
    if (!adr) {
      throw new Error(`ADR ${adrId} not found`);
    }

    if (!this.codeLinks.has(adrId)) {
      this.codeLinks.set(adrId, []);
    }
    this.codeLinks.get(adrId)!.push(reference);

    adr.codeReferences.push(reference);
    adr.updatedAt = new Date();
    await this.saveADR(adr);
    await this.saveLinks();
  }

  async getRelated(adrId: string): Promise<ArchitectureDecisionRecord[]> {
    const adr = this.adrs.get(adrId);
    if (!adr) {
      return [];
    }

    const related: ArchitectureDecisionRecord[] = [];

    for (const link of adr.links) {
      const relatedAdr = this.adrs.get(link.adrId);
      if (relatedAdr) {
        related.push(relatedAdr);
      }
    }

    for (const [id, otherAdr] of this.adrs) {
      if (id !== adrId) {
        for (const link of otherAdr.links) {
          if (link.adrId === adrId) {
            if (!related.find((r) => r.id === id)) {
              related.push(otherAdr);
            }
          }
        }
      }
    }

    return related;
  }

  async getADRsForPage(pageId: string): Promise<ArchitectureDecisionRecord[]> {
    const adrs: ArchitectureDecisionRecord[] = [];

    for (const [adrId, pageIds] of this.pageLinks) {
      if (pageIds.has(pageId)) {
        const adr = this.adrs.get(adrId);
        if (adr) {
          adrs.push(adr);
        }
      }
    }

    return adrs;
  }

  async getADRsForCode(filePath: string): Promise<ArchitectureDecisionRecord[]> {
    const adrs: ArchitectureDecisionRecord[] = [];

    for (const [adrId, refs] of this.codeLinks) {
      if (refs.some((ref) => ref.filePath === filePath)) {
        const adr = this.adrs.get(adrId);
        if (adr) {
          adrs.push(adr);
        }
      }
    }

    return adrs;
  }

  async getByStatus(status: ADRStatus): Promise<ArchitectureDecisionRecord[]> {
    return this.list({ status: [status] });
  }

  async getRecent(limit: number = 10): Promise<ArchitectureDecisionRecord[]> {
    const all = await this.list();
    return all.slice(0, limit);
  }

  async search(query: string): Promise<ArchitectureDecisionRecord[]> {
    return this.list({ searchQuery: query });
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<ADRStatus, number>;
    byTag: Record<string, number>;
  }> {
    const all = Array.from(this.adrs.values());
    const byStatus: Record<ADRStatus, number> = {
      proposed: 0,
      accepted: 0,
      deprecated: 0,
      superseded: 0,
      rejected: 0,
    };
    const byTag: Record<string, number> = {};

    for (const adr of all) {
      byStatus[adr.status]++;
      for (const tag of adr.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }

    return { total: all.length, byStatus, byTag };
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }
}
