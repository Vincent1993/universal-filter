import { describe, it, expect } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import type { Plugin } from '../../src/core/types';

describe('PluginManager', () => {
  it('应按真实场景的依赖与优先级顺序执行（local -> remote -> url）', () => {
    // 本地存储优先级低，最先执行
    const local: Plugin = {
      name: 'local-storage',
      priority: 50,
      onInit: ({ setReady }) => {
        setReady(true);
      },
    };

    // 远端存储依赖本地（例如需要本地 token 等），其次执行
    const remote: Plugin = {
      name: 'remote-storage',
      requires: ['local-storage'],
      priority: 70,
      onInit: ({ setReady }) => {
        setReady(true);
      },
    };

    // URL 同步最高优先级，最后覆盖
    const url: Plugin = {
      name: 'url-sync',
      priority: 100,
      onInit: ({ setReady }) => {
        setReady(true);
      },
    };

    // 打乱注册顺序，验证排序正确
    const filter =createFilter({ plugins: [url, remote, local] });

    expect(Array.from(filter.pluginMap.keys())).toStrictEqual([
      'url-sync',
      'remote-storage',
      'local-storage',
    ]);
  });

  it('应在全部插件 ready 后聚合为 true 且自动触发一次 apply', async () => {
    const marks: string[] = [];

    const fastLocal: Plugin = {
      name: 'local-storage',
      priority: 50,
      onInit: ({ setReady }) => {
        marks.push('local-ready');
        setReady(true);
      },
    };

    const slowRemote: Plugin = {
      name: 'remote-storage',
      requires: ['local-storage'],
      priority: 70,
      async onInit({ setReady }) {
        await new Promise((r) => setTimeout(r, 10));
        marks.push('remote-ready');
        setReady(true);
      },
    };

    const filter = createFilter({ plugins: [slowRemote, fastLocal], autoApply: { onInit: true } });

    const appliedDrafts: Array<Record<string, unknown>> = [];
    const offApply = filter.events.on('apply:success', ({ draft }) => {
      appliedDrafts.push(draft as Record<string, unknown>);
    });

    // 等待 plugins:ready 事件更符合真实时序
    await new Promise<void>((resolve) => {
      filter.events.once('plugins:ready', ({ ready }) => ready ? resolve() : undefined);
    });

    // 校验就绪聚合
    expect(marks).toEqual(expect.arrayContaining(['local-ready', 'remote-ready']));
    expect(filter.plugin.ready).toBe(true);

    // 首屏仅自动 apply 一次
    expect(appliedDrafts.length).toBe(1);
    offApply();
  });
});


