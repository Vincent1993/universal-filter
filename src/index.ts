// Core API - Framework independent
export * from './core/index';

// React Hooks
export { useField, useOptions, useFilter } from './hooks/index';

// React Context & Providers
export { FilterProvider, FilterConfigure, useConfigure, getGlobalConfigure } from './context/index';
export type { FilterContextMap } from './context/index';

// Adapters
export * from './adapters/memoryAdapter';

// Plugins
export * from './plugins/historyPlugin';
export * from './plugins/presetPlugin';
export * from './plugins/urlSyncPlugin';
