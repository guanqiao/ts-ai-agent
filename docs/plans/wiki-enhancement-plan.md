# Wiki 功能增强开发计划

> 版本: 1.0.0  
> 创建日期: 2026-02-16  
> 状态: 规划中

---

## 一、项目背景

### 1.1 对标产品
阿里 Qoder Repo Wiki 功能，主要特性包括：
- 基于代码自动生成结构化文档
- 架构图谱、引用关系图谱可视化
- Wiki 共享、编辑和导出
- 隐性知识显性化
- 团队协作支持

### 1.2 当前状态
本项目 Wiki 模块已实现：
- ✅ 自动生成文档（概览、架构、API、模块）
- ✅ 版本控制与历史管理
- ✅ 审计日志
- ✅ 自动同步与监控
- ✅ 向量搜索（领先）
- ✅ 规范学习（领先）
- ✅ 上下文压缩（领先）
- ✅ Prompt 增强（领先）

### 1.3 差距分析

| 功能领域 | Qoder | 当前项目 | 差距等级 |
|---------|-------|---------|---------|
| Wiki 共享机制 | ✅ | ❌ | 🔴 重大 |
| 团队协作功能 | ✅ | ❌ | 🔴 重大 |
| 引用关系图谱可视化 | ✅ | ⚠️ 文本 | 🟠 较大 |
| 隐性知识显性化（ADR） | ✅ | ⚠️ 基础 | 🟠 较大 |
| Wiki 编辑器增强 | ✅ | ⚠️ 基础 | 🟡 轻微 |
| 架构文档可视化 | ✅ | ⚠️ 文本 | 🟡 轻微 |
| 知识图谱构建 | ⚠️ | ❌ | 🟡 轻微 |
| 变更影响分析增强 | ⚠️ | ⚠️ 基础 | 🟡 轻微 |

---

## 二、开发阶段规划

### Phase 1: P0 核心功能（预计 2 周）

#### 2.1.1 Wiki 共享机制

**目标**: 实现 Wiki 文档的团队共享能力

**功能需求**:
1. Git 集成共享
   - 自动将 Wiki 提交到指定 Git 目录
   - 支持 `.wiki/` 或 `docs/wiki/` 目录
   - 与远程仓库同步

2. 共享配置管理
   - 共享范围设置（公开/团队/私有）
   - 共享路径配置
   - 同步策略配置

3. 同步状态追踪
   - 本地与远程同步状态
   - 冲突检测与解决
   - 同步历史记录

**技术方案**:
```typescript
interface WikiSharingConfig {
  enabled: boolean;
  shareToGit: boolean;
  sharePath: string;
  accessControl: 'public' | 'team' | 'private';
  syncWithRemote: boolean;
  autoCommit: boolean;
  commitMessage: string;
}

interface WikiSharingService {
  initialize(config: WikiSharingConfig): Promise<void>;
  share(): Promise<ShareResult>;
  sync(): Promise<SyncResult>;
  getStatus(): ShareStatus;
  resolveConflicts(conflicts: Conflict[]): Promise<void>;
}
```

**依赖关系**:
- 依赖现有 GitWatcher 模块
- 依赖 WikiStorage 模块

**验收标准**:
- [ ] 可配置共享目录和同步策略
- [ ] 支持自动提交到 Git
- [ ] 支持与远程仓库同步
- [ ] 同步状态可查询

---

#### 2.1.2 引用关系图谱可视化

**目标**: 实现代码引用关系的可视化展示

**功能需求**:
1. 依赖关系图
   - 模块间依赖关系
   - 文件间依赖关系
   - 循环依赖检测

2. 调用关系图
   - 函数调用关系
   - 类继承关系
   - 接口实现关系

3. 图表格式支持
   - Mermaid 图表（Markdown 原生支持）
   - SVG 导出
   - JSON 数据导出

