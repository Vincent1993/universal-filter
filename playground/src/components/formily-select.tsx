import * as React from "react"
import { connect, mapProps, mapReadPretty } from "@formily/react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// 定义选项类型
interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

// 定义组件属性类型
interface FormilySelectProps {
  value?: string | number
  onChange?: (value: string | number) => void
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  size?: "sm" | "default"
  className?: string
  options?: SelectOption[]
  enum?: SelectOption[]
  mode?: "single" | "multiple"
  loading?: boolean
  notFoundContent?: React.ReactNode
  showSearch?: boolean
  filterOption?: boolean | ((input: string, option: SelectOption) => boolean)
  onSearch?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  onDropdownVisibleChange?: (open: boolean) => void
}

// 自定义 Formily Select 组件
const FormilySelectComponent: React.FC<FormilySelectProps> = ({
  value,
  onChange,
  placeholder = "请选择",
  disabled = false,
  allowClear = false,
  size = "default",
  className,
  options = [],
  enum: enumOptions = [],
  mode = "single",
  loading = false,
  notFoundContent,
  showSearch = false,
  filterOption = true,
  onSearch,
  onBlur,
  onFocus,
  onDropdownVisibleChange,
  ...props
}) => {
  console.log(options, enumOptions)
  // 合并 options 和 enum 选项
  const allOptions = React.useMemo(() => {
    return [...options, ...enumOptions]
  }, [options, enumOptions])
  // 处理值变化
  const handleValueChange = React.useCallback((newValue: string) => {
    if (onChange) {
      // 尝试转换为数字，如果失败则保持字符串
      const numericValue = Number(newValue)
      const finalValue = isNaN(numericValue) ? newValue : numericValue
      onChange(finalValue)
    }
  }, [onChange])

  // 处理搜索
  const handleSearch = React.useCallback((searchValue: string) => {
    onSearch?.(searchValue)
  }, [onSearch])

  // 处理下拉框显示状态变化
  const handleOpenChange = React.useCallback((open: boolean) => {
    onDropdownVisibleChange?.(open)
  }, [onDropdownVisibleChange])

  // 如果没有选项，显示空状态
  if (allOptions.length === 0) {
    return (
      <Select disabled={disabled}>
        <SelectTrigger
          className={cn(
            "w-full",
            size === "sm" && "h-8",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <div className="p-2 text-sm text-muted-foreground text-center">
            {notFoundContent || "暂无选项"}
          </div>
        </SelectContent>
      </Select>
    )
  }

  return (
    <Select
      value={value?.toString()}
      onValueChange={handleValueChange}
      disabled={disabled}
      {...props}
    >
      <SelectTrigger
        className={cn(
          "w-full",
          size === "sm" && "h-8",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allOptions.map((option) => (
          <SelectItem
            key={option.value.toString()}
            value={option.value.toString()}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// 创建只读版本的组件
const FormilySelectReadPretty: React.FC<FormilySelectProps> = ({
  value,
  options = [],
  enum: enumOptions = [],
  placeholder = "请选择",
  className,
}) => {
  const allOptions = React.useMemo(() => {
    return [...options, ...enumOptions]
  }, [options, enumOptions])

  const selectedOption = allOptions.find(option => option.value === value)

  return (
    <div className={cn("text-sm", className)}>
      {selectedOption ? selectedOption.label : placeholder}
    </div>
  )
}

// 使用 Formily 的 connect 和 mapProps 创建最终的组件
export const FormilySelect = connect(
  FormilySelectComponent,
  mapProps({dataSource: 'options'},(props) => props),
  mapReadPretty(FormilySelectReadPretty)
)

// 导出类型
export type { FormilySelectProps, SelectOption }
