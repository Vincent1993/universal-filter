/**
 * codec 转换插件
 *
 * 提供 codec 转换能力，支持同步/异步转换、多重转换链、错误处理等功能
 *
 * @example
 * ```ts
 * import { createCodecTransformPlugin } from '@dfx/universal-filter/plugins/codec';
 *
 * const plugin = createCodecTransformPlugin({
 *   transformers: [
 *     { name: 'transform1', transform: (d) => d },
 *   ],
 * });
 * ```
 */

// 导出主插件
export { createCodecTransformPlugin } from './plugin';

// 导出类型
export type {
  TransformState,
  TransformFn,
  TransformContext,
  TransformerConfig,
  CodecTransformPluginOptions,
  TransformFunctions,
} from './types';

// 导出辅助函数
export { createTransformFunctions } from './transformFunctions';
export {
  createKeyTransformTransformer,
  createFieldMappingTransformer,
} from './transformers';

// 导出工具函数（如果需要）
export { executeTransformer } from './utils';

