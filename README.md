# TSD-Generator (TypeScript AI Agent Documentation Generator)

AI 驱动的 TypeScript/Java 代码文档生成器，基于 LLM 自动分析代码并生成结构化 Wiki 文档。

## 功能特性

- **多语言支持**: TypeScript/JavaScript 和 Java 代码解析
- **多语言文档**: 支持中文/英文 Wiki 文档生成
- **AI 驱动分析**: 使用 LLM 自动理解代码结构和语义
- **Wiki 文档生成**: 自动生成结构化的 Wiki 文档
- **增量更新**: 智能增量更新，仅更新变更部分，大幅提升效率
- **知识图谱**: 构建代码知识图谱，支持语义搜索
- **架构决策记录 (ADR)**: 管理架构决策记录
- **变更影响分析**: 分析代码变更的影响范围
- **协作功能**: 支持多人协作和权限管理
- **进度持久化**: 支持任务进度保存与恢复
- **Wiki 共享**: 支持将 Wiki 共享到 Git 仓库（`.tsdgen/wiki`）

## 安装

```bash
npm install tsd-generator
```

## 快速开始

### 初始化项目

```bash
tsd-gen wiki init ./src
```

### 生成文档

```bash
tsd-gen wiki generate ./src -o ./wiki
```

### 监听模式

```bash
tsd-gen wiki watch ./src
```

## CLI 命令

### Wiki 命令

| 命令 | 描述 |
|------|------|
| `wiki init` | 初始化 Wiki 项目 |
| `wiki generate` | 生成 Wiki 文档 |
| `wiki watch` | 监听文件变化并自动更新 |
| `wiki query` | 查询 Wiki 知识库 |
| `wiki export` | 导出 Wiki 到不同格式 |
| `wiki architecture` | 显示架构分析 |
| `wiki sync` | 管理自动同步 |
| `wiki search` | 搜索 Wiki 文档 |
| `wiki config` | 管理 Wiki 配置 |
| `wiki share` | 分享 Wiki 到 Git 仓库 |
| `wiki graph` | 生成依赖/调用/继承图 |
| `wiki adr` | 管理架构决策记录 |
| `wiki collab` | 管理协作者和权限 |
| `wiki impact` | 分析变更影响 |

### 选项

| 选项 | 描述 | 默认值 |
|------|------|--------|
| `-o, --output <path>` | 输出目录 | `./wiki` |
| `-f, --format <format>` | 输出格式 (markdown, github-wiki, confluence) | `markdown` |
| `--llm <provider>` | LLM 提供者 (openai, anthropic) | `openai` |
| `--model <model>` | LLM 模型名称 | `gpt-4` |
| `--api-key <key>` | API 密钥 | 环境变量 `OPENAI_API_KEY` |
| `--base-url <url>` | API 基础 URL | - |
| `--ca-cert <path>` | CA 证书文件路径（可选，用于自定义证书） | - |
| `--wiki-languages <langs>` | Wiki 语言（逗号分隔：en,zh） | `en` |
| `--share-path <path>` | Wiki 共享路径 | `.tsdgen/wiki` |

### 多语言文档生成

支持生成中文/英文 Wiki 文档：

```bash
# 生成中文文档
tsd-gen wiki generate ./src --wiki-languages zh

# 生成中英文双语文档
tsd-gen wiki generate ./src --wiki-languages en,zh
```

生成的文档将按语言存放在独立目录：
- `.wiki/en/` - 英文文档
- `.wiki/zh/` - 中文文档

## 配置

在项目根目录创建 `.tsdgenrc` 文件：

