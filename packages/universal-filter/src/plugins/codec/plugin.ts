import type { Draft, Plugin } from '../../core/types';
import type { PluginManager } from '../../core/managers/PluginManager';
import { cloneDeep } from 'es-toolkit';
import type {
  CodecTransformPluginOptions,
  TransformState,
  TransformContext,
} from './types';
import { executeTransformer } from './utils';

/**
 * 创建 codec 转换插件
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
 *         // 模拟从 API 获取额外数据
 *         const extraData = await fetchExtraData(data.id);
 *         return { ...data, ...extraData };
 *       },
 *     },
 *   ],
 *   applyOn: 'init',
 *   onError: 'skip',
 *   enableTransformState: true, // 启用转换状态事件（默认 true）
 * });
 *
 * // 在组件中使用响应式状态（用于 UI 加载提示）
 * import { observer } from '@formily/reactive-react';
 *
 * const MyComponent = observer(() => {
 *   const transformState = filter.plugin.get('codec-plugin')?.transformState as TransformState;
 *   if (transformState?.isTransforming) {
 *     return <Loading message={`正在转换 ${transformState.currentTransformer || '数据'}`} />;
 *   }
 *   return <Form />;
 * });
 *
 * // 多重转换链（混合同步和异步）
 * const chainPlugin = createCodecTransformPlugin({
 *   transformers: [
 *     { name: 'step1', transform: (d) => ({ ...d, step1: true }) },
 *     { name: 'step2', transform: async (d) => {
 *       await delay(10);
 *       return { ...d, step2: true };
 *     }},
 *     { name: 'step3', transform: (d) => ({ ...d, step3: true }) },
 *   ],
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

  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[CodecTransformPlugin] ${message}`, ...args);
    }
  };

  /**
   * 更新转换状态（响应式）
   */
  const updateTransformState = (
    pluginManager: PluginManager<TDraft>,
    pluginName: string,
    updates: Partial<TransformState>
  ) => {
    if (enableTransformState) {
      pluginManager.setState<{ transformState: TransformState }>(pluginName, (prev) => ({
        transformState: {
          isTransforming: false,
          ...prev?.transformState,
          ...updates,
        },
      }));
    }
  };

  /**
   * 执行转换链（内部函数）
   */
  const executeTransformChainInternal = async <T = unknown>(
    data: T,
    direction: 'inbound' | 'outbound',
    path: string | undefined,
    pluginManager: PluginManager<TDraft> | undefined,
    pluginName: string
  ): Promise<T> => {
    let currentData: unknown = data;
    const context: TransformContext = { direction, path };
    const totalTransformers = transformers.length;

    // 更新转换开始状态
    if (pluginManager && enableTransformState) {
      updateTransformState(pluginManager, pluginName, {
        isTransforming: true,
        direction,
        currentTransformer: undefined,
        progress: 0,
      });
    }

    try {
      for (let i = 0; i < transformers.length; i++) {
        const transformer = transformers[i];

        // 更新当前转换器状态
        if (pluginManager && enableTransformState && transformer.name) {
          updateTransformState(pluginManager, pluginName, {
            currentTransformer: transformer.name,
            progress: i / totalTransformers,
          });
        }

        const { result, skipped } = await executeTransformer(
          transformer,
          currentData,
          context,
          {
            onError,
            fallbackValue,
            debug,
            log,
          }
        );

        currentData = result;

        // 如果使用了 fallback，提前返回
        if (onError === 'fallback' && fallbackValue && result === fallbackValue) {
          if (pluginManager && enableTransformState) {
            updateTransformState(pluginManager, pluginName, {
              isTransforming: false,
              currentTransformer: undefined,
              progress: 1,
            });
          }
          return result as T;
        }
      }

      return currentData as T;
    } finally {
      // 更新转换完成状态
      if (pluginManager && enableTransformState) {
        updateTransformState(pluginManager, pluginName, {
          isTransforming: false,
          currentTransformer: undefined,
          progress: 1,
        });
      }
    }
  };

  // 存储事件监听器的清理函数
  let unsubscribeApplySuccess: (() => void) | undefined;

  const pluginName = 'codec-plugin';

  return {
    name: pluginName,
    async onInit({ filter, pluginManager }) {
      try {
        // 初始化转换状态
        if (enableTransformState) {
          pluginManager.setState<{ transformState: TransformState }>(pluginName, {
            transformState: {
              isTransforming: false,
            },
          });
        }

        // 如果需要初始化时转换，处理初始值
        if (applyOn === 'init' || applyOn === 'both') {
          const currentValues = filter.draft;
          if (currentValues && Object.keys(currentValues).length > 0) {
            log('转换初始值');
            const transformed = await executeTransformChainInternal(
              currentValues,
              'inbound',
              undefined,
              pluginManager,
              pluginName
            );
            filter.setValues(transformed as Partial<TDraft>, 'overwrite');
            filter.setInitialValues(transformed as Partial<TDraft>, 'overwrite');
          }
        }

        // 如果需要应用时转换，在 apply:success 时转换 applied 数据
        // draft 保持原始格式，applied 是转换后的数据
        if (applyOn === 'apply' || applyOn === 'both') {
          const handler = async ({ draft }: { draft: TDraft }) => {
            try {
              log('检测到 apply:success，转换 applied 数据');
              // 转换 draft 数据（保持 draft 原始格式，只转换 applied）
              const transformedDraft = await executeTransformChainInternal(
                draft,
                'outbound',
                undefined,
                pluginManager,
                pluginName
              );

              // 更新 applied 为转换后的数据
              // applied 是 public 属性，可以直接设置
              filter.applied = cloneDeep(transformedDraft) as TDraft;

              if (debug) {
                log('转换完成，applied 已更新为转换后的数据:', filter.applied);
              }
            } catch (error) {
              if (debug) {
                log('转换 applied 数据失败:', error);
              }
              if (onError === 'throw') {
                throw error;
              }
              // skip 和 fallback 策略：保持原始 applied 值
            }
          };

          filter.on('apply:success', handler);
          unsubscribeApplySuccess = () => {
            filter.off('apply:success', handler);
          };
        }

        // 标记插件就绪
        pluginManager.markReady(pluginName, true);
      } catch (error) {
        log('插件初始化失败:', error);
        // 标记插件未就绪
        pluginManager.markReady(pluginName, false, error);
        throw error;
      }
    },
    onDestroy() {
      // 清理事件监听器
      if (unsubscribeApplySuccess) {
        unsubscribeApplySuccess();
        unsubscribeApplySuccess = undefined;
      }
    },
  };
}

