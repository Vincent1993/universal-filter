import { useContext } from 'react';
import { DynamicFilterContext } from '../provider/context';
import type { ISchema } from '@formily/json-schema';

/**
 * 获取组装后的完整 Schema
 *
 * @returns 完整组装后的 Schema (来自 Provider)
 */
export function useAssembledSchema(): ISchema | undefined {
  const context = useContext(DynamicFilterContext);

  if (!context) {
    throw new Error(
      '[Dynamic Filter] useAssembledSchema must be used within DynamicFilterProvider'
    );
  }

  return context.assembledSchema;
}

