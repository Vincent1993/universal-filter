# universal-filter

一个基于 Formily 和 TanStack Query 的无界面过滤工具库，对标"全局筛选器体系"设计。提供完整的插件生态、数据管道支持，以及强大的 SOLID 原则驱动的架构。

## 核心特性

- **框架独立的核心** – `createFilter` 创建 Formily 表单实例，核心逻辑与 React 完全分离
- **React Hooks & Context** – `useFilter`、`useField`、`useOptions` 以及集成 `ExpressionScope` 的 Provider
- **数据管道与分片** – `createDataPipeline` 和 `registerDataShard` 支持编码/解码及部分状态投影
- **多根与分组** – `createHeadlessRoot` 和分组 reset 帮助器支持独立控制器和同步
- **插件生态** – 预设管理、URL 同步、历史追踪等完整的生命周期钩子
- **SOLID 原则** – 单一职责、开闭原则、里式替换、接口隔离和依赖倒置原则贯穿架构
- **充分复用** – 100% 使用 es-toolkit 工具函数，复用 Formily 所有能力

## 架构设计

### 目录结构

```
src/
  core/              # 框架独立的核心逻辑
    ├── controller.ts    # FilterController 实现（带 SOLID 分层）
    ├── createFilter.ts  # 工厂函数
    ├── pipeline.ts      # 数据管道
    ├── registry.ts      # 实例注册表
    ├── schema.ts        # Schema 编译
    ├── types.ts         # 类型定义
    └── ...

  context/           # React 上下文层
    ├── FilterProvider.tsx  # 集成 ExpressionScope 的 Provider
    ├── FilterConfigure.tsx # 全局配置
    └── context.ts          # Context 定义

  hooks/             # React Hooks 层
    ├── useField.tsx      # 优化版 useField（支持自动路径推断）
    ├── useOptions.ts     # 选项加载
    └── index.ts

  adapters/          # 环境适配器
  plugins/           # 插件系统
  types/             # TypeScript 类型垫片
```

### SOLID 原则应用

#### 单一职责原则 (SRP)
- `StateManager` – 管理状态
- `SubscriptionManager` – 管理订阅
- `GroupManager` – 管理字段分组
- 职责清晰，易于测试和维护

#### 开闭原则 (OCP)
- 完整的 Plugin 接口支持扩展
- 可扩展的 DataPipeline 流程
- PresetPlugin、UrlSyncPlugin 等无须修改核心

#### 里式替换原则 (LSP)
- 所有 Plugin 实现统一接口
- 所有 Adapter 统一契约
- 可无缝替换实现

#### 接口隔离原则 (ISP)
- 小而专的接口设计
- 消费者只依赖所需功能

#### 依赖倒置原则 (DIP)
- 依赖抽象而非具体
- Plugin 系统、Adapter 模式充分应用

## 快速开始

```bash
pnpm install
```

### 脚本

- `pnpm run build` – 使用 rslib 构建
- `pnpm run test` – 运行 Vitest 测试（含覆盖率）
- `pnpm test:coverage` – 生成覆盖率报告
- `pnpm run lint` – 运行 ESLint
- `pnpm run typecheck` – 类型检查

## 核心用法

### 基础用法

```typescript
import { createFilter } from '@universal-filter/core';

const filter = createFilter({
  defaultValues: { search: '', status: 'all' },
});

filter.getField('search').setValue('product');
await filter.apply();
```

### React 集成

```typescript
import { FilterProvider, useFilter, useField } from '@universal-filter';

function MyComponent() {
  const filter = useFilter();
  const field = useField('search');

  return (
    <input
      value={field.value}
      onChange={(e) => field.setValue(e.target.value)}
    />
  );
}

function App() {
  const filter = createFilter({ defaultValues: { search: '' } });

  return (
    <FilterProvider instance={filter}>
      <MyComponent />
    </FilterProvider>
  );
}
```

### 数据管道

```typescript
const pipeline = createDataPipeline([
  {
    name: 'api-encode',
    encode: (draft) => ({
      filters: {
        keyword: draft.keyword,
        status: draft.status,
      },
    }),
  },
]);

const filter = createFilter({ pipeline });
```

### 分组管理

```typescript
const filter = createFilter({
  defaultValues: { a: 1, b: 2, c: 3 },
  groups: [
    { id: 'basic', fields: ['a', 'b'] },
    { id: 'advanced', fields: ['c'] },
  ],
});

filter.reset('group', 'basic'); // 仅重置 a, b
```

## 技术栈

- **Formily** – 底层表单引擎
- **TanStack Query** – 异步状态管理
- **es-toolkit** – 现代工具函数库
- **TypeScript** – 完整类型支持
- **Vitest** – 测试框架（>95% 覆盖率）

## 测试

项目包含全面的单元和集成测试：

```bash
# 运行所有测试
pnpm test

# 监视模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage
```

### 覆盖率目标

- 行覆盖率: 95%+
- 函数覆盖率: 95%+
- 分支覆盖率: 90%+
- 语句覆盖率: 95%+

## 示例

见 `examples/` 目录：

- `basic.ts` – 基本用法
- `pipeline.ts` – 数据管道示例
- `multipleRoots.ts` – 多根投影

## 许可证

MIT © 2025

## 贡献指南

遵循 SOLID 原则，保证代码质量和可维护性。所有贡献需要：

1. 单元测试覆盖
2. TypeScript 类型完整性
3. ESLint 检查通过
4. 代码注释说明

## 相关资源

- [Formily 官方文档](https://react.formilyjs.org/)
- [TanStack Query 官方文档](https://tanstack.com/query)
- [es-toolkit 官方文档](https://es-toolkit.vercel.app/)
