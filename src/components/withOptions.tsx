/**
 * withOptions - 高阶组件，自动为组件注入 options 数据源
 *
 * 当 Schema 中包含 x-data-source 时，自动使用 useOptions 获取数据
 * 并通过 field.setDataSource 同步到 Formily
 */

import * as React from 'react';
import { useOptions, useField, useFilter } from '../index';
import type { OptionSourceConfig, OptionItem } from '../index'

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
export function withOptions<P extends Record<string, any>>(Component: React.ComponentType<P>) {
  return function OptionsWrapper(props: P & WithOptionsProps) {
    const field = useField();
    const filter = useFilter();

    const dataSource = field.schema?.['x-data-source'] as OptionSourceConfig;
    const staticEnum = field.schema?.enum as OptionItem[];

    if (!dataSource) {
      return React.createElement(Component, {
        ...props,
        options: staticEnum ?? props.options,
      });
    }

    const deps = React.useMemo<Record<string, unknown>>(() => {
      if (!dataSource.dependencies) return {};
      return dataSource.dependencies.reduce<Record<string, unknown>>((acc, depPath) => {
        acc[depPath] = filter.form.getValuesIn(depPath);
        return acc;
      }, {});
    }, [
      filter.form,
      JSON.stringify(dataSource.dependencies ?? []),
    ]);

    const {
      data,
      isLoading,
      error,
      search,
    } = useOptions({
      dataSource,
      staticEnum,
      deps: Object.keys(deps).length ? deps : undefined,
    });

    React.useEffect(() => {
      field.setDataSource(data);
    }, [data, field]);


    const mergedProps = React.useMemo(() => {
      const merged: any = {
        ...props,
        loading: props.loading || isLoading,
      };

      if (dataSource.strategy === 'remote-search' && props.showSearch) {
        merged.onSearch = (keyword: string) => {
          search(keyword);
          props.onSearch?.(keyword);
        };
        merged.filterOption = false;
      }

      return merged as P;
    }, [
      props,
      isLoading,
      dataSource,
      search,
    ]);

    if (error) {
      console.warn('[withOptions] 数据加载失败:', error);
    }

    return React.createElement(Component, mergedProps);
  };
}
