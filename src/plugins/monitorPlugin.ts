import type { Draft, Plugin, PluginInitContext, ApplySuccessPayload } from '../core/types';

export const MONITOR_PLUGIN_NAME = 'monitor-plugin';

export interface MonitorMetrics {
  /** 实例就绪耗时 (ms) */
  readyDuration?: number;
  /** 最近一次查询的处理耗时 (ms) - 系统开销 */
  lastProcessingDuration?: number;
  /** 最近一次查询的用户决策耗时 (ms) - 用户思考时间 */
  lastDecisionDuration?: number;
  /** 最近一次查询的操作次数 */
  lastInteractionCount: number;
  /** 字段热度统计 (fieldKey -> 修改次数) */
  fieldHeatmap: Record<string, number>;
  /** 校验错误统计 (fieldPath -> 失败次数) */
  validationFriction: Record<string, number>;
}

export interface MonitorPluginOptions {
  /** 埋点上报回调 */
  onReport?: (event: string, data: any) => void;
  /** 是否开启调试日志 */
  debug?: boolean;
}
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
      const handleReady = () => {
        const readyDuration = performance.now() - pluginStartTime;
        pluginManager.setState(MONITOR_PLUGIN_NAME, { readyDuration });
        logDebug('就绪耗时:', readyDuration.toFixed(2), 'ms');
        emitReport('filter_ready', { duration: readyDuration });
      };
      filter.once('ready', handleReady);

      // 3. 统计【决策起点】与【字段热度】
      const handleDraftChange = ({ draft, prev }: any) => {
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
      };
      filter.on('draft:change', handleDraftChange);

      // 4. 统计【系统处理耗时起点】
      const handleApplyStart = () => {
        processingStartTime = performance.now();
      };
      filter.on('apply:start', handleApplyStart);

      // 5. 统计【决策终点】与【处理耗时终点】
      const handleApplySuccess = (
        event: { draft: TDraft; payload: ApplySuccessPayload<TDraft> } | ApplySuccessPayload<TDraft>
      ) => {
        const payload = 'payload' in event ? event.payload : event;

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
      };
      filter.on('apply:success', handleApplySuccess);

      // 6. 统计【校验摩擦力】: 记录哪些字段导致了校验失败
      const handleValidateFailed = ({ errors }: { errors: Array<{ address?: string }> }) => {
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
      };
      filter.on('validate:failed', handleValidateFailed);

      // 7. 重置逻辑
      const handleReset = () => {
        decisionStartTime = null;
        processingStartTime = null;
        interactionCount = 0;
        logDebug('用户重置了筛选器');
      };
      filter.on('reset', handleReset);

      // 标记监控插件就绪
      pluginManager.markReady(MONITOR_PLUGIN_NAME, true);
    }
  };
}