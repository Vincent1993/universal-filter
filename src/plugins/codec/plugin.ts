import type { Draft, Plugin } from '../../core/types';
import type {
  CodecTransformPluginOptions,
  TransformState,
  CodecPluginApi,
} from './types';
import { CodecRuntime } from './runtime';

/**
 * Codec 插件名称常量
 */
export const CODEC_PLUGIN_NAME = 'codec-plugin';

/**
 * 创建 Codec 转换插件
 *
 * 在 Filter 的数据流入/流出时执行数据格式转换，典型场景：
 * - 前后端字段命名风格转换（camelCase ↔ snake_case）
 * - 数据结构扁平化/嵌套化
 * - 枚举值映射
 * - 异步数据补全（如 ID → Name 查询）
 *
 * ## 数据流方向
 *
 * | 方向 | 使用函数 | 触发时机 | 说明 |
 * |------|---------|---------|------|
 * | Inbound（入站） | `transform` | 初始化时 | 外部数据 → 表单内部格式 |
 * | Outbound（出站） | `reverseTransform` | apply 时 | 表单内部格式 → 外部数据 |
 *
 * ## 出站转换原理
 *
 * 使用 tapable 的 `AsyncSeriesWaterfallHook`（`filter.hooks.processSnapshot`）
 * 注册出站转换。apply 成功后，snapshot 依次经过所有转换器的 `reverseTransform`，
 * 最终结果存入 `filter.applied`。`filter.draft` 始终保持内部格式不变。
 *
 * @param options - 插件配置
 * @returns Plugin 对象
 *
 * @example
 * ```ts
 * // camelCase ↔ snake_case 双向转换
 * createFilter({
 *   defaultValues: { userName: 'John', userAge: 30 },
 *   plugins: [
 *     createCodecTransformPlugin({
 *       transformers: [{
 *         name: 'snake_case',
 *         // inbound: snake_case → camelCase（外部数据加载时）
 *         transform: (data) => mapKeys(data, camelCase),
 *         // outbound: camelCase → snake_case（apply 提交时）
 *         reverseTransform: (data) => mapKeys(data, snakeCase),
 *       }],
 *       applyOn: 'both',
 *     }),
 *   ],
 * });
 *
 * // apply 后：
 * // filter.draft      → { userName: 'John', userAge: 30 }   (内部格式)
 * // filter.applied     → { user_name: 'John', user_age: 30 } (外部格式)
 * // filter.lastApplied → { userName: 'John', userAge: 30 }   (未转换)
 * ```
 */
export function createCodecTransformPlugin<TDraft extends Draft = Draft>(
  options: CodecTransformPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const {
    transformers = [],
    applyOn = 'both',
    onError = 'throw',
    fallbackValue,
    debug = false,
    enableTransformState = true,
  } = options;

  // 创建 runtime 实例
  const runtime = new CodecRuntime<TDraft>({
    transformers,
    onError,
    fallbackValue,
    debug,
    enableTransformState,
    pluginName: CODEC_PLUGIN_NAME,
  });

  // 日志函数
  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[CodecTransformPlugin] ${message}`, ...args);
    }
  };

  return {
    name: CODEC_PLUGIN_NAME,

    async onInit({ filter, pluginManager }) {
      try {
        // 绑定 PluginManager 到 runtime
        runtime.bindPluginManager(pluginManager);

        // 初始化转换状态
        runtime.initializeState();

        // 将转换函数暴露到插件状态中，供外部调用
        pluginManager.setState<CodecPluginApi>(CODEC_PLUGIN_NAME, (prev) => ({
          ...prev,
          transformInbound: <T = unknown>(data: T) => runtime.runInbound(data),
          transformOutbound: <T = unknown>(data: T) => runtime.runOutbound(data),
        }));

        // 如果需要初始化时转换，处理初始值
        if (
          (applyOn === 'init' || applyOn === 'both') &&
          runtime.hasTransformers()
        ) {
          const currentValues = filter.draft;
          if (currentValues && Object.keys(currentValues).length > 0) {
            log('转换初始值');
            const transformed = await runtime.runInbound(currentValues);
            filter.setValues(transformed as Partial<TDraft>, 'overwrite');
            filter.setInitialValues(transformed as Partial<TDraft>, 'overwrite');
          }
        }

        // 如果需要应用时转换，注册 hook
        // 使用 tapable 的 AsyncSeriesWaterfallHook（filter.hooks.processSnapshot）
        if (
          (applyOn === 'apply' || applyOn === 'both') &&
          runtime.hasTransformers()
        ) {
          filter.hooks.processSnapshot.tapPromise(
            `${CODEC_PLUGIN_NAME}-outbound`,
            async (applied, _draft) => {
              log('执行出站转换');
              try {
                const transformed = await runtime.runOutbound(applied);
                log('出站转换完成', transformed);
                return transformed;
              } catch (error) {
                log('出站转换失败:', error);
                if (onError === 'throw') {
                  throw error;
                }
                // skip 和 fallback 策略：返回原始 applied 值
                return applied;
              }
            }
          );
        }

        // 标记插件就绪
        pluginManager.markReady(CODEC_PLUGIN_NAME, true);
      } catch (error) {
        log('插件初始化失败:', error);
        // 标记插件未就绪
        pluginManager.markReady(CODEC_PLUGIN_NAME, false, error);
        throw error;
      }
    },

    onDestroy() {
      // tapable hooks 不需要手动取消注册
      // 当 filter 被销毁时，hooks 实例会随之释放
    },
  };
}

/**
 * 获取 codec 插件的转换状态
 * @param pluginManager - PluginManager 实例
 * @returns 转换状态，如果插件不存在则返回 undefined
 */
export function getCodecTransformState<TDraft extends Draft = Draft>(
  pluginManager: { get: (name: string) => { state: unknown } | undefined }
): TransformState | undefined {
  const codecInfo = pluginManager.get(CODEC_PLUGIN_NAME);
  if (!codecInfo) {
    return undefined;
  }
  return (codecInfo.state as CodecPluginApi)?.transformState;
}

/**
 * 获取 codec 插件的转换函数
 * @param pluginManager - PluginManager 实例
 * @returns 转换函数对象，如果插件不存在则返回 undefined
 */
export function getCodecTransformFunctions<TDraft extends Draft = Draft>(
  pluginManager: { get: (name: string) => { state: unknown } | undefined }
): Pick<CodecPluginApi, 'transformInbound' | 'transformOutbound'> | undefined {
  const codecInfo = pluginManager.get(CODEC_PLUGIN_NAME);
  if (!codecInfo) {
    return undefined;
  }
  const state = codecInfo.state as CodecPluginApi;
  if (!state?.transformInbound || !state?.transformOutbound) {
    return undefined;
  }
  return {
    transformInbound: state.transformInbound,
    transformOutbound: state.transformOutbound,
  };
}
