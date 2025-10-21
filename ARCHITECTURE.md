# Universal Filter 架构文档

## 概述

Universal Filter 是一个按照 SOLID 原则精心设计的过滤框架，核心与 React 完全分离，提供强大的可扩展性和可维护性。

## SOLID 原则应用

### 1. 单一职责原则 (Single Responsibility Principle)

每个类或模块只负责一个职责，便于测试和维护。

#### StateManager
- **职责**: 管理过滤器的状态（draft、applied、validating、schema）
- **位置**: `src/core/controller.ts`
- **好处**: 状态管理逻辑集中，便于维护和测试

```typescript
class StateManager<TDraft> {
  draft: TDraft;
  applied?: TDraft;
  validating = false;
  schema?: RegisteredSchema<TDraft>;

  getAppliedDraft(): TDraft { ... }
  setApplied(draft: TDraft, payload: any): void { ... }
}
```

#### SubscriptionManager
- **职责**: 管理订阅者和广播更新
- **位置**: `src/core/controller.ts`
- **好处**: 订阅逻辑独立，易于添加新的通知机制

```typescript
class SubscriptionManager<TDraft> {
  subscribe(listener: ...): () => void { ... }
  broadcast(state: ...): void { ... }
}
```

#### GroupManager
- **职责**: 管理字段分组
- **位置**: `src/core/controller.ts`
- **好处**: 分组逻辑独立，便于后续扩展（如权限管理）

```typescript
class GroupManager {
  setGroups(groups?: FilterGroup[]): void { ... }
  getGroups(): FilterGroup[] { ... }
  getGroupFields(id: string): string[] { ... }
}
```

### 2. 开闭原则 (Open/Closed Principle)

类或模块对扩展开放，对修改关闭。

#### Plugin 系统
通过完整的 Plugin 接口支持无限扩展，无需修改核心代码：

```typescript
interface Plugin<TDraft> {
  name: string;
  onInit?(ctx: { root: FilterApi<TDraft> }): void | Promise<void>;
  onAfterApply?(ctx: { ... }): void | Promise<void>;
  onSchemaChange?(ctx: { ... }): void | Promise<void>;
  onDestroy?(ctx: { ... }): void | Promise<void>;
}
```

示例扩展：
- `HistoryPlugin` – 历史追踪（无需修改核心）
- `PresetPlugin` – 预设管理（无需修改核心）
- `UrlSyncPlugin` – URL 同步（无需修改核心）

#### DataPipeline
管道可无限延伸：

```typescript
const pipeline = createDataPipeline([...])
  .extend(newStage)
  .extend(anotherStage);
```

### 3. 里式替换原则 (Liskov Substitution Principle)

所有实现都可以互相替换。

#### Adapter 模式
所有适配器遵循统一契约：

```typescript
interface MemoryAdapterApi<TDraft> {
  readonly filter: FilterApi<TDraft>;
  getSnapshot(): MemoryAdapterSnapshot<TDraft>;
  setValue(path: string, value: any): void;
  subscribe(listener: (snapshot: ...) => void): () => void;
  dispose(): void;
}
```

可无缝替换为其他存储实现（如 LocalStorage、IndexedDB）。

#### Plugin 实现
所有 Plugin 实现都遵循统一接口，可互相替换：

```typescript
// 可互相替换
createHistoryPlugin({ limit: 50 })
createHistoryPlugin({ limit: 100 })
```

### 4. 接口隔离原则 (Interface Segregation Principle)

不强迫客户端依赖不需要的方法。

#### FieldApi 与 FilterApi 分离
- `FieldApi` – 只暴露字段操作
- `FilterApi` – 只暴露过滤器操作

```typescript
// 字段操作 – 不会暴露整个过滤器
const field = filter.getField('search');
field.setValue('test');
field.reset();

// 过滤器操作 – 不会暴露内部状态细节
await filter.apply();
filter.reset('group', 'basic');
```

#### OptionSource 与 OptionsRegistry 分离
- `OptionSource` – 选项源定义
- `OptionsRegistry` – 选项注册表

### 5. 依赖倒置原则 (Dependency Inversion Principle)

依赖抽象而非具体实现。

#### Plugin 系统
FilterController 依赖 Plugin 抽象，而非具体实现：

```typescript
// FilterController 不知道具体是哪个 Plugin
private plugins: Plugin<TDraft>[] = [];

// 可动态插入任何实现
for (const plugin of this.plugins) {
  if (typeof plugin.onInit === 'function') {
    await plugin.onInit({ root: this });
  }
}
```

#### Options 流程
FilterController 依赖 OptionSource 抽象：

```typescript
interface OptionSource {
  key: QueryKey;
  fetcher: (ctx: { keyword?: string; draft: Draft }) => Promise<OptionItem[]>;
  // ...
}
```

## 目录结构详解

### src/core/
**框架独立的纯 JavaScript 核心**

- `controller.ts` – FilterController 实现（含 3 个职责管理器）
- `createFilter.ts` – 工厂函数
- `pipeline.ts` – 数据管道
- `registry.ts` – 实例注册表
- `schema.ts` – Schema 编译
- `types.ts` – 类型定义
- `errors.ts` – 错误定义
- `fieldHelpers.ts` – 字段辅助函数
- `lifecycle.ts` – 生命周期管理
- `optionsRegistry.ts` – 选项注册表