**技术方案**:
```typescript
interface WikiGraphVisualization {
  type: 'dependency' | 'reference' | 'call-graph' | 'inheritance';
  format: 'mermaid' | 'svg' | 'json';
  interactive: boolean;
  options: GraphOptions;
}

interface GraphOptions {
  maxDepth: number;
  excludePatterns: string[];
  highlightCycles: boolean;
  groupByLayer: boolean;
  showExternal: boolean;
}

interface WikiGraphGenerator {
  generateDependencyGraph(architecture: ArchitectureReport): string;
  generateCallGraph(symbols: Symbol[]): string;
  generateInheritanceGraph(classes: ClassSymbol[]): string;
  exportToMermaid(graph: Graph): string;
  exportToSVG(graph: Graph): string;
}
```

**依赖关系**:
- 依赖 ArchitectureAnalyzer 模块
- 依赖现有依赖图数据结构

**验收标准**:
- [ ] 可生成模块依赖关系 Mermaid 图
- [ ] 可生成函数调用关系图
- [ ] 可生成类继承关系图
- [ ] 支持图表导出

---

### Phase 2: P1 协作功能（预计 2 周）

#### 2.2.1 团队协作功能

**目标**: 支持多人协作编辑和管理 Wiki

**功能需求**:
1. 多用户支持
   - 用户身份识别
   - 用户配置管理
   - 用户活动记录

2. 权限管理
   - 角色定义（管理员/编辑者/查看者）
   - 页面级权限控制
   - 操作权限控制

3. 协作状态同步
   - 实时编辑状态
   - 编辑锁机制
   - 变更通知

**技术方案**:
```typescript
interface WikiContributor {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: Date;
  lastActiveAt: Date;
}

interface WikiPermission {
  userId: string;
  resource: 'page' | 'document' | 'global';
  resourceId?: string;
  actions: ('read' | 'write' | 'delete' | 'share')[];
}

interface WikiCollaborationService {
  addContributor(contributor: WikiContributor): Promise<void>;
  removeContributor(userId: string): Promise<void>;
  setPermission(permission: WikiPermission): Promise<void>;
  getPermissions(userId: string): Promise<WikiPermission[]>;
  lockPage(pageId: string, userId: string): Promise<boolean>;
  unlockPage(pageId: string): Promise<void>;
  getActiveEditors(): Promise<WikiContributor[]>;
}
```

**依赖关系**:
- 依赖现有审计日志模块
- 依赖版本历史模块

**验收标准**:
- [ ] 支持多用户身份管理
- [ ] 支持角色和权限控制
- [ ] 支持页面编辑锁
- [ ] 可查看活跃编辑者

---

#### 2.2.2 隐性知识显性化（ADR）

**目标**: 实现架构决策记录（ADR）功能

**功能需求**:
1. ADR 数据结构
   - 标准化 ADR 格式
   - 状态管理（提议/接受/废弃/替代）
   - 关联代码和文档

2. 自动提取机制
   - 从代码注释提取决策
   - 从提交信息提取决策
   - 从文档提取决策

3. ADR 模板系统
   - 预设模板
   - 自定义模板
   - 模板变量

**技术方案**:
```typescript
interface ArchitectureDecisionRecord {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string;
  decision: string;
  consequences: string;
  alternatives: Alternative[];
  author: string;
  createdAt: Date;
  updatedAt: Date;
  relatedPages: string[];
  relatedCode: string[];
  tags: string[];
}

interface Alternative {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  rejected: boolean;
  rejectedReason?: string;
}

interface ADRService {
  create(adr: ArchitectureDecisionRecord): Promise<ArchitectureDecisionRecord>;
  update(id: string, adr: Partial<ArchitectureDecisionRecord>): Promise<ArchitectureDecisionRecord>;
  get(id: string): Promise<ArchitectureDecisionRecord | null>;
  list(filter?: ADRFilter): Promise<ArchitectureDecisionRecord[]>;
  extractFromCode(parsedFiles: ParsedFile[]): Promise<ArchitectureDecisionRecord[]>;
  extractFromCommits(commits: Commit[]): Promise<ArchitectureDecisionRecord[]>;
  generateFromTemplate(template: ADRTemplate): ArchitectureDecisionRecord;
}
```

**依赖关系**:
- 依赖代码解析模块
- 依赖 Git 历史模块

**验收标准**:
- [ ] 支持创建和管理 ADR
- [ ] 可从代码注释自动提取 ADR
- [ ] 支持 ADR 状态流转
- [ ] 支持 ADR 模板

