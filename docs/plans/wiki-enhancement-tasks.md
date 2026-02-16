# Wiki 生成增强功能任务清单

> 版本: 1.0.0  
> 创建日期: 2026-02-16  
> 对标产品: Qoder Repo Wiki

---

## 概述

本文档基于 Qoder Repo Wiki 功能对标分析，规划 Wiki 生成能力的持续增强方向。

### Qoder Repo Wiki 核心特性

| 特性 | 描述 |
|------|------|
| 自动文档生成 | 打开项目时自动分析生成结构化文档 |
| 增量更新 | Git HEAD 变更时自动同步更新文档 |
| 上下文洞察 | 分析项目结构和实现细节，提供深度理解 |
| Search Memory | Agent 执行任务时查询知识库，避免重复工具调用 |
| 大规模支持 | 支持最多 6000 文件，4000 文件约 120 分钟 |
| 交互式 Wiki | 结构化文档 + Mermaid 图表可视化 |

---

## Phase 1: 智能文档生成增强 (P0)

### 1.1 智能文档结构生成器

#### 1.1.1 类型定义与接口设计
- [ ] **TASK-1.1.1-1**: 定义 `DocumentStructure` 接口
  - 文件: `src/wiki/structure/types.ts`
  - 包含: DocumentSection, SectionHierarchy, SectionType, SectionPriority
  - 预计: 0.5h

- [ ] **TASK-1.1.1-2**: 定义 `StructureGenerator` 接口
  - 文件: `src/wiki/structure/types.ts`
  - 包含: generateStructure(), analyzeContent(), suggestSections()
  - 预计: 0.5h

- [ ] **TASK-1.1.1-3**: 定义 `SectionTemplate` 类型
  - 文件: `src/wiki/structure/types.ts`
  - 包含: 预设章节模板、变量替换规则
  - 预计: 0.5h

#### 1.1.2 结构生成器实现
- [ ] **TASK-1.1.2-1**: 实现 `DocumentStructureGenerator` 基础类
  - 文件: `src/wiki/structure/document-structure-generator.ts`
  - 方法: analyzeProjectStructure(), generateSectionHierarchy()
  - 预计: 2h

- [ ] **TASK-1.1.2-2**: 实现智能章节推荐
  - 文件: `src/wiki/structure/section-recommender.ts`
  - 方法: recommendSections(), prioritizeSections()
  - 预计: 2h

- [ ] **TASK-1.1.2-3**: 实现内容组织优化
  - 文件: `src/wiki/structure/content-organizer.ts`
  - 方法: organizeContent(), mergeSections(), splitSections()
  - 预计: 1.5h

#### 1.1.3 集成与测试
- [ ] **TASK-1.1.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: generate() 方法使用智能结构生成
  - 预计: 1h

- [ ] **TASK-1.1.3-2**: 编写单元测试
  - 文件: `tests/wiki/structure/document-structure-generator.test.ts`
  - 覆盖: 结构生成、章节推荐、内容组织
  - 预计: 1.5h

---

### 1.2 Search Memory 服务集成

#### 1.2.1 类型定义与接口设计
- [ ] **TASK-1.2.1-1**: 定义 `SearchMemory` 接口
  - 文件: `src/wiki/memory/types.ts`
  - 包含: MemoryEntry, MemoryQuery, MemoryResult, MemoryContext
  - 预计: 0.5h

- [ ] **TASK-1.2.1-2**: 定义 `MemoryService` 接口
  - 文件: `src/wiki/memory/types.ts`
  - 包含: store(), query(), invalidate(), getRelevant()
  - 预计: 0.5h

#### 1.2.2 Search Memory 实现
- [ ] **TASK-1.2.2-1**: 实现 `WikiSearchMemory` 服务
  - 文件: `src/wiki/memory/wiki-search-memory.ts`
  - 方法: storeKnowledge(), queryKnowledge(), getContextForAgent()
  - 预计: 2h

- [ ] **TASK-1.2.2-2**: 实现知识缓存机制
  - 文件: `src/wiki/memory/knowledge-cache.ts`
  - 方法: cache(), invalidate(), refresh()
  - 预计: 1.5h

- [ ] **TASK-1.2.2-3**: 实现 Agent 集成接口
  - 文件: `src/wiki/memory/agent-memory-bridge.ts`
  - 方法: provideContext(), enrichPrompt()
  - 预计: 1.5h

#### 1.2.3 集成与测试
- [ ] **TASK-1.2.3-1**: 集成到 AgentOrchestrator
  - 文件: `src/agents/orchestrator.ts`
  - 修改: Agent 执行时查询 Search Memory
  - 预计: 1h

- [ ] **TASK-1.2.3-2**: 编写单元测试
  - 文件: `tests/wiki/memory/wiki-search-memory.test.ts`
  - 覆盖: 存储、查询、缓存、Agent 集成
  - 预计: 1.5h

---

### 1.3 文档内容智能分类

#### 1.3.1 类型定义与接口设计
- [ ] **TASK-1.3.1-1**: 定义 `ContentClassifier` 接口
  - 文件: `src/wiki/classification/types.ts`
  - 包含: ContentCategory, ClassificationResult, CategoryRule
  - 预计: 0.5h

