/**
 * 响应式更新集成测试
 *
 * 测试 draft 和 applied 在真实 React 环境下的响应式更新
 * 验证 Formily Observer 与 React 组件的集成
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { Observer } from '@formily/react';
import {
  render,
  screen,
  waitFor,
  createTestFilter,
} from '../../test-utils';
import { useFilter } from '../../../src/hooks/useFilter';
import type { FilterApi } from '../../../src/core/types';

describe('响应式更新集成测试', () => {
  let testFilter: FilterApi<{ name: string; age: number }>;

  beforeEach(() => {
    testFilter = createTestFilter({ name: 'John', age: 25 });
  });

  // ==================== draft 响应式更新 ====================

  describe('draft 响应式更新', () => {
    it('应该在 draft 变化时触发 Observer 重渲染', async () => {
      let renderCount = 0;

      function TestComponent() {
        const filter = useFilter<{ name: string; age?: number }>();

        return (
          <div>
            <Observer>
              {() => {
                renderCount++;
                return <div data-testid="name">{filter.draft.name}</div>;
              }}
            </Observer>
            <button
              data-testid="change-btn"
              onClick={() => {
                filter.form.setValues({ name: 'Jane' });
              }}
            >
              Change
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      // 初始渲染
      expect(screen.getByTestId('name')).toHaveTextContent('John');
      const initialRenderCount = renderCount;

      // 点击按钮修改值
      screen.getByTestId('change-btn').click();

      // 等待更新
      await waitFor(() => {
        expect(screen.getByTestId('name')).toHaveTextContent('Jane');
      });

      // 验证重渲染发生
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });

    it('应该在多个字段中独立响应更新', async () => {
      let nameRenderCount = 0;
      let ageRenderCount = 0;

      function TestComponent() {
        const filter = useFilter<{ name: string; age?: number }>();

        return (
          <div>
            <Observer>
              {() => {
                nameRenderCount++;
                return <div data-testid="name">{filter.draft.name}</div>;
              }}
            </Observer>
            <Observer>
              {() => {
                ageRenderCount++;
                return <div data-testid="age">{filter.draft.age}</div>;
              }}
            </Observer>
            <button
              data-testid="change-name-btn"
              onClick={() => {
                // 使用 setValuesIn 精确设置单个字段
                filter.form.setValuesIn('name', 'Jane');
              }}
            >
              Change Name
            </button>
            <button
              data-testid="change-age-btn"
              onClick={() => {
                // 使用 setValuesIn 精确设置单个字段
                filter.form.setValuesIn('age', 30);
              }}
            >
              Change Age
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      const initialNameRenderCount = nameRenderCount;
      const initialAgeRenderCount = ageRenderCount;

      // 只修改 name
      screen.getByTestId('change-name-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('name')).toHaveTextContent('Jane');
      });

      // name Observer 应该重渲染
      expect(nameRenderCount).toBeGreaterThan(initialNameRenderCount);

      const nameCountAfterFirstChange = nameRenderCount;

      // 只修改 age
      screen.getByTestId('change-age-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('age')).toHaveTextContent('30');
      });

      // age Observer 应该重渲染
      expect(ageRenderCount).toBeGreaterThan(initialAgeRenderCount);
      // name 可能会有额外渲染(由于 Formily 的响应式机制),但至少不应该无限增长
      expect(nameRenderCount).toBeLessThanOrEqual(nameCountAfterFirstChange + 2);
    });

    it('应该通过 setValues 触发更新', async () => {
      function TestComponent() {
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <Observer>
              {() => <div data-testid="name">{filter.draft.name}</div>}
            </Observer>
            <button
              data-testid="update-btn"
              onClick={() => {
                filter.setValues({ name: 'Updated' });
              }}
            >
              Update
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      expect(screen.getByTestId('name')).toHaveTextContent('John');

      screen.getByTestId('update-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('name')).toHaveTextContent('Updated');
      });
    });
  });

  // ==================== applied 响应式更新 ====================

  describe('applied 响应式更新', () => {
    it('应该在 apply 后触发 applied 更新', async () => {
      let appliedRenderCount = 0;

      function TestComponent() {
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <Observer>
              {() => {
                appliedRenderCount++;
                return (
                  <div data-testid="applied">
                    {filter.applied ? filter.applied.name : 'undefined'}
                  </div>
                );
              }}
            </Observer>
            <button
              data-testid="change-and-apply-btn"
              onClick={async () => {
                filter.form.setValues({ name: 'Applied' });
                await filter.apply();
              }}
            >
              Change and Apply
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      // 初始 applied 应该是 undefined
      expect(screen.getByTestId('applied')).toHaveTextContent('undefined');
      const initialRenderCount = appliedRenderCount;

      // 修改并应用
      screen.getByTestId('change-and-apply-btn').click();

      // 等待 applied 更新
      await waitFor(() => {
        expect(screen.getByTestId('applied')).toHaveTextContent('Applied');
      });

      // 验证重渲染发生
      expect(appliedRenderCount).toBeGreaterThan(initialRenderCount);
    });

    it('应该在 draft 变化时 applied 不变', async () => {
      let appliedRenderCount = 0;

      function TestComponent() {
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <Observer>
              {() => <div data-testid="draft">{filter.draft.name}</div>}
            </Observer>
            <Observer>
              {() => {
                appliedRenderCount++;
                return (
                  <div data-testid="applied">
                    {filter.applied ? filter.applied.name : 'undefined'}
                  </div>
                );
              }}
            </Observer>
            <button
              data-testid="change-btn"
              onClick={() => {
                filter.form.setValues({ name: 'Changed' });
              }}
            >
              Change
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      const initialAppliedRenderCount = appliedRenderCount;

      // 只修改 draft，不 apply
      screen.getByTestId('change-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('draft')).toHaveTextContent('Changed');
      });

      // applied 不应该变化，所以不应该重渲染
      expect(screen.getByTestId('applied')).toHaveTextContent('undefined');
      expect(appliedRenderCount).toBe(initialAppliedRenderCount);
    });

    it('应该支持多次 apply 更新', async () => {
      function TestComponent() {
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <Observer>
              {() => (
                <div data-testid="applied">
                  {filter.applied ? filter.applied.name : 'undefined'}
                </div>
              )}
            </Observer>
            <button
              data-testid="apply-1-btn"
              onClick={async () => {
                filter.form.setValues({ name: 'First' });
                await filter.apply();
              }}
            >
              Apply 1
            </button>
            <button
              data-testid="apply-2-btn"
              onClick={async () => {
                filter.form.setValues({ name: 'Second' });
                await filter.apply();
              }}
            >
              Apply 2
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      // 第一次 apply
      screen.getByTestId('apply-1-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('applied')).toHaveTextContent('First');
      });

      // 第二次 apply
      screen.getByTestId('apply-2-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('applied')).toHaveTextContent('Second');
      });
    });
  });

  // ==================== draft 和 applied 联合更新 ====================

  describe('draft 和 applied 联合更新', () => {
    it('应该正确显示 draft 和 applied 的差异', async () => {
      function TestComponent() {
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <Observer>
              {() => <div data-testid="draft">{filter.draft.name}</div>}
            </Observer>
            <Observer>
              {() => (
                <div data-testid="applied">
                  {filter.applied ? filter.applied.name : 'undefined'}
                </div>
              )}
            </Observer>
            <Observer>
              {() => (
                <div data-testid="changed">
                  {filter.changed ? 'changed' : 'unchanged'}
                </div>
              )}
            </Observer>
            <button
              data-testid="change-btn"
              onClick={() => {
                filter.form.setValues({ name: 'Modified' });
              }}
            >
              Change
            </button>
            <button
              data-testid="apply-btn"
              onClick={async () => {
                await filter.apply();
              }}
            >
              Apply
            </button>
            <button
              data-testid="reset-btn"
              onClick={() => {
                filter.reset();
              }}
            >
              Reset
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      // 初始状态
      expect(screen.getByTestId('draft')).toHaveTextContent('John');
      expect(screen.getByTestId('applied')).toHaveTextContent('undefined');
      expect(screen.getByTestId('changed')).toHaveTextContent('unchanged');

      // 修改 draft
      screen.getByTestId('change-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('draft')).toHaveTextContent('Modified');
      });
      expect(screen.getByTestId('applied')).toHaveTextContent('undefined');
      expect(screen.getByTestId('changed')).toHaveTextContent('changed');

      // 应用
      screen.getByTestId('apply-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('applied')).toHaveTextContent('Modified');
      });
      expect(screen.getByTestId('draft')).toHaveTextContent('Modified');
      expect(screen.getByTestId('changed')).toHaveTextContent('changed');

      // 重置
      screen.getByTestId('reset-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('draft')).toHaveTextContent('John');
      });
      expect(screen.getByTestId('applied')).toHaveTextContent('Modified');
      expect(screen.getByTestId('changed')).toHaveTextContent('unchanged');
    });
  });

  // ==================== 无 Observer 场景 ====================

  describe('无 Observer 场景', () => {
    it('应该在没有 Observer 时仍能正确读取值', () => {
      function TestComponent() {
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <div data-testid="draft">{filter.draft.name}</div>
            <div data-testid="applied">
              {filter.applied ? filter.applied.name : 'undefined'}
            </div>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      // 应该能正确读取初始值
      expect(screen.getByTestId('draft')).toHaveTextContent('John');
      expect(screen.getByTestId('applied')).toHaveTextContent('undefined');
    });

    it('应该在没有 Observer 时不自动重渲染', async () => {
      let renderCount = 0;

      function TestComponent() {
        renderCount++;
        const filter = useFilter<{ name: string }>();

        return (
          <div>
            <div data-testid="name">{filter.draft.name}</div>
            <button
              data-testid="change-btn"
              onClick={() => {
                filter.form.setValues({ name: 'Changed' });
              }}
            >
              Change
            </button>
          </div>
        );
      }

      render(<TestComponent />, { filterInstance: testFilter });

      const initialRenderCount = renderCount;

      // 修改值
      screen.getByTestId('change-btn').click();

      // 等待一下，确认没有重渲染
      await new Promise(resolve => setTimeout(resolve, 100));

      // 没有 Observer，应该不会触发重渲染
      expect(renderCount).toBe(initialRenderCount);

      // 但是值在 filter 内部已经更新了
      expect(testFilter.draft.name).toBe('Changed');
    });
  });
});

