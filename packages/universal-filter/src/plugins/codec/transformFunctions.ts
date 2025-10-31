import type { TransformerConfig, TransformFunctions, TransformContext } from './types';
import { executeTransformer } from './utils';

/**
 * 导出 codec 转换函数创建器（供外部使用）
 * 这些函数可以在业务层手动调用，用于在 apply 前后转换数据
 */
export function createTransformFunctions(
  transformers: TransformerConfig[],
  options?: {
    onError?: 'throw' | 'skip' | 'fallback';
    fallbackValue?: unknown;
    debug?: boolean;
  }
): TransformFunctions {
  const {
    onError = 'skip',
    fallbackValue,
    debug = false,
  } = options || {};

  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[TransformFunctions] ${message}`, ...args);
    }
  };

  const executeTransformChain = async (
    data: unknown,
    direction: 'inbound' | 'outbound'
  ): Promise<unknown> => {
    let currentData: unknown = data;
    const context: TransformContext = { direction };

    for (const transformer of transformers) {
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

      if (skipped) {
        continue;
      }

      currentData = result;

      // 如果使用了 fallback，提前返回
      if (onError === 'fallback' && fallbackValue && result === fallbackValue) {
        return result;
      }
    }

    return currentData;
  };

  return {
    transformInbound: (data: unknown) => executeTransformChain(data, 'inbound'),
    transformOutbound: (data: unknown) => executeTransformChain(data, 'outbound'),
  };
}

