import { FilterController } from './controller';
import type { Draft, FilterApi, FilterOptions } from './types';

export function createFilter<TDraft extends Draft = Draft>(options: FilterOptions<TDraft> = {}): FilterApi<TDraft> {
  return new FilterController<TDraft>(options) as unknown as FilterApi<TDraft>;
}
