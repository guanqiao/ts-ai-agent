# Wiki 功能增强任务清单

> 版本: 1.0.0  
> 创建日期: 2026-02-16  
> 关联文档: [wiki-enhancement-plan.md](./wiki-enhancement-plan.md)

---

## Phase 1: P0 核心功能

### 1.1 Wiki 共享机制

#### 1.1.1 类型定义与接口设计
- [ ] **TASK-1.1.1-1**: 定义 `WikiSharingConfig` 接口
  - 文件: `src/wiki/sharing/wiki-sharing-config.ts`
  - 包含: enabled, shareToGit, sharePath, accessControl, syncWithRemote, autoCommit
  - 预计: 0.5h

- [ ] **TASK-1.1.1-2**: 定义 `ShareResult` 和 `SyncResult` 类型
  - 文件: `src/wiki/sharing/wiki-sharing-config.ts`
  - 包含: 成功/失败状态、冲突列表、同步详情
  - 预计: 0.5h

- [ ] **TASK-1.1.1-3**: 定义 `ShareStatus` 和 `Conflict` 类型
  - 文件: `src/wiki/sharing/wiki-sharing-config.ts`
  - 包含: 同步状态枚举、冲突详情、解决方案
  - 预计: 0.5h

#### 1.1.2 共享服务实现
- [ ] **TASK-1.1.2-1**: 实现 `WikiSharingService` 基础类
  - 文件: `src/wiki/sharing/wiki-sharing-service.ts`
  - 包含: 初始化、配置管理、状态查询
  - 预计: 2h

- [ ] **TASK-1.1.2-2**: 实现 Git 集成共享功能
  - 文件: `src/wiki/sharing/wiki-sharing-service.ts`
  - 方法: share(), commitToGit(), pushToRemote()
  - 预计: 3h

- [ ] **TASK-1.1.2-3**: 实现同步功能
  - 文件: `src/wiki/sharing/wiki-sharing-service.ts`
  - 方法: sync(), pullFromRemote(), detectConflicts()
  - 预计: 3h

- [ ] **TASK-1.1.2-4**: 实现冲突解决机制
  - 文件: `src/wiki/sharing/wiki-sync-resolver.ts`
  - 方法: resolveConflicts(), autoMerge(), manualMerge()
  - 预计: 2h

#### 1.1.3 集成与测试
- [ ] **TASK-1.1.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加共享相关方法
  - 预计: 1h

- [ ] **TASK-1.1.3-2**: 编写单元测试
  - 文件: `tests/wiki/sharing/wiki-sharing-service.test.ts`
  - 覆盖: 配置、共享、同步、冲突解决
  - 预计: 2h

- [ ] **TASK-1.1.3-3**: 编写集成测试
  - 文件: `tests/wiki/sharing/wiki-sharing-integration.test.ts`
  - 覆盖: Git 操作、远程同步
  - 预计: 2h

---

### 1.2 引用关系图谱可视化

#### 1.2.1 类型定义与接口设计
- [ ] **TASK-1.2.1-1**: 定义图谱相关类型
  - 文件: `src/wiki/graph/types.ts`
  - 包含: WikiGraphVisualization, GraphOptions, Graph, Node, Edge
  - 预计: 1h

- [ ] **TASK-1.2.1-2**: 定义 `WikiGraphGenerator` 接口
  - 文件: `src/wiki/graph/types.ts`
  - 包含: 图谱生成方法签名
  - 预计: 0.5h

#### 1.2.2 依赖关系图实现
- [ ] **TASK-1.2.2-1**: 实现模块依赖关系图生成
  - 文件: `src/wiki/graph/dependency-graph.ts`
  - 方法: generateModuleDependencyGraph()
  - 预计: 3h

- [ ] **TASK-1.2.2-2**: 实现文件依赖关系图生成
  - 文件: `src/wiki/graph/dependency-graph.ts`
  - 方法: generateFileDependencyGraph()
  - 预计: 2h

- [ ] **TASK-1.2.2-3**: 实现循环依赖检测
  - 文件: `src/wiki/graph/dependency-graph.ts`
  - 方法: detectCircularDependencies()
  - 预计: 2h

