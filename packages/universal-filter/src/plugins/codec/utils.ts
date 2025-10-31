import type { TransformerConfig, TransformContext } from './types';

/**
 * 执行单个转换器的核心逻辑
 */
export async function executeTransformer(
  transformer: TransformerConfig,
  data: unknown,
  context: TransformContext,
  options: {
    onError: 'throw' | 'skip' | 'fallback';
    fallbackValue?: unknown;
    debug: boolean;
    log: (message: string, ...args: unknown[]) => void;
  }
): Promise<{ result: unknown; skipped: boolean }> {
  const { name, transform, reverseTransform, condition, direction: transformerDirection } = transformer;
  const { direction } = context;

  // 检查转换方向（提前退出，避免后续检查）
  if (transformerDirection && transformerDirection !== 'both' && transformerDirection !== direction) {
    if (options.debug) {
      options.log(`跳过转换器 ${name || 'unnamed'}（方向不匹配）`);
    }
    return { result: data, skipped: true };
  }

  // 检查转换条件（支持异步）
  if (condition) {
    try {
      const conditionResult = await condition(data, context);
      if (!conditionResult) {
        if (options.debug) {
          options.log(`跳过转换器 ${name || 'unnamed'}（条件不满足）`);
        }
        return { result: data, skipped: true };
      }
    } catch (error) {
      // 条件函数抛出异常时的处理
      if (options.debug) {
        options.log(`转换器 ${name || 'unnamed'} 条件检查失败:`, error);
      }

      if (options.onError === 'throw') {
        throw new Error(
          `codec 转换条件检查失败 [${name || 'unnamed'}] (${direction}): ${error instanceof Error ? error.message : String(error)}`
        );
      } else if (options.onError === 'fallback' && options.fallbackValue) {
        if (options.debug) {
          options.log(`使用回退值`);
        }
        return { result: options.fallbackValue, skipped: false };
      }
      // 'skip' 策略：跳过转换器
      return { result: data, skipped: true };
    }
  }

  // 选择转换函数
  const transformFn = direction === 'inbound' ? transform : reverseTransform || transform;

  if (!transformFn) {
    if (options.debug) {
      options.log(`警告：转换器 ${name || 'unnamed'} 缺少 ${direction} 方向的转换函数`);
    }
    return { result: data, skipped: true };
  }

  try {
    if (options.debug) {
      options.log(`应用转换器 ${name || 'unnamed'} (${direction})`);
    }
    const result = await transformFn(data, context);
    return { result, skipped: false };
  } catch (error) {
    if (options.debug) {
      options.log(`转换器 ${name || 'unnamed'} 执行失败:`, error);
    }

    if (options.onError === 'throw') {
      throw new Error(
        `codec 转换失败 [${name || 'unnamed'}] (${direction}): ${error instanceof Error ? error.message : String(error)}`
      );
    } else if (options.onError === 'fallback' && options.fallbackValue) {
      if (options.debug) {
        options.log(`使用回退值`);
      }
      return { result: options.fallbackValue, skipped: false };
    }
    // 'skip' 策略：继续使用原始数据
    return { result: data, skipped: false };
  }
}

