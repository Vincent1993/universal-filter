/**
 * Test Utilities
 *
 * 参考: https://testing-library.com/docs/react-testing-library/setup
 *
 * 提供自定义的 render 方法和辅助函数，简化测试代码
 */
import React, { ReactElement, type ReactNode } from 'react';
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  RenderOptions,
  renderHook,
} from '@testing-library/react';
import { FilterProvider } from '../src/context/Provider';
import { createFilter } from '../src/core/createFilter';
import type { FilterApi, Draft } from '../src/core/types';
import type { ErrorInfo } from 'react';

// ==================== 类型定义 ====================

interface CustomRenderOptions<TDraft extends Draft = Draft> extends Omit<RenderOptions, 'wrapper'> {
  /**
   * FilterProvider 的 instance
   * 如果不提供，会自动创建一个空的 filter 实例
   */
  filterInstance?: FilterApi<TDraft>;
  /**
   * FilterProvider 的 namespace
   */
  filterNamespace?: string;
  /**
   * 初始值（用于自动创建 filter）
   */
  defaultValues?: TDraft;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: Array<string | number>;
}

interface RenderHookWithFilterOptions<TDraft extends Draft = Draft> {
  filterInstance?: FilterApi<TDraft>;
  defaultValues?: TDraft;
  namespace?: string;
}

// ==================== 工厂函数 ====================

/**
 * 创建测试用的 filter 实例
 *
 * @example
 * const filter = createTestFilter({ name: 'John', age: 25 });
 */
export function createTestFilter<TDraft extends Draft = Draft>(
  defaultValues?: TDraft
): FilterApi<TDraft> {
  return createFilter<TDraft>({
    defaultValues: defaultValues || ({} as TDraft),
  });
}

// ==================== 自定义 Render ====================

/**
 * 自定义 render 方法
 * 自动包裹 FilterProvider
 */
function customRender<TDraft extends Draft = Draft>(
  ui: ReactElement,
  options?: CustomRenderOptions<TDraft>
) {
  const {
    filterInstance,
    filterNamespace,
    defaultValues,
    fallback,
    onError,
    onReset,
    resetKeys,
    ...renderOptions
  } = options || {};

  // 如果提供了 filterInstance，使用它；否则创建一个新的
  const instance = filterInstance || createTestFilter<TDraft>(defaultValues);

  // 创建 AllTheProviders 组件
  function AllTheProviders({ children }: { children: React.ReactNode }) {
    return (
      <FilterProvider
        instance={instance}
        namespace={filterNamespace}
        fallback={fallback}
        onError={onError}
        onReset={onReset}
        resetKeys={resetKeys}
      >
        {children}
      </FilterProvider>
    );
  }

  return rtlRender(ui, { wrapper: AllTheProviders, ...renderOptions });
}

// ==================== Hook Render 辅助函数 ====================

/**
 * 渲染带 FilterProvider 的 hook
 *
 * 关键改进：
 * 1. 使用 SyncRegisterWrapper 在子组件渲染前同步注册实例
 * 2. 确保 useFilter hook 调用时能立即找到实例
 * 3. 自动处理清理逻辑
 *
 * @example
 * const { result, filter } = renderHookWithFilter(() => useFilter(), {
 *   filterInstance: myFilter,
 * });
 */
export function renderHookWithFilter<TResult, TDraft extends Draft = Draft>(
  hook: () => TResult,
  options?: RenderHookWithFilterOptions<TDraft>
) {
  const instance = options?.filterInstance || createTestFilter(options?.defaultValues);

  const hookResult = renderHook(hook, {
    wrapper: ({ children }) => (
      <FilterProvider instance={instance} namespace={options?.namespace}>
        {children}
      </FilterProvider>
    ),
  });

  return {
    ...hookResult,
    filter: instance,
  };
}

// ==================== 嵌套 Provider 辅助函数 ====================

/**
 * 创建嵌套的 FilterProvider wrapper
 *
 * @example
 * const wrapper = createNestedWrapper([
 *   { instance: filter1, namespace: 'ns1' },
 *   { instance: filter2, namespace: 'ns2' },
 * ]);
 *
 * const { result } = renderHook(() => useFilter({ namespace: 'ns2' }), { wrapper });
 */
export function createNestedWrapper<TDraft extends Draft = Draft>(
  providers: Array<{
    instance: FilterApi<TDraft>;
    namespace?: string;
  }>
) {
  return ({ children }: { children: React.ReactNode }) => {
    return providers.reduceRight(
      (child, { instance, namespace }) => (
        <FilterProvider instance={instance} namespace={namespace}>
          {child}
        </FilterProvider>
      ),
      children as React.ReactElement
    );
  };
}

// ==================== 导出 ====================

// 重新导出 @testing-library/react 的所有内容
export * from '@testing-library/react';

// 覆盖 render 方法
export { customRender as render };

// 导出原始的 renderHook（用于不需要 Provider 的测试）
export { rtlRenderHook as renderHook };

// 导出类型
export type { CustomRenderOptions, RenderHookWithFilterOptions };

