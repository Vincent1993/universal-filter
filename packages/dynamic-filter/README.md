# @dfx/dynamic-filter

Headless 动态筛选器系统，基于 Formily Schema Patch 机制实现。

## 特性

- 🎯 **纯 Headless**: 只提供 Hooks 和逻辑，零 UI 组件
- 🔌 **Provider 注册**: 所有注册工作在 Provider 中完成
- 📦 **单一配置源**: 只有服务端配置，外部注入或动态加载
- 🔧 **基于 universal-filter**: 复用已有的表单核心能力
- ⚡ **Schema Patch**: 自动拦截和合并配置
- 🎨 **动态字段管理**: 运行时添加/删除字段
- 🧹 **自动清理**: 删除字段自动清理表单值
- 💪 **类型安全**: 完整的 TypeScript 类型支持

## 安装

```bash
pnpm add @dfx/dynamic-filter
```

## 快速开始

### 1. 配置 Provider

```typescript
import { DynamicFilterProvider } from '@dfx/dynamic-filter'
import { FormItem, Input, Select } from '@formily/antd-v5'

const filterConfigs = [
  {
    id: 'filter:keyword',
    name: '关键词搜索',
    schema: {
      type: 'string',
      'x-component': 'Input',
      'x-decorator': 'FormItem'
    }
  }
]

function App() {
  return (
    <DynamicFilterProvider
      filterConfigs={filterConfigs}
      components={{ FormItem, Input, Select }}
    >
      <YourApp />
    </DynamicFilterProvider>
  )
}
```

### 2. 使用动态字段

```typescript
import { useDynamicFields, useSchemaField } from '@dfx/dynamic-filter'
import { createFilter, FilterProvider } from '@dfx/universal-filter'

function FilterPage() {
  const filter = useMemo(() => createFilter(), [])

  const serverSchema = {
    type: 'object',
    properties: {
      keyword: { 'x-component-id': 'filter:keyword' }
    }
  }

  const {
    activeSchema,
    addField,
    removeField
  } = useDynamicFields({
    filter,
    serverSchema,
    defaultFields: ['filter:keyword']
  })

  const SchemaField = useSchemaField()

  return (
    <FilterProvider instance={filter}>
      <SchemaField schema={activeSchema} />
    </FilterProvider>
  )
}
```

## API

### DynamicFilterProvider

核心 Provider 组件，完成所有注册工作。

**Props:**
- `filterConfigs: FilterFieldConfig[]` - 筛选器字段配置列表
- `components: Record<string, any>` - SchemaField 组件映射
- `scope?: Record<string, any>` - 表达式作用域
- `autoInitPatch?: boolean` - 是否自动初始化 Schema Patch (默认 true)

### useDynamicFields

动态字段管理 Hook。

**参数:**
- `filter: FilterApi` - universal-filter 实例
- `serverSchema: ISchema` - 服务端返回的 Schema
- `defaultFields?: string[]` - 默认展示的字段 ID 列表

**返回:**
- `activeFields: string[]` - 当前激活的字段
- `activeSchema: ISchema` - 激活字段的 Schema
- `availableFields: FilterFieldConfig[]` - 可添加的字段配置
- `addField: (fieldId: string) => void` - 添加字段
- `removeField: (fieldId: string) => void` - 删除字段
- `resetFields: () => void` - 重置字段
- `setFields: (fieldIds: string[]) => void` - 直接设置字段列表

### useFilterRegistry

访问筛选器注册表 Hook。

**返回:**
- `getById: (id: string) => FilterFieldConfig | undefined`
- `getAll: () => FilterFieldConfig[]`
- `getByCategory: (category: string) => FilterFieldConfig[]`
- `search: (keyword: string) => FilterFieldConfig[]`

### useSchemaField

获取已注册的 SchemaField 组件。

## License

MIT

