# Sidebar 组件 - TanStack Router 集成

## 概述

`sidebar.tsx` 已经集成了 TanStack Router，提供了两个专门的组件用于路由导航：

- `SidebarMenuButtonLink` - 主菜单项的路由链接
- `SidebarMenuSubButtonLink` - 子菜单项的路由链接

这些组件会自动检测当前路由并应用激活样式，无需手动管理 `isActive` 状态。

## 使用方法

### 基础用法

```tsx
import { SidebarMenuButtonLink } from "@/components/ui/sidebar"

<SidebarMenuItem>
  <SidebarMenuButtonLink to="/dashboard" tooltip="Dashboard">
    <IconDashboard />
    <span>Dashboard</span>
  </SidebarMenuButtonLink>
</SidebarMenuItem>
```

### 完整示例（nav-main.tsx）

```tsx
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButtonLink,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({ items }) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButtonLink
                to={item.url}
                tooltip={item.title}
                fuzzy={true}  // 启用模糊匹配（子路由也会高亮）
              >
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButtonLink>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```

### 子菜单示例

```tsx
import {
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButtonLink,
} from "@/components/ui/sidebar"

<SidebarMenuSub>
  <SidebarMenuSubItem>
    <SidebarMenuSubButtonLink
      to="/settings/profile"
      fuzzy={false}  // 精确匹配
    >
      <span>Profile</span>
    </SidebarMenuSubButtonLink>
  </SidebarMenuSubItem>
  <SidebarMenuSubItem>
    <SidebarMenuSubButtonLink to="/settings/security">
      <span>Security</span>
    </SidebarMenuSubButtonLink>
  </SidebarMenuSubItem>
</SidebarMenuSub>
```

## API

### SidebarMenuButtonLink

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `to` | `string` | - | 路由路径（必填） |
| `fuzzy` | `boolean` | `true` | 是否启用模糊匹配（子路由也会高亮父路由） |
| `tooltip` | `string \| TooltipProps` | - | 鼠标悬停提示 |
| `variant` | `"default" \| "outline"` | `"default"` | 按钮样式变体 |
| `size` | `"default" \| "sm" \| "lg"` | `"default"` | 按钮尺寸 |
| `className` | `string` | - | 自定义类名 |

### SidebarMenuSubButtonLink

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `to` | `string` | - | 路由路径（必填） |
| `fuzzy` | `boolean` | `false` | 是否启用模糊匹配 |
| `size` | `"sm" \| "md"` | `"md"` | 按钮尺寸 |
| `className` | `string` | - | 自定义类名 |

## 特性

### 自动激活状态

组件内部使用 `useMatchRoute` hook 自动检测当前路由：

```tsx
const matchRoute = useMatchRoute()
const isActive = !!matchRoute({ to: to as string, fuzzy })
```

当路由匹配时，会自动应用 `data-active={true}` 属性，触发对应的激活样式。

### 模糊匹配（Fuzzy Match）

- **主菜单**：默认 `fuzzy={true}`
  - 例如：访问 `/dashboard/analytics` 时，`/dashboard` 也会高亮

- **子菜单**：默认 `fuzzy={false}`
  - 通常子菜单需要精确匹配，避免多个子项同时高亮

### Tooltip 支持

在侧边栏折叠状态下，tooltip 会自动显示：

```tsx
<SidebarMenuButtonLink
  to="/settings"
  tooltip="Settings"  // 或者传入完整的 TooltipProps
>
  <IconSettings />
  <span>Settings</span>
</SidebarMenuButtonLink>
```

## 迁移指南

### 从旧版本迁移

**之前（手动管理状态）：**
```tsx
import { Link, useMatchRoute } from '@tanstack/react-router'

const matchRoute = useMatchRoute()
const isActive = !!matchRoute({ to: item.url, fuzzy: true })

<SidebarMenuButton tooltip={item.title} asChild isActive={isActive}>
  <Link to={item.url}>
    {item.icon && <item.icon />}
    <span>{item.title}</span>
  </Link>
</SidebarMenuButton>
```

**现在（自动管理状态）：**
```tsx
<SidebarMenuButtonLink
  to={item.url}
  tooltip={item.title}
  fuzzy={true}
>
  {item.icon && <item.icon />}
  <span>{item.title}</span>
</SidebarMenuButtonLink>
```

## 优势

1. **简化使用** - 无需手动导入和使用 `useMatchRoute`
2. **自动状态管理** - 组件内部处理激活状态
3. **一致性** - 统一的 API 和行为
4. **类型安全** - 完整的 TypeScript 支持
5. **灵活配置** - 支持 `fuzzy` 匹配、`tooltip`、样式变体等

## 注意事项

1. `SidebarMenuButton` 仍然保留用于非路由场景（如弹出菜单、操作按钮）
2. 路由场景统一使用 `SidebarMenuButtonLink`
3. 子菜单默认精确匹配，避免多个子项同时高亮
4. 确保 `to` 属性的路径与 TanStack Router 的路由配置一致

