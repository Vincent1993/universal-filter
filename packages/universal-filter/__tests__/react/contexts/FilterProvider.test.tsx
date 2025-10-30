/**
 * FilterProvider 组件测试
 *
 * 测试范围：
 * 1. Context 提供：FilterContext、FormProvider、ExpressionScope
 * 2. 嵌套 Provider：多层嵌套、命名空间隔离
 * 3. ErrorBoundary：错误捕获、自定义 fallback、React 18 特性
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';


import {
  render,
  screen,
  waitFor,
  renderHookWithFilter,
  createTestFilter,
  createNestedWrapper,
} from '../../test-utils';
import { render as rtlRender } from '@testing-library/react';
import { FilterProvider } from '../../../src/context/Provider';
import { useFilter } from '../../../src/hooks/useFilter';
import { useField } from '../../../src/hooks/useField';
import type { FilterApi } from '../../../src/core/types';

describe('FilterProvider', () => {
  // ==================== 共享实例 ====================
  let testFilter: FilterApi<{ value: string }>;

  beforeEach(() => {
    testFilter = createTestFilter({ value: 'test' });
  });

  // ==================== Context 提供测试 ====================

  describe('Context 提供', () => {
    it('应该通过 FilterContext 提供 filter 实例', () => {
      function TestComponent() {
        const filter = useFilter();
        return <div data-testid="value">{filter.draft.value}</div>;
      }

      render(<TestComponent />, {
        filterInstance: testFilter,
      });

      expect(screen.getByTestId('value')).toHaveTextContent('test');
    });

    it('应该支持命名空间实例', () => {
      const nsFilter = createTestFilter({ value: 'ns-value' });

      function TestComponent() {
        const filter = useFilter({ namespace: 'test-ns' });
        return <div data-testid="value">{filter.draft.value}</div>;
      }

      render(<TestComponent />, {
        filterInstance: nsFilter,
        filterNamespace: 'test-ns',
      });

      expect(screen.getByTestId('value')).toHaveTextContent('ns-value');
    });

    it('应该提供完整的 filter API', () => {
      function TestComponent() {
        const filter = useFilter();

        return (
          <div>
            <div data-testid="has-apply">{typeof filter.apply === 'function' ? 'yes' : 'no'}</div>
            <div data-testid="has-reset">{typeof filter.reset === 'function' ? 'yes' : 'no'}</div>
            <div data-testid="has-form">{filter.form ? 'yes' : 'no'}</div>
          </div>
        );
      }

      render(<TestComponent />, {
        filterInstance: testFilter,
      });

      expect(screen.getByTestId('has-apply')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-reset')).toHaveTextContent('yes');
      expect(screen.getByTestId('has-form')).toHaveTextContent('yes');
    });
  });

  // ==================== 嵌套 Provider 测试 ====================

  describe('嵌套 Provider', () => {
    it('应该支持嵌套，内层覆盖外层', () => {
      const outer = createTestFilter({ value: 'outer' });
      const inner = createTestFilter({ value: 'inner' });

      function TestComponent() {
        const filter = useFilter();
        return <div data-testid="value">{filter.draft.value}</div>;
      }

      const wrapper = createNestedWrapper([
        { instance: outer },
        { instance: inner },
      ]);

      render(wrapper({ children: <TestComponent /> }));

      // 应该获取最内层的实例
      expect(screen.getByTestId('value')).toHaveTextContent('inner');
    });

    it('应该支持命名空间隔离', () => {
      const outer = createTestFilter({ value: 'outer' });
      const inner = createTestFilter({ value: 'inner' });

      function TestComponent() {
        const outerFilter = useFilter({ namespace: 'outer' });
        const innerFilter = useFilter({ namespace: 'inner' });

        return (
          <div>
            <div data-testid="outer">{outerFilter.draft.value}</div>
            <div data-testid="inner">{innerFilter.draft.value}</div>
          </div>
        );
      }

      const wrapper = createNestedWrapper([
        { instance: outer, namespace: 'outer' },
        { instance: inner, namespace: 'inner' },
      ]);

      render(wrapper({ children: <TestComponent /> }));

      expect(screen.getByTestId('outer')).toHaveTextContent('outer');
      expect(screen.getByTestId('inner')).toHaveTextContent('inner');
    });

    it('应该支持三层嵌套', () => {
      const level1 = createTestFilter({ value: 'l1' });
      const level2 = createTestFilter({ value: 'l2' });
      const level3 = createTestFilter({ value: 'l3' });

      function TestComponent() {
        const f1 = useFilter({ namespace: 'l1' });
        const f2 = useFilter({ namespace: 'l2' });
        const f3 = useFilter({ namespace: 'l3' });

        return (
          <div>
            <div data-testid="l1">{f1.draft.value}</div>
            <div data-testid="l2">{f2.draft.value}</div>
            <div data-testid="l3">{f3.draft.value}</div>
          </div>
        );
      }

      const wrapper = createNestedWrapper([
        { instance: level1, namespace: 'l1' },
        { instance: level2, namespace: 'l2' },
        { instance: level3, namespace: 'l3' },
      ]);

      render(wrapper({ children: <TestComponent /> }));

      expect(screen.getByTestId('l1')).toHaveTextContent('l1');
      expect(screen.getByTestId('l2')).toHaveTextContent('l2');
      expect(screen.getByTestId('l3')).toHaveTextContent('l3');
    });
  });

  // ==================== ErrorBoundary 测试 ====================

  describe('ErrorBoundary', () => {
    it('应该捕获子组件渲染错误', async () => {
      // 抑制 console.error
      const originalError = console.error;
      console.error = vi.fn();

      function ThrowError() {
        throw new Error('测试错误');
      }

      function TestComponent() {
        return <ThrowError />;
      }

      render(<TestComponent />, {
        filterInstance: testFilter,
      });

      // 应该显示错误界面而不是崩溃
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      console.error = originalError;
    });

    it('应该支持自定义 fallback', () => {
      const originalError = console.error;
      console.error = vi.fn();

      function ThrowError() {
        throw new Error('Custom Error');
      }

      const customFallback = () => (
        <div data-testid="custom-error">自定义错误显示</div>
      );

      render(
        <FilterProvider instance={testFilter} fallback={customFallback}>
          <ThrowError />
        </FilterProvider>
      );

      expect(screen.getByTestId('custom-error')).toHaveTextContent('自定义错误显示');

      console.error = originalError;
    });

    it('应该支持 onError 回调', () => {
      const originalError = console.error;
      console.error = vi.fn();

      const onError = vi.fn();

      function ThrowError() {
        throw new Error('Error for callback');
      }

      render(
        <FilterProvider instance={testFilter} onError={onError}>
          <ThrowError />
        </FilterProvider>
      );

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.anything()
      );

      console.error = originalError;
    });

    it('应该支持 onReset 回调', async () => {
      const originalError = console.error;
      console.error = vi.fn();

      const onReset = vi.fn();

      function ThrowError() {
        throw new Error('Error for reset');
      }

      function TestComponent() {
        return <ThrowError />;
      }

      render(<TestComponent />, {
        filterInstance: testFilter,
        onReset,
      });

      // 点击重置按钮
      const resetButton = await screen.findByRole('button', {
        name: /重置错误状态|重试/i,
      });
      resetButton.click();

      await waitFor(() => {
        expect(onReset).toHaveBeenCalled();
      });

      console.error = originalError;
    });

    it('应该支持 resetKeys 自动重置', async () => {
      const originalError = console.error;
      console.error = vi.fn();

      function ConditionalError({ shouldThrow }: { shouldThrow: boolean }) {
        if (shouldThrow) {
          throw new Error('Conditional Error');
        }
        return <div data-testid="recovered">已恢复</div>;
      }

      const { rerender, unmount } = rtlRender(
        <FilterProvider instance={testFilter} resetKeys={[true]}>
          <ConditionalError shouldThrow={true} />
        </FilterProvider>
      );

      // 应该显示错误
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      // 修改条件，重新渲染
      rerender(
        <FilterProvider instance={testFilter} resetKeys={[false]}>
          <ConditionalError shouldThrow={false} />
        </FilterProvider>
      );

      // 应该自动恢复
      const recovered = await screen.findByTestId('recovered');
      expect(recovered).toHaveTextContent('已恢复');

      unmount();
      console.error = originalError;
    });
  });

  // ==================== 性能测试 ====================

  describe('性能', () => {
    it('应该避免不必要的重渲染', () => {
      let renderCount = 0;

      function TestComponent() {
        renderCount++;
        const filter = useFilter();
        return <div data-testid="value">{filter.draft.value}</div>;
      }

      const { rerender } = render(<TestComponent />, {
        filterInstance: testFilter,
      });

      const initialRenderCount = renderCount;

      // 重新渲染 Provider（但 instance 不变）
      rerender(<TestComponent />);

      // 应该只增加一次渲染
      expect(renderCount).toBe(initialRenderCount + 1);
    });

    it('应该在实例不变时保持 context 稳定', () => {
      const instances: FilterApi<{ value: string }>[] = [];

      function TestComponent() {
        const filter = useFilter<{ value: string }>();
        instances.push(filter);
        return <div>{filter.draft.value}</div>;
      }

      const { rerender } = render(<TestComponent />, {
        filterInstance: testFilter,
      });

      rerender(<TestComponent />);
      rerender(<TestComponent />);

      // 所有获取的实例应该相同
      expect(instances[0]).toBe(instances[1]);
      expect(instances[1]).toBe(instances[2]);
    });
  });
});