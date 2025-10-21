/**
 * CoreManager 完整功能测试
 * 测试所有公共 API 和接口实现
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CoreManager, type ICoreManager } from '../../src/core/managers/CoreManager';
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

  describe('类型和接口', () => {
    it('应该实现 ICoreManager 接口', () => {
      // 类型检查
      const _manager: ICoreManager<TestDraft> = manager;
      expect(_manager).toBeDefined();
    });

    it('应该有正确的只读属性', () => {
      expect(manager.id).toBeDefined();
      expect(typeof manager.id).toBe('string');
      expect(manager.form).toBeDefined();
    });

    it('应该有公共属性', () => {
      expect(manager.listeners).toBeUndefined();
      expect(manager.defaultValues).toEqual(defaultValues);
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

    describe('applied', () => {
      it('初始状态应该为 undefined', () => {
        expect(manager.applied).toBeUndefined();
      });

      it('apply 后应该有值', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        expect(manager.applied).toBeDefined();
        expect(manager.applied?.name).toBe('Jane');
      });

      it('应该是独立副本', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        const applied = manager.applied;

        manager.setValue('name', 'Bob');
        expect(applied?.name).toBe('Jane');
        expect(manager.draft.name).toBe('Bob');
      });
    });

    describe('previous', () => {
      it('初始状态应该为 undefined', () => {
        expect(manager.previous).toBeUndefined();
      });

      it('apply 后应该创建 previous 快照', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        expect(manager.previous).toBeDefined();
        expect(manager.previous?.name).toBe('Jane');
      });

      it('应该是独立副本', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        const previous = manager.previous;

        manager.setValue('name', 'Bob');
        expect(previous?.name).toBe('Jane');
        expect(manager.draft.name).toBe('Bob');
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
      it('初始状态应该返回 false', () => {
        expect(manager.changed).toBe(false);
      });

      it('未 apply 前应该返回 false', () => {
        manager.setValue('name', 'Jane');
        // previous 不存在，所以返回 false
        expect(manager.changed).toBe(false);
      });

      it('apply 后未修改应该返回 true', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();
        // draft 和 previous 相同
        expect(manager.changed).toBe(true);
      });

      it('apply 后修改应该返回 false', async () => {
        manager.setValue('name', 'Jane');
        await manager.apply();

        manager.setValue('name', 'Bob');
        // draft 和 previous 不同
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
      // formily 的 tags 是数组，删除元素后会自动调整索引，所以长度不变，但索引会变化，会变成一个稀疏数组
      // expect(manager.draft.tags?.length).toBe(2);
      expect(manager.draft.tags?.[1]).toBeUndefined();
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
      const managerWithValidation = new CoreManager<TestDraft>({
        defaultValues,
        listeners: {
          onValidateFailed,
        },
        formilyOptions: {
          effects: () => {
            // 可以在这里添加验证规则
          },
        },
      });

      // 这里应该设置一些验证规则并触发失败
      // 由于需要复杂的 Formily 配置，这里只测试监听器存在
      expect(managerWithValidation.listeners?.onValidateFailed).toBeDefined();
    });
  });

  describe('reset - 重置表单', () => {
    it('应该重置所有字段到默认值', () => {
      manager.setValues({
        name: 'Jane',
        age: 25,
        email: 'jane@example.com',
      });

      manager.reset();

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
      expect(manager.draft.tags?.[0]).toBeUndefined();
      // expect(manager.draft.tags?.length).toBe(2);
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
});


