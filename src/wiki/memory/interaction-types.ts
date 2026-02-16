export enum InteractionType {
  Query = 'query',
  ToolCall = 'tool_call',
  CodeGeneration = 'code_generation',
  CodeModification = 'code_modification',
  Decision = 'decision',
  Learning = 'learning',
}

export interface InteractionMetadata {
  model?: string;
  tokensUsed?: number;
  success: boolean;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  filesAffected?: string[];
  linesGenerated?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface InteractionRecord {
  id: string;
  type: InteractionType;
  timestamp: Date;
  input: string;
  output: string;
  metadata: InteractionMetadata;
  sessionId?: string;
  contextSnapshot?: {
    relevantFiles?: string[];
    relevantSymbols?: string[];
    wikiContext?: string;
  };
}

export interface InteractionQuery {
  type?: InteractionType;
  startDate?: Date;
  endDate?: Date;
  sessionId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface InteractionStats {
  totalInteractions: number;
  byType: Record<InteractionType, number>;
  successRate: number;
  totalTokensUsed: number;
  averageDuration?: number;
  mostUsedTools?: Array<{ name: string; count: number }>;
}

export interface InteractionHistoryConfig {
  maxRecords: number;
  retentionDays: number;
  enableContextSnapshot: boolean;
}
