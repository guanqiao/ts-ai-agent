# TSD-Generator (TypeScript AI Agent Documentation Generator)

AI 驱动的 TypeScript/Java 代码文档生成器，基于 LLM 自动分析代码并生成结构化 Wiki 文档。

## 功能特性

- **多语言支持**: TypeScript/JavaScript 和 Java 代码解析
- **AI 驱动分析**: 使用 LLM 自动理解代码结构和语义
- **Wiki 文档生成**: 自动生成结构化的 Wiki 文档
- **知识图谱**: 构建代码知识图谱，支持语义搜索
- **架构决策记录 (ADR)**: 管理架构决策记录
- **变更影响分析**: 分析代码变更的影响范围
- **协作功能**: 支持多人协作和权限管理

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
    "generateSearch": true
  },
  "llm": {
    "enabled": true,
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

## API 使用

```typescript
import { WikiManager, LLMService } from 'tsd-generator';

const llmConfig = {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: process.env.OPENAI_API_KEY,
};

const wikiManager = new WikiManager(llmConfig);

await wikiManager.initialize('./src', {
  outputDir: './wiki',
  format: 'markdown',
});

const pages = await wikiManager.generateWiki();
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
│   └── ...
├── search/          # 混合搜索引擎
├── config/          # 配置管理
├── changelog/       # 变更日志生成
└── cli/             # 命令行接口
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
