/**
 * withOptions - 高阶组件，自动为组件注入 options 数据源
 *
 * 当 Schema 中包含 x-data-source 时，自动使用 useOptions 获取数据
 * 并通过 field.setDataSource 同步到 Formily
 */

import { useMemo } from 'react';
import { useField, useFieldSchema } from '@formily/react';
import { useOptions } from '@dfx/universal-filter';
import type { OptionSourceConfig, OptionItem } from '@dfx/universal-filter';

export interface WithOptionsProps {
  children?: React.ReactElement;
  [key: string]: any;
}

/**
 * withOptions - 高阶组件包装器
 *
 * @param Component - 要包装的组件（如 Select）
 * @returns 包装后的组件
 */
export function withOptions<P extends Record<string, any>>(
  Component: React.ComponentType<P>
) {
  return function OptionsWrapper(props: P & WithOptionsProps) {
    const field = useField();
    const schema = useFieldSchema();

    // 从 Schema 中获取数据源配置
    const dataSource = schema['x-data-source'] as OptionSourceConfig | undefined;
    const staticEnum = schema.enum as OptionItem[] | undefined;

    // 只有在有 x-data-source 配置时才使用 useOptions
    const hasDataSource = !!dataSource;

    // 获取依赖字段的值
    // 使用 useMemo 并在依赖数组中包含依赖字段的值，确保当依赖字段变化时重新计算
    const deps = useMemo<Record<string, unknown>>(() => {
      const result: Record<string, unknown> = {};
      if (dataSource?.dependencies) {
        dataSource.dependencies.forEach((depPath) => {
          const depValue = field.form.getValuesIn(depPath);
          result[depPath] = depValue;
        });
      }
      return result;
    }, [
      dataSource?.dependencies,
      // 包含依赖字段的值，确保当依赖字段变化时重新计算
      ...(dataSource?.dependencies?.map((depPath) => field.form.getValuesIn(depPath)) || []),
    ]);

    // 使用 useOptions Hook 获取数据（仅当有 x-data-source 时）
    const {
      options,
      isLoading,
      isSearching,
      error,
      search,
      prefetch,
    } = useOptions({
      fieldPath: field.path.toString(),
      dataSource: hasDataSource ? dataSource : undefined,
      staticEnum: hasDataSource ? staticEnum : undefined, // 只有在有数据源时才传递
      deps: Object.keys(deps).length > 0 ? deps : undefined,
      enabled: hasDataSource && !props.disabled,
      syncToField: true, // 自动同步到 field.dataSource
    });

    // 合并 props
    const mergedProps = useMemo(() => {
      const merged: any = {
        ...props,
      };

      // 只有在有 x-data-source 配置时才覆盖 options
      if (hasDataSource) {
        merged.options = options;
      }
      // 如果没有 x-data-source，保留 Formily 的默认行为（使用 schema.enum）

      // 处理 loading 状态（仅当有数据源时）
      if (hasDataSource && (isLoading || isSearching)) {
        merged.loading = true;
      }

      // 处理搜索（仅当有数据源且 strategy 为 remote-search 时）
      if (hasDataSource && dataSource?.strategy === 'remote-search' && props.showSearch) {
        merged.onSearch = (keyword: string) => {
          search(keyword);
          // 如果原组件有 onSearch，也调用它
          if (props.onSearch) {
            props.onSearch(keyword);
          }
        };
        // 关闭本地过滤，使用远程搜索
        merged.filterOption = false;
      }

      // 处理聚焦（用于 on-demand 触发，仅当有数据源时）
      if (hasDataSource && dataSource?.trigger === 'focus') {
        const originalOnFocus = props.onFocus;
        merged.onFocus = (e: any) => {
          prefetch();
          if (originalOnFocus) {
            originalOnFocus(e);
          }
        };
      }

      // 处理下拉框展开（用于 on-demand 触发，仅当有数据源时）
      if (hasDataSource && dataSource?.trigger === 'focus') {
        const originalOnDropdownVisibleChange = props.onDropdownVisibleChange;
        merged.onDropdownVisibleChange = (open: boolean) => {
          if (open) {
            prefetch();
          }
          if (originalOnDropdownVisibleChange) {
            originalOnDropdownVisibleChange(open);
          }
        };
      }

      return merged as P;
    }, [
      props,
      options,
      isLoading,
      isSearching,
      dataSource,
      staticEnum,
      search,
      prefetch,
    ]);

    // 如果有错误，可以显示错误信息
    if (error && process.env.NODE_ENV === 'development') {
      console.warn('[withOptions] 数据加载失败:', error);
    }

    return <Component {...(mergedProps as P)} />;
  };
}

export default withOptions;