---

### Phase 3: P2 体验增强（预计 1 周）

#### 2.3.1 Wiki 编辑器增强

**目标**: 提供更好的 Wiki 编辑体验

**功能需求**:
1. 编辑模式
   - Markdown 源码编辑
   - 所见即所得编辑
   - 分屏预览

2. 辅助功能
   - 自动保存
   - 语法检查
   - AI 辅助写作建议

3. 模板系统
   - 预设模板（API 文档、模块文档等）
   - 自定义模板
   - 模板变量填充

**技术方案**:
```typescript
interface WikiEditorConfig {
  mode: 'markdown' | 'wysiwyg' | 'split';
  autoSave: boolean;
  autoSaveInterval: number;
  spellCheck: boolean;
  aiAssist: boolean;
  previewTheme: string;
}

interface WikiEditSession {
  id: string;
  pageId: string;
  userId: string;
  startedAt: Date;
  lastSaved: Date;
  content: string;
  originalContent: string;
  isDirty: boolean;
  cursorPosition: Position;
}

interface WikiTemplate {
  id: string;
  name: string;
  description: string;
  category: WikiCategory;
  content: string;
  variables: TemplateVariable[];
}

interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'list';
  default?: string;
  required: boolean;
  description: string;
}
```

**验收标准**:
- [ ] 支持分屏预览编辑
- [ ] 支持自动保存
- [ ] 支持预设模板
- [ ] 支持自定义模板

---

#### 2.3.2 架构文档可视化

**目标**: 增强架构文档的可视化展示

**功能需求**:
1. 架构图生成
   - 分层架构图
   - 组件架构图
   - 部署架构图

2. 交互功能
   - 节点点击跳转
   - 层级展开/折叠
   - 过滤和搜索

3. 导出功能
   - Mermaid 格式
   - SVG 格式
   - PNG 格式

**技术方案**:
```typescript
interface ArchitectureDiagram {
  type: 'layered' | 'component' | 'deployment';
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layers?: DiagramLayer[];
  metadata: DiagramMetadata;
}

interface DiagramNode {
  id: string;
  label: string;
  type: string;
  layer?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  style: NodeStyle;
  link?: string;
}

interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style: EdgeStyle;
  type: 'solid' | 'dashed' | 'dotted';
}

interface ArchitectureDiagramService {
  generateLayeredDiagram(architecture: ArchitectureReport): ArchitectureDiagram;
  generateComponentDiagram(modules: Module[]): ArchitectureDiagram;
  exportToMermaid(diagram: ArchitectureDiagram): string;
  exportToSVG(diagram: ArchitectureDiagram): string;
  exportToPNG(diagram: ArchitectureDiagram): Buffer;
}
```

**验收标准**:
- [ ] 可生成分层架构图
- [ ] 可生成组件架构图
- [ ] 支持 Mermaid 格式导出
- [ ] 支持 SVG 格式导出

---

### Phase 4: P3 高级功能（预计 1 周）

#### 2.4.1 知识图谱构建

**目标**: 构建项目知识图谱，支持智能推荐

**功能需求**:
1. 知识节点提取
   - 概念节点
   - API 节点
   - 模块节点
   - 模式节点

2. 关系图谱生成
   - 节点关系
   - 聚类分析
   - 重要性评估

3. 智能推荐
   - 相关文档推荐
   - 相关代码推荐
   - 学习路径推荐

**技术方案**:
```typescript
interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  clusters: KnowledgeCluster[];
  metadata: GraphMetadata;
}

interface KnowledgeNode {
  id: string;
  type: 'concept' | 'api' | 'module' | 'pattern' | 'decision';
  name: string;
  description: string;
  sources: string[];
  confidence: number;
  importance: number;
  tags: string[];
}

interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: 'relates-to' | 'depends-on' | 'implements' | 'extends' | 'uses';
  weight: number;
  evidence: string[];
}

interface KnowledgeCluster {
  id: string;
  name: string;
  nodes: string[];
  description: string;
  representative: string;
}

interface KnowledgeGraphService {
  build(parsedFiles: ParsedFile[], wiki: WikiDocument): Promise<KnowledgeGraph>;
  findRelated(nodeId: string, limit?: number): Promise<KnowledgeNode[]>;
  getLearningPath(startNode: string, endNode: string): Promise<KnowledgeNode[]>;
  recommend(userId: string, context: string): Promise<Recommendation[]>;
  exportToJSON(graph: KnowledgeGraph): string;
}
```

