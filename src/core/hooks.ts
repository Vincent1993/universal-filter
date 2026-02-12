import {
  SyncHook,
  SyncBailHook,
  SyncWaterfallHook,
  AsyncSeriesWaterfallHook,
} from 'tapable';
import type { Form } from '@formily/core';
import type { Draft, ApplySuccessPayload, PluginDisposeError, FilterApi } from './types';

/**
 * FilterHooks - 基于 tapable 的统一钩子注册表
 *
 * 这是整个 Filter 系统的唯一事件源，替代了之前的：
 * 1. EventEmitter3 事件总线
 * 2. FilterListeners 回调
 * 3. 自制 AsyncSeriesWaterfallHook
 *
 * 所有模块间通信、插件生命周期、数据转换管道都通过此注册表完成。
 *
 * @template TDraft - 草稿数据类型
 */
export function createFilterHooks<TDraft extends Draft>() {
  return {
    // ==================== 核心生命周期钩子 ====================

    /** Filter 实例初始化完成 */
    init: new SyncHook<[{ root: FilterApi<TDraft> }]>(['context']),

    /**
     * Filter 实例完全就绪
     * 触发条件：Formily Form 已挂载 + 所有插件初始化完成
     */
    ready: new SyncHook<[{ root: FilterApi<TDraft> }]>(['context']),

    /**
     * Filter 实例销毁
     * payload 包含 root 引用，方便 listener 做最后的清理
     */
    destroy: new SyncHook<[{ root: FilterApi<TDraft> }]>(['context']),

    // ==================== 数据流钩子 ====================

    /**
     * 草稿数据变更前的拦截钩子（SyncWaterfallHook）
     *
     * 在 Formily 值变化后、draftChange 通知前执行。
     * 每个 tap 接收当前 draft 并返回（可能被修改的）draft。
     * 如果最终值与 Formily 当前值不同，会自动回写到表单。
     *
     * @example
     * ```ts
     * filter.hooks.beforeDraftChange.tap('sanitize', (draft) => {
     *   return { ...draft, name: draft.name?.trim() };
     * });
     * ```
     */
    beforeDraftChange: new SyncWaterfallHook<[TDraft]>(['draft']),

    /** 草稿数据变更（通知型，不可修改数据） */
    draftChange: new SyncHook<[{ draft: TDraft; prev?: TDraft }]>(['payload']),

    /**
     * Apply 流程拦截钩子（SyncBailHook）
     *
     * 在 form.submit() 之前执行。
     * 任意 tap 返回 true 即阻止本次 apply。
     *
     * @example
     * ```ts
     * filter.hooks.beforeApply.tap('guard', ({ draft }) => {
     *   if (!draft.keyword) return true; // 阻止空查询
     * });
     * ```
     */
    beforeApply: new SyncBailHook<[{ draft: TDraft }], boolean>(['payload']),

    /** Apply 流程开始（验证 + 快照前） */
    applyStart: new SyncHook<[{ draft: TDraft }]>(['payload']),

    /** Apply 流程成功（快照已创建） */
    applySuccess: new SyncHook<[{ draft: TDraft; payload: ApplySuccessPayload<TDraft> }]>(['payload']),

    /** 表单验证失败 */
    validateFailed: new SyncHook<[{ draft: TDraft; errors: Form['errors'] }]>(['payload']),

    /** 表单重置 */
    reset: new SyncHook<[{ scope: 'all' | 'group' | string; target?: string }]>(['payload']),

    // ==================== 数据转换管道（瀑布流） ====================

    /**
     * 快照处理钩子（AsyncSeriesWaterfallHook）
     *
     * 在 apply 成功后，对 applied 快照进行链式处理（如 codec 编码、数据清洗等）
     * 第一个参数 snapshot 是瀑布流值（上一个 tap 的返回值传给下一个），
     * 第二个参数 currentDraft 是当前的草稿数据（透传，不会被修改）。
     */
    processSnapshot: new AsyncSeriesWaterfallHook<[TDraft, TDraft]>(['snapshot', 'currentDraft']),

    // ==================== 插件生命周期钩子 ====================

    /** 单个插件就绪状态变更 */
    pluginReady: new SyncHook<[{ name: string; ready: boolean; error?: unknown }]>(['payload']),

    /** 所有插件就绪状态汇总 */
    pluginsReady: new SyncHook<[{ ready: boolean }]>(['payload']),

    /** 插件已挂载 */
    pluginsAttached: new SyncHook<[{ total: number }]>(['payload']),

    /** 插件已销毁 */
    pluginsDestroyed: new SyncHook<[{ errors: PluginDisposeError[] }]>(['payload']),

    // ==================== Options 数据源钩子 ====================

    /** 选项数据开始加载 */
    optionsLoad: new SyncHook<[{ fieldPath: string }]>(['payload']),

    /** 选项数据加载完成 */
    optionsLoaded: new SyncHook<[{ fieldPath: string; data: unknown[] }]>(['payload']),

    /** 选项数据加载失败 */
    optionsError: new SyncHook<[{ fieldPath: string; error: Error }]>(['payload']),
  };
}

/**
 * FilterHooks 类型（从工厂函数推断）
 */
export type FilterHooks<TDraft extends Draft> = ReturnType<typeof createFilterHooks<TDraft>>;

/**
 * FilterHookMap - 事件名到 payload 类型的映射
 * 用于 on/off/once 的类型推导
 */
export type FilterHookMap<TDraft extends Draft> = {
  [K in keyof FilterHooks<TDraft>]: FilterHooks<TDraft>[K] extends SyncHook<[infer P]>
    ? P
    : FilterHooks<TDraft>[K] extends SyncBailHook<[infer P], any>
    ? P
    : FilterHooks<TDraft>[K] extends SyncWaterfallHook<[infer P]>
    ? P
    : FilterHooks<TDraft>[K] extends AsyncSeriesWaterfallHook<[infer P, ...any[]]>
    ? P
    : never;
};