#### 1.2.3 调用关系图实现
- [ ] **TASK-1.2.3-1**: 实现函数调用关系图
  - 文件: `src/wiki/graph/call-graph.ts`
  - 方法: generateCallGraph()
  - 预计: 3h

- [ ] **TASK-1.2.3-2**: 实现类继承关系图
  - 文件: `src/wiki/graph/inheritance-graph.ts`
  - 方法: generateInheritanceGraph()
  - 预计: 2h

- [ ] **TASK-1.2.3-3**: 实现接口实现关系图
  - 文件: `src/wiki/graph/inheritance-graph.ts`
  - 方法: generateImplementationGraph()
  - 预计: 2h

#### 1.2.4 图表导出实现
- [ ] **TASK-1.2.4-1**: 实现 Mermaid 格式导出
  - 文件: `src/wiki/graph/wiki-graph-generator.ts`
  - 方法: exportToMermaid()
  - 预计: 2h

- [ ] **TASK-1.2.4-2**: 实现 SVG 格式导出
  - 文件: `src/wiki/graph/wiki-graph-generator.ts`
  - 方法: exportToSVG()
  - 预计: 2h

- [ ] **TASK-1.2.4-3**: 实现 JSON 数据导出
  - 文件: `src/wiki/graph/wiki-graph-generator.ts`
  - 方法: exportToJSON()
  - 预计: 1h

#### 1.2.5 集成与测试
- [ ] **TASK-1.2.5-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加图谱生成方法
  - 预计: 1h

- [ ] **TASK-1.2.5-2**: 集成到架构页面生成
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: createArchitecturePage() 添加图谱
  - 预计: 1h

- [ ] **TASK-1.2.5-3**: 编写单元测试
  - 文件: `tests/wiki/graph/wiki-graph-generator.test.ts`
  - 覆盖: 各类图谱生成、导出格式
  - 预计: 2h

---

## Phase 2: P1 协作功能

### 2.1 团队协作功能

#### 2.1.1 类型定义与接口设计
- [x] **TASK-2.1.1-1**: 定义用户和权限类型
  - 文件: `src/wiki/collaboration/types.ts`
  - 包含: WikiContributor, WikiPermission, WikiRole
  - 预计: 1h

- [x] **TASK-2.1.1-2**: 定义协作服务接口
  - 文件: `src/wiki/collaboration/types.ts`
  - 包含: WikiCollaborationService 接口
  - 预计: 0.5h

- [x] **TASK-2.1.1-3**: 定义锁和会话类型
  - 文件: `src/wiki/collaboration/types.ts`
  - 包含: PageLock, EditSession, LockStatus
  - 预计: 0.5h

#### 2.1.2 用户管理实现
- [x] **TASK-2.1.2-1**: 实现贡献者管理
  - 文件: `src/wiki/collaboration/wiki-collaboration-service.ts`
  - 方法: addContributor(), removeContributor(), getContributors()
  - 预计: 2h

- [x] **TASK-2.1.2-2**: 实现用户配置存储
  - 文件: `src/wiki/collaboration/wiki-collaboration-service.ts`
  - 方法: saveUserConfig(), loadUserConfig()
  - 预计: 1h

#### 2.1.3 权限管理实现
- [x] **TASK-2.1.3-1**: 实现权限设置
  - 文件: `src/wiki/collaboration/wiki-permission.ts`
  - 方法: setPermission(), getPermissions(), checkPermission()
  - 预计: 2h

- [x] **TASK-2.1.3-2**: 实现角色管理
  - 文件: `src/wiki/collaboration/wiki-permission.ts`
  - 方法: assignRole(), getRole(), getRolePermissions()
  - 预计: 1h

- [x] **TASK-2.1.3-3**: 实现权限检查中间件
  - 文件: `src/wiki/collaboration/wiki-permission.ts`
  - 方法: requirePermission(), filterByPermission()
  - 预计: 1h

#### 2.1.4 编辑锁实现
- [x] **TASK-2.1.4-1**: 实现页面锁机制
  - 文件: `src/wiki/collaboration/wiki-lock.ts`
  - 方法: lockPage(), unlockPage(), getLockStatus()
  - 预计: 2h