- [ ] **TASK-1.3.1-2**: 定义分类规则类型
  - 文件: `src/wiki/classification/types.ts`
  - 包含: RuleCondition, RuleAction, RulePriority
  - 预计: 0.5h

#### 1.3.2 分类器实现
- [ ] **TASK-1.3.2-1**: 实现 `WikiContentClassifier` 服务
  - 文件: `src/wiki/classification/content-classifier.ts`
  - 方法: classify(), autoCategorize(), suggestCategory()
  - 预计: 2h

- [ ] **TASK-1.3.2-2**: 实现分类规则引擎
  - 文件: `src/wiki/classification/rule-engine.ts`
  - 方法: applyRules(), evaluateConditions()
  - 预计: 1.5h

- [ ] **TASK-1.3.2-3**: 实现 AI 辅助分类
  - 文件: `src/wiki/classification/ai-classifier.ts`
  - 方法: classifyWithAI(), trainClassifier()
  - 预计: 2h

#### 1.3.3 集成与测试
- [ ] **TASK-1.3.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 文档生成时自动分类
  - 预计: 1h

- [ ] **TASK-1.3.3-2**: 编写单元测试
  - 文件: `tests/wiki/classification/content-classifier.test.ts`
  - 覆盖: 分类、规则引擎、AI 分类
  - 预计: 1.5h

---

## Phase 2: 文档关联与交互 (P1)

### 2.1 代码位置双向跳转

#### 2.1.1 类型定义与接口设计
- [ ] **TASK-2.1.1-1**: 定义 `CodeLocation` 接口
  - 文件: `src/wiki/location/types.ts`
  - 包含: FileLocation, SymbolLocation, Range, Position
  - 预计: 0.5h

- [ ] **TASK-2.1.1-2**: 定义 `LocationLinker` 接口
  - 文件: `src/wiki/location/types.ts`
  - 包含: linkToCode(), resolveLocation(), getReferences()
  - 预计: 0.5h

#### 2.1.2 位置链接实现
- [ ] **TASK-2.1.2-1**: 实现 `CodeLocationLinker` 服务
  - 文件: `src/wiki/location/code-location-linker.ts`
  - 方法: createLink(), resolveLink(), updateLinks()
  - 预计: 2h

- [ ] **TASK-2.1.2-2**: 实现符号引用追踪
  - 文件: `src/wiki/location/symbol-tracker.ts`
  - 方法: trackSymbol(), findUsages(), getDefinition()
  - 预计: 2h

- [ ] **TASK-2.1.2-3**: 实现位置索引
  - 文件: `src/wiki/location/location-index.ts`
  - 方法: indexLocations(), queryByLocation(), queryByPage()
  - 预计: 1.5h

#### 2.1.3 集成与测试
- [ ] **TASK-2.1.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 文档生成时创建位置链接
  - 预计: 1h

- [ ] **TASK-2.1.3-2**: 编写单元测试
  - 文件: `tests/wiki/location/code-location-linker.test.ts`
  - 覆盖: 链接创建、解析、索引
  - 预计: 1.5h

---

### 2.2 增量更新性能优化

#### 2.2.1 类型定义与接口设计
- [ ] **TASK-2.2.1-1**: 定义 `IncrementalUpdateConfig` 接口
  - 文件: `src/wiki/incremental/types.ts`
  - 包含: UpdateStrategy, BatchConfig, PerformanceMetrics
  - 预计: 0.5h

- [ ] **TASK-2.2.1-2**: 定义 `UpdateOptimizer` 接口
  - 文件: `src/wiki/incremental/types.ts`
  - 包含: optimizeUpdate(), batchChanges(), prioritizeUpdates()
  - 预计: 0.5h

#### 2.2.2 增量更新优化实现
- [ ] **TASK-2.2.2-1**: 实现 `IncrementalUpdateOptimizer` 服务
  - 文件: `src/wiki/incremental/update-optimizer.ts`
  - 方法: analyzeChanges(), optimizeBatch(), executeOptimized()
  - 预计: 2h

- [ ] **TASK-2.2.2-2**: 实现变更影响分析
  - 文件: `src/wiki/incremental/change-impact-analyzer.ts`
  - 方法: analyzeImpact(), getAffectedPages(), estimateUpdateTime()
  - 预计: 2h

- [ ] **TASK-2.2.2-3**: 实现并行更新处理
  - 文件: `src/wiki/incremental/parallel-updater.ts`
  - 方法: parallelUpdate(), mergeResults()
  - 预计: 1.5h

#### 2.2.3 集成与测试
- [ ] **TASK-2.2.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: update() 方法使用优化策略
  - 预计: 1h

- [ ] **TASK-2.2.3-2**: 编写性能测试
  - 文件: `tests/wiki/incremental/update-optimizer.test.ts`
  - 覆盖: 性能指标、批量处理、并行更新
  - 预计: 1.5h

---

## Phase 3: 质量与扩展 (P2)

### 3.1 文档质量评分系统

