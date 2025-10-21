// Core API - Framework independent
export * from './core/index.js';

// React Hooks
export { useField, useOptions } from './hooks/index.js';

// React Context & Providers
export { FilterProvider, useFilter, FilterConfigure, useConfigure, getGlobalConfigure } from './context/index.js';
export type { FilterContextMap } from './context/index.js';

// Adapters
export * from './adapters/memoryAdapter.js';

// Plugins
export * from './plugins/historyPlugin.js';
export * from './plugins/presetPlugin.js';
export * from './plugins/urlSyncPlugin.js';
