# @dfx/dynamic-filter

基于 Schema Assembly 和 Projection 机制的 Headless 动态筛选器系统。

## 核心特性

- ✅ **Schema Assembly**: 一次性组装完整 Schema，无全局副作用
- ✅ **Schema Projection**: 按需过滤激活字段，高性能渲染
- ✅ **Thin Hooks, Fat Core**: 逻辑集中在 Core 层，Hooks 只负责状态管理
- ✅ **完全 Headless**: 无 UI 依赖，自由组装界面
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **纯函数式**: 所有核心逻辑都是纯函数，可预测、可测试

## 架构原理

```
┌──────────────────────────────────────┐
│  服务端                                │
│  ├─ 全局定义 (FILTER_DEFINITIONS)     │
│  └─ 页面布局 (SERVER_SCHEMA)          │
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Provider - Assembly Phase           │
│  Processor.assemble(Layout, Registry)│
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Assembled Schema (完整)              │
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Hook - Projection Phase             │
│  Processor.project(Schema, activeIds)│
└──────────────┬───────────────────────┘
               │
               v
┌──────────────────────────────────────┐
│  Active Schema (渲染)                 │
└──────────────────────────────────────┘
```

## 快速开始

### 1. 定义全局筛选器配置

```typescript
import type { FilterDefinition } from '@dfx/dynamic-filter';

export const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    id: 'filter:keyword',
    name: '关键词搜索',
    category: 'search',
    type: 'string',
    title: '关键词',
    'x-component': 'Input',
    'x-decorator': 'FormItem',
    'x-component-props': {
      placeholder: '请输入关键词',
      allowClear: true,
    },
  },
  {
    id: 'filter:status',
    name: '状态筛选',
    category: 'enum',
    type: 'string',
    title: '状态',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    enum: [
      { label: '启用', value: 'active' },
      { label: '禁用', value: 'disabled' },
    ],
  },
];
```

### 2. 定义服务端 Schema (页面布局)

```typescript
export const SERVER_SCHEMA = {
  type: 'object',
  properties: {
    keyword: {
      'x-filter-id': 'filter:keyword',
      // 可以覆盖全局配置
      'x-component-props': {
        placeholder: '搜索用户名或邮箱',
      },
    },
    status: {
      'x-filter-id': 'filter:status',
    },
  },
};
```

### 3. 在应用中使用

```tsx
import { createFilter, FilterProvider } from '@dfx/universal-filter';
import {
  DynamicFilterProvider,
  useDynamicFilters,
  useSchemaField,
  useAssembledSchema,
} from '@dfx/dynamic-filter';
import { FormItem, Input, Select } from '@formily/antd-v5';

function App() {
  return (
    <DynamicFilterProvider
      schema={SERVER_SCHEMA}
      definitions={FILTER_DEFINITIONS}
      components={{ FormItem, Input, Select }}
    >
      <FilterContent />
    </DynamicFilterProvider>
  );
}

function FilterContent() {
  const filter = useMemo(() => createFilter(), []);
  const assembledSchema = useAssembledSchema();
  const SchemaField = useSchemaField();

  const {
    activeFilters,
    activeSchema,
    availableFilters,
    addFilter,
    removeFilter,
  } = useDynamicFilters({
    filter,
    assembledSchema: assembledSchema!,
    defaultFilters: ['filter:keyword'],
  });

  return (
    <FilterProvider instance={filter}>
      {/* 渲染已激活的字段 */}
      <SchemaField schema={activeSchema} />

      {/* 添加字段按钮 */}
      {availableFilters.map((field) => (
        <button key={field.id} onClick={() => addFilter(field.id)}>
          添加 {field.name}
        </button>
      ))}

      {/* 移除字段按钮 */}
      {activeFilters.map((filterId) => (
        <button key={filterId} onClick={() => removeFilter(filterId)}>
          移除 {filterId}
        </button>
      ))}
    </FilterProvider>
  );
}
```

## API 文档

### DynamicFilterProvider

```typescript
interface DynamicFilterProviderProps {
  /** 服务端返回的 Schema Layout */
  schema?: ISchema;
  /** 全局筛选器配置列表 */
  definitions: FilterDefinition[];
  /** Formily 组件映射 */
  components: Record<string, any>;
  /** 表达式作用域 */
  scope?: Record<string, any>;
  children: ReactNode;
}
```

### useDynamicFilters

```typescript
interface UseDynamicFiltersOptions {
  /** universal-filter 实例 */
  filter: FilterApi;
  /** 组装后的完整 Schema */
  assembledSchema: ISchema;
  /** 默认展示的字段 ID 列表 */
  defaultFilters?: string[];
}

interface DynamicFieldsManager {
  /** 当前激活的字段 ID 列表 */
  activeFilters: string[];
  /** 激活字段的 Schema */
  activeSchema: ISchema;
  /** 可添加的字段配置列表 */
  availableFilters: FilterDefinition[];
  /** 添加字段 */
  addFilter: (filterId: string) => void;
  /** 删除字段 */
  removeFilter: (filterId: string) => void;
  /** 重置字段 */
  resetFilters: () => void;
  /** 直接设置字段列表 */
  setFilters: (filterIds: string[]) => void;
}
```

### Processor (高级用法)

```typescript
interface SchemaProcessor {
  /** 组装 Schema */
  assemble: (layout: ISchema, registry: FilterRegistry) => ISchema;
  /** 投影 Schema */
  project: (assembledSchema: ISchema, activeIds: string[]) => ISchema;
  /** 获取可用筛选器 */
  getAvailableFilters: (
    registry: FilterRegistry,
    activeIds: string[]
  ) => FilterDefinition[];
}
```

## 配置合并策略

当服务端 Schema 引用全局配置时，会进行智能合并：

```typescript
// 全局配置
{
  id: 'filter:keyword',
  schema: {
    type: 'string',
    title: '关键词',
    'x-component': 'Input',
    'x-component-props': {
      placeholder: '请输入',
      allowClear: true,
    }
  }
}

// 服务端覆盖
{
  'x-filter-id': 'filter:keyword',
  title: '用户搜索',
  'x-component-props': {
    placeholder: '搜索用户名',
  }
}

// 合并结果
{
  type: 'string',
  title: '用户搜索',  // 覆盖
  'x-component': 'Input',  // 保留
  'x-component-props': {
    placeholder: '搜索用户名',  // 覆盖
    allowClear: true,  // 保留
  }
}
```

**合并规则**:
- 对象属性: 深度合并
- 数组属性: 后者完全替换前者
- 优先级: 全局配置 < 服务端配置

## 示例项目

查看 `playground/src/routes/dynamic-filter.tsx` 获取完整示例。

## 与旧版本的区别

### 架构变化

- **旧版**: 使用 `Schema.registerPatches` 全局副作用
- **新版**: 使用 `Processor.assemble` 纯函数

### API 变化

```typescript
// 旧版
<DynamicFilterProvider
  filterConfigs={configs}
  autoInitPatch={true}  // ❌ 已移除
>

// 新版
<DynamicFilterProvider
  schema={SERVER_SCHEMA}  // ✅ 新增
  definitions={configs}
>

// 旧版 Hook
useDynamicFields({
  filter,
  serverSchema,  // ❌ 已废弃
})

// 新版 Hook
const assembledSchema = useAssembledSchema();  // ✅ 从 Context 获取
useDynamicFilters({
  filter,
  assembledSchema,  // ✅ 使用组装后的 Schema
})
```

## License

MIT