**验收标准**:
- [ ] 可构建知识图谱
- [ ] 支持相关节点查询
- [ ] 支持学习路径生成
- [ ] 支持智能推荐

---

#### 2.4.2 变更影响分析增强

**目标**: 提供更深入的变更影响分析

**功能需求**:
1. 影响范围分析
   - 直接影响分析
   - 间接影响分析
   - 影响链路追踪

2. 风险评估
   - 风险等级评估
   - 影响面评估
   - 破坏性变更检测

3. 建议生成
   - 需要更新的文档
   - 需要运行的测试
   - 需要通知的人员

**技术方案**:
```typescript
interface EnhancedChangeImpact {
  changeId: string;
  filePath: string;
  changeType: 'add' | 'modify' | 'delete' | 'rename';
  directImpact: ImpactItem[];
  indirectImpact: ImpactItem[];
  impactChain: ImpactChain[];
  riskAssessment: RiskAssessment;
  suggestedActions: SuggestedAction[];
}

interface ImpactItem {
  type: 'code' | 'test' | 'doc' | 'config';
  path: string;
  symbol?: string;
  impactLevel: 'high' | 'medium' | 'low';
  description: string;
}

interface ImpactChain {
  startNode: string;
  endNode: string;
  path: string[];
  impactType: string;
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  factors: RiskFactor[];
  mitigation: string[];
}

interface RiskFactor {
  name: string;
  description: string;
  severity: number;
  affectedItems: string[];
}

interface SuggestedAction {
  type: 'update-doc' | 'run-test' | 'notify-user' | 'review-code';
  priority: 'high' | 'medium' | 'low';
  description: string;
  target: string;
  estimatedEffort: string;
}

interface ChangeImpactAnalyzer {
  analyze(filePath: string, changeType: string): Promise<EnhancedChangeImpact>;
  analyzeBatch(changes: FileChange[]): Promise<EnhancedChangeImpact[]>;
  getImpactChain(startNode: string, maxDepth: number): Promise<ImpactChain[]>;
  assessRisk(impact: EnhancedChangeImpact): RiskAssessment;
  generateSuggestions(impact: EnhancedChangeImpact): SuggestedAction[];
}
```

**验收标准**:
- [ ] 可分析直接和间接影响
- [ ] 可生成影响链路
- [ ] 可进行风险评估
- [ ] 可生成建议操作

---

## 三、技术架构

### 3.1 模块依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        WikiManager                               │
│  (核心控制器 - 协调所有子模块)                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ├──► WikiStorage (存储层)
         │
         ├──► WikiKnowledgeBase (知识库)
         │
         ├──► WikiVectorStore (向量存储)
         │
         ├──► WikiHistory (版本历史)
         │
         ├──► WikiAudit (审计日志)
         │
         ├──► WikiAutoSync (自动同步)
         │
         ├──► WikiSyncMonitor (同步监控)
         │
         ├──► WikiMemory (项目记忆)
         │
         ├──► WikiContextCompressor (上下文压缩)
         │
         ├──► WikiPromptEnhancer (Prompt 增强)
         │
         ├──► [NEW] WikiSharingService (共享服务) ─────── Phase 1
         │
         ├──► [NEW] WikiGraphGenerator (图谱生成) ─────── Phase 1
         │
         ├──► [NEW] WikiCollaborationService (协作服务) ─ Phase 2
         │
         ├──► [NEW] ADRService (ADR 服务) ─────────────── Phase 2
         │
         ├──► [NEW] WikiEditorService (编辑器服务) ────── Phase 3
         │
         ├──► [NEW] ArchitectureDiagramService (架构图) ─ Phase 3
         │
         ├──► [NEW] KnowledgeGraphService (知识图谱) ──── Phase 4
         │
         └──► [NEW] ChangeImpactAnalyzer (影响分析) ───── Phase 4