- [x] **TASK-2.1.4-2**: 实现锁超时和自动释放
  - 文件: `src/wiki/collaboration/wiki-lock.ts`
  - 方法: startLockMonitor(), releaseExpiredLocks()
  - 预计: 1h

- [x] **TASK-2.1.4-3**: 实现编辑会话管理
  - 文件: `src/wiki/collaboration/wiki-lock.ts`
  - 方法: createSession(), updateSession(), endSession()
  - 预计: 1h

#### 2.1.5 集成与测试
- [x] **TASK-2.1.5-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加协作相关方法
  - 预计: 1h

- [x] **TASK-2.1.5-2**: 编写单元测试
  - 文件: `tests/wiki/collaboration/wiki-collaboration-service.test.ts`
  - 覆盖: 用户管理、权限、锁
  - 预计: 2h

---

### 2.2 隐性知识显性化（ADR）

#### 2.2.1 类型定义与接口设计
- [x] **TASK-2.2.1-1**: 定义 ADR 核心类型
  - 文件: `src/wiki/adr/types.ts`
  - 包含: ArchitectureDecisionRecord, ADRStatus, Alternative
  - 预计: 1h

- [x] **TASK-2.2.1-2**: 定义 ADR 服务接口
  - 文件: `src/wiki/adr/types.ts`
  - 包含: ADRService, ADRFilter, ADRTemplate
  - 预计: 0.5h

#### 2.2.2 ADR 服务实现
- [x] **TASK-2.2.2-1**: 实现 ADR CRUD 操作
  - 文件: `src/wiki/adr/adr-service.ts`
  - 方法: create(), update(), get(), list(), delete()
  - 预计: 2h

- [x] **TASK-2.2.2-2**: 实现 ADR 状态流转
  - 文件: `src/wiki/adr/adr-service.ts`
  - 方法: propose(), accept(), deprecate(), supersede()
  - 预计: 1h

- [x] **TASK-2.2.2-3**: 实现 ADR 关联管理
  - 文件: `src/wiki/adr/adr-service.ts`
  - 方法: linkToPage(), linkToCode(), getRelated()
  - 预计: 1h

#### 2.2.3 ADR 自动提取实现
- [x] **TASK-2.2.3-1**: 实现从代码注释提取
  - 文件: `src/wiki/adr/adr-extractor.ts`
  - 方法: extractFromCode()
  - 支持标签: @decision, @why, @todo(decision)
  - 预计: 3h

- [x] **TASK-2.2.3-2**: 实现从提交信息提取
  - 文件: `src/wiki/adr/adr-extractor.ts`
  - 方法: extractFromCommits()
  - 解析: conventional commits, 决策关键词
  - 预计: 2h

- [x] **TASK-2.2.3-3**: 实现从文档提取
  - 文件: `src/wiki/adr/adr-extractor.ts`
  - 方法: extractFromDocs()
  - 解析: RFC, 设计文档
  - 预计: 2h

#### 2.2.4 ADR 模板系统实现
- [x] **TASK-2.2.4-1**: 实现预设模板
  - 文件: `src/wiki/adr/adr-templates.ts`
  - 模板: 标准 ADR, 轻量 ADR, 技术选型 ADR
  - 预计: 1h

- [x] **TASK-2.2.4-2**: 实现模板变量填充
  - 文件: `src/wiki/adr/adr-templates.ts`
  - 方法: fillTemplate(), validateTemplate()
  - 预计: 1h

- [x] **TASK-2.2.4-3**: 实现自定义模板支持
  - 文件: `src/wiki/adr/adr-templates.ts`
  - 方法: addTemplate(), getTemplates(), removeTemplate()
  - 预计: 1h

#### 2.2.5 集成与测试
- [x] **TASK-2.2.5-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加 ADR 相关方法
  - 预计: 1h

- [x] **TASK-2.2.5-2**: 创建 ADR 页面类型
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加 'decision' 分类页面生成
  - 预计: 1h

- [x] **TASK-2.2.5-3**: 编写单元测试
  - 文件: `tests/wiki/adr/adr-service.test.ts`
  - 覆盖: CRUD、提取、模板
  - 预计: 2h

