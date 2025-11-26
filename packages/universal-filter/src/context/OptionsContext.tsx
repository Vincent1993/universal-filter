import type { OptionsRuntimeConfig, RequestClient } from '../core/option-source';
import { useConfigure } from './Provider';

/**
 * 获取当前的 Options 运行时配置
 */
export function useOptionsContext(): OptionsRuntimeConfig | null {
  const configure = useConfigure<Record<string, unknown>>();
  return (configure.options ?? null) as OptionsRuntimeConfig | null;
}

/**
 * useRequestClient - 获取请求客户端的 Hook
 *
 * @param clientName - 可选的命名客户端
 * @returns RequestClient | null
 */
export function useRequestClient(clientName?: string): RequestClient | null {
  const context = useOptionsContext();

  if (!context) return null;

  if (clientName && context.clientRegistry?.[clientName]) {
    return context.clientRegistry[clientName];
  }

  return context.requestClient;
}
