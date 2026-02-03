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
 * @example
 * ```ts
 * // 基础同步转换
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
 *
 * // 异步转换示例（带加载状态）
 * const asyncPlugin = createCodecTransformPlugin({
 *   transformers: [
 *     {
 *       name: 'async-fetch',
 *       transform: async (data) => {
 *         const extraData = await fetchExtraData(data.id);
 *         return { ...data, ...extraData };
 *       },
 *     },
 *   ],
 *   applyOn: 'init',
 *   onError: 'skip',
 *   enableTransformState: true,
 * });
 *
 * // 在组件中使用响应式状态（用于 UI 加载提示）
 * import { observer } from '@formily/reactive-react';
 *
 * const MyComponent = observer(() => {
 *   const codecInfo = filter.plugin.get('codec-plugin');
 *   const transformState = codecInfo?.state.transformState as TransformState;
 *   if (transformState?.isTransforming) {
 *     return <Loading message={`正在转换 ${transformState.currentTransformer || '数据'}`} />;
 *   }
 *   return <Form />;
 * });
 *
 * // 手动调用转换函数
 * const codecInfo = filter.plugin.get('codec-plugin');
 * if (codecInfo) {
 *   const { transformInbound, transformOutbound } = codecInfo.state as CodecPluginApi;
 *   const encoded = await transformOutbound(myData);
 * }
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

  // 存储清理函数
  let unregisterPostApply: (() => void) | undefined;

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
        if (
          (applyOn === 'apply' || applyOn === 'both') &&
          runtime.hasTransformers()
        ) {
          unregisterPostApply = filter.hooks.processSnapshot.tapPromise(
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
      // 清理 post-apply 转换器
      if (unregisterPostApply) {
        unregisterPostApply();
        unregisterPostApply = undefined;
      }
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