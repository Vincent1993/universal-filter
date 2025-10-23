# Universal Filter Playground

基于 **shadcn/ui + Tailwind CSS** 构建的交互式开发环境,用于测试和演示 Universal Filter 库的功能。

## 🎨 UI 架构

### 双层设计

```
┌─────────────────────────────────────────┐
│   shadcn/ui + Tailwind CSS            │  布局层
│   (Sidebar, Header, Card, Button)     │
├─────────────────────────────────────────┤
│   Ant Design + Formily                │  表单层
│   (Input, Select, Switch, FormItem)   │
└─────────────────────────────────────────┘
```

**shadcn/ui** 负责:
- 整体布局 (Sidebar, Header)
- 页面容器和卡片
- 按钮和交互组件
- 使用 Tailwind CSS 类名

**Ant Design** 负责:
- Filter 表单控件
- Formily 组件 (`@formily/antd-v5`)
- 表单验证和布局

## 📁 页面导航

### 🏠 首页 (`/`)
- 项目介绍
- 核心特性展示
- 快速开始指引

### 🎯 基础示例 (`/basic`)
- JSON Schema 驱动的表单
- 草稿和已应用状态管理
- Schema 配置查看器

### ⚡ 高级功能 (`/advanced`)
- URL 同步插件
- 自动应用功能
- 实时 URL 参数监控

### 💻 在线编辑器 (`/editor`)
- 使用 modern-monaco 在线编辑 JSON Schema
- 实时预览表单效果
- 支持语法高亮和智能提示
- Ctrl/Cmd+S 保存并应用

### ⚙️ 配置示例 (`/settings`)
- 完整的配置指南
- 各种配置示例
- API 参考文档

## 🚀 运行 Playground

```bash
pnpm install
pnpm dev
```

然后访问 http://localhost:3000

## 🛠️ 技术栈

### 核心框架
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **TanStack Router** - 路由管理
- **Rsbuild** - 构建工具

### UI 组件
- **shadcn/ui** - 布局和基础组件
  - Radix UI 组件
  - Tailwind CSS 样式
  - lucide-react 图标
- **Ant Design 5** - 表单组件

### 表单系统
- **Formily 2** - 表单状态管理
  - @formily/core
  - @formily/react
  - @formily/antd-v5
  - @formily/json-schema

### 编辑器
- **modern-monaco** - 代码编辑器

## 📂 项目结构

```
playground/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui 组件
│   │   │   ├── button.tsx
│   │   │   └── card.tsx
│   │   └── app-sidebar.tsx  # 应用侧边栏
│   ├── lib/
│   │   └── utils.ts         # cn() 工具函数
│   ├── routes/              # TanStack Router 路由
│   │   ├── __root.tsx       # 根布局 (shadcn)
│   │   ├── index.tsx        # 首页
│   │   ├── basic.tsx        # 基础示例
│   │   ├── advanced.tsx     # 高级功能
│   │   ├── editor.tsx       # 在线编辑器
│   │   └── settings.tsx     # 配置示例
│   ├── main.tsx             # 应用入口
│   └── styles.css           # Tailwind 样式
├── tailwind.config.js       # Tailwind 配置
├── postcss.config.js        # PostCSS 配置
└── rsbuild.config.ts        # Rsbuild 配置
```

## 🎯 核心特性

- ✅ **JSON Schema 驱动**: 使用 Formily JSON Schema 定义表单
- ✅ **双态管理**: 区分草稿态(draft)和已应用态(applied)
- ✅ **URL 同步**: 自动将筛选状态同步到 URL 查询参数
- ✅ **自动应用**: 支持值变化时自动应用
- ✅ **插件系统**: 可扩展的插件架构
- ✅ **shadcn/ui**: 现代化的 UI 组件和布局
- ✅ **Monaco Editor**: 基于 modern-monaco 的在线编辑器
- ✅ **类型安全**: 完整的 TypeScript 支持

## 💡 使用示例

### 混合使用 shadcn + Ant Design

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FormItem, Input, Select } from '@formily/antd-v5';
import { createFilter, FilterProvider, useFilter } from '@lib';

function ExamplePage() {
  const filter = useMemo(() => createFilter<Draft>({...}), []);

  return (
    // shadcn/ui 布局
    <div className="container mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>筛选表单</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Ant Design + Formily 表单 */}
          <FilterProvider instance={filter}>
            <SchemaField schema={schema} />
          </FilterProvider>
        </CardContent>
      </Card>

      {/* shadcn/ui 按钮 */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => filter.reset()}>
          重置
        </Button>
        <Button onClick={() => filter.apply()}>
          应用
        </Button>
      </div>
    </div>
  );
}
```

## 🎨 样式系统

### Tailwind CSS 变量
使用 HSL 颜色系统,定义在 `styles.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --card: 0 0% 100%;
  --border: 214.3 31.8% 91.4%;
  /* ... */
}
```

### cn() 工具函数
用于合并 Tailwind 类名:

```tsx
import { cn } from '@/lib/utils';

<div className={cn(
  'base-class',
  condition && 'conditional-class',
  className
)} />
```

## 📚 参考文档

- [shadcn/ui](https://ui.shadcn.com/) - UI 组件库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Ant Design](https://ant.design/) - 表单组件
- [Formily](https://formilyjs.org/) - 表单解决方案
- [TanStack Router](https://tanstack.com/router) - 路由管理
- [modern-monaco](https://github.com/esm-dev/modern-monaco) - 代码编辑器

## 🔧 开发

### 添加 shadcn/ui 组件

使用 shadcn CLI 快速添加组件:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add alert
```

或手动从 https://ui.shadcn.com 复制组件代码到 `src/components/ui/`

### 创建新页面

1. 在 `src/routes/` 创建新文件
2. 使用 `createFileRoute` 定义路由
3. 使用 shadcn/ui 组件构建布局
4. 使用 Ant Design 组件构建表单

## ⚡ 性能优化

- ✅ 路由级代码分割 (TanStack Router)
- ✅ 按需加载组件
- ✅ Tailwind CSS JIT 模式
- ✅ Monaco Editor 懒加载

## 📄 License

MIT