```json
{
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "language": "typescript",
    "excludePatterns": ["node_modules", "dist", "**/*.test.ts"],
    "includePatterns": ["**/*.ts", "**/*.tsx"]
  },
  "wiki": {
    "outputDir": ".wiki",
    "format": "markdown",
    "generateIndex": true,
    "generateSearch": true,
    "wikiLanguages": ["en", "zh"]
  },
  "llm": {
    "enabled": true,
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 4096,
    "baseUrl": "https://api.example.com/v1",
    "caCert": "/path/to/ca-cert.pem"
  },
  "incremental": {
    "enabled": true,
    "maxBatchSize": 50,
    "parallelism": 4,
    "debounceMs": 300,
    "enableCaching": true,
    "cacheTTL": 3600000
  }
}
```

### 增量更新策略

增量更新支持三种策略：

| 策略 | 触发条件 | 说明 |
|------|----------|------|
| `full` | 变更文件 > 50% | 完全重新生成所有文档 |
| `incremental` | 变更文件 20%-50% | 增量更新受影响的页面 |
| `selective` | 变更文件 < 20% | 仅更新变更相关的章节 |

### 页面更新规则

| 页面类型 | 触发条件 | 合并策略 |
|----------|----------|----------|
| `overview` | 文件数量/符号数量/架构变更 | 替换章节 |
| `architecture` | 依赖/模式/层级变更 | 智能合并 |
| `module` | 模块内文件/符号变更 | 符号级别更新 |
| `api` | 符号/签名/描述变更 | 符号级别更新 |

## API 使用

```typescript
import { WikiManager, LLMService } from 'tsd-generator';

const llmConfig = {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: 'https://api.example.com/v1',
  caCert: '/path/to/ca-cert.pem',
};

const wikiManager = new WikiManager(llmConfig);

await wikiManager.initialize('./src', {
  outputDir: './wiki',
  format: 'markdown',
});

const pages = await wikiManager.generateWiki();
```

### 增量更新 API

```typescript
import { 
  IncrementalUpdateOptimizer, 
  HashCacheManager,
  ImpactAnalyzer,
  ParallelUpdater 
} from 'tsd-generator';

const hashCache = new HashCacheManager('./wiki/.cache');
const impactAnalyzer = new ImpactAnalyzer();
const optimizer = new IncrementalUpdateOptimizer(hashCache, impactAnalyzer);

const changes = await hashCache.detectChanges('./src');
const analysis = await optimizer.analyzeChanges(changes);

if (analysis.recommendedStrategy.type === 'incremental') {
  const updater = new ParallelUpdater({ parallelism: 4 });
  const result = await updater.executeBatch(analysis.affectedPages);
  console.log(`Updated ${result.pagesUpdated.length} pages`);
}
```

## 模块结构

```
src/
├── agents/          # AI Agent 编排
├── llm/             # LLM 服务和缓存
├── parser/          # 代码解析器
├── wiki/            # Wiki 管理核心
│   ├── knowledge/   # 知识图谱
│   ├── sharing/     # 共享服务
│   ├── impact/      # 变更影响分析
│   ├── incremental/ # 增量更新引擎
│   │   ├── hash-cache.ts        # 文件哈希缓存
│   │   ├── adaptive-threshold.ts # 自适应阈值
│   │   ├── symbol-tracker.ts    # 符号追踪
│   │   ├── impact-analyzer.ts   # 影响分析
│   │   ├── page-updater.ts      # 页面更新器
│   │   ├── parallel-updater.ts  # 并行更新器
│   │   └── myers-diff.ts        # Myers diff 算法
│   ├── memory/      # 记忆与交互历史
│   └── ...
├── search/          # 混合搜索引擎
├── config/          # 配置管理
├── changelog/       # 变更日志生成
├── sync/            # 同步服务
│   ├── snapshot-index.ts  # 快照索引
│   └── incremental-updater.ts # 增量更新器
├── cli/             # 命令行接口
│   └── progress-bar.ts    # 进度条组件
└── error/           # 错误处理
```

## 开发

### 安装依赖

```bash
npm install
```

### 运行测试

```bash
npm test
```

### 构建

```bash
npm run build
```

## 许可证

MIT
