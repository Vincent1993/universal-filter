/**
 * 监控插件
 *
 * 自动采集 Filter 实例的使用指标，用于性能分析和用户行为理解。
 *
 * ## 采集指标
 *
 * | 指标 | 说明 | 采集时机 |
 * |------|------|---------|
 * | `readyDuration` | 从插件初始化到 Filter 就绪的耗时 | ready 事件 |
 * | `lastProcessingDuration` | 最近一次 apply 的系统处理耗时 | apply:success |
 * | `lastDecisionDuration` | 从首次操作到提交的用户决策耗时 | apply:success |
 * | `lastInteractionCount` | 最近一次查询周期内的操作次数 | apply:success |
 * | `fieldHeatmap` | 各字段的修改频率 | draft:change |
 * | `validationFriction` | 各字段的校验失败次数 | validate:failed |
 *
 * ## 使用方式
 *
 * 所有指标通过 `pluginManager.getState('monitor-plugin')` 获取（响应式），
 * 也可通过 `onReport` 回调上报到监控平台。
 *
 * @example
 * ```ts
 * const filter = createFilter({
 *   plugins: [
 *     createMonitorPlugin({
 *       debug: false,
 *       onReport: (event, data) => {
 *         analytics.track(event, data);
 *       },
 *     }),
 *   ],
 * });
 *
 * // 在组件中读取指标（响应式）
 * const metrics = filter.plugin.getState<MonitorMetrics>('monitor-plugin');
 * ```
 *
 * @module
 */
import type { Draft, Plugin, PluginInitContext, ApplySuccessPayload } from '../core/types';

export const MONITOR_PLUGIN_NAME = 'monitor-plugin';

/**
 * 监控指标数据结构（响应式）
 */
export interface MonitorMetrics {
  /** 实例就绪耗时 (ms) */
  readyDuration?: number;
  /** 最近一次 apply 的系统处理耗时 (ms)，包括 codec 转换 */
  lastProcessingDuration?: number;
  /** 从首次操作到最终 apply 成功的用户决策耗时 (ms) */
  lastDecisionDuration?: number;
  /** 最近一次查询周期内的操作次数 */
  lastInteractionCount: number;
  /** 字段修改热度 (fieldKey → 修改次数) */
  fieldHeatmap: Record<string, number>;
  /** 校验失败摩擦力 (fieldPath → 失败次数) */
  validationFriction: Record<string, number>;
}

/**
 * 监控插件配置
 */
export interface MonitorPluginOptions {
  /**
   * 埋点上报回调，每次状态变更时触发
   * @param event - 事件名（如 `'filter_ready'`、`'filter_apply_success'`）
   * @param data - 事件数据
   */
  onReport?: (event: string, data: any) => void;
  /**
   * 是否输出调试日志到 console
   * @default false
   */
  debug?: boolean;
}

/**
 * 创建监控插件
 *
 * @param options - 插件配置
 * @returns Plugin 对象
 */
