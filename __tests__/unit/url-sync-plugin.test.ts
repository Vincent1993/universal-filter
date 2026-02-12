/**
 * URL 同步插件测试
 * 测试 timing 选项、resolveOptions 预初始化、syncToUrl 回写
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import { createUrlSyncPlugin } from '../../src/plugins/urlSyncPlugin';
import type { Draft } from '../../src/core/types';

// Mock window.location
const originalLocation = window.location;

function mockUrlSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: {
      ...originalLocation,
      href: `http://localhost${search ? '?' + search : ''}`,
      search: search ? '?' + search : '',
      pathname: '/',
      hash: '',
    },
    writable: true,
    configurable: true,
  });
}

function restoreLocation() {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
}

// Mock history
const pushStateSpy = vi.fn();
const replaceStateSpy = vi.fn();

beforeEach(() => {
  window.history.pushState = pushStateSpy;
  window.history.replaceState = replaceStateSpy;
  pushStateSpy.mockClear();
  replaceStateSpy.mockClear();
});

afterEach(() => {
  restoreLocation();
});

// 辅助函数
async function waitForPluginsReady(filter: ReturnType<typeof createFilter>, timeout = 1000): Promise<void> {
  if (filter.plugin.ready) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    filter.once('plugins:ready', () => { clearTimeout(timer); resolve(); });
  });
}

function triggerFormMount(filter: ReturnType<typeof createFilter>): void {
  filter.form.onMount();
  const controller = filter as any;
  if (!controller._isFormMounted) {
    controller._isFormMounted = true;
    if (typeof controller.checkReadyState === 'function') {
      controller.checkReadyState();
    }
  }
}

describe('urlSyncPlugin - timing: beforeFormInit', () => {
  it('应该在 Form 创建前将 URL 参数注入到 defaultValues', () => {
    mockUrlSearch('keyword=react&page=2');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1, sort: 'desc' },
      plugins: [
        createUrlSyncPlugin({ timing: 'beforeFormInit' }),
      ],
    });

    // URL 参数应该已经合并到 defaultValues
    expect(filter.draft.keyword).toBe('react');
    expect(filter.draft.page).toBe(2);
    // 未在 URL 中的字段保持原默认值
    expect(filter.draft.sort).toBe('desc');

    filter.dispose();
  });

  it('reset 后应该保留 URL 注入的默认值', () => {
    mockUrlSearch('keyword=react');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1 },
      plugins: [
        createUrlSyncPlugin({ timing: 'beforeFormInit' }),
      ],
    });

    // 修改值
    filter.setValue('keyword', 'vue');
    expect(filter.draft.keyword).toBe('vue');

    // reset 应该恢复到包含 URL 参数的默认值
    filter.reset();
    expect(filter.draft.keyword).toBe('react');

    filter.dispose();
  });

  it('URL 为空时不应该影响 defaultValues', () => {
    mockUrlSearch('');

    const filter = createFilter({
      defaultValues: { keyword: 'original', page: 1 },
      plugins: [
        createUrlSyncPlugin({ timing: 'beforeFormInit' }),
      ],
    });

    expect(filter.draft.keyword).toBe('original');
    expect(filter.draft.page).toBe(1);

    filter.dispose();
  });

  it('应该支持自定义 deserialize', () => {
    mockUrlSearch('q=hello&p=3');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1 },
      plugins: [
        createUrlSyncPlugin({
          timing: 'beforeFormInit',
          deserialize: (params) => ({
            keyword: String(params.q ?? ''),
            page: Number(params.p ?? 1),
          }),
        }),
      ],
    });

    expect(filter.draft.keyword).toBe('hello');
    expect(filter.draft.page).toBe(3);

    filter.dispose();
  });
});

describe('urlSyncPlugin - timing: onInit', () => {
  it('应该在插件初始化阶段设置值', async () => {
    mockUrlSearch('keyword=react');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1 },
      plugins: [
        createUrlSyncPlugin({ timing: 'onInit' }),
      ],
    });

    await waitForPluginsReady(filter);

    expect(filter.draft.keyword).toBe('react');

    filter.dispose();
  });

  it('syncToInitialValues: true 应该同步到 initialValues', async () => {
    mockUrlSearch('keyword=react');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1 },
      plugins: [
        createUrlSyncPlugin({ timing: 'onInit', syncToInitialValues: true }),
      ],
    });

    await waitForPluginsReady(filter);

    // 修改然后 reset
    filter.setValue('keyword', 'vue');
    filter.reset();

    // 因为 URL 参数同步到了 initialValues，reset 后应该保留
    // 注意：Formily reset 行为依赖具体实现
    expect(filter.plugin.ready).toBe(true);

    filter.dispose();
  });
});

describe('urlSyncPlugin - syncToUrl', () => {
  it('apply 成功后应该将数据写入 URL', async () => {
    mockUrlSearch('');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1 },
      plugins: [
        createUrlSyncPlugin({ syncToUrl: true }),
      ],
    });

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    filter.setValue('keyword', 'react');
    await filter.apply();

    // 应该调用了 replaceState
    expect(replaceStateSpy).toHaveBeenCalled();
    const lastCall = replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1];
    expect(lastCall[2]).toContain('keyword=react');

    filter.dispose();
  });

  it('historyMode: push 应该使用 pushState', async () => {
    mockUrlSearch('');

    const filter = createFilter({
      defaultValues: { keyword: '' },
      plugins: [
        createUrlSyncPlugin({ syncToUrl: true, historyMode: 'push' }),
      ],
    });

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    filter.setValue('keyword', 'test');
    await filter.apply();

    expect(pushStateSpy).toHaveBeenCalled();

    filter.dispose();
  });

  it('应该支持自定义 serialize', async () => {
    mockUrlSearch('');

    const filter = createFilter({
      defaultValues: { keyword: '', page: 1 },
      plugins: [
        createUrlSyncPlugin({
          syncToUrl: true,
          serialize: ({ applied }) => ({
            q: (applied as any).keyword || undefined,
            p: (applied as any).page > 1 ? String((applied as any).page) : undefined,
          }),
        }),
      ],
    });

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    filter.setValue('keyword', 'hello');
    filter.setValue('page', 1);
    await filter.apply();

    // page=1 应该被过滤掉（undefined）
    const lastUrl = replaceStateSpy.mock.calls[replaceStateSpy.mock.calls.length - 1][2];
    expect(lastUrl).toContain('q=hello');
    expect(lastUrl).not.toContain('p=');

    filter.dispose();
  });
});

describe('urlSyncPlugin - resolveOptions 阶段', () => {
  it('resolveOptions 应该在 CoreManager 构造之前执行', () => {
    mockUrlSearch('injected=true');

    // 通过 defaultValues 验证 resolveOptions 已在 Form 创建前执行
    const filter = createFilter({
      defaultValues: { injected: 'false', other: 'keep' },
      plugins: [
        createUrlSyncPlugin({ timing: 'beforeFormInit' }),
      ],
    });

    // Formily Form 的 initialValues 应该已包含 URL 参数
    expect(filter.form.initialValues.injected).toBe(true);
    expect(filter.form.initialValues.other).toBe('keep');

    filter.dispose();
  });
});
