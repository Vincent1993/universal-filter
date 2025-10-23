/**
 * useFilter Hook 测试
 * 使用真实的 Formily 和 React
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { useFilter } from '../../../src/hooks/useFilter';
import { FilterProvider } from '../../../src/context/Provider';
import { createFilter } from '../../../src/core/createFilter';
import type { FilterApi } from '../../../src/core/types';

describe('useFilter Hook 测试（真实 Formily）', () => {
  it('应该返回 filter 实例', () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FilterProvider instance={filter}>{children}</FilterProvider>
    );

    const { result } = renderHook(() => useFilter(), { wrapper });

    expect(result.current).toBe(filter);
  });

  it('应该能访问 filter 的所有属性', () => {
    const filter = createFilter<{ name: string; age: number }>({
      defaultValues: { name: 'John', age: 30 },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FilterProvider instance={filter}>{children}</FilterProvider>
    );

    const { result } = renderHook(() => useFilter<{ name: string; age: number }>(), { wrapper });

    expect(result.current.id).toBeDefined();
    expect(result.current.draft).toEqual({ name: 'John', age: 30 });
    expect(result.current.form).toBeDefined();
    expect(typeof result.current.apply).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });

  it('应该在没有 FilterProvider 时抛出错误', () => {
    // 屏蔽控制台错误输出
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      renderHook(() => useFilter());
    }).toThrow();

    console.error = originalError;
  });

  it('应该支持泛型类型', () => {
    interface UserFilter {
      name: string;
      age: number;
      email: string;
    }

    const filter = createFilter<UserFilter>({
      defaultValues: {
        name: 'John',
        age: 30,
        email: 'john@example.com',
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FilterProvider instance={filter}>{children}</FilterProvider>
    );

    const { result } = renderHook(() => useFilter<UserFilter>(), { wrapper });

    expect(result.current.draft.name).toBe('John');
    expect(result.current.draft.age).toBe(30);
    expect(result.current.draft.email).toBe('john@example.com');
  });

  it('应该能调用 filter 方法', async () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FilterProvider instance={filter}>{children}</FilterProvider>
    );

    const { result } = renderHook(() => useFilter<{ name: string }>(), { wrapper });

    // 修改值
    result.current.form.setValues({ name: 'Jane' });
    expect(result.current.draft.name).toBe('Jane');

    // 应用
    await result.current.apply();
    expect(result.current.applied?.name).toBe('Jane');

    // 重置
    result.current.reset();
    expect(result.current.draft.name).toBe('John');
  });

  it('应该支持嵌套的 FilterProvider', () => {
    const filter1 = createFilter<{ name: string }>({
      defaultValues: { name: 'John' },
    });

    const filter2 = createFilter<{ name: string }>({
      defaultValues: { name: 'Jane' },
    });

    const wrapper1 = ({ children }: { children: React.ReactNode }) => (
      <FilterProvider instance={filter1}>{children}</FilterProvider>
    );

    const wrapper2 = ({ children }: { children: React.ReactNode }) => (
      <FilterProvider instance={filter1}>
        <FilterProvider instance={filter2}>{children}</FilterProvider>
      </FilterProvider>
    );

    const { result: result1 } = renderHook(() => useFilter(), { wrapper: wrapper1 });
    const { result: result2 } = renderHook(() => useFilter(), { wrapper: wrapper2 });

    expect(result1.current).toBe(filter1);
    expect(result2.current).toBe(filter2); // 内层应该覆盖外层
  });
});




