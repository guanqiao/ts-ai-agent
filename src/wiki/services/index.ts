import { ServiceToken, DIContainer, ServiceLifetime, ServiceLocator } from '@core/di';
import { WikiStorage } from '../wiki-storage';
import { WikiHistory } from '../wiki-history';
import { WikiAudit } from '../wiki-audit';
import { WikiAutoSync } from '../wiki-auto-sync';
import { WikiSyncMonitor } from '../wiki-sync-monitor';
import { WikiSharingService } from '../sharing';
import { WikiGraphGenerator } from '../graph';
import { WikiEditorService } from '../editor';
import { ArchitectureDiagramGenerator, DiagramExporter } from '../diagram';
import { WikiCollaborationService, WikiPermissionService, WikiLockService } from '../collaboration';
import { ADRService, ADRExtractor, ADRTemplates } from '../adr';
import { KnowledgeGraphService } from '../knowledge';
import { ChangeImpactAnalyzer, RiskAssessmentService, SuggestionGenerator } from '../impact';
import { WikiManager } from '../wiki-manager';
import { LLMService } from '../../llm';
import { LLMConfig } from '../../types';

export const WikiServiceTokens = {
  LLMService: ServiceToken.create<LLMService>('LLMService'),
  Storage: ServiceToken.create<WikiStorage>('WikiStorage'),
  History: ServiceToken.create<WikiHistory>('WikiHistory'),
  Audit: ServiceToken.create<WikiAudit>('WikiAudit'),
  AutoSync: ServiceToken.create<WikiAutoSync>('WikiAutoSync'),
  SyncMonitor: ServiceToken.create<WikiSyncMonitor>('WikiSyncMonitor'),
  SharingService: ServiceToken.create<WikiSharingService>('WikiSharingService'),
  GraphGenerator: ServiceToken.create<WikiGraphGenerator>('WikiGraphGenerator'),
  EditorService: ServiceToken.create<WikiEditorService>('WikiEditorService'),
  Preview: ServiceToken.create<any>('WikiPreview'),
  Templates: ServiceToken.create<any>('WikiTemplates'),
  DiagramGenerator: ServiceToken.create<ArchitectureDiagramGenerator>(
    'ArchitectureDiagramGenerator'
  ),
  DiagramExporter: ServiceToken.create<DiagramExporter>('DiagramExporter'),
  CollaborationService: ServiceToken.create<WikiCollaborationService>('WikiCollaborationService'),
  PermissionService: ServiceToken.create<WikiPermissionService>('WikiPermissionService'),
  LockService: ServiceToken.create<WikiLockService>('WikiLockService'),
  ADRService: ServiceToken.create<ADRService>('ADRService'),
  ADRExtractor: ServiceToken.create<ADRExtractor>('ADRExtractor'),
  ADRTemplates: ServiceToken.create<ADRTemplates>('ADRTemplates'),
  KnowledgeGraphService: ServiceToken.create<KnowledgeGraphService>('KnowledgeGraphService'),
  ChangeImpactAnalyzer: ServiceToken.create<ChangeImpactAnalyzer>('ChangeImpactAnalyzer'),
  RiskAssessmentService: ServiceToken.create<RiskAssessmentService>('RiskAssessmentService'),
  SuggestionGenerator: ServiceToken.create<SuggestionGenerator>('SuggestionGenerator'),
  WikiManager: ServiceToken.create<WikiManager>('WikiManager'),
};

