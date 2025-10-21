import { useContext } from 'react';
import { FilterContext, DEFAULT_NAMESPACE } from '../context/context';
import { ERROR_CODES, FilterError } from '../core/errors';
import { useConfigure } from '../context/configure';
import type { FilterApi, UseFilterInput } from '../core/types';

export function useFilter<TDraft>(input?: UseFilterInput<TDraft>): FilterApi<TDraft> {
  if (input?.instance) {
    return input.instance;
  }

  const contextMap = useContext(FilterContext);
  const configure = useConfigure<TDraft>();

  if (input?.namespace) {
    const key = input.namespace;
    const fromContext = contextMap?.get(key) as FilterApi<TDraft> | undefined;
    if (fromContext) {
      return fromContext;
    }
    const fromRegistry = configure.registry.get(key) as FilterApi<TDraft> | undefined;
    if (fromRegistry) {
      return fromRegistry;
    }
    throw new FilterError(ERROR_CODES.NAMESPACE_NOT_FOUND, `Namespace "${key}" is not registered`);
  }

  const defaultContext = contextMap?.get(DEFAULT_NAMESPACE) as FilterApi<TDraft> | undefined;
  if (defaultContext) {
    return defaultContext;
  }

  const defaultRegistry = configure.registry.getDefault() as FilterApi<TDraft> | undefined;
  if (defaultRegistry) {
    return defaultRegistry;
  }

  throw new FilterError(ERROR_CODES.NO_FILTER_CONTEXT, 'No filter instance available in context');
}
