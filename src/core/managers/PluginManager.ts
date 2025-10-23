import type { Draft, Plugin, FilterApi } from '../types';
import type EventEmitter from 'eventemitter3';

/**
 * @name 插件管理器
 *
 * @description 负责插件的注册、初始化、生命周期管理和状态维护
 * 通过内部事件总线与其他模块通信
 *
 * @template TDraft - 筛选器数据类型
 *
 * @example
 * ```ts
 * // 检查插件是否就绪
 * if (filter.plugin.ready) {
 *   console.log('所有插件已就绪');
 * }
 *
 * // 读写插件状态
 * filter.plugin.setState('my-key', { foo: 'bar' });
 * const state = filter.plugin.getState('my-key');
 * ```
 */
export class PluginManager<TDraft extends Draft> {
  private plugins: Plugin<TDraft>[] = [];
  private readonly pluginReady = new Map<
    string,
    { ready: boolean; error?: unknown }
  >();
  private readonly pluginMap = new Map<string, Plugin<TDraft>>();

  constructor(private bus: EventEmitter, plugins: Plugin<TDraft>[]) {
    this.plugins = [...(plugins ?? [])];
    this.pluginMap.clear();
    this.pluginReady.clear();
    for (const p of this.plugins) {
      this.pluginMap.set(p.name, p);
      this.pluginReady.set(p.name, { ready: false });
    }
  }


  /**
   * @name runInit
   * @description 执行所有插件的初始化钩子
   * @param filter - FilterApi 实例
   * @returns {Promise<void>}
   * @internal
   */
  async runInit(filter: FilterApi<TDraft>): Promise<void> {
    // 发送插件挂载事件
    this.bus.emit('plugins:attached', { total: this.plugins.length });
    const ordered = this.sortByRequiresAndPriority(this.plugins);
    for (const plugin of ordered) {
      if (typeof plugin.onInit === 'function') {
        await plugin.onInit({
          root: filter,
          setReady: (ready: boolean, error?: unknown) => {
            this.pluginReady.set(plugin.name, { ready, error });
            this.bus.emit('plugin:ready', { name, ready, error });
          },
          isReady: () => this.pluginReady.get(plugin.name)?.ready === true,
        });
      }
    }
    this.bus.emit('plugins:ready', { ready: this.ready });
  }

  /**
   * @name ready
   * @description 所有插件是否都已就绪
   * @type {boolean}
   * @readonly
   */
  get ready(): boolean {
    return Array.from(this.pluginReady.values()).every(({ ready }) => ready);
  }


  /**
   * 根据依赖关系和优先级对插件进行拓扑排序
   *
   * 排序规则:
   * 1. 被依赖的插件先执行 (拓扑排序)
   * 2. 同层级按 priority 升序排列
   * 3. priority 相同时,被更多插件依赖的先执行
   * 4. 其他情况按名称字典序排列
   *
   * @param items - 待排序的插件列表
   * @returns 排序后的插件列表
   * @internal
   */
  private sortByRequiresAndPriority(items: Plugin<TDraft>[]): Plugin<TDraft>[] {
    const graph = new Map<string, Set<string>>(); // dep -> [dependents]
    const indeg = new Map<string, number>();
    const dict = new Map(items.map((p) => [p.name, p] as const));

    for (const p of items) {
      graph.set(p.name, new Set());
      indeg.set(p.name, 0);
    }
    for (const p of items) {
      for (const dep of p.requires ?? []) {
        if (!dict.has(dep)) continue;
        graph.get(dep)!.add(p.name);
        indeg.set(p.name, (indeg.get(p.name) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [name, d] of indeg) if (d === 0) queue.push(name);

    const result: Plugin<TDraft>[] = [];
    const outdeg = new Map<string, number>(
      Array.from(graph.entries()).map(([k, v]) => [k, v.size])
    );
    while (queue.length) {
      // 按 priority 升序；若相同，则按出度降序（依赖越多越先执行）；再按名称稳定排序
      queue.sort((a, b) => {
        const pa = dict.get(a)?.priority ?? 0;
        const pb = dict.get(b)?.priority ?? 0;
        if (pa !== pb) return pa - pb;
        const oa = outdeg.get(a) ?? 0;
        const ob = outdeg.get(b) ?? 0;
        if (oa !== ob) return ob - oa;
        return a.localeCompare(b);
      });
      const name = queue.shift()!;
      const p = dict.get(name);
      if (p) result.push(p);
      for (const to of graph.get(name) ?? []) {
        indeg.set(to, (indeg.get(to) ?? 0) - 1);
        if ((indeg.get(to) ?? 0) === 0) queue.push(to);
      }
    }

    return result.length === items.length ? result : items.slice();
  }
}