export class WikiServiceFactory {
  static registerServices(
    container: DIContainer,
    projectPath: string,
    llmConfig?: LLMConfig
  ): void {
    if (llmConfig) {
      container.register(WikiServiceTokens.LLMService, {
        factory: () => new LLMService(llmConfig),
        lifetime: ServiceLifetime.Singleton,
      });
    }

    container.register(WikiServiceTokens.Storage, {
      factory: () => new WikiStorage(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.History, {
      factory: () => new WikiHistory(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.Audit, {
      factory: () => new WikiAudit(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.AutoSync, {
      factory: () => new WikiAutoSync(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.SyncMonitor, {
      factory: () => new WikiSyncMonitor(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.SharingService, {
      factory: () => new WikiSharingService(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.GraphGenerator, {
      factory: () => new WikiGraphGenerator(),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.EditorService, {
      factory: () => new WikiEditorService(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.DiagramGenerator, {
      factory: () => new ArchitectureDiagramGenerator(),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.DiagramExporter, {
      factory: () => new DiagramExporter(),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.CollaborationService, {
      factory: () => new WikiCollaborationService(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.PermissionService, {
      factory: (c) => {
        const collabService = c.resolve(WikiServiceTokens.CollaborationService);
        return new WikiPermissionService(projectPath, collabService);
      },
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.LockService, {
      factory: () => new WikiLockService(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.ADRService, {
      factory: () => new ADRService(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.ADRExtractor, {
      factory: () => new ADRExtractor(),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.ADRTemplates, {
      factory: () => new ADRTemplates(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.KnowledgeGraphService, {
      factory: () => new KnowledgeGraphService(),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.ChangeImpactAnalyzer, {
      factory: () => new ChangeImpactAnalyzer(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.RiskAssessmentService, {
      factory: () => new RiskAssessmentService(),
      lifetime: ServiceLifetime.Singleton,
    });

    container.register(WikiServiceTokens.SuggestionGenerator, {
      factory: () => new SuggestionGenerator(projectPath),
      lifetime: ServiceLifetime.Singleton,
    });
  }

  static async createWikiManager(
    container: DIContainer,
    projectPath: string
  ): Promise<WikiManager> {
    const storage = container.resolve(WikiServiceTokens.Storage);
    const history = container.resolve(WikiServiceTokens.History);
    const audit = container.resolve(WikiServiceTokens.Audit);
    const autoSync = container.resolve(WikiServiceTokens.AutoSync);
    const syncMonitor = container.resolve(WikiServiceTokens.SyncMonitor);
    const sharingService = container.resolve(WikiServiceTokens.SharingService);
    const graphGenerator = container.resolve(WikiServiceTokens.GraphGenerator);
    const editorService = container.resolve(WikiServiceTokens.EditorService);
    const diagramGenerator = container.resolve(WikiServiceTokens.DiagramGenerator);
    const diagramExporter = container.resolve(WikiServiceTokens.DiagramExporter);
    const collaborationService = container.resolve(WikiServiceTokens.CollaborationService);
    const permissionService = container.resolve(WikiServiceTokens.PermissionService);
    const lockService = container.resolve(WikiServiceTokens.LockService);
    const adrService = container.resolve(WikiServiceTokens.ADRService);
    const adrExtractor = container.resolve(WikiServiceTokens.ADRExtractor);
    const adrTemplates = container.resolve(WikiServiceTokens.ADRTemplates);
    const knowledgeGraphService = container.resolve(WikiServiceTokens.KnowledgeGraphService);
    const changeImpactAnalyzer = container.resolve(WikiServiceTokens.ChangeImpactAnalyzer);
    const riskAssessmentService = container.resolve(WikiServiceTokens.RiskAssessmentService);
    const suggestionGenerator = container.resolve(WikiServiceTokens.SuggestionGenerator);

    const llmService = container.tryResolve(WikiServiceTokens.LLMService);

    const manager = new WikiManager();
    await manager.injectDependencies(
      {
        storage,
        history,
        audit,
        autoSync,
        syncMonitor,
        sharingService,
        graphGenerator,
        editorService,
        diagramGenerator,
        diagramExporter,
        collaborationService,
        permissionService,
        lockService,
        adrService,
        adrExtractor,
        adrTemplates,
        knowledgeGraphService,
        changeImpactAnalyzer,
        riskAssessmentService,
        suggestionGenerator,
        llmService,
      },
      projectPath
    );

    return manager;
  }

  static getStorage(): WikiStorage {
    return ServiceLocator.get(WikiServiceTokens.Storage);
  }

  static getHistory(): WikiHistory {
    return ServiceLocator.get(WikiServiceTokens.History);
  }

  static getAudit(): WikiAudit {
    return ServiceLocator.get(WikiServiceTokens.Audit);
  }

  static getAutoSync(): WikiAutoSync {
    return ServiceLocator.get(WikiServiceTokens.AutoSync);
  }

  static getSyncMonitor(): WikiSyncMonitor {
    return ServiceLocator.get(WikiServiceTokens.SyncMonitor);
  }
}
