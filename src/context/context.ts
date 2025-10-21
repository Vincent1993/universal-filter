import React, { createContext } from 'react';
import type { FilterApi } from '../core/types.js';

export const DEFAULT_NAMESPACE = '__default__';

export type FilterContextMap = Map<string, FilterApi<any>>;

export const FilterContext = createContext<FilterContextMap | null>(null);
