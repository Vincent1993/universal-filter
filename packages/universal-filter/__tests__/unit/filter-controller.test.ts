import { describe, it, expect, vi } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import type { Draft, PluginFactory } from '../../src/core/types';

describe('FilterController - 生命周期与事件', () => {
  it('应该暴露 dispose 方法并触发 destroy 事件', () => {
    const filter = createFilter();
    const onDestroy = vi.fn();
    const unsubscribe = filter.on('destroy', onDestroy);

    filter.dispose();
    filter.dispose(); // 多次调用不应重复触发

    expect(typeof filter.dispose).toBe('function');
    expect(onDestroy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('dispose 时应该触发监听器的 onDestroy', () => {
    let destroyedRoot: unknown;
    const filter = createFilter({
      listeners: {
        onDestroy: ({ root }) => {
          destroyedRoot = root;
        },
      },
    });

    filter.dispose();

    expect(destroyedRoot).toBe(filter);
  });

  it('dispose 应该卸载 Formily 表单并清理核心引用', () => {
    const filter = createFilter();
    const removeEffectsSpy = vi.spyOn(filter.form, 'removeEffects');

    expect(filter.form.unmounted).toBe(false);

    filter.dispose();

    expect(removeEffectsSpy).toHaveBeenCalledWith('filter-apply');
    expect(filter.form.unmounted).toBe(true);
    expect(filter.listeners).toBeUndefined();
  });

  it('插件销毁异常时应该继续销毁其他插件并上报错误', () => {
    const destroySpy = vi.fn();
    const faultyPlugin: PluginFactory<Draft> = () => ({
      name: 'faulty',
      onDestroy: () => {
        throw new Error('dispose failed');
      },
    });
    const okPlugin: PluginFactory<Draft> = () => ({
      name: 'ok',
      onDestroy: destroySpy,
    });

    const filter = createFilter({ plugins: [faultyPlugin, okPlugin] });
    const destroyedPayload = vi.fn();
    filter.on('plugins:destroyed', destroyedPayload);

    filter.dispose();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(destroyedPayload).toHaveBeenCalledWith({
      errors: [expect.objectContaining({ name: 'faulty', error: expect.any(Error) })],
    });
  });

  it('没有 onInit 的插件应该自动标记为 ready', async () => {
    const filter = createFilter({
      plugins: [
        {
          name: 'without-init',
        },
      ],
    });

    await Promise.resolve();

    expect(filter.plugin.ready).toBe(true);
  });

  it('未显式调用 setReady 的插件在初始化后也应标记为 ready 并触发事件', async () => {
    const readySpy = vi.fn();
    const filter = createFilter({
      plugins: [
        {
          name: 'lazy',
          onInit: async () => {
            await Promise.resolve();
          },
        },
      ],
    });
    filter.on('plugin:ready', readySpy);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(filter.plugin.ready).toBe(true);
    expect(readySpy).toHaveBeenCalledWith({ name: 'lazy', ready: true, error: undefined });
  });
});
