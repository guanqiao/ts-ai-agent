# Wiki 功能增强实现计划

## 目标
对标 Qoder Repo Wiki，实现智能化的项目知识管理系统，包括 Git 变更监听、增量更新、架构分析、依赖图谱、AI 知识库集成等核心能力。

---

## 一、新增模块结构

```
src/
├── wiki/                      # 新增 Wiki 模块
│   ├── index.ts               # 模块导出
│   ├── wiki-manager.ts        # Wiki 管理器（核心）
│   ├── wiki-storage.ts        # Wiki 存储服务
│   ├── wiki-knowledge-base.ts # AI 知识库集成
│   └── types.ts               # Wiki 专用类型
│
├── git/                       # 新增 Git 模块
│   ├── index.ts               # 模块导出
│   ├── git-service.ts         # Git 操作服务
│   ├── git-watcher.ts         # Git 变更监听器
│   └── types.ts               # Git 相关类型
│
├── architecture/              # 新增架构分析模块
│   ├── index.ts               # 模块导出
│   ├── architecture-analyzer.ts # 架构分析器
│   ├── dependency-graph.ts    # 依赖关系图谱
│   ├── pattern-detector.ts    # 架构模式检测器
│   └── types.ts               # 架构相关类型
│
└── sync/                      # 新增同步模块
    ├── index.ts               # 模块导出
    ├── incremental-updater.ts # 增量更新引擎
    ├── change-detector.ts     # 变更检测器
    └── types.ts               # 同步相关类型
```

---

## 二、实现任务清单

### Phase 1: Git 集成层（基础设施）

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 1.1 | Git 类型定义 | `src/git/types.ts` | GitCommit, GitDiff, GitStatus 等类型 |
| 1.2 | Git 服务实现 | `src/git/git-service.ts` | 封装 git 命令行操作 |
| 1.3 | Git 监听器 | `src/git/git-watcher.ts` | 监听 HEAD 变更，触发回调 |
| 1.4 | Git 模块导出 | `src/git/index.ts` | 模块统一导出 |

### Phase 2: 架构分析层

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 2.1 | 架构类型定义 | `src/architecture/types.ts` | ArchitecturePattern, DependencyNode 等类型 |
| 2.2 | 架构模式检测器 | `src/architecture/pattern-detector.ts` | 识别 MVC/微服务/分层等架构模式 |
| 2.3 | 依赖图谱构建 | `src/architecture/dependency-graph.ts` | 构建模块间依赖关系图 |
| 2.4 | 架构分析器 | `src/architecture/architecture-analyzer.ts` | 统一架构分析入口 |
| 2.5 | 架构模块导出 | `src/architecture/index.ts` | 模块统一导出 |

### Phase 3: 增量更新层

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 3.1 | 同步类型定义 | `src/sync/types.ts` | ChangeSet, SyncResult 等类型 |
| 3.2 | 变更检测器 | `src/sync/change-detector.ts` | 检测文件变更，计算差异 |
| 3.3 | 增量更新引擎 | `src/sync/incremental-updater.ts` | 只更新变更部分，智能合并 |
| 3.4 | 同步模块导出 | `src/sync/index.ts` | 模块统一导出 |

### Phase 4: Wiki 管理层

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 4.1 | Wiki 类型定义 | `src/wiki/types.ts` | WikiPage, WikiMetadata 等类型 |
| 4.2 | Wiki 存储服务 | `src/wiki/wiki-storage.ts` | 文件系统存储，版本管理 |
| 4.3 | AI 知识库 | `src/wiki/wiki-knowledge-base.ts` | Wiki 作为 AI 知识库的集成 |
| 4.4 | Wiki 管理器 | `src/wiki/wiki-manager.ts` | Wiki 生命周期管理 |
| 4.5 | Wiki 模块导出 | `src/wiki/index.ts` | 模块统一导出 |

### Phase 5: CLI 集成

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 5.1 | CLI 扩展 | `src/cli/index.ts` | 新增 wiki 子命令 |
| 5.2 | 类型扩展 | `src/types/index.ts` | 扩展 GeneratorOptions |

### Phase 6: 测试覆盖

| 序号 | 任务 | 文件 | 描述 |
|-----|------|------|------|
| 6.1 | Git 模块测试 | `tests/git/*.test.ts` | Git 服务和监听器测试 |
| 6.2 | 架构模块测试 | `tests/architecture/*.test.ts` | 架构分析器测试 |
| 6.3 | 同步模块测试 | `tests/sync/*.test.ts` | 增量更新测试 |
| 6.4 | Wiki 模块测试 | `tests/wiki/*.test.ts` | Wiki 管理器测试 |

---

## 三、核心接口设计

### 3.1 Git 服务接口
```typescript
interface IGitService {
  isGitRepo(path: string): Promise<boolean>;
  getHeadCommit(path: string): Promise<GitCommit>;
  getChangedFiles(path: string, since?: string): Promise<string[]>;
  getDiff(path: string, filePath: string): Promise<string>;
  getBlame(path: string, filePath: string): Promise<BlameInfo[]>;
}
```

### 3.2 架构分析器接口
```typescript
interface IArchitectureAnalyzer {
  analyze(codebase: ParsedFile[]): Promise<ArchitectureReport>;
  detectPattern(files: ParsedFile[]): ArchitecturePattern;
  buildDependencyGraph(files: ParsedFile[]): DependencyGraph;
  identifyCoreFlows(files: ParsedFile[]): BusinessFlow[];
}
```

### 3.3 Wiki 管理器接口
```typescript
interface IWikiManager {
  initialize(projectPath: string): Promise<void>;
  generate(): Promise<WikiDocument>;
  update(changes: ChangeSet): Promise<void>;
  query(question: string): Promise<WikiAnswer>;
  export(format: DocumentFormat): Promise<string>;
  watch(callback: (event: WikiEvent) => void): void;
}
```

---

## 四、CLI 命令设计

```bash
# 初始化 Wiki
tsd-gen wiki init

# 生成完整 Wiki
tsd-gen wiki generate

# 启动监听模式（自动更新）
tsd-gen wiki watch

# 查询 Wiki 知识库
tsd-gen wiki query "X功能是如何实现的？"

# 导出 Wiki
tsd-gen wiki export --format confluence

# 查看架构分析
tsd-gen wiki architecture
```

---

## 五、依赖新增

```json
{
  "simple-git": "^3.22.0",    // Git 操作
  "chokidar": "^3.5.3"        // 文件监听
}
```

---

## 六、预估工作量

| 阶段 | 任务数 | 预估时间 |
|-----|-------|---------|
| Phase 1: Git 集成 | 4 | 1h |
| Phase 2: 架构分析 | 5 | 2h |
| Phase 3: 增量更新 | 4 | 1.5h |
| Phase 4: Wiki 管理 | 5 | 2h |
| Phase 5: CLI 集成 | 2 | 0.5h |
| Phase 6: 测试覆盖 | 4 | 1h |
| **总计** | **24** | **8h** |

---

确认后将按顺序实现所有模块。