---

## Phase 3: P2 体验增强

### 3.1 Wiki 编辑器增强

#### 3.1.1 类型定义与接口设计
- [ ] **TASK-3.1.1-1**: 定义编辑器配置类型
  - 文件: `src/wiki/editor/types.ts`
  - 包含: WikiEditorConfig, WikiEditSession, EditorMode
  - 预计: 0.5h

- [ ] **TASK-3.1.1-2**: 定义模板类型
  - 文件: `src/wiki/editor/types.ts`
  - 包含: WikiTemplate, TemplateVariable, TemplateCategory
  - 预计: 0.5h

#### 3.1.2 编辑器服务实现
- [ ] **TASK-3.1.2-1**: 实现编辑会话管理
  - 文件: `src/wiki/editor/wiki-editor-service.ts`
  - 方法: createSession(), updateSession(), endSession()
  - 预计: 2h

- [ ] **TASK-3.1.2-2**: 实现自动保存功能
  - 文件: `src/wiki/editor/wiki-editor-service.ts`
  - 方法: enableAutoSave(), saveDraft(), restoreDraft()
  - 预计: 1h

- [ ] **TASK-3.1.2-3**: 实现预览功能
  - 文件: `src/wiki/editor/wiki-preview.ts`
  - 方法: renderPreview(), syncScroll()
  - 预计: 2h

#### 3.1.3 模板系统实现
- [ ] **TASK-3.1.3-1**: 实现预设模板
  - 文件: `src/wiki/editor/wiki-templates.ts`
  - 模板: API 文档、模块文档、架构文档、变更日志
  - 预计: 1h

- [ ] **TASK-3.1.3-2**: 实现模板应用
  - 文件: `src/wiki/editor/wiki-templates.ts`
  - 方法: applyTemplate(), fillVariables()
  - 预计: 1h

- [ ] **TASK-3.1.3-3**: 实现自定义模板
  - 文件: `src/wiki/editor/wiki-templates.ts`
  - 方法: createTemplate(), validateTemplate()
  - 预计: 1h

#### 3.1.4 集成与测试
- [ ] **TASK-3.1.4-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加编辑器相关方法
  - 预计: 1h

- [ ] **TASK-3.1.4-2**: 编写单元测试
  - 文件: `tests/wiki/editor/wiki-editor-service.test.ts`
  - 覆盖: 会话、自动保存、模板
  - 预计: 1h

---

### 3.2 架构文档可视化

#### 3.2.1 类型定义与接口设计
- [ ] **TASK-3.2.1-1**: 定义架构图类型
  - 文件: `src/wiki/diagram/types.ts`
  - 包含: ArchitectureDiagram, DiagramNode, DiagramEdge, DiagramLayer
  - 预计: 1h

- [ ] **TASK-3.2.1-2**: 定义导出选项类型
  - 文件: `src/wiki/diagram/types.ts`
  - 包含: ExportOptions, DiagramStyle, LayoutOptions
  - 预计: 0.5h

#### 3.2.2 架构图生成实现
- [ ] **TASK-3.2.2-1**: 实现分层架构图
  - 文件: `src/wiki/diagram/architecture-diagram.ts`
  - 方法: generateLayeredDiagram()
  - 预计: 2h

- [ ] **TASK-3.2.2-2**: 实现组件架构图
  - 文件: `src/wiki/diagram/architecture-diagram.ts`
  - 方法: generateComponentDiagram()
  - 预计: 2h

- [ ] **TASK-3.2.2-3**: 实现部署架构图
  - 文件: `src/wiki/diagram/architecture-diagram.ts`
  - 方法: generateDeploymentDiagram()
  - 预计: 2h

#### 3.2.3 导出功能实现
- [ ] **TASK-3.2.3-1**: 实现 Mermaid 导出
  - 文件: `src/wiki/diagram/diagram-exporter.ts`
  - 方法: exportToMermaid()
  - 预计: 1h

- [ ] **TASK-3.2.3-2**: 实现 SVG 导出
  - 文件: `src/wiki/diagram/diagram-exporter.ts`
  - 方法: exportToSVG()
  - 预计: 2h

- [ ] **TASK-3.2.3-3**: 实现 PNG 导出
  - 文件: `src/wiki/diagram/diagram-exporter.ts`
  - 方法: exportToPNG()
  - 预计: 1h

#### 3.2.4 集成与测试
- [ ] **TASK-3.2.4-1**: 集成到架构页面
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: createArchitecturePage() 添加架构图
  - 预计: 1h

- [ ] **TASK-3.2.4-2**: 编写单元测试
  - 文件: `tests/wiki/diagram/architecture-diagram.test.ts`
  - 覆盖: 各类架构图生成、导出
  - 预计: 1h

---

## Phase 4: P3 高级功能

### 4.1 知识图谱构建

#### 4.1.1 类型定义与接口设计
- [ ] **TASK-4.1.1-1**: 定义知识图谱类型
  - 文件: `src/wiki/knowledge/types.ts`
  - 包含: KnowledgeGraph, KnowledgeNode, KnowledgeEdge, KnowledgeCluster
  - 预计: 1h

- [ ] **TASK-4.1.1-2**: 定义推荐类型
  - 文件: `src/wiki/knowledge/types.ts`
  - 包含: Recommendation, LearningPath, NodeRelation
  - 预计: 0.5h

#### 4.1.2 节点提取实现
- [ ] **TASK-4.1.2-1**: 实现概念节点提取
  - 文件: `src/wiki/knowledge/node-extractor.ts`
  - 方法: extractConcepts()
  - 预计: 2h

- [ ] **TASK-4.1.2-2**: 实现 API 节点提取
  - 文件: `src/wiki/knowledge/node-extractor.ts`
  - 方法: extractAPIs()
  - 预计: 1h

- [ ] **TASK-4.1.2-3**: 实现模式节点提取
  - 文件: `src/wiki/knowledge/node-extractor.ts`
  - 方法: extractPatterns()
  - 预计: 2h

#### 4.1.3 关系构建实现
- [ ] **TASK-4.1.3-1**: 实现边构建
  - 文件: `src/wiki/knowledge/edge-builder.ts`
  - 方法: buildEdges(), inferRelations()
  - 预计: 2h

- [ ] **TASK-4.1.3-2**: 实现聚类分析
  - 文件: `src/wiki/knowledge/edge-builder.ts`
  - 方法: clusterNodes(), findCommunities()
  - 预计: 2h

#### 4.1.4 推荐系统实现
- [ ] **TASK-4.1.4-1**: 实现相关节点查询
  - 文件: `src/wiki/knowledge/recommendation.ts`
  - 方法: findRelated()
  - 预计: 2h

- [ ] **TASK-4.1.4-2**: 实现学习路径生成
  - 文件: `src/wiki/knowledge/recommendation.ts`
  - 方法: getLearningPath()
  - 预计: 2h

- [ ] **TASK-4.1.4-3**: 实现智能推荐
  - 文件: `src/wiki/knowledge/recommendation.ts`
  - 方法: recommend()
  - 预计: 2h

#### 4.1.5 集成与测试
- [ ] **TASK-4.1.5-1**: 实现知识图谱服务
  - 文件: `src/wiki/knowledge/knowledge-graph-service.ts`
  - 方法: build(), query(), export()
  - 预计: 2h

- [ ] **TASK-4.1.5-2**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 添加知识图谱方法
  - 预计: 1h

- [ ] **TASK-4.1.5-3**: 编写单元测试
  - 文件: `tests/wiki/knowledge/knowledge-graph-service.test.ts`
  - 覆盖: 节点提取、关系构建、推荐
  - 预计: 2h

---

### 4.2 变更影响分析增强

#### 4.2.1 类型定义与接口设计
- [ ] **TASK-4.2.1-1**: 定义影响分析类型
  - 文件: `src/wiki/impact/types.ts`
  - 包含: EnhancedChangeImpact, ImpactItem, ImpactChain
  - 预计: 1h

- [ ] **TASK-4.2.1-2**: 定义风险评估类型
  - 文件: `src/wiki/impact/types.ts`
  - 包含: RiskAssessment, RiskFactor, RiskLevel
  - 预计: 0.5h

