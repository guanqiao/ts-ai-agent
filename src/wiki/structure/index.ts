export {
  DocumentSection,
  SectionHierarchy,
  SectionType,
  SectionPriority,
  SectionMetadata,
  SectionTemplate,
  StructureAnalysisResult,
  StructureRecommendation,
  ArchitectureContext,
  ArchitectureLayer,
  ArchitectureModule,
  SymbolInfo,
  ArchitectureMetrics,
  ContentOrganizationOptions,
  DEFAULT_ORGANIZATION_OPTIONS,
  BUILTIN_SECTION_TEMPLATES,
  IStructureGenerator,
} from './types';

export { DocumentStructureGenerator } from './document-structure-generator';
export { SectionRecommender, SectionRecommendation } from './section-recommender';
export { ContentOrganizer, OrganizedContent } from './content-organizer';
