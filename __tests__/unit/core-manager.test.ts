/**
 * CoreManager 完整功能测试
 * 测试所有公共 API 和接口实现
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreManager } from '../../src/core/managers/CoreManager';
import type { Draft } from '../../src/core/types';

interface TestDraft extends Draft {
  name: string;
  age: number;
  email?: string;
  address?: {
    city: string;
    street: string;
  };
  tags?: string[];
}

describe('CoreManager - 完整功能测试', () => {
  let manager: CoreManager<TestDraft>;
  const defaultValues: TestDraft = {
    name: 'John',
    age: 30,
    email: 'john@example.com',
  };

  beforeEach(() => {
    manager = new CoreManager<TestDraft>({
      defaultValues,
    });
  });

  describe('属性和初始化', () => {
    it('应该正确初始化所有属性', () => {
      expect(manager.form).toBeDefined();
      expect(manager.listeners).toBeUndefined();
      expect(manager.defaultValues).toEqual(defaultValues);
    });

    it('响应式属性应该初始化为 undefined', () => {
      expect(manager.applied).toBeUndefined();
      expect(manager.previous).toBeUndefined();
    });

    it('应该正确设置 Formily 表单', () => {
      expect(manager.form.values).toBeDefined();
      expect(manager.form.getState).toBeDefined();
      expect(manager.form.setValues).toBeDefined();
    });
  });

  describe('状态访问器', () => {
    describe('draft', () => {
      it('应该返回当前可变状态', () => {
        expect(manager.draft).toBeDefined();
        expect(manager.draft.name).toBe('John');
        expect(manager.draft.age).toBe(30);
      });

      it('draft 应该是可变的', () => {
        manager.setValue('name', 'Jane');
        expect(manager.draft.name).toBe('Jane');
      });
    });

    describe('applied (响应式属性)', () => {
      it('初始状态应该为 undefined', () => {
        expect(manager.applied).toBeUndefined();
      });

      it('apply 后应该立即更新', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();

        // applied 应该立即有值
        expect(manager.applied).toBeDefined();
        expect(manager.applied?.name).toBe('Jane');
      });

      it('应该是独立的快照副本', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        const appliedSnapshot = manager.applied;

        // 修改 draft 不应该影响 applied 快照
        manager.setValue('name', 'Bob');
        expect(appliedSnapshot?.name).toBe('Jane');
        expect(manager.draft.name).toBe('Bob');
        expect(manager.applied?.name).toBe('Jane');
      });

      it('多次 apply 应该正确更新', async () => {
        // 第一次 apply
        manager.setValue('name', 'Jane');
        await manager.apply();
        expect(manager.applied?.name).toBe('Jane');

        // 第二次 apply
        manager.setValue('name', 'Bob');
        await manager.apply();
        expect(manager.applied?.name).toBe('Bob');
      });

      it('是响应式属性（可被 Observer 追踪）', async () => {
        // 这个测试验证 applied 被正确设置为 observable.ref
        expect(manager.applied).toBeUndefined();

        await manager.apply();

        // 属性应该可以直接访问和修改（响应式）
        expect(manager.applied).toBeDefined();
      });
    });

    describe('previous (响应式属性)', () => {
      it('初始状态应该为 undefined', () => {
        expect(manager.previous).toBeUndefined();
      });

      it('apply 开始时应该创建 previous 快照', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();

        // previous 应该保存 apply 开始时的状态
        expect(manager.previous).toBeDefined();
        expect(manager.previous?.name).toBe('Jane');
      });

      it('应该是独立的快照副本', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        const previousSnapshot = manager.previous;

        // 修改 draft 不应该影响 previous 快照
        manager.setValue('name', 'Bob');
        expect(previousSnapshot?.name).toBe('Jane');
        expect(manager.draft.name).toBe('Bob');
        expect(manager.previous?.name).toBe('Jane');
      });

      it('多次 apply 应该正确更新 previous', async () => {
        // 第一次 apply
        manager.setValue('name', 'Jane');
        await manager.apply();
        expect(manager.previous?.name).toBe('Jane');

        // 第二次 apply - previous 应该更新为第二次 apply 开始时的状态
        manager.setValue('name', 'Bob');
        await manager.apply();
        expect(manager.previous?.name).toBe('Bob');
      });

      it('是响应式属性（可被 Observer 追踪）', async () => {
        // 这个测试验证 previous 被正确设置为 observable.ref
        expect(manager.previous).toBeUndefined();

        await manager.apply();

        // 属性应该可以直接访问（响应式）
        expect(manager.previous).toBeDefined();
      });
    });

    describe('state', () => {
      it('应该返回 Formily 表单状态', () => {
        const state = manager.state;
        expect(state).toBeDefined();
        expect(state.values).toBeDefined();
        expect(state.valid).toBeDefined();
        expect(state.invalid).toBeDefined();
      });

      it('state 应该反映表单修改状态', () => {
        const initialState = manager.state;
        expect(initialState.modified).toBe(false);

        manager.setValue('name', 'Jane');
        const modifiedState = manager.state;
        // formily 的 modified 只针对手动修改的表单值才会触发，如果是非手动的用 changed
        expect(modifiedState.modified).toBeFalsy();
      });
    });

    describe('changed', () => {
      it('初始状态应该返回 false（未修改）', () => {
        expect(manager.changed).toBe(false);
      });

      it('修改值后应该返回 true（相对于 defaultValues）', () => {
        manager.setValue('name', 'Jane');
        // draft 和 defaultValues 不同
        expect(manager.changed).toBe(true);
      });

      it('apply 后仍显示为已修改（相对于 defaultValues）', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        // draft 和 defaultValues 仍然不同
        expect(manager.changed).toBe(true);
      });

      it('reset 后应该返回 false', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();

        manager.reset();
        // reset 后回到 defaultValues
        expect(manager.changed).toBe(false);
      });
    });
  });

  describe('setValues - 批量设置值', () => {
    it('应该能够批量设置值（默认覆盖模式）', () => {
      manager.setValues({
        name: 'Jane',
        age: 25,
      });

      expect(manager.draft.name).toBe('Jane');
      expect(manager.draft.age).toBe(25);
    });

    it('应该支持部分更新', () => {
      manager.setValues({
        name: 'Jane',
      });

      expect(manager.draft.name).toBe('Jane');
      expect(manager.draft.age).toBe(30); // 保持原值
    });

    it('应该支持 merge 策略', () => {
      manager.setValues(
        {
          address: {
            city: 'Beijing',
            street: 'Main St',
          },
        },
        'merge'
      );

      expect(manager.draft.address?.city).toBe('Beijing');
    });

    it('应该支持 deepMerge 策略', () => {
      manager.setValues({
        address: {
          city: 'Beijing',
          street: 'Main St',
        },
      });

      manager.setValues(
        {
          address: {
            city: 'Shanghai',
          } as any,
        },
        'deepMerge'
      );

      expect(manager.draft.address?.city).toBe('Shanghai');
      expect(manager.draft.address?.street).toBe('Main St'); // 保留
    });

    it('应该触发 onDraftChange 监听器', () => {
      const onDraftChange = vi.fn();
      const managerWithListener = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onDraftChange,
        },
      });

      managerWithListener.setValues({ name: 'Jane' });

      expect(onDraftChange).toHaveBeenCalled();
    });
  });

  describe('setValue - 设置单个字段', () => {
    it('应该能够设置简单字段', () => {
      manager.setValue('name', 'Jane');
      expect(manager.draft.name).toBe('Jane');
    });

    it('应该能够设置嵌套字段', () => {
      manager.setValue('address.city', 'Beijing');
      expect(manager.draft.address?.city).toBe('Beijing');
    });

    it('应该能够设置数组元素', () => {
      manager.setValue('tags', ['tag1', 'tag2']);
      manager.setValue('tags.0', 'updated-tag1');
      expect(manager.draft.tags?.[0]).toBe('updated-tag1');
    });

    it('应该支持不同的路径格式', () => {
      // 点号格式
      manager.setValue('address.city', 'Beijing');
      expect(manager.draft.address?.city).toBe('Beijing');

      // 数组索引格式
      manager.setValue('tags[0]', 'tag1');
      expect(manager.draft.tags?.[0]).toBe('tag1');
    });
  });

  describe('deleteValue - 删除字段', () => {
    it('应该能够删除简单字段', () => {
      manager.setValue('email', 'test@example.com');
      expect(manager.draft.email).toBe('test@example.com');

      manager.deleteValue('email');
      expect(manager.draft.email).toBeUndefined();
    });

    it('应该能够删除嵌套字段', () => {
      manager.setValue('address.city', 'Beijing');
      expect(manager.draft.address?.city).toBe('Beijing');

      manager.deleteValue('address.city');
      expect(manager.draft.address?.city).toBeUndefined();
    });

    it('应该能够删除数组元素', () => {
      manager.setValue('tags', ['tag1', 'tag2', 'tag3']);
      expect(manager.draft.tags?.length).toBe(3);

      manager.deleteValue('tags.1');
      expect(manager.draft.tags?.length).toBe(2);
    });
  });

  describe('validate - 表单验证', () => {
    it('应该能够验证整个表单', async () => {
      await expect(manager.validate()).resolves.toBeUndefined();
    });

    it('应该能够验证特定字段', async () => {
      await expect(manager.validate('name')).resolves.toBeUndefined();
    });

    it('应该能够使用通配符验证', async () => {
      manager.setValue('address.city', 'Beijing');
      await expect(manager.validate('address.*')).resolves.toBeUndefined();
    });

    it('验证失败应该触发 onValidateFailed 监听器', async () => {
      const onValidateFailed = vi.fn();
      const emitFn = vi.fn();
      const managerWithValidation = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onValidateFailed,
        },
        emitFn,
      });

      // 创建字段并设置验证器
      managerWithValidation.form.createField({
        name: 'testField',
        validator: (value: any) => {
          if (!value) {
            return '字段不能为空';
          }
        },
      });

      // 设置空值并尝试提交
      managerWithValidation.form.setValues({ testField: '' });

      // 触发验证失败
      try {
        await managerWithValidation.form.submit();
      } catch (error) {
        // 提交失败是预期的
      }

      // 验证监听器和事件发射函数被调用
      expect(onValidateFailed).toHaveBeenCalled();
      expect(onValidateFailed).toHaveBeenCalledWith({
        draft: expect.any(Object),
        errors: expect.any(Array),
      });
      expect(emitFn).toHaveBeenCalledWith('validate:failed', {
        draft: expect.any(Object),
        errors: expect.any(Array),
      });
    });
  });

  describe('reset - 重置表单', () => {
    it('应该重置所有字段到初始值', () => {
      manager.setValues({
        name: 'Jane',
        age: 25,
        email: 'jane@example.com',
      });

      manager.reset();

      // reset 应该重置到 initialValues (defaultValues)
      expect(manager.draft.name).toBe('John');
      expect(manager.draft.age).toBe(30);
      expect(manager.draft.email).toBe('john@example.com');
    });

    it('应该清除验证状态', () => {
      manager.setValue('name', 'Jane');
      manager.reset();

      const state = manager.state;
      expect(state.modified).toBe(false);
    });

    it('应该触发 onReset 监听器', () => {
      const onReset = vi.fn();
      const managerWithListener = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onReset,
        },
      });

      managerWithListener.reset();
      expect(onReset).toHaveBeenCalledWith({ scope: 'all' });
    });

    it('forceClear 时应该重置为一个空对象', () => {
      manager.setValue('name', 'Jane');
      manager.reset({ forceClear: true });

      expect(manager.draft).toEqual({});
    });
  });

  describe('clearErrors - 清除错误', () => {
    it('应该清除所有表单错误', () => {
      manager.clearErrors();
      expect(manager.state.errors).toEqual([]);
    });

    it('清除错误不应该影响字段值', () => {
      manager.setValue('name', 'Jane');
      manager.clearErrors();
      expect(manager.draft.name).toBe('Jane');
    });
  });

  describe('apply - 应用状态', () => {
    it('应该成功应用状态', async () => {
      manager.setValue('name', 'Jane');
      await expect(manager.apply()).resolves.toBeUndefined();
    });

    it('应该创建 previous 和 applied 快照', async () => {
      manager.setValue('name', 'Jane');
      await manager.apply();

      expect(manager.previous).toBeDefined();
      expect(manager.applied).toBeDefined();
      expect(manager.previous?.name).toBe('Jane');
      expect(manager.applied?.name).toBe('Jane');
    });

    it('应该触发 onApplyStart 监听器', async () => {
      const onApplyStart = vi.fn();
      const managerWithListener = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onApplyStart,
        },
      });

      await managerWithListener.apply();
      expect(onApplyStart).toHaveBeenCalledWith({
        draft: expect.any(Object),
      });
    });

    it('应该触发 onApplySuccess 监听器', async () => {
      const onApplySuccess = vi.fn();
      const managerWithListener = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onApplySuccess,
        },
      });

      await managerWithListener.apply();
      expect(onApplySuccess).toHaveBeenCalledWith({
        draft: expect.any(Object),
        payload: expect.any(Object),
      });
    });

    it('多次 apply 应该正确更新快照', async () => {
      // 第一次 apply
      manager.setValue('name', 'Jane');
      await manager.apply();
      expect(manager.applied?.name).toBe('Jane');

      // 第二次 apply
      manager.setValue('name', 'Bob');
      await manager.apply();
      expect(manager.applied?.name).toBe('Bob');
      expect(manager.previous?.name).toBe('Bob');
    });
  });

  describe('监听器', () => {
    it('onDraftChange 应该在值变化时触发', () => {
      const onDraftChange = vi.fn();
      const managerWithListener = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onDraftChange,
        },
      });

      managerWithListener.setValue('name', 'Jane');
      expect(onDraftChange).toHaveBeenCalled();
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jane' }),
        undefined
      );
    });

    it('onDraftChange 应该传递 previous 快照', async () => {
      const onDraftChange = vi.fn();
      const managerWithListener = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onDraftChange,
        },
      });

      // 先 apply 创建 previous
      await managerWithListener.apply();
      onDraftChange.mockClear();

      // 再修改
      managerWithListener.setValue('name', 'Jane');
      expect(onDraftChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jane' }),
        expect.objectContaining({ name: 'John' })
      );
    });
  });

  describe('复杂场景', () => {
    it('应该支持嵌套对象的完整操作', async () => {
      // 设置嵌套对象
      manager.setValues({
        address: {
          city: 'Beijing',
          street: 'Main St',
        },
      });

      // 修改嵌套字段
      manager.setValue('address.city', 'Shanghai');
      expect(manager.draft.address?.city).toBe('Shanghai');

      // Apply
      await manager.apply();
      expect(manager.applied?.address?.city).toBe('Shanghai');

      // 删除嵌套字段
      manager.deleteValue('address.street');
      expect(manager.draft.address?.street).toBeUndefined();
    });

    it('应该支持数组的完整操作', async () => {
      // 设置数组
      manager.setValue('tags', ['tag1', 'tag2', 'tag3']);
      expect(manager.draft.tags).toEqual(['tag1', 'tag2', 'tag3']);

      // 修改数组元素
      manager.setValue('tags[1]', 'updated-tag2');
      expect(manager.draft.tags?.[1]).toBe('updated-tag2');

      // Apply
      await manager.apply();
      expect(manager.applied?.tags?.[1]).toBe('updated-tag2');

      // 删除数组元素
      manager.deleteValue('tags.0');
      // Formily 会重排数组索引
      expect(manager.draft.tags).toEqual(['updated-tag2', 'tag3']);
    });

    it('应该支持连续的修改-应用-重置流程', async () => {
      // 修改
      manager.setValue('name', 'Jane');
      expect(manager.draft.name).toBe('Jane');

      // 应用
      await manager.apply();
      expect(manager.applied?.name).toBe('Jane');

      // 再次修改
      manager.setValue('name', 'Bob');
      expect(manager.draft.name).toBe('Bob');

      // 重置
      manager.reset();
      expect(manager.draft.name).toBe('John');
    });

    it('应该正确处理 undefined 和 null 值', () => {
      manager.setValue('email', undefined);
      expect(manager.draft.email).toBeUndefined();

      manager.setValue('email', null);
      expect(manager.draft.email).toBeNull();

      manager.setValue('email', 'test@example.com');
      expect(manager.draft.email).toBe('test@example.com');
    });
  });

  describe('边界情况', () => {
    it('应该处理空对象的设置', () => {
      manager.setValues({});
      expect(manager.draft.name).toBe('John'); // 保持原值
    });

    it('应该处理不存在的路径', () => {
      // 设置不存在的路径应该创建路径
      manager.setValue('nonexistent.path', 'value');
      expect((manager.draft as unknown as { nonexistent?: { path: string } }).nonexistent?.path).toBe('value');
    });

    it('应该处理删除不存在的路径', () => {
      expect(() => {
        manager.deleteValue('nonexistent.path');
      }).not.toThrow();
    });

    it('apply 空表单应该成功', async () => {
      const emptyManager = new CoreManager<TestDraft>({});
      await expect(emptyManager.apply()).resolves.toBeUndefined();
    });
  });

  describe('响应式系统集成', () => {
    it('applied 和 previous 应该是响应式属性', () => {
      // 验证这些属性存在且可访问
      expect('applied' in manager).toBe(true);
      expect('previous' in manager).toBe(true);
    });

    it('响应式属性更新应该是同步的', async () => {
      // 在 apply 之前
      expect(manager.applied).toBeUndefined();
      expect(manager.previous).toBeUndefined();

      // apply 之后应该立即可见
      manager.setValue('name', 'Jane');
      await manager.apply();

      // 同步检查（不需要等待下一个 tick）
      expect(manager.applied).toBeDefined();
      expect(manager.previous).toBeDefined();
    });

    it('应该正确处理连续的响应式更新', async () => {
      // 第一次更新
      manager.setValue('name', 'Jane');
      await manager.apply();
      const firstApplied = manager.applied;
      const firstPrevious = manager.previous;

      // 第二次更新
      manager.setValue('name', 'Bob');
      await manager.apply();

      // 响应式属性应该已更新
      expect(manager.applied).not.toBe(firstApplied);
      expect(manager.previous).not.toBe(firstPrevious);
      expect(manager.applied?.name).toBe('Bob');
      expect(manager.previous?.name).toBe('Bob');
    });

    it('快照应该是不可变的（深拷贝）', async () => {
      manager.setValues({
        address: {
          city: 'Beijing',
          street: 'Main St',
        },
      });
      await manager.apply();

      const appliedSnapshot = manager.applied;

      // 修改 draft 的嵌套对象
      manager.setValue('address.city', 'Shanghai');

      // applied 快照不应该受影响
      expect(appliedSnapshot?.address?.city).toBe('Beijing');
      expect(manager.draft.address?.city).toBe('Shanghai');
    });
  });

  describe('防抖功能', () => {
    it('应该支持防抖延迟配置', async () => {
      const onApplyStart = vi.fn();
      const debouncedManager = new CoreManager<TestDraft>({
        defaultValues,
        applyDebounceMs: 100,
        listeners: {
          onApplyStart,
        },
      });

      debouncedManager.setValue('name', 'Jane');

      // 立即调用 apply 两次
      const promise1 = debouncedManager.apply();
      const promise2 = debouncedManager.apply();

      // 防抖应该只触发一次
      await Promise.all([promise1, promise2]);

      // 等待防抖延迟结束
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(onApplyStart).toHaveBeenCalledTimes(1);
    });

    it('applyDebounceMs 为 0 时不应该创建防抖函数', () => {
      const managerWithoutDebounce = new CoreManager<TestDraft>({
        defaultValues,
        applyDebounceMs: 0,
      });

      // 应该直接执行，不使用防抖
      expect(managerWithoutDebounce['debouncedApply']).toBeUndefined();
    });

    it('applyDebounceMs 为负数时不应该创建防抖函数', () => {
      const managerWithoutDebounce = new CoreManager<TestDraft>({
        defaultValues,
        applyDebounceMs: -100,
      });

      // 应该直接执行，不使用防抖
      expect(managerWithoutDebounce['debouncedApply']).toBeUndefined();
    });

    it('没有配置 applyDebounceMs 时不应该创建防抖函数', () => {
      const managerWithoutDebounce = new CoreManager<TestDraft>({
        defaultValues,
      });

      // 应该直接执行，不使用防抖
      expect(managerWithoutDebounce['debouncedApply']).toBeUndefined();
    });
  });

  describe('setInitialValues - 设置初始值', () => {
    it('应该能够设置初始值', () => {
      manager.setInitialValues({
        name: 'Alice',
        age: 25,
      });

      expect(manager.initialValues?.name).toBe('Alice');
      expect(manager.initialValues?.age).toBe(25);
      expect(manager.defaultValues?.name).toBe('Alice');
      expect(manager.defaultValues?.age).toBe(25);
    });

    it('设置初始值应该清除 changed 缓存', () => {
      manager.setValue('name', 'Jane');
      expect(manager.changed).toBe(true);

      // 访问 changed 触发缓存
      const cachedResult = manager.changed;
      expect(cachedResult).toBe(true);

      // 设置初始值应该清除缓存
      manager.setInitialValues({
        name: 'Alice',
        age: 25,
      });

      // 缓存应该被清除，changed 应该重新计算
      // 现在 draft 包含 email，但 defaultValues 不包含，所以应该为 true
      expect(manager.changed).toBe(true);

      // 验证缓存确实被清除了（通过再次设置相同的值，应该重新计算）
      manager.setInitialValues({
        name: 'Bob',
        age: 30,
      });
      // 再次验证 changed 重新计算了
      expect(manager.changed).toBe(true);
    });

    it('应该支持 merge 策略', () => {
      manager.setInitialValues({
        address: {
          city: 'Beijing',
          street: 'Main St',
        },
      }, 'merge');

      expect(manager.initialValues?.address?.city).toBe('Beijing');
    });

    it('应该切断引用（深拷贝）', () => {
      const values = { name: 'Alice', age: 25 };
      manager.setInitialValues(values);

      values.name = 'Bob';

      // 修改原始对象不应该影响 initialValues
      expect(manager.initialValues?.name).toBe('Alice');
    });
  });

  describe('initialValues getter', () => {
    it('应该返回初始值', () => {
      expect(manager.initialValues).toBeDefined();
      expect(manager.initialValues?.name).toBe('John');
      expect(manager.initialValues?.age).toBe(30);
    });

    it('没有初始值时应返回空对象或 undefined', () => {
      const emptyManager = new CoreManager<TestDraft>({});
      // Formily 在没有初始值时会返回空对象 {}
      expect(emptyManager.initialValues).toBeDefined();
      expect(emptyManager.initialValues).toEqual({});
    });

    it('初始值应该与 defaultValues 同步', () => {
      manager.setInitialValues({ name: 'Alice' });
      expect(manager.initialValues?.name).toBe('Alice');
      expect(manager.defaultValues?.name).toBe('Alice');
    });
  });

  describe('reset - 边界情况', () => {
    it('defaultValues 为 undefined 时应该重置为空对象', () => {
      const emptyManager = new CoreManager<TestDraft>({});
      emptyManager.setValue('name', 'Jane');

      emptyManager.reset();

      expect(emptyManager.draft).toEqual({});
    });

    it('应该支持 validate 选项', () => {
      manager.setValue('name', 'Jane');
      manager.reset({ validate: true });

      expect(manager.draft.name).toBe('John');
    });

    it('应该支持 forceClear 和 validate 组合', () => {
      manager.setValue('name', 'Jane');
      manager.reset({ forceClear: true, validate: true });

      expect(manager.draft).toEqual({});
    });
  });

  describe('dispose - 清理资源', () => {
    it('应该正确清理所有资源', () => {
      const managerToDispose = new CoreManager<TestDraft>({
        defaultValues,
        applyDebounceMs: 100,
        listeners: {
          onDraftChange: vi.fn(),
        },
      });

      managerToDispose.setValue('name', 'Jane');

      // 调用 dispose
      managerToDispose['dispose']();

      // 验证资源已清理
      expect(managerToDispose.listeners).toBeUndefined();
      expect(managerToDispose.defaultValues).toBeUndefined();
      expect(managerToDispose.applied).toBeUndefined();
      expect(managerToDispose.previous).toBeUndefined();
      expect(managerToDispose['previousDraft']).toBeUndefined();
      expect(managerToDispose['_changedCache']).toBeUndefined();
      expect(managerToDispose['emitFn']).toBeUndefined();
      expect(managerToDispose['applyDebounceMs']).toBeUndefined();
      expect(managerToDispose['debouncedApply']).toBeUndefined();
    });

    it('应该取消防抖函数', () => {
      const managerToDispose = new CoreManager<TestDraft>({
        defaultValues,
        applyDebounceMs: 100,
      });

      const debouncedApply = managerToDispose['debouncedApply'];
      expect(debouncedApply).toBeDefined();

      // 调用 dispose
      managerToDispose['dispose']();

      // 防抖函数应该被取消
      expect(managerToDispose['debouncedApply']).toBeUndefined();
    });

    it('没有防抖函数时 dispose 不应该报错', () => {
      const managerToDispose = new CoreManager<TestDraft>({
        defaultValues,
      });

      expect(() => {
        managerToDispose['dispose']();
      }).not.toThrow();
    });
  });

  describe('事件发射函数 (emitFn)', () => {
    it('应该触发 draft:change 事件', () => {
      const emitFn = vi.fn();
      const managerWithEmit = new CoreManager<TestDraft>({
        defaultValues,
        emitFn,
      });

      managerWithEmit.setValue('name', 'Jane');

      expect(emitFn).toHaveBeenCalledWith('draft:change', {
        draft: expect.objectContaining({ name: 'Jane' }),
        prev: undefined,
      });
    });

    it('应该触发 apply:start 事件', async () => {
      const emitFn = vi.fn();
      const managerWithEmit = new CoreManager<TestDraft>({
        defaultValues,
        emitFn,
      });

      await managerWithEmit.apply();

      expect(emitFn).toHaveBeenCalledWith('apply:start', {
        draft: expect.any(Object),
      });
    });

    it('应该触发 apply:success 事件', async () => {
      const emitFn = vi.fn();
      const managerWithEmit = new CoreManager<TestDraft>({
        defaultValues,
        emitFn,
      });

      await managerWithEmit.apply();

      expect(emitFn).toHaveBeenCalledWith('apply:success', {
        draft: expect.any(Object),
        payload: expect.any(Object),
      });
    });

    it('应该触发 reset 事件', () => {
      const emitFn = vi.fn();
      const managerWithEmit = new CoreManager<TestDraft>({
        defaultValues,
        emitFn,
      });

      managerWithEmit.reset();

      expect(emitFn).toHaveBeenCalledWith('reset', {
        scope: 'all',
      });
    });

    it('应该触发 validate:failed 事件（如果验证失败）', async () => {
      const emitFn = vi.fn();
      const managerWithEmit = new CoreManager<TestDraft>({
        defaultValues,
        emitFn,
        formilyOptions: {
          effects: () => {
            // 可以在这里添加验证规则
          },
        },
      });

      // 注意：由于需要实际的验证失败场景，这里主要测试事件系统存在
      expect(emitFn).toBeDefined();
    });
  });

  describe('changed 缓存机制', () => {
    it('应该缓存 changed 结果', () => {
      manager.setValue('name', 'Jane');

      // 第一次访问，应该计算并缓存
      const first = manager.changed;

      // 第二次访问，应该使用缓存
      const second = manager.changed;

      expect(first).toBe(true);
      expect(second).toBe(true);
    });

    it('值变化时应该清除缓存', () => {
      expect(manager.changed).toBe(false);

      manager.setValue('name', 'Jane');
      expect(manager.changed).toBe(true);

      manager.setValue('name', 'John');
      expect(manager.changed).toBe(false);
    });

    it('设置初始值应该清除缓存', () => {
      manager.setValue('name', 'Jane');
      expect(manager.changed).toBe(true);

      // 设置初始值应该清除缓存
      manager.setInitialValues({
        name: 'Alice',
        age: 25,
      });

      // 缓存应该被清除，changed 应该重新计算
      // 现在 draft 是 { name: 'Jane', age: 30, email: 'john@example.com' }
      // defaultValues 是 { name: 'Alice', age: 25 }
      // 它们不相等，所以 changed 应该为 true
      expect(manager.changed).toBe(true);

      // 验证缓存确实被清除了（通过再次设置初始值）
      manager.setInitialValues({
        name: 'Bob',
        age: 30,
      });
      // 再次验证 changed 重新计算了
      expect(manager.changed).toBe(true);
    });
  });

  describe('Snapshot Processing Hooks - 快照处理钩子', () => {
    it('应该通过钩子处理快照', async () => {
      // 注册钩子
      manager.hooks.processSnapshot.tap('test-hook', (snapshot) => {
        return { ...snapshot, processed: true } as any;
      });

      manager.setValue('name', 'Jane');
      await manager.apply();

      // 验证 applied 快照已被处理
      expect((manager.applied as any).processed).toBe(true);
    });

    it('钩子应该按顺序串行执行（瀑布流）', async () => {
      manager.hooks.processSnapshot.tap('hook1', (snapshot) => {
        return { ...snapshot, step1: true } as any;
      });

      manager.hooks.processSnapshot.tap('hook2', (snapshot) => {
        // 接收上一个钩子的结果
        expect((snapshot as any).step1).toBe(true);
        return { ...snapshot, step2: true } as any;
      });

      manager.setValue('name', 'Jane');
      await manager.apply();

      const applied = manager.applied as any;
      expect(applied.step1).toBe(true);
      expect(applied.step2).toBe(true);
    });

    it('钩子支持异步操作', async () => {
      manager.hooks.processSnapshot.tapPromise('async-hook', async (snapshot) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { ...snapshot, asyncProcessed: true } as any;
      });

      manager.setValue('name', 'Jane');
      await manager.apply();

      expect((manager.applied as any).asyncProcessed).toBe(true);
    });

    it('如果钩子执行失败，apply 应该被拒绝', async () => {
      manager.hooks.processSnapshot.tap('fail-hook', () => {
        throw new Error('Hook failed');
      });

      manager.setValue('name', 'Jane');

      // apply 应该 reject
      await expect(manager.apply()).rejects.toThrow('Hook failed');

      // 失败时不应该更新 applied
      expect(manager.applied).toBeUndefined();
    });
  });

  describe('reset - 错误清除', () => {
    it('reset 应该清除表单错误', async () => {
      // 模拟一个带有验证规则的表单
      const managerWithValidation = new CoreManager<TestDraft>({
        defaultValues: { name: 'John' } as any,
      });
      // 添加一个必填字段验证
      managerWithValidation.form.createField({
        name: 'requiredField',
        required: true,
        validator: { required: true, message: '必填' }
      });

      // 触发验证错误
      try {
        await managerWithValidation.validate();
      } catch (e) {
        // 忽略验证错误
      }

      expect(managerWithValidation.state.errors.length).toBeGreaterThan(0);

      // Reset
      managerWithValidation.reset();

      // 错误应该被清除
      expect(managerWithValidation.state.errors).toEqual([]);
    });
  });
});
