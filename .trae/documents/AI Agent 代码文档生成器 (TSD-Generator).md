# AI Agent 代码文档生成器 - 实现计划

## 项目概述
构建一个基于AI Agent的智能代码文档生成系统，能够自动分析代码并生成Wiki技术文档(TSD)。

## 技术架构

### 核心技术栈
- **语言**: TypeScript + Node.js
- **AI框架**: LangChain.js (Agent编排)
- **LLM支持**: OpenAI GPT-4 / Claude / 本地模型
- **代码解析**: 
  - TypeScript: TypeScript Compiler API
  - Java: JavaParser (通过子进程调用)
- **输出格式**: Markdown (Wiki兼容)

### 系统架构
```
┌─────────────────────────────────────────────────────────┐
│                    CLI / API 入口                        │
├─────────────────────────────────────────────────────────┤
│                  Agent Orchestrator                      │
│  ┌─────────────┬─────────────┬──────────────────────┐   │
│  │ 分析Agent   │ 文档Agent   │ 审核Agent            │   │
│  └─────────────┴─────────────┴──────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Code Parser Layer                     │
│  ┌──────────────┬──────────────┬───────────────────┐    │
│  │ TS Parser    │ Java Parser  │ Python Parser     │    │
│  └──────────────┴──────────────┴───────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                  Document Generator                      │
│  ┌──────────────┬──────────────┬───────────────────┐    │
│  │ 模板引擎     │ 格式化器     │ 输出适配器        │    │
│  └──────────────┴──────────────┴───────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 实现步骤

### Phase 1: 项目基础设施 (Day 1)
1. 初始化TypeScript项目结构
2. 配置开发环境 (ESLint, Prettier, Jest)
3. 设置依赖管理 (package.json)
4. 创建基础目录结构

### Phase 2: 代码解析器 (Day 2-3)
1. **TypeScript解析器**
   - 使用`typescript`编译器API
   - 提取类、接口、函数、类型定义
   - 分析依赖关系和导入导出
   
2. **Java解析器**
   - 集成JavaParser (通过Java子进程)
   - 提取类、方法、字段、注解
   - 分析包结构和继承关系

### Phase 3: AI Agent核心 (Day 4-5)
1. **LangChain Agent设置**
   - 配置LLM模型接口
   - 定义Agent工具集
   
2. **专用Agent实现**
   - `CodeAnalysisAgent`: 深度分析代码逻辑
   - `DocGeneratorAgent`: 生成结构化文档
   - `ReviewAgent`: 审核文档质量

### Phase 4: 文档生成引擎 (Day 6-7)
1. **模板系统**
   - API文档模板
   - 架构说明模板
   - 使用指南模板
   
2. **输出格式**
   - Markdown格式化
   - Wiki适配 (Confluence/GitHub Wiki)
   - 交叉引用链接

### Phase 5: CLI与配置 (Day 8)
1. 命令行接口实现
2. 配置文件支持
3. 批量处理能力

### Phase 6: 测试与优化 (Day 9-10)
1. 单元测试覆盖
2. 集成测试
3. 性能优化

## 目录结构
```
ts-ai-agent/
├── src/
│   ├── agents/           # AI Agent实现
│   │   ├── base.ts       # Agent基类
│   │   ├── analyzer.ts   # 代码分析Agent
│   │   ├── generator.ts  # 文档生成Agent
│   │   └── reviewer.ts   # 审核Agent
│   ├── parsers/          # 代码解析器
│   │   ├── typescript.ts # TS解析器
│   │   ├── java.ts       # Java解析器
│   │   └── base.ts       # 解析器接口
│   ├── generators/       # 文档生成器
│   │   ├── markdown.ts   # Markdown生成
│   │   └── templates/    # 文档模板
│   ├── llm/              # LLM集成
│   │   ├── provider.ts   # 模型提供者
│   │   └── prompts/      # Prompt模板
│   ├── cli/              # CLI入口
│   └── index.ts          # 主入口
├── tests/                # 测试文件
├── docs/                 # 项目文档
├── examples/             # 示例代码
└── package.json
```

## 核心功能特性
1. **智能代码理解**: AI深度分析代码逻辑和设计意图
2. **多语言支持**: 可扩展的解析器架构
3. **结构化输出**: 符合Wiki规范的文档格式
4. **增量更新**: 只更新变更部分的文档
5. **自定义模板**: 支持用户定义文档模板

## 依赖清单
```json
{
  "dependencies": {
    "typescript": "^5.3.0",
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.3.0",
    "commander": "^12.0.0",
    "glob": "^10.0.0",
    "yaml": "^2.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0"
  }
}
```

## 预期产出
- 可运行的CLI工具
- 完整的单元测试
- 使用文档和示例
- 支持TypeScript和Java代码文档生成