/**
 * codec 转换插件
 *
 * 提供数据编解码能力，用于前后端数据模型的适配。
 * 支持同步/异步转换、多重转换链、错误处理、状态追踪等功能。
 *
 * @example
 * ```ts
 * import {
 *   createCodecTransformPlugin,
 *   CODEC_PLUGIN_NAME,
 * } from '@dfx/universal-filter/plugins/codec';
 *
 * // 创建插件
 * const plugin = createCodecTransformPlugin({
 *   transformers: [
 *     { name: 'transform1', transform: (d) => d },
 *   ],
 * });
 *
 * // 获取插件状态
 * const codecInfo = filter.plugin.get(CODEC_PLUGIN_NAME);
 * const { transformState, transformInbound, transformOutbound } = codecInfo?.state;
 * ```
 */

// 导出主插件和辅助转换器
export {
  createCodecTransformPlugin,
  getCodecTransformState,
  getCodecTransformFunctions,
  CODEC_PLUGIN_NAME,
} from './plugin';

// 导出 Runtime 和独立转换函数
export {
  CodecRuntime,
  createCodecRuntime,
  createTransformFunctions,
} from './runtime';

// 导出类型
export type {
  TransformState,
  TransformFn,
  TransformContext,
  TransformerConfig,
  CodecTransformPluginOptions,
  TransformFunctions,
  CodecRuntimeOptions,
  CodecPluginApi,
} from './types';
