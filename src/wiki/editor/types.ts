export type EditorMode = 'edit' | 'preview' | 'split';

export interface WikiEditorConfig {
  mode: EditorMode;
  autoSave: AutoSaveConfig;
  preview: PreviewConfig;
  toolbar: ToolbarConfig;
  shortcuts: ShortcutConfig;
  theme: EditorTheme;
}

export interface AutoSaveConfig {
  enabled: boolean;
  intervalMs: number;
  maxDrafts: number;
  draftPath?: string;
}

export interface PreviewConfig {
  syncScroll: boolean;
  showToc: boolean;
  highlightLinks: boolean;
  renderDiagrams: boolean;
}

export interface ToolbarConfig {
  enabled: boolean;
  items: ToolbarItem[];
  position: 'top' | 'bottom';
}

export interface ToolbarItem {
  id: string;
  type: 'button' | 'dropdown' | 'separator';
  label?: string;
  icon?: string;
  action?: string;
  shortcut?: string;
}

export interface ShortcutConfig {
  enabled: boolean;
  bindings: ShortcutBinding[];
}

export interface ShortcutBinding {
  key: string;
  modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[];
  action: string;
  description: string;
}

export interface EditorTheme {
  name: 'light' | 'dark' | 'custom';
  colors?: Record<string, string>;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
}

export interface WikiEditSession {
  id: string;
  pageId: string;
  pageTitle: string;
  originalContent: string;
  currentContent: string;
  createdAt: Date;
  updatedAt: Date;
  status: SessionStatus;
  metadata: SessionMetadata;
}

export type SessionStatus = 'active' | 'paused' | 'saved' | 'closed';

export interface SessionMetadata {
  cursorPosition: CursorPosition;
  selection?: SelectionRange;
  scrollPosition: number;
  undoStack: EditAction[];
  redoStack: EditAction[];
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface SelectionRange {
  start: CursorPosition;
  end: CursorPosition;
}

export interface EditAction {
  type: 'insert' | 'delete' | 'replace';
  position: CursorPosition;
  content: string;
  previousContent?: string;
  timestamp: Date;
}

export interface DraftDocument {
  id: string;
  pageId: string;
  content: string;
  savedAt: Date;
  metadata: DraftMetadata;
}

export interface DraftMetadata {
  wordCount: number;
  characterCount: number;
  autoSaved: boolean;
}

export type TemplateCategory = 'api' | 'module' | 'architecture' | 'changelog' | 'guide' | 'custom';

export interface WikiTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'number' | 'boolean';
  required: boolean;
  defaultValue?: string | number | boolean | string[];
  options?: string[];
  placeholder?: string;
  validation?: ValidationRule;
}

export interface ValidationRule {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  custom?: string;
}

export interface TemplateMetadata {
  author?: string;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  usageCount: number;
}

export interface AppliedTemplate {
  templateId: string;
  variables: Record<string, string | number | boolean | string[]>;
  appliedAt: Date;
  generatedContent: string;
}

export interface IWikiEditorService {
  createSession(pageId: string, content: string): Promise<WikiEditSession>;
  updateSession(sessionId: string, content: string): Promise<void>;
  getSession(sessionId: string): Promise<WikiEditSession | null>;
  endSession(sessionId: string): Promise<void>;
  getActiveSessions(): Promise<WikiEditSession[]>;
  enableAutoSave(sessionId: string, config: AutoSaveConfig): void;
  disableAutoSave(sessionId: string): void;
  saveDraft(sessionId: string): Promise<DraftDocument>;
  restoreDraft(pageId: string): Promise<DraftDocument | null>;
  getDrafts(pageId: string): Promise<DraftDocument[]>;
  clearDrafts(pageId: string): Promise<void>;
}

export interface IWikiPreview {
  renderPreview(content: string): Promise<string>;
  syncScroll(position: number): void;
  highlightSection(sectionId: string): void;
  getTableOfContents(): Promise<TableOfContentsEntry[]>;
}

export interface TableOfContentsEntry {
  id: string;
  title: string;
  level: number;
  children: TableOfContentsEntry[];
}

export interface IWikiTemplates {
  getTemplate(id: string): Promise<WikiTemplate | null>;
  getTemplates(category?: TemplateCategory): Promise<WikiTemplate[]>;
  applyTemplate(templateId: string, variables: Record<string, unknown>): Promise<string>;
  createTemplate(template: Omit<WikiTemplate, 'id' | 'metadata'>): Promise<WikiTemplate>;
  updateTemplate(id: string, template: Partial<WikiTemplate>): Promise<WikiTemplate>;
  deleteTemplate(id: string): Promise<void>;
  validateTemplate(template: WikiTemplate): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export const DEFAULT_EDITOR_CONFIG: WikiEditorConfig = {
  mode: 'split',
  autoSave: {
    enabled: true,
    intervalMs: 30000,
    maxDrafts: 10,
  },
  preview: {
    syncScroll: true,
    showToc: true,
    highlightLinks: true,
    renderDiagrams: true,
  },
  toolbar: {
    enabled: true,
    position: 'top',
    items: [
      { id: 'bold', type: 'button', label: 'B', action: 'formatBold', shortcut: 'Ctrl+B' },
      { id: 'italic', type: 'button', label: 'I', action: 'formatItalic', shortcut: 'Ctrl+I' },
      { id: 'separator1', type: 'separator' },
      { id: 'heading', type: 'dropdown', label: 'Heading', action: 'insertHeading' },
      { id: 'link', type: 'button', label: 'Link', action: 'insertLink', shortcut: 'Ctrl+K' },
      { id: 'image', type: 'button', label: 'Image', action: 'insertImage' },
      { id: 'separator2', type: 'separator' },
      { id: 'code', type: 'button', label: 'Code', action: 'insertCode', shortcut: 'Ctrl+`' },
      { id: 'list', type: 'button', label: 'List', action: 'insertList' },
      { id: 'table', type: 'button', label: 'Table', action: 'insertTable' },
    ],
  },
  shortcuts: {
    enabled: true,
    bindings: [
      { key: 's', modifiers: ['ctrl'], action: 'save', description: 'Save document' },
      { key: 'z', modifiers: ['ctrl'], action: 'undo', description: 'Undo' },
      { key: 'z', modifiers: ['ctrl', 'shift'], action: 'redo', description: 'Redo' },
      { key: 'b', modifiers: ['ctrl'], action: 'formatBold', description: 'Bold text' },
      { key: 'i', modifiers: ['ctrl'], action: 'formatItalic', description: 'Italic text' },
      { key: 'k', modifiers: ['ctrl'], action: 'insertLink', description: 'Insert link' },
    ],
  },
  theme: {
    name: 'light',
    fontSize: 14,
    fontFamily: 'Consolas, Monaco, monospace',
    lineHeight: 1.6,
  },
};