```

### 3.2 文件结构规划

```
src/wiki/
├── index.ts
├── types.ts                    # 扩展类型定义
├── wiki-manager.ts             # 核心管理器（扩展）
├── wiki-storage.ts
├── wiki-knowledge-base.ts
├── wiki-vector-store.ts
├── wiki-history.ts
├── wiki-diff.ts
├── wiki-audit.ts
├── wiki-auto-sync.ts
├── wiki-sync-monitor.ts
├── wiki-memory.ts
├── wiki-context-compressor.ts
├── wiki-prompt-enhancer.ts
│
├── sharing/                    # [NEW] 共享模块
│   ├── index.ts
│   ├── wiki-sharing-service.ts
│   ├── wiki-sharing-config.ts
│   └── wiki-sync-resolver.ts
│
├── graph/                      # [NEW] 图谱模块
│   ├── index.ts
│   ├── wiki-graph-generator.ts
│   ├── dependency-graph.ts
│   ├── call-graph.ts
│   └── inheritance-graph.ts
│
├── collaboration/              # [NEW] 协作模块
│   ├── index.ts
│   ├── wiki-collaboration-service.ts
│   ├── wiki-permission.ts
│   └── wiki-lock.ts
│
├── adr/                        # [NEW] ADR 模块
│   ├── index.ts
│   ├── adr-service.ts
│   ├── adr-extractor.ts
│   └── adr-templates.ts
│
├── editor/                     # [NEW] 编辑器模块
│   ├── index.ts
│   ├── wiki-editor-service.ts
│   ├── wiki-templates.ts
│   └── wiki-preview.ts
│
├── diagram/                    # [NEW] 架构图模块
│   ├── index.ts
│   ├── architecture-diagram.ts
│   ├── diagram-exporter.ts
│   └── diagram-templates.ts
│
├── knowledge/                  # [NEW] 知识图谱模块
│   ├── index.ts
│   ├── knowledge-graph-service.ts
│   ├── node-extractor.ts
│   ├── edge-builder.ts
│   └── recommendation.ts
│
└── impact/                     # [NEW] 影响分析模块
    ├── index.ts
    ├── change-impact-analyzer.ts
    ├── risk-assessment.ts
    └── suggestion-generator.ts
```

---

## 四、里程碑计划

| 阶段 | 功能 | 开始日期 | 结束日期 | 状态 |
|------|------|---------|---------|------|
| Phase 1 | Wiki 共享机制 | 2026-02-17 | 2026-02-23 | 待开始 |
| Phase 1 | 引用关系图谱可视化 | 2026-02-17 | 2026-02-23 | 待开始 |
| Phase 2 | 团队协作功能 | 2026-02-24 | 2026-03-02 | 待开始 |
| Phase 2 | 隐性知识显性化（ADR） | 2026-02-24 | 2026-03-02 | 待开始 |
| Phase 3 | Wiki 编辑器增强 | 2026-03-03 | 2026-03-06 | 待开始 |
| Phase 3 | 架构文档可视化 | 2026-03-03 | 2026-03-06 | 待开始 |
| Phase 4 | 知识图谱构建 | 2026-03-07 | 2026-03-10 | 待开始 |
| Phase 4 | 变更影响分析增强 | 2026-03-07 | 2026-03-10 | 待开始 |

---

## 五、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| Git 集成复杂度高 | 中 | 高 | 复用现有 GitWatcher 模块 |
| 图表渲染性能问题 | 低 | 中 | 使用增量渲染和缓存 |
| 多用户并发冲突 | 中 | 高 | 实现乐观锁和冲突检测 |
| ADR 自动提取准确率低 | 高 | 中 | 结合人工审核和 AI 辅助 |

---

## 六、参考资源

- [Qoder Repo Wiki 功能介绍](http://m.163.com/news/article/K99712UF00099BK0.html)
- [ADR 架构决策记录规范](https://adr.github.io/)
- [Mermaid 图表语法](https://mermaid.js.org/)
- [现有 Wiki 模块文档](../wiki/README.md)
