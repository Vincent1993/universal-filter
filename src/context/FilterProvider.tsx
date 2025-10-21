import { useContext, useEffect, useMemo } from 'react';
import { FormProvider } from '@formily/react';
import { ExpressionScope } from '@formily/react';
import { FilterContext, DEFAULT_NAMESPACE } from './context';
import { useConfigure } from './configure';
import type { FilterApi, FilterProviderProps } from '../core/types';

export function FilterProvider<TDraft>(props: FilterProviderProps<TDraft>): any {
  const { instance, namespace, children } = props;
  const configure = useConfigure<TDraft>();
  const parentMap = useContext(FilterContext);

  const map = useMemo(() => {
    const next = new Map(parentMap ?? undefined);
    const key = namespace ?? DEFAULT_NAMESPACE;
    next.set(key, instance as FilterApi<any>);
    return next;
  }, [instance, namespace, parentMap]);

  useEffect(() => {
    if (namespace) {
      configure.registry.set(namespace, instance as FilterApi<any>);
      return () => configure.registry.delete(namespace);
    }
    configure.registry.setDefault(instance as FilterApi<any>);
    return undefined;
  }, [configure.registry, instance, namespace]);

  return (
    <FormProvider form={instance.form as any}>
      <ExpressionScope value={{ $root: instance } as any}>
        <FilterContext.Provider value={map}>{children}</FilterContext.Provider>
      </ExpressionScope>
    </FormProvider>
  );
}