- [ ] **TASK-4.2.1-3**: 定义建议操作类型
  - 文件: `src/wiki/impact/types.ts`
  - 包含: SuggestedAction, ActionType, ActionPriority
  - 预计: 0.5h

#### 4.2.2 影响分析实现
- [ ] **TASK-4.2.2-1**: 实现直接影响分析
  - 文件: `src/wiki/impact/change-impact-analyzer.ts`
  - 方法: analyzeDirectImpact()
  - 预计: 2h

- [ ] **TASK-4.2.2-2**: 实现间接影响分析
  - 文件: `src/wiki/impact/change-impact-analyzer.ts`
  - 方法: analyzeIndirectImpact()
  - 预计: 2h

- [ ] **TASK-4.2.2-3**: 实现影响链路追踪
  - 文件: `src/wiki/impact/change-impact-analyzer.ts`
  - 方法: traceImpactChain()
  - 预计: 2h

#### 4.2.3 风险评估实现
- [ ] **TASK-4.2.3-1**: 实现风险评分
  - 文件: `src/wiki/impact/risk-assessment.ts`
  - 方法: calculateRiskScore()
  - 预计: 2h

- [ ] **TASK-4.2.3-2**: 实现风险因素识别
  - 文件: `src/wiki/impact/risk-assessment.ts`
  - 方法: identifyRiskFactors()
  - 预计: 1h

- [ ] **TASK-4.2.3-3**: 实现缓解建议生成
  - 文件: `src/wiki/impact/risk-assessment.ts`
  - 方法: generateMitigation()
  - 预计: 1h

#### 4.2.4 建议生成实现
- [ ] **TASK-4.2.4-1**: 实现文档更新建议
  - 文件: `src/wiki/impact/suggestion-generator.ts`
  - 方法: suggestDocUpdates()
  - 预计: 1h

- [ ] **TASK-4.2.4-2**: 实现测试运行建议
  - 文件: `src/wiki/impact/suggestion-generator.ts`
  - 方法: suggestTestRuns()
  - 预计: 1h

- [ ] **TASK-4.2.4-3**: 实现通知建议
  - 文件: `src/wiki/impact/suggestion-generator.ts`
  - 方法: suggestNotifications()
  - 预计: 1h

#### 4.2.5 集成与测试
- [ ] **TASK-4.2.5-1**: 集成到 WikiSyncMonitor
  - 文件: `src/wiki/wiki-sync-monitor.ts`
  - 修改: 使用增强的影响分析
  - 预计: 1h

- [ ] **TASK-4.2.5-2**: 编写单元测试
  - 文件: `tests/wiki/impact/change-impact-analyzer.test.ts`
  - 覆盖: 影响分析、风险评估、建议生成
  - 预计: 2h

---

## 任务统计

| 阶段 | 任务数 | 预计工时 |
|------|-------|---------|
| Phase 1 | 24 | 36h |
| Phase 2 | 26 | 35h |
| Phase 3 | 16 | 19h |
| Phase 4 | 24 | 32h |
| **总计** | **90** | **122h** |

---

## 任务依赖关系

```
Phase 1
├── 1.1 Wiki 共享机制
│   └── 依赖: GitWatcher, WikiStorage
└── 1.2 引用关系图谱可视化
    └── 依赖: ArchitectureAnalyzer

Phase 2 (依赖 Phase 1)
├── 2.1 团队协作功能
│   └── 依赖: WikiAudit, WikiHistory
└── 2.2 隐性知识显性化（ADR）
    └── 依赖: 代码解析, Git 历史

Phase 3 (依赖 Phase 2)
├── 3.1 Wiki 编辑器增强
│   └── 依赖: WikiTemplates, WikiHistory
└── 3.2 架构文档可视化
    └── 依赖: 1.2 图谱生成

Phase 4 (依赖 Phase 3)
├── 4.1 知识图谱构建
│   └── 依赖: WikiKnowledgeBase, WikiVectorStore
└── 4.2 变更影响分析增强
    └── 依赖: WikiSyncMonitor, 1.2 图谱
```
