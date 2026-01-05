/**
 * RemoteSelect - 支持远程数据源的 Select 组件
 *
 * 使用 useOptions Hook 自动获取数据
 * 支持：静态数据、首次加载、搜索、依赖刷新
 */

import { Select, Spin } from 'antd';
import { useField, useFieldSchema } from '@formily/react';
import { useOptions } from '@dfx/dynamic-filter';
import type { OptionSourceConfig } from '@dfx/dynamic-filter';

export interface RemoteSelectProps {
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  allowClear?: boolean;
  showSearch?: boolean;
  filterOption?: boolean;
  mode?: 'multiple' | 'tags';
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function RemoteSelect(props: RemoteSelectProps) {
  const {
    value,
    onChange,
    placeholder,
    allowClear = true,
    showSearch = false,
    filterOption = true,
    mode,
    disabled,
    style,
  } = props;

  const field = useField();
  const schema = useFieldSchema();

  // 从 Schema 中获取数据源配置
  const dataSource = schema['x-data-source'] as OptionSourceConfig | undefined;
  const staticEnum = schema.enum as { label: string; value: string | number }[] | undefined;

  // 获取依赖字段的值（如果配置了 dependencies）
  const deps: Record<string, unknown> = {};
  if (dataSource?.dependencies) {
    dataSource.dependencies.forEach((depPath) => {
      const depValue = field.form.getValuesIn(depPath);
      deps[depPath] = depValue;
    });
  }

  // 使用 useOptions Hook
  const {
    options,
    isLoading,
    isSearching,
    error,
    search,
    prefetch,
  } = useOptions({
    fieldPath: field.path.toString(),
    dataSource,
    staticEnum,
    deps: Object.keys(deps).length > 0 ? deps : undefined,
    enabled: !disabled,
  });

  // 处理搜索
  const handleSearch = (keyword: string) => {
    if (dataSource?.strategy === 'remote-search') {
      search(keyword);
    }
  };

  // 处理聚焦（用于 on-demand 触发）
  const handleFocus = () => {
    if (dataSource?.trigger === 'focus') {
      prefetch();
    }
  };

  // 过滤选项（本地过滤）
  const handleFilterOption = filterOption
    ? (input: string, option?: { label?: string }) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
    : false;

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      allowClear={allowClear}
      showSearch={showSearch}
      filterOption={handleFilterOption}
      mode={mode}
      disabled={disabled}
      style={style}
      options={options}
      loading={isLoading || isSearching}
      onSearch={showSearch ? handleSearch : undefined}
      onFocus={handleFocus}
      notFoundContent={
        isLoading ? (
          <Spin size="small" />
        ) : error ? (
          <span className="text-red-500 text-sm">加载失败</span>
        ) : (
          <span className="text-gray-400 text-sm">暂无数据</span>
        )
      }
    />
  );
}

export default RemoteSelect;

