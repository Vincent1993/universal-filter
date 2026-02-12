import { FilterController } from './controller';
import type { Draft, FilterApi, FilterOptions } from './types';

/**
 * 创建 Filter 实例
 *
 * 这是整个库的核心入口。创建一个基于 Formily 的筛选器实例，
 * 具备草稿管理、状态快照、插件系统、数据转换等能力。
 *
 * ## 生命周期
 *
 * ```
 * createFilter()
 *   ├── resolveOptions 阶段（同步，Form 创建前）
 *   │   └── 插件 resolveOptions() 修改 FilterOptions
 *   ├── CoreManager 初始化
 *   │   ├── createForm() → Formily Form 实例
 *   │   └── listeners → hooks taps 转换
 *   ├── PluginManager 初始化
 *   │   └── 顺序执行 plugin.onInit()
 *   ├── hooks.init 触发
 *   └── 等待 Form Mount + Plugins Ready → hooks.ready 触发
 * ```
 *
 * ## 就绪条件
 *
 * `filter.ready === true` 需要同时满足：
 * 1. Formily Form 已挂载（`<FilterProvider>` 渲染完成）
 * 2. 所有插件初始化完成（`pluginManager.markReady()` 被调用）
 *
 * @param options - 筛选器配置
 * @returns FilterApi 实例
 *
 * @example
 * ```ts
 * // 基础用法
 * const filter = createFilter({
 *   defaultValues: { keyword: '', page: 1 },
 * });
 *
 * // 使用插件
 * const filter = createFilter({
 *   defaultValues: { keyword: '' },
 *   plugins: [
 *     createUrlSyncPlugin({ syncToUrl: true }),
 *     createCodecTransformPlugin({ transformers: [...] }),
 *   ],
 *   autoApply: { onInit: true, onChange: false },
 * });
 *
 * // 使用 listeners 回调
 * const filter = createFilter({
 *   defaultValues: { keyword: '' },
 *   listeners: {
 *     onApplySuccess: ({ payload }) => {
 *       console.log('Applied:', payload.applied);
 *     },
 *   },
 * });
 *
 * // 等待就绪
 * await filter.waitForReady(5000);
 * ```
 */
export function createFilter<TDraft extends Draft = Draft>(options: FilterOptions<TDraft> = {}): FilterApi<TDraft> {
  return new FilterController<TDraft>(options);
}
