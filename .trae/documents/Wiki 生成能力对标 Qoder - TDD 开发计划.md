# Wiki 生成能力对标 Qoder - TDD 开发计划

## 一、项目目标

缩小与 Qoder Repo Wiki 的核心差距，重点实现：
1. **Search Memory 工具** - 让 Agent 可查询 Wiki 知识库
2. **Agent 工具调用机制** - 实现 Tool 注册和调用框架
3. **长期记忆增强** - 支持交互历史和自我进化
4. **隐性知识显性化** - 深度挖掘代码意图

---

## 二、开发阶段规划

### Phase 1: Agent 工具框架 (P0)

#### 1.1 Tool 核心接口设计
**测试文件**: `tests/agents/tools/tool-registry.test.ts`
- [ ] 测试 Tool 接口定义
- [ ] 测试 ToolRegistry 注册和获取工具
- [ ] 测试工具调用结果格式

**实现文件**: `src/agents/tools/`
- `types.ts` - Tool 接口定义
- `tool-registry.ts` - 工具注册中心
- `base-tool.ts` - 工具基类

#### 1.2 Agent 工具调用集成
**测试文件**: `tests/agents/tool-calling-agent.test.ts`
- [ ] 测试 Agent 发起工具调用
- [ ] 测试工具结果处理
- [ ] 测试多工具编排

**实现文件**: `src/agents/tool-calling-agent.ts`

---

### Phase 2: Search Memory 工具 (P0)

#### 2.1 SearchMemoryTool 实现
**测试文件**: `tests/wiki/tools/search-memory-tool.test.ts`
- [ ] 测试基本搜索功能
- [ ] 测试上下文提供功能
- [ ] 测试 Prompt 增强功能
- [ ] 测试缓存机制

**实现文件**: `src/wiki/tools/search-memory-tool.ts`

#### 2.2 与 AgentMemoryBridge 集成
**测试文件**: `tests/wiki/memory/agent-memory-bridge-enhanced.test.ts`
- [ ] 测试增强的上下文提供
- [ ] 测试多维度知识检索
- [ ] 测试智能摘要生成

**修改文件**: `src/wiki/memory/agent-memory-bridge.ts`

---

### Phase 3: 长期记忆增强 (P1)

#### 3.1 交互历史记录
**测试文件**: `tests/wiki/memory/interaction-history.test.ts`
- [ ] 测试交互记录存储
- [ ] 测试历史查询和回放
- [ ] 测试上下文关联

**实现文件**: `src/wiki/memory/interaction-history.ts`

#### 3.2 自我进化机制
**测试文件**: `tests/wiki/memory/knowledge-evolution.test.ts`
- [ ] 测试知识更新策略
- [ ] 测试过时知识清理
- [ ] 测试知识关联学习

**实现文件**: `src/wiki/memory/knowledge-evolution.ts`

---

### Phase 4: 隐性知识显性化 (P1)

#### 4.1 代码意图推理
**测试文件**: `tests/wiki/knowledge/intent-inference.test.ts`
- [ ] 测试代码意图识别
- [ ] 测试设计决策推理
- [ ] 测试隐性依赖发现

**实现文件**: `src/wiki/knowledge/intent-inference.ts`

#### 4.2 多源知识整合
**测试文件**: `tests/wiki/knowledge/multi-source-integration.test.ts`
- [ ] 测试 Git 历史知识提取
- [ ] 测试 Issue/PR 关联
- [ ] 测试知识融合去重

**实现文件**: `src/wiki/knowledge/multi-source-integration.ts`

---

### Phase 5: 文档同步优化 (P2)

#### 5.1 智能提醒机制
**测试文件**: `tests/wiki/sync/outdated-reminder.test.ts`
- [ ] 测试滞后检测算法
- [ ] 测试提醒策略
- [ ] 测试用户偏好学习

**实现文件**: `src/wiki/sync/outdated-reminder.ts`

---

## 三、文件结构规划

```
src/
├── agents/
│   └── tools/                    # 新增：工具框架
│       ├── types.ts              # Tool 接口定义
│       ├── tool-registry.ts      # 工具注册中心
│       ├── base-tool.ts          # 工具基类
│       └── index.ts
├── wiki/
│   ├── tools/                    # 新增：Wiki 工具
│   │   ├── search-memory-tool.ts # Search Memory 工具
│   │   └── index.ts
│   ├── memory/
│   │   ├── interaction-history.ts    # 新增：交互历史
│   │   ├── knowledge-evolution.ts    # 新增：知识进化
│   │   └── ...
│   ├── knowledge/
│   │   ├── intent-inference.ts       # 新增：意图推理
│   │   ├── multi-source-integration.ts # 新增：多源整合
│   │   └── ...
│   └── sync/
│       ├── outdated-reminder.ts      # 新增：滞后提醒
│       └── ...
└── types/
    └── tools.ts                 # 新增：工具类型定义

tests/
├── agents/tools/                 # 工具测试
├── wiki/tools/                   # Wiki 工具测试
├── wiki/memory/                  # Memory 测试
├── wiki/knowledge/               # Knowledge 测试
└── wiki/sync/                    # Sync 测试
```

---

## 四、TDD 开发流程

每个功能模块遵循：
1. **Red** - 先编写失败的测试用例
2. **Green** - 实现最小代码使测试通过
3. **Refactor** - 重构优化代码
4. **Document** - 更新相关文档

---

## 五、验收标准

| 阶段 | 验收标准 |
|------|---------|
| Phase 1 | Agent 可注册和调用工具，测试覆盖率 > 90% |
| Phase 2 | Search Memory 工具可被 Agent 调用，查询响应 < 100ms |
| Phase 3 | 交互历史可持久化，支持跨会话记忆 |
| Phase 4 | 隐性知识提取准确率 > 80% |
| Phase 5 | 文档滞后提醒准确率 > 85% |

---

## 六、预估工作量

| 阶段 | 预估时间 |
|------|---------|
| Phase 1 | 2-3 天 |
| Phase 2 | 2 天 |
| Phase 3 | 2 天 |
| Phase 4 | 3 天 |
| Phase 5 | 1 天 |
| **总计** | **10-11 天** |