#### 3.1.1 类型定义与接口设计
- [ ] **TASK-3.1.1-1**: 定义 `DocumentQuality` 接口
  - 文件: `src/wiki/quality/types.ts`
  - 包含: QualityScore, QualityDimension, QualityReport
  - 预计: 0.5h

- [ ] **TASK-3.1.1-2**: 定义 `QualityEvaluator` 接口
  - 文件: `src/wiki/quality/types.ts`
  - 包含: evaluate(), getScore(), getRecommendations()
  - 预计: 0.5h

#### 3.1.2 质量评估实现
- [ ] **TASK-3.1.2-1**: 实现 `DocumentQualityEvaluator` 服务
  - 文件: `src/wiki/quality/quality-evaluator.ts`
  - 方法: evaluate(), calculateScore(), generateReport()
  - 预计: 2h

- [ ] **TASK-3.1.2-2**: 实现完整性检查
  - 文件: `src/wiki/quality/completeness-checker.ts`
  - 方法: checkCompleteness(), findMissingSections()
  - 预计: 1.5h

- [ ] **TASK-3.1.2-3**: 实现可读性评分
  - 文件: `src/wiki/quality/readability-scorer.ts`
  - 方法: scoreReadability(), analyzeStructure()
  - 预计: 1.5h

#### 3.1.3 集成与测试
- [ ] **TASK-3.1.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 文档生成后自动评分
  - 预计: 1h

- [ ] **TASK-3.1.3-2**: 编写单元测试
  - 文件: `tests/wiki/quality/quality-evaluator.test.ts`
  - 覆盖: 评分、完整性、可读性
  - 预计: 1.5h

---

### 3.2 智能摘要生成优化

#### 3.2.1 类型定义与接口设计
- [ ] **TASK-3.2.1-1**: 定义 `SummaryConfig` 接口
  - 文件: `src/wiki/summary/types.ts`
  - 包含: SummaryType, SummaryLength, SummaryStyle
  - 预计: 0.5h

- [ ] **TASK-3.2.1-2**: 定义 `SummaryGenerator` 接口
  - 文件: `src/wiki/summary/types.ts`
  - 包含: generate(), customize(), optimize()
  - 预计: 0.5h

#### 3.2.2 摘要生成实现
- [ ] **TASK-3.2.2-1**: 实现 `IntelligentSummaryGenerator` 服务
  - 文件: `src/wiki/summary/intelligent-summary-generator.ts`
  - 方法: generateSummary(), extractKeyPoints(), formatSummary()
  - 预计: 2h

- [ ] **TASK-3.2.2-2**: 实现 AI 摘要增强
  - 文件: `src/wiki/summary/ai-summary-enhancer.ts`
  - 方法: enhanceWithAI(), improveClarity()
  - 预计: 1.5h

- [ ] **TASK-3.2.2-3**: 实现摘要模板系统
  - 文件: `src/wiki/summary/summary-templates.ts`
  - 方法: applyTemplate(), customizeTemplate()
  - 预计: 1h

#### 3.2.3 集成与测试
- [ ] **TASK-3.2.3-1**: 集成到 WikiManager
  - 文件: `src/wiki/wiki-manager.ts`
  - 修改: 页面生成时使用智能摘要
  - 预计: 1h

- [ ] **TASK-3.2.3-2**: 编写单元测试
  - 文件: `tests/wiki/summary/intelligent-summary-generator.test.ts`
  - 覆盖: 摘要生成、AI 增强、模板应用
  - 预计: 1.5h

---

## 任务统计

| 阶段 | 任务数 | 预计工时 |
|------|-------|---------|
| Phase 1 | 18 | 24h |
| Phase 2 | 12 | 16h |
| Phase 3 | 12 | 15h |
| **总计** | **42** | **55h** |

---

## 任务依赖关系

```
Phase 1
├── 1.1 智能文档结构生成器
│   └── 依赖: ArchitectureAnalyzer, ParsedFile
├── 1.2 Search Memory 服务集成
│   └── 依赖: WikiKnowledgeBase, WikiVectorStore
└── 1.3 文档内容智能分类
    └── 依赖: 1.1 结构生成器

Phase 2 (依赖 Phase 1)
├── 2.1 代码位置双向跳转
│   └── 依赖: Parsers, SymbolTable
└── 2.2 增量更新性能优化
    └── 依赖: IncrementalUpdater, ChangeDetector

Phase 3 (依赖 Phase 2)
├── 3.1 文档质量评分系统
│   └── 依赖: 1.1 结构生成器
└── 3.2 智能摘要生成优化
    └── 依赖: LLMService, 1.2 Search Memory
```

---

## 完成标准

### Phase 1 完成标准
- [ ] 智能文档结构生成器可自动生成多层次文档结构
- [ ] Search Memory 服务可被 Agent 调用获取上下文
- [ ] 文档内容可自动分类到正确的类别

### Phase 2 完成标准
- [ ] 文档可跳转到对应的代码位置
- [ ] 增量更新性能提升 50% 以上

### Phase 3 完成标准
- [ ] 文档质量评分系统可生成详细的质量报告
- [ ] 智能摘要生成质量得到 AI 评估认可
