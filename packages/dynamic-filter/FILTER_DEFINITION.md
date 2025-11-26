# FilterDefinition（单字段定义）说明

最新版动态筛选器架构中，`FilterDefinition` 被重新定位为 **“单字段级别的 Formily Schema 定义”**。每个定义仅负责描述一个可重复使用的筛选器字段，所有组合/复杂交互都通过组件内部实现，这样可以确保：

1. 全局配置是一个扁平列表，易于维护和检索；
2. 任意页面/模块可通过 `x-filter-id` 精确引用某个筛选器定义；
3. 如果需要复杂交互（如价格范围、级联、组合输入），可以通过自定义组件在单字段内部封装，而不是在 Schema 层展开多个 properties。

## 新结构

```ts
export interface FilterDefinition extends ISchema {
  id: string;          // 全局唯一 ID，如 filter:keyword
  name: string;        // 人类可读的名称
  category?: string;   // 分类标签（搜索 / 数值 / 枚举 / ...）
  defaultValue?: any;  // 可选：默认值
  metadata?: Record<string, any>; // 额外信息（描述、图标、标签等）

  /**
   * 继承 ISchema，推荐定义单字段：
   * type、title、x-component、x-decorator 等均在此声明
   */
}
```

> ⚠️ 不再推荐在 `FilterDefinition` 内使用 `properties` 拆分多个字段。如果确实需要组合交互，请通过自定义组件实现（示例见下文的 `PriceRangeInput`）。

## 示例：全局筛选器列表

```ts
export const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    id: 'filter:keyword',
    name: '关键词搜索',
    type: 'string',
    title: '关键词',
    'x-component': 'Input',
    'x-decorator': 'FormItem',
    'x-component-props': { placeholder: '请输入关键词', allowClear: true },
    metadata: { description: '支持模糊搜索', tags: ['搜索', '常用'] },
  },
  {
    id: 'filter:category',
    name: '分类筛选',
    type: 'array',
    title: '分类',
    'x-component': 'Select',
    'x-decorator': 'FormItem',
    'x-component-props': { mode: 'multiple', allowClear: true },
    enum: [
      { label: '科技', value: 'tech' },
      { label: '生活', value: 'life' },
    ],
  },
  {
    id: 'filter:price-range',
    name: '价格范围',
    type: 'array',
    title: '价格范围',
    'x-component': 'PriceRangeInput', // 自定义组件内部处理双输入
    'x-decorator': 'FormItem',
    'x-component-props': { placeholder: ['最低价', '最高价'] },
  },
];
```

## 服务端 / 模块布局

模块（页面、频道等）只需要声明“使用哪些筛选器”，并通过 `x-filter-id` 引用全局定义。如果需要覆盖标题、占位符等属性，可以直接写在布局节点上：

```ts
export const SERVER_SCHEMA = {
  type: 'object',
  properties: {
    keywordFilter: {
      'x-filter-id': 'filter:keyword',
    },
    statusFilter: {
      'x-filter-id': 'filter:status',
      'x-component-props': {
        placeholder: '选择当前模块支持的状态',
      },
    },
    priceFilter: {
      'x-filter-id': 'filter:price-range',
    },
  },
};
```

## 组装与投影

1. `DynamicFilterProvider` 接收 `definitions` 和 `schema`：
   - 创建 `FilterRegistry`（Map<id, FilterDefinition>）；
   - 调用 `Processor.assemble(layout, registry)`，将布局节点中的 `x-filter-id` 替换为全局定义 + 覆盖项；
   - 将 `assembledSchema` 传给 React Context。

2. `useDynamicFilters`：
   - 读取 `assembledSchema`；
   - 通过 `Processor.project(assembledSchema, activeIds)` 得到当前激活筛选器对应的 Schema；
   - 暴露 `activeFilters`、`availableFilters`、`add/remove/reset` 方法供页面交互。

> 由于 `FilterDefinition` 仅描述单字段，`Processor.project` 只需根据顶层节点的 `x-filter-id` 进行过滤，逻辑更简单、更稳定。

## 自定义复杂组件

若需要多输入项，可编写一个自定义组件，将复杂交互封装在组件内部。例如价格范围组件：

```tsx
export function PriceRangeInput(props) {
  const { value = [], onChange } = props;
  const [min, max] = value;

  return (
    <div className="flex gap-2 items-center">
      <InputNumber value={min} onChange={(next) => onChange?.([next, max])} />
      <span>~</span>
      <InputNumber value={max} onChange={(next) => onChange?.([min, next])} />
    </div>
  );
}
```

然后在 `FilterDefinition` 中引用：

```ts
{
  id: 'filter:price-range',
  type: 'array',
  title: '价格范围',
  'x-component': 'PriceRangeInput',
  // ...
}
```

这样即便组件内部有多个输入控件，在 Formily Schema 层仍然只有一个字段，满足“全局配置都是独立字段”的要求。

## 总结

- 全局筛选器配置是一个 **扁平、可搜索的列表**；
- 每个 `FilterDefinition` 只描述一个字段，方便复用和覆盖；
- 多字段/复杂交互通过自定义组件实现，避免在 Schema 层引入多层 `properties`；
- 页面布局通过 `x-filter-id` 精准引用、覆盖，`Processor` 负责最终的合并与投影。

此模式让“全局配置 + 模块装配”更加直观、可维护，也为后续的动态下发、灰度发布等场景提供了稳定基础。***