export function createMonitorPlugin<TDraft extends Draft = Draft>(
  options: MonitorPluginOptions = {}
): Plugin<TDraft> {
  const { onReport, debug = true } = options;

  // 内部统计状态
  let pluginStartTime = performance.now();
  let decisionStartTime: number | null = null;
  let processingStartTime: number | null = null;
  let interactionCount = 0;

  const logDebug = (message: string, ...args: any[]) => {
    if (!debug) return;
    console.log(`[MonitorPlugin] ${message}`, ...args);
  };

  const emitReport = (event: string, data: any) => {
    if (!onReport) return;
    onReport(event, data);
  };

  return {
    name: MONITOR_PLUGIN_NAME,

    onInit({ filter, pluginManager }: PluginInitContext<TDraft>) {
      // 1. 初始化插件响应式状态
      pluginManager.setState<MonitorMetrics>(MONITOR_PLUGIN_NAME, {
        lastInteractionCount: 0,
        fieldHeatmap: {},
        validationFriction: {},
      });

      // 2. 统计【就绪耗时】: 从插件初始化到 Ready 事件触发
      // 使用 tapable hooks 替代 filter.once('ready', ...)
      let readyHandled = false;
      filter.hooks.ready.tap('MonitorPlugin:ready', () => {
        if (readyHandled) return; // 模拟 once 行为
        readyHandled = true;
        const readyDuration = performance.now() - pluginStartTime;
        pluginManager.setState(MONITOR_PLUGIN_NAME, { readyDuration });
        logDebug('就绪耗时:', readyDuration.toFixed(2), 'ms');
        emitReport('filter_ready', { duration: readyDuration });
      });

      // 3. 统计【决策起点】与【字段热度】
      filter.hooks.draftChange.tap('MonitorPlugin:draftChange', ({ draft, prev }: any) => {
        // 记录决策起点
        if (decisionStartTime === null) {
          decisionStartTime = performance.now();
        }
        interactionCount++;

        // 统计字段变更频率 (对比旧值找出变更的 key)
        const changedKeys = Object.keys(draft).filter(key => draft[key] !== prev?.[key]);
        pluginManager.setState<MonitorMetrics>(MONITOR_PLUGIN_NAME, (state) => {
          const baseState: MonitorMetrics = state ?? {
            lastInteractionCount: 0,
            fieldHeatmap: {},
            validationFriction: {},
          };
          const newHeatmap = { ...baseState.fieldHeatmap };
          changedKeys.forEach(key => {
            newHeatmap[key] = (newHeatmap[key] || 0) + 1;
          });
          return {
            ...baseState,
            fieldHeatmap: newHeatmap,
            lastInteractionCount: interactionCount,
          };
        });
      });

      // 4. 统计【系统处理耗时起点】
      filter.hooks.applyStart.tap('MonitorPlugin:applyStart', () => {
        processingStartTime = performance.now();
      });

      // 5. 统计【决策终点】与【处理耗时终点】
      filter.hooks.applySuccess.tap('MonitorPlugin:applySuccess', (
        event: { draft: TDraft; payload: ApplySuccessPayload<TDraft> }
      ) => {
        const payload = event.payload;

        // 未发生任何用户操作，过滤掉 0 耗时上报
        if (decisionStartTime === null && interactionCount === 0) {
          processingStartTime = null;
          logDebug('忽略 0 耗时上报（无用户交互）');
          return;
        }
        const now = performance.now();
        let decisionDuration = 0;
        let processingDuration = 0;

        // 计算用户决策耗时 (从第一次改动到最终查询成功)
        if (decisionStartTime !== null) {
          decisionDuration = now - decisionStartTime;
        }

        // 计算系统处理耗时 (转换、Hook等执行时间)
        if (processingStartTime !== null) {
          processingDuration = now - processingStartTime;
        }

        // 更新状态
        pluginManager.setState<MonitorMetrics>(MONITOR_PLUGIN_NAME, (state) => ({
          ...(state ?? {
            lastInteractionCount: 0,
            fieldHeatmap: {},
            validationFriction: {},
          }),
          lastDecisionDuration: decisionDuration,
          lastProcessingDuration: processingDuration,
        }));

        logDebug('决策耗时:', decisionDuration.toFixed(2), 'ms (操作次数:', interactionCount, ')');
        logDebug('处理耗时:', processingDuration.toFixed(2), 'ms');

        // 上报完整查询行为
        emitReport('filter_apply_success', {
          decisionDuration,
          processingDuration,
          interactionCount,
          appliedData: payload.applied
        });

        // 【重置周期】
        decisionStartTime = null;
        processingStartTime = null;
        interactionCount = 0;
      });

      // 6. 统计【校验摩擦力】: 记录哪些字段导致了校验失败
      filter.hooks.validateFailed.tap('MonitorPlugin:validateFailed', ({ errors }: { errors: Array<{ address?: string }> }) => {
        pluginManager.setState<MonitorMetrics>(MONITOR_PLUGIN_NAME, (state) => {
          const baseState: MonitorMetrics = state ?? {
            lastInteractionCount: 0,
            fieldHeatmap: {},
            validationFriction: {},
          };
          const newFriction = { ...baseState.validationFriction };
          errors.forEach(err => {
            const path = err.address || 'unknown';
            newFriction[path] = (newFriction[path] || 0) + 1;
          });
          return { ...baseState, validationFriction: newFriction };
        });

        logDebug('校验失败:', errors);
        emitReport('filter_validate_failed', { errorCount: errors.length });
      });

      // 7. 重置逻辑
      filter.hooks.reset.tap('MonitorPlugin:reset', () => {
        decisionStartTime = null;
        processingStartTime = null;
        interactionCount = 0;
        logDebug('用户重置了筛选器');
      });

      // 标记监控插件就绪
      pluginManager.markReady(MONITOR_PLUGIN_NAME, true);
    }
  };
}
