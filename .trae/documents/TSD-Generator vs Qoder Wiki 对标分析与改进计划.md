
# TSD-Generator vs Qoder Wiki 对标 - TDD 开发计划

## 一、差距分析总结

### Qoder 已有的核心功能（v0.2.0+）
1. ✅ 初次生成 Wiki
2. ✅ 代码变更检测与增量更新
3. ✅ Git 目录双向同步（支持直接编辑 Git 中的 Markdown）
4. ✅ Wiki 共享（.qoder/repowiki 目录）
5. ✅ 多语言支持（中文/英文）
6. ✅ 智能 Agent 查询集成

### TSD-Generator 现状
- ✅ 已有完整模块框架
- ✅ 已有大量测试文件
- ⚠️ 需要验证核心流程完整性
- ❌ 缺少多语言支持
- ❌ 缺少 Git 目录双向同步
- ❌ Agent 与 Wiki 集成不完整

---

## 二、TDD 开发阶段

### Phase 1: 验证现有核心流程（P0）
**目标**: 确保现有的生成、增量更新、共享功能可正常运行

1. **先写测试**: `tests/e2e/wiki-core-flow.test.ts`
   - 测试完整 Wiki 生成流程
   - 测试增量更新流程
   - 测试 Wiki 共享流程
2. **实现代码**: 修复测试中发现的问题
3. **运行测试**: 确保所有测试通过

### Phase 2: 多语言支持（P0）
**目标**: 支持中文/英文双语生成

1. **先写测试**: `tests/wiki/multi-language.test.ts`
   - 测试语言配置
   - 测试按语言生成独立目录
   - 测试中英文内容生成
2. **实现代码**:
   - 添加 `WikiLanguage` 类型
   - 修改 `WikiOptions` 支持语言配置
   - 修改 `WikiStorage` 支持多语言目录
   - 修改生成器支持语言切换
3. **运行测试**: 确保所有测试通过

### Phase 3: Git 目录双向同步（P0）
**目标**: 支持从 Git 目录读取 Markdown 变更并同步回 Wiki

1. **先写测试**: `tests/wiki/git-two-way-sync.test.ts`
   - 测试检测 Git 目录 Markdown 变更
   - 测试从 Git 目录导入内容
   - 测试冲突检测与解决
2. **实现代码**:
   - 扩展 `WikiSharingService` 支持导入
   - 添加 `GitDirectoryWatcher` 监控 Git 目录变更
   - 实现变更导入逻辑
3. **运行测试**: 确保所有测试通过

### Phase 4: Agent 与 Wiki 深度集成（P0）
**目标**: Agent 可通过 SearchMemoryTool 查询 Wiki 知识库

1. **先写测试**: `tests/agents/wiki-integration.test.ts`
   - 测试 Agent 注册 SearchMemoryTool
   - 测试 Agent 调用工具查询 Wiki
   - 测试 Prompt 增强
2. **实现代码**:
   - 确保 ToolCallingAgent 可正确调用 SearchMemoryTool
   - 实现 AgentMemoryBridge 与 SearchMemoryTool 集成
   - 添加 Prompt 增强机制
3. **运行测试**: 确保所有测试通过

---

## 三、TDD 流程规范
每个功能严格遵循:
1. **Red**: 先写失败的测试
2. **Green**: 实现最小代码使测试通过
3. **Refactor**: 重构优化
4. **Document**: 更新文档

---

## 四、验收标准
- 所有测试通过（覆盖率 ≥ 80%）
- 核心流程可端到端运行
- 代码符合项目规范
- 无 TypeScript 类型错误
- 无 ESLint 错误
