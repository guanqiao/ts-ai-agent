## 问题分析

当前wiki生成系统存在以下问题：
1. **CLI入口每次都完全重新生成**：`handleWikiGenerate`没有检查是否已有wiki
2. **WikiManager.update()实现不完整**：只是简单的mergeContent，没有利用已有的优化器
3. **缺少智能判断机制**：没有自动检测是否需要增量更新
4. **没有充分利用已有wiki**：每次都重新生成所有页面

## 实现方案

### 1. 增强WikiManager增量更新核心逻辑

**修改文件**: `src/wiki/wiki-manager.ts`

- 新增 `generateIncremental()` 方法：智能增量生成
- 增强 `update()` 方法：利用 `IncrementalUpdateOptimizer` 分析变更影响
- 新增 `shouldUseIncrementalUpdate()` 方法：判断是否应该使用增量更新
- 新增 `detectChanges()` 方法：检测自上次生成以来的变更
- 新增 `updateAffectedPages()` 方法：只更新受影响的页面

### 2. 实现智能页面更新器

**新增文件**: `src/wiki/incremental/page-updater.ts`

- 实现智能页面内容合并
- 基于符号级别的精确更新
- 保留未变更的内容
- 支持部分section更新

### 3. 增强CLI入口

**修改文件**: `src/cli/index.ts`

- 新增 `--incremental` 选项：强制使用增量更新
- 新增 `--force` 选项：强制完全重新生成
- 默认行为：自动检测是否使用增量更新
- 显示增量更新统计信息

### 4. 完善类型定义

**修改文件**: `src/wiki/incremental/types.ts`

- 新增 `IncrementalUpdateResult` 类型
- 新增 `PageUpdatePlan` 类型
- 新增 `ContentMergeStrategy` 类型

### 5. 更新快照管理

**修改文件**: `src/sync/incremental-updater.ts`

- 增强快照信息，包含页面与文件的映射关系
- 新增 `getChangedFilesSinceLastSnapshot()` 方法
- 新增 `updateSnapshotWithPages()` 方法

## 关键实现细节

### 增量更新流程

```
1. 检查是否存在已有wiki
   ├── 不存在 → 完全生成
   └── 存在 → 检查快照
       ├── 无快照 → 完全生成
       └── 有快照 → 检测变更
           ├── 变更超过阈值(>50%) → 完全生成
           └── 变更在阈值内 → 增量更新
               ├── 分析变更影响
               ├── 确定受影响页面
               ├── 只更新受影响页面
               ├── 保留未变更页面
               └── 更新索引和快照
```

### 页面更新策略

- **Overview页面**：统计信息变化时更新
- **Architecture页面**：架构变化时更新
- **Module页面**：模块内文件变化时更新
- **API页面**：符号变化时精确更新

## 预期效果

1. **大幅减少生成时间**：只处理变更部分
2. **保留已有内容**：未变更页面保持原样
3. **智能判断**：自动选择最优更新策略
4. **用户可控**：提供命令行选项控制行为