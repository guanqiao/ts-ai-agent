# Wiki 功能增强改进计划

## 目标
对标 Qoder Repo Wiki，实现自动化触发、文档滞后提醒、向量语义搜索、上下文压缩等核心能力。

---

## 一、新增模块结构

```
src/
├── wiki/
│   ├── wiki-auto-sync.ts        # 自动同步服务
│   ├── wiki-sync-monitor.ts     # 文档同步监控
│   ├── wiki-vector-store.ts     # 向量存储服务
│   ├── wiki-context-compressor.ts # 上下文压缩器
│   ├── wiki-memory.ts           # 动态记忆模块
│   └── wiki-prompt-enhancer.ts  # 提示词增强器
│
├── search/
│   ├── index.ts                 # 模块导出
│   ├── hybrid-search.ts         # 混合搜索引擎
│   ├── semantic-search.ts       # 语义搜索
│   └── types.ts                 # 搜索类型定义
│
└── config/
    ├── index.ts                 # 模块导出
    ├── config-manager.ts        # 配置管理器
    └── types.ts                 # 配置类型定义
```

---

## 二、实现任务清单

### Phase 1: 自动化与同步监控（高优先级）

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 1.1 | 自动同步类型定义 | `src/wiki/types.ts` | 扩展 AutoSyncConfig 等类型 |
| 1.2 | 自动同步服务 | `src/wiki/wiki-auto-sync.ts` | 项目打开时自动分析、后台同步 |
| 1.3 | 文档同步监控 | `src/wiki/wiki-sync-monitor.ts` | 文档滞后检测、过期提醒 |
| 1.4 | WikiManager 集成 | `src/wiki/wiki-manager.ts` | 集成自动同步和监控 |

### Phase 2: 向量搜索与混合检索（高优先级）

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 2.1 | 搜索类型定义 | `src/search/types.ts` | SearchResult、HybridSearchOptions 等 |
| 2.2 | 向量存储服务 | `src/wiki/wiki-vector-store.ts` | 向量嵌入、相似度搜索 |
| 2.3 | 语义搜索 | `src/search/semantic-search.ts` | 基于向量的语义搜索 |
| 2.4 | 混合搜索引擎 | `src/search/hybrid-search.ts` | 关键词 + 语义融合搜索 |
| 2.5 | 搜索模块导出 | `src/search/index.ts` | 模块统一导出 |

### Phase 3: 上下文优化（高优先级）

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 3.1 | 上下文压缩器 | `src/wiki/wiki-context-compressor.ts` | 会话摘要、关键信息提取 |
| 3.2 | 动态记忆模块 | `src/wiki/wiki-memory.ts` | 编码风格学习、约定识别 |
| 3.3 | 提示词增强器 | `src/wiki/wiki-prompt-enhancer.ts` | 需求结构化、任务补全 |

### Phase 4: 配置管理（中优先级）

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 4.1 | 配置类型定义 | `src/config/types.ts` | WikiConfig、ProjectConfig 等 |
| 4.2 | 配置管理器 | `src/config/config-manager.ts` | 配置文件读写、验证 |
| 4.3 | 配置模块导出 | `src/config/index.ts` | 模块统一导出 |

### Phase 5: CLI 增强

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 5.1 | CLI 扩展 | `src/cli/index.ts` | 新增 sync、compress、config 子命令 |

### Phase 6: 测试覆盖

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 6.1 | 搜索模块测试 | `tests/search/*.test.ts` | 混合搜索测试 |
| 6.2 | Wiki 扩展测试 | `tests/wiki/*.test.ts` | 自动同步、压缩器测试 |

---

## 三、核心接口设计

### 3.1 自动同步服务
```typescript
interface IWikiAutoSync {
  start(config: AutoSyncConfig): Promise<void>;
  stop(): void;
  getStatus(): SyncStatus;
  forceSync(): Promise<void>;
}

interface AutoSyncConfig {
  onProjectOpen: boolean;
  onGitChange: boolean;
  debounceMs: number;
  backgroundMode: boolean;
  notifyOnOutdated: boolean;
}
```

### 3.2 文档同步监控
```typescript
interface IWikiSyncMonitor {
  checkSyncStatus(): Promise<SyncStatus>;
  getOutdatedPages(): Promise<OutdatedPage[]>;
  scheduleReminders(config: ReminderConfig): void;
  getChangeImpact(filePath: string): Promise<string[]>;
}
```

### 3.3 混合搜索引擎
```typescript
interface IHybridSearch {
  search(query: string, options: HybridSearchOptions): Promise<SearchResult[]>;
  indexDocument(doc: WikiPage): Promise<void>;
  removeDocument(docId: string): Promise<void>;
}

interface HybridSearchOptions {
  keywordWeight: number;
  semanticWeight: number;
  maxResults: number;
  threshold: number;
}
```

### 3.4 上下文压缩器
```typescript
interface IContextCompressor {
  compress(context: string, targetTokens: number): Promise<string>;
  extractKeyPoints(context: string): Promise<string[]>;
  summarizeHistory(messages: Message[]): Promise<string>;
}
```

---

## 四、CLI 命令扩展

```bash
# 启动自动同步
tsd-gen wiki sync --start

# 检查文档同步状态
tsd-gen wiki sync --status

# 压缩上下文
tsd-gen wiki compress --session-id <id>

# 配置管理
tsd-gen wiki config init
tsd-gen wiki config set autoSync true
tsd-gen wiki config get
```

---

## 五、依赖新增

```json
{
  "openai": "^4.20.0",      // OpenAI Embeddings API
  "hnswlib-node": "^3.0.0"  // 本地向量数据库（可选）
}
```

---

## 六、预估工作量

| 阶段 | 任务数 | 预估时间 |
|-----|-------|---------|
| Phase 1: 自动化与同步 | 4 | 2h |
| Phase 2: 向量搜索 | 5 | 3h |
| Phase 3: 上下文优化 | 3 | 2h |
| Phase 4: 配置管理 | 3 | 1h |
| Phase 5: CLI 增强 | 1 | 0.5h |
| Phase 6: 测试覆盖 | 2 | 1h |
| **总计** | **18** | **9.5h** |

---

确认后将按顺序实现所有模块。