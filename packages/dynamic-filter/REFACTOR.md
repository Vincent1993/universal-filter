# Dynamic Filter 架构重构总结

## 重构概述

本次重构将 Dynamic Filter 从"全局副作用 + Schema Patch"模式转变为"Schema Assembly + Projection"模式，实现了"Thin Hooks, Fat Core"的架构原则。

## 核心变更

### 1. 架构模式转变

**之前 (Schema Patch 模式)**:
```
┌─────────────────┐
│  Provider       │
│  注册全局 Patch  │ ← 副作用
└────────┬────────┘
         │
         v
┌─────────────────┐
│  Formily Schema │
│  (全局拦截)      │
└─────────────────┘
```

**现在 (Assembly + Projection 模式)**:
```
┌──────────────────────────────────────┐
│  Provider                            │
│  Processor.assemble(Layout, Registry)│ ← 纯函数
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Assembled Schema (完整)              │
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Hook                                │
│  Processor.project(Schema, activeIds)│ ← 纯函数
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Active Schema (用于渲染)             │
└──────────────────────────────────────┘
```

### 2. 文件变更

#### 新增文件
- `packages/dynamic-filter/src/core/schema-processor.ts` - 核心处理器(取代 schema-patch.ts)
- `packages/dynamic-filter/src/hooks/useAssembledSchema.ts` - 获取组装后Schema的Hook

#### 删除文件
- `packages/dynamic-filter/src/core/schema-patch.ts` - 已被 schema-processor.ts 取代

#### 修改文件
- `packages/dynamic-filter/src/types.ts` - 更新类型定义
- `packages/dynamic-filter/src/provider/DynamicFilterProvider.tsx` - 使用 Processor.assemble
- `packages/dynamic-filter/src/provider/context.ts` - 添加 assembledSchema
- `packages/dynamic-filter/src/hooks/useDynamicFields.ts` - 委托给 Processor
- `packages/dynamic-filter/src/index.ts` - 更新导出

### 3. API 变更

#### Provider Props
```typescript
// 新增
interface DynamicFilterProviderProps {
  schema?: ISchema;  // 服务端 Layout Schema
  // ... 其他保持不变
}

// 移除
interface DynamicFilterProviderProps {
  autoInitPatch?: boolean;  // 已移除
}
```

#### useDynamicFields Options
```typescript
// 之前
interface UseDynamicFieldsOptions {
  serverSchema: ISchema;  // 服务端 Schema
}

// 现在
interface UseDynamicFieldsOptions {
  assembledSchema: ISchema;  // 组装后的完整 Schema
}
```

## 核心概念

### Schema Processor

新的核心处理器提供三个纯函数:

1. **assemble(layout, registry)**
   - 输入: Server Layout + Registry
   - 处理: 遍历 Layout，解析 `x-filter-id`，从 Registry 获取定义并合并
   - 输出: 完整的 Assembled Schema

2. **project(assembledSchema, activeIds)**
   - 输入: Assembled Schema + 激活字段ID列表
   - 处理: 过滤 Schema，只保留激活字段
   - 输出: 用于渲染的 Active Schema

3. **getAvailableFilters(registry, activeIds)**
   - 输入: Registry + 激活字段ID列表
   - 处理: 过滤掉已激活的筛选器
   - 输出: 可添加的筛选器列表

### 数据流

```
服务端返回
├─ FILTER_DEFINITIONS (全局定义)
└─ SERVER_SCHEMA (页面布局 + 覆盖)

         ↓

DynamicFilterProvider
├─ 构建 Registry (from FILTER_DEFINITIONS)
└─ Processor.assemble(SERVER_SCHEMA, Registry)
   → Assembled Schema

         ↓

useDynamicFilters Hook
├─ 接收 Assembled Schema
├─ 维护 activeFilters 状态
└─ Processor.project(Assembled Schema, activeFilters)
   → Active Schema (用于渲染)
```

## 优势

### 1. 无副作用
- 移除了 `Schema.registerPatches` 全局注册
- 所有操作都是纯函数，可预测、可测试

### 2. Thin Hooks, Fat Core
- Hooks 只负责 React 状态管理
- 所有 Schema 操作逻辑在 Core 层
- 代码职责清晰，易于维护

### 3. 性能优化
- Assembly 只在 Provider 层执行一次
- Projection 使用 useMemo 缓存
- 避免重复计算

### 4. 更好的类型安全
- 明确的输入输出类型
- 减少 `any` 的使用

## 使用示例

```tsx
// 1. Provider 层 - Assembly Phase
<DynamicFilterProvider
  schema={SERVER_SCHEMA}          // 服务端 Layout
  definitions={FILTER_DEFINITIONS} // 全局定义
  components={{ Input, Select }}
>
  <YourApp />
</DynamicFilterProvider>

// 2. Hook 层 - Projection Phase
function YourApp() {
  const assembledSchema = useAssembledSchema();

  const {
    activeFilters,
    activeSchema,      // 投影后的 Schema
    availableFilters,  // 可添加筛选器
    addFilter,
    removeFilter
  } = useDynamicFilters({
    filter,
    assembledSchema,
    defaultFilters: ['filter:keyword']
  });

  return <SchemaField schema={activeSchema} />;
}
```

## 测试验证

运行 playground 验证新架构:

```bash
cd playground
pnpm dev
```

访问 `http://localhost:3000/dynamic-filter` 查看示例。

## 向后兼容性

⚠️ **Breaking Changes**:

1. `DynamicFilterProvider` 需要传入 `schema` 属性
2. `useDynamicFields` 的 `serverSchema` 改为 `assembledSchema`
3. 移除了 `autoInitPatch` 选项
4. 移除了 `createSchemaPatch` 导出

## 未来优化方向

1. 支持异步 Schema 加载
2. 增加 Schema 缓存策略
3. 提供 Schema diff 工具用于性能优化
4. 支持 Schema 版本管理

## 总结

本次重构实现了从"命令式 + 副作用"到"函数式 + 纯函数"的转变，代码更加清晰、可维护、可测试。新架构完全满足用户的三点诉求：

1. ✅ 从服务端拉取所有可选的筛选项 (FILTER_DEFINITIONS)
2. ✅ 获取页面配置并与全局配置合并 (Processor.assemble)
3. ✅ Hook 导出可用筛选项和添加/删除操作 (useDynamicFields)

