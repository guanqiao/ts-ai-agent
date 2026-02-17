## Wiki 文档生成监控优化方案

### 一、当前问题分析

| 问题 | 描述 |
|------|------|
| 事件粒度不足 | `WikiEvent.type` 只有 4 种类型，缺少生成过程进度事件 |
| 无进度回调 | `generate()` 方法没有进度回调参数，无法实时监控 |
| CLI 显示简单 | 只用 ora spinner 显示简单文本，无百分比和阶段划分 |
| 错误事件缺失 | 错误信息嵌入 `details`，无专门错误事件类型 |
| 页面生成无反馈 | `generatePages()` 一次性完成，无逐页进度 |

### 二、优化方案

#### 1. 扩展事件类型系统 (`src/wiki/types.ts`)

```typescript
// 新增进度事件类型
export interface WikiProgressEvent {
  type: 'generation-started' | 'generation-completed' | 'generation-error' |
        'architecture-analyzing' | 'architecture-analyzed' |
        'page-generating' | 'page-generated' | 'page-saving' |
        'index-building' | 'storage-saving' | 'knowledge-indexing';
  phase: 'initialization' | 'analysis' | 'generation' | 'finalization';
  progress: number;  // 0-100
  current?: number;
  total?: number;
  message: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}
```

#### 2. 添加进度回调接口 (`src/wiki/types.ts`)

```typescript
export interface ProgressInfo {
  phase: string;
  progress: number;
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (info: ProgressInfo) => void;

// 扩展 WikiOptions
export interface WikiOptions {
  // ... 现有选项
  onProgress?: ProgressCallback;
}
```

#### 3. 改造 WikiManager.generate() (`src/wiki/wiki-manager.ts`)

- 添加进度发射点：架构分析、页面生成（逐页）、索引构建、存储保存
- 支持进度回调函数
- 发射细粒度事件

#### 4. 创建进度监控类 (`src/wiki/wiki-progress-monitor.ts`)

```typescript
export class WikiProgressMonitor extends EventEmitter {
  start(totalSteps: number): void;
  updateProgress(step: number, message: string): void;
  complete(): void;
  error(error: Error): void;
  getProgress(): ProgressInfo;
}
```

#### 5. 优化 CLI 进度显示 (`src/cli/index.ts`)

- 使用 `cli-progress` 库显示进度条
- 显示当前阶段和操作
- 支持详细模式输出

### 三、实施步骤

1. **扩展类型定义** - 在 `types.ts` 中添加新的事件和接口
2. **创建进度监控类** - 新建 `wiki-progress-monitor.ts`
3. **改造 WikiManager** - 在 `generate()` 中添加进度发射点
4. **优化 CLI 显示** - 集成进度条和阶段显示
5. **编写测试用例** - 确保进度监控正确工作

### 四、预期效果

- 实时显示生成进度百分比
- 清晰的阶段划分和当前操作提示
- 支持进度回调用于自定义监控
- 统一的事件机制便于集成