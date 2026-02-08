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
 * 创建 codec 转换插件
 *
 * 该插件用于在 Filter 的数据流入流出时进行数据格式转换，
 * 主要用于前后端数据模型的适配。
 *
 * 现在使用 tapable 的 AsyncSeriesWaterfallHook（filter.hooks.processSnapshot）
 * 来注册出站转换，替代了原来的自制 hook。
 *
 * @example
 * ```ts
 * const plugin = createCodecTransformPlugin({
 *   transformers: [
 *     {
 *       name: 'snake_case',
 *       transform: (data) => convertKeys(data, 'snake_case'),
 *       reverseTransform: (data) => convertKeys(data, 'camelCase'),
 *     },
 *   ],
 *   applyOn: 'both',
 * });
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
