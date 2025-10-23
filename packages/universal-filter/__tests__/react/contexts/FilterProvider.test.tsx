/**
 * FilterProvider 测试
 * 使用真实的 Formily 和 React
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FilterProvider } from '../../../src/context/Provider';
import { useFilter } from '../../../src/hooks/useFilter';
import { createFilter } from '../../../src/core/createFilter';

describe('FilterProvider 测试（真实 Formily）', () => {
  it('应该提供 filter 实例给子组件', () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    function TestComponent() {
      const f = useFilter();
      return <div data-testid="filter-id">{f.id}</div>;
    }

    render(
      <FilterProvider instance={filter}>
        <TestComponent />
      </FilterProvider>
    );

    const element = screen.getByTestId('filter-id');
    expect(element.textContent).toBe(filter.id);
  });

  it('应该能访问 draft 值', () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    function TestComponent() {
      const f = useFilter<{ name: string }>();
      return <div data-testid="name">{f.draft.name}</div>;
    }

    render(
      <FilterProvider instance={filter}>
        <TestComponent />
      </FilterProvider>
    );

    expect(screen.getByTestId('name').textContent).toBe('John');
  });

  it('应该支持嵌套 Provider', () => {
    const filter1 = createFilter<{ value: string }>({
      defaultValues: { value: 'outer' },
    });

    const filter2 = createFilter<{ value: string }>({
      defaultValues: { value: 'inner' },
    });

    function OuterComponent() {
      const f = useFilter<{ value: string }>();
      return <div data-testid="outer">{f.draft.value}</div>;
    }

    function InnerComponent() {
      const f = useFilter<{ value: string }>();
      return <div data-testid="inner">{f.draft.value}</div>;
    }

    render(
      <FilterProvider instance={filter1}>
        <OuterComponent />
        <FilterProvider instance={filter2}>
          <InnerComponent />
        </FilterProvider>
      </FilterProvider>
    );

    expect(screen.getByTestId('outer').textContent).toBe('outer');
    expect(screen.getByTestId('inner').textContent).toBe('inner');
  });

  it('应该支持更新 draft 值', () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    function TestComponent() {
      const f = useFilter<{ name: string }>();

      return (
        <div>
          <div data-testid="name">{f.draft.name}</div>
          <button
            data-testid="update"
            onClick={() => f.form.setValues({ name: 'Jane' })}
          >
            Update
          </button>
        </div>
      );
    }

    const { getByTestId } = render(
      <FilterProvider instance={filter}>
        <TestComponent />
      </FilterProvider>
    );

    // 初始值
    expect(getByTestId('name').textContent).toBe('John');

    // 点击更新（注意：实际更新可能需要等待 React 重渲染）
    const button = getByTestId('update');
    button.click();

    // 验证 filter 状态已更新
    expect(filter.draft.name).toBe('Jane');
  });

  it('应该在没有 Provider 时抛出错误', () => {
    // 屏蔽控制台错误
    const originalError = console.error;
    console.error = () => {};

    function TestComponent() {
      useFilter();
      return null;
    }

    expect(() => {
      render(<TestComponent />);
    }).toThrow();

    console.error = originalError;
  });

  it('应该支持多个不同类型的 filter', () => {
    const userFilter = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    const productFilter = createFilter<{ category: string }>({
      defaultValues: { category: 'Electronics' },
    });

    function UserComponent() {
      const f = useFilter<{ name: string }>();
      return <div data-testid="user">{f.draft.name}</div>;
    }

    function ProductComponent() {
      const f = useFilter<{ category: string }>();
      return <div data-testid="product">{f.draft.category}</div>;
    }

    render(
      <>
        <FilterProvider instance={userFilter}>
          <UserComponent />
        </FilterProvider>
        <FilterProvider instance={productFilter}>
          <ProductComponent />
        </FilterProvider>
      </>
    );

    expect(screen.getByTestId('user').textContent).toBe('John');
    expect(screen.getByTestId('product').textContent).toBe('Electronics');
  });
});