**特点**：
- 零 React 依赖
- 可用于 Node.js、微信小程序等任何 JavaScript 环境
- 易于测试
- 高度可复用

### src/context/
**React 上下文层**

- `FilterProvider.tsx` – 集成 ExpressionScope 的 Provider
- `FilterConfigure.tsx` – 全局配置
- `context.ts` – Context 定义
- `index.ts` – 导出文件

**特点**：
- 依赖于 React
- 提供全局配置能力
- ExpressionScope 支持字段表达式求值

### src/hooks/
**React Hooks 层**

- `useField.tsx` – 优化版 useField（支持自动路径推断）
- `useOptions.ts` – 选项加载
- `index.ts` – 导出文件

**特点**：
- useField 支持两种调用方式：
  1. 显式 path: `useField('search')`
  2. 隐式推断: `useField()` // 从 FormItem context 推断

### src/adapters/
**环境适配器**

- `memoryAdapter.ts` – 内存适配器

可扩展为：
- LocalStorageAdapter
- IndexedDBAdapter
- RemoteAdapter

### src/plugins/
**插件系统**

- `historyPlugin.ts` – 历史追踪
- `presetPlugin.ts` – 预设管理
- `urlSyncPlugin.ts` – URL 同步

## 层级交互

```
┌─────────────────────────────────────┐
│  React 应用                          │
├─────────────────────────────────────┤
│  Hooks 层 (useField, useOptions)    │ ─ 依赖 React
├─────────────────────────────────────┤
│  Context 层 (Provider, Configure)    │ ─ 依赖 React + Core
├─────────────────────────────────────┤
│  Core 层 (FilterController, ...)    │ ─ 纯 JavaScript
├─────────────────────────────────────┤
│  Adapters & Plugins                 │ ─ 依赖 Core
├─────────────────────────────────────┤
│  Formily + TanStack Query            │ ─ 外部库
└─────────────────────────────────────┘
```

## 技术细节

### 状态管理

```
defaultValues ─────┐
                   ├──> StateManager
                   │    ├─ draft (当前编辑状态)
                   │    ├─ applied (已应用状态)
                   │    └─ validating (验证中)
                   │
                   └──> SubscriptionManager (广播给订阅者)
```

### 订阅流程

```
setFieldValue(path, value)
    ↓
Form Effects 触发
    ↓
updateDraftFromForm()
    ↓
broadcast() ─→ SubscriptionManager.broadcast()
    ↓
所有订阅者接收更新
    ↓
创建新的状态快照（cloneDeep）
```

### 应用流程

```
apply()
    ↓
验证 (form.validate)
    ↓
编码 (pipeline.encode) ─→ transform
    ↓
stateManager.setApplied()
    ↓
broadcast()
    ↓
runPluginsAfterApply()
    ↓
listeners.onApplySuccess()
```

## 扩展示例

### 添加新的 Plugin

```typescript
const myPlugin: Plugin = {
  name: 'my-plugin',
  onInit({ root }) {
    console.log('Filter initialized:', root.id);
    root.setPluginState('myKey', {});
  },
  onAfterApply({ draft, payload, root }) {
    console.log('Filter applied with payload:', payload);
  },
};

const filter = createFilter({
  defaultValues: { ... },
  plugins: [myPlugin],
});
```

### 添加新的 Adapter

```typescript
interface LocalStorageAdapterApi<TDraft> {
  readonly filter: FilterApi<TDraft>;
  getSnapshot(): any;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

export function createLocalStorageAdapter<TDraft>(
  filter: FilterApi<TDraft>,
  key: string
): LocalStorageAdapterApi<TDraft> {
  // 实现...
}
```

### 添加新的 Pipeline Stage

```typescript
const pipeline = createDataPipeline([
  {
    name: 'validate',
    encode: (draft) => {
      // 验证逻辑
      return draft;
    },
  },
  {
    name: 'transform',
    encode: (draft) => {
      // 转换逻辑
      return transformedDraft;
    },
  },
]);
```

## 测试策略

### 单元测试覆盖

- ✅ 核心模块 (95%+ 覆盖率)
- ✅ 高级功能 (数据分片、Headless 根)
- ✅ 错误处理
- ✅ 插件系统
- ✅ 注册表

### 集成测试覆盖

- ✅ Filter + Pipeline + Adapter
- ✅ Multiple Plugins
- ✅ Complex Scenarios
- ✅ Error Scenarios

## 性能优化

### 状态复制
- 使用 `cloneDeep` 避免共享引用
- 订阅者收到的都是独立快照

### 选择性更新
- 使用 `isEqual` 比较避免不必要的通知
- DataShard 仅在值变化时通知

### 内存管理
- 完整的 dispose 机制
- 及时清理监听器和订阅

## 相关资源

- [SOLID 原则详解](https://en.wikipedia.org/wiki/SOLID)
- [设计模式](https://refactoring.guru/design-patterns)
- [Formily 文档](https://react.formilyjs.org/)
- [TanStack Query 文档](https://tanstack.com/query)

## 贡献指南

遵循 SOLID 原则进行贡献：

1. **SRP**: 每个模块只做一件事
2. **OCP**: 通过扩展而非修改来添加功能
3. **LSP**: 确保实现可互相替换
4. **ISP**: 提供精细的接口
5. **DIP**: 依赖抽象而非具体

所有贡献需要满足：
- 单元测试覆盖
- 类型完整性
- ESLint 检查
- 遵循 SOLID 原则
