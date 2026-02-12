/**
 * Copilot Plugin — 智能推荐引擎插件
 *
 * 将 filter-copilot 推荐引擎整合到 universal-filter 插件体系：
 *
 * 1. 监听 apply:success 自动记录行为（key + 值 双维度）
 * 2. 通过 pluginManager.setState 暴露推荐 API
 * 3. 支持 localStorage 持久化 + 冷启动
 * 4. 与现有 OptionItem 类型兼容
 */

import type { Draft, Plugin, PluginInitContext } from '../../core/types';
import type { CopilotPluginOptions, CopilotPluginApi, FilterSelection } from './types';

// 直接导入 filter-copilot 核心模块（避免循环依赖）
import { BehaviorStore } from '../../../filter-copilot/src/core/BehaviorStore';
import { RuleEngine } from '../../../filter-copilot/src/core/RuleEngine';
import { Recommender } from '../../../filter-copilot/src/core/Recommender';
import type { FilterDefs } from '../../../filter-copilot/src/types/Filter';
import { getStorageKey, readStorage, writeStorage, removeStorage } from '../../../filter-copilot/src/utils/storage';

export const COPILOT_PLUGIN_NAME = 'copilot-plugin';

/**
 * 从 applied 数据中提取 FilterSelection[]
 * 跳过 undefined/null/空字符串/空数组
 */
function extractSelections(
  applied: Record<string, unknown>,
  trackFields?: string[],
): FilterSelection[] {
  const selections: FilterSelection[] = [];
  const keys = trackFields ?? Object.keys(applied);

  for (const key of keys) {
    const value = applied[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;

    if (typeof value === 'string') {
      selections.push({ key, value });
    } else if (typeof value === 'number') {
      selections.push({ key, value: String(value) });
    } else if (Array.isArray(value)) {
      const stringValues = value
        .filter((v) => v !== undefined && v !== null && v !== '')
        .map((v) => String(v));
      if (stringValues.length > 0) {
        selections.push({ key, value: stringValues });
      }
    }
    // 对象类型等复杂值不记录
  }

  return selections;
}

/**
 * 自动从 applied 数据推断 FilterDefs
 * 每个有值的字段变成一个无依赖约束的 FilterDef
 */
function inferFilterDefs(applied: Record<string, unknown>): FilterDefs {
  const defs: FilterDefs = {};
  for (const key of Object.keys(applied)) {
    defs[key] = { label: key };
  }
  return defs;
}

/**
 * 创建 Copilot 推荐插件
 *
 * @example
 * ```ts
 * const filter = createFilter({
 *   plugins: [
 *     createCopilotPlugin({
 *       userId: 'user-123',
 *       persist: true,
 *       coldStart: globalSeedData,
 *     }),
 *   ],
 * });
 *
 * // 获取推荐 API
 * const copilot = filter.plugin.getState<CopilotPluginApi>('copilot-plugin');
 * const suggestions = copilot.recommend([{ key: 'category', value: '手机' }]);
 *
 * // 对下拉列表选项排序
 * const sortedBrands = copilot.sortOptions('brand',
 *   [{ key: 'category', value: '手机' }],
 *   brandOptionItems
 * );
 * ```
 */
export function createCopilotPlugin<TDraft extends Draft = Draft>(
  options: CopilotPluginOptions,
): Plugin<TDraft> {
  const {
    userId,
    persist = true,
    coldStart,
    autoRecord = true,
    trackFields,
    filterDefs: userFilterDefs,
  } = options;

  // 核心模块（延迟初始化——需要第一次 apply 后才能推断 filterDefs）
  let behaviorStore: BehaviorStore;
  let recommender: Recommender | null = null;
  let ruleEngine: RuleEngine | null = null;
  let currentFilterDefs: FilterDefs = userFilterDefs ?? {};

  // 存储 key
  const storageKey = getStorageKey(`copilot:${userId}`);

  /**
   * 确保推荐引擎已初始化
   * 如果用户没有提供 filterDefs，则在第一次 apply 后从 applied 数据推断
   */
  function ensureEngine(applied?: Record<string, unknown>): void {
    if (recommender) return;

    // 如果没有 filterDefs 且有 applied 数据，自动推断
    if (Object.keys(currentFilterDefs).length === 0 && applied) {
      currentFilterDefs = inferFilterDefs(applied);
    }

    // 如果还是没有，创建空的
    ruleEngine = new RuleEngine(currentFilterDefs);
    recommender = new Recommender(currentFilterDefs, behaviorStore, ruleEngine);
  }

  /**
   * 持久化保存
   */
  function persistSave(): void {
    if (!persist) return;
    try {
      writeStorage(storageKey, behaviorStore.export());
    } catch {
      // 静默失败
    }
  }

  // 构建对外 API
  function buildApi(): CopilotPluginApi {
    return {
      recommend(context, opts) {
        ensureEngine();
        if (!recommender) return [];
        try {
          return recommender.recommend(context, opts);
        } catch {
          return [];
        }
      },

      recommendValues(targetKey, context, allValues, opts) {
        ensureEngine();
        if (!recommender) return [];
        try {
          return recommender.recommendValues(targetKey, context, allValues, opts);
        } catch {
          return [];
        }
      },

      sortOptions(targetKey, context, options) {
        ensureEngine();
        if (!recommender || !options || options.length === 0) {
          return options.map((o) => ({ ...o, score: 0, reason: undefined }));
        }

        try {
          const allValues = options.map((o) => String(o.value));
          const scores = recommender.recommendValues(targetKey, context, allValues);
          const scoreMap = new Map<string, { score: number; reason?: string }>();
          for (const s of scores) {
            scoreMap.set(s.value, { score: s.score, reason: s.reason });
          }

          const result = options.map((o) => {
            const rec = scoreMap.get(String(o.value));
            return { ...o, score: rec?.score ?? 0, reason: rec?.reason };
          });

          result.sort((a, b) => b.score - a.score);
          return result;
        } catch {
          return options.map((o) => ({ ...o, score: 0, reason: undefined }));
        }
      },

      record(action) {
        try {
          if (action.selections && action.selections.length > 0) {
            behaviorStore.recordSelections(action.selections);
          } else if (action.sequence && action.sequence.length > 0) {
            behaviorStore.record(action.sequence);
          }
          persistSave();
        } catch {
          // 不抛异常
        }
      },

      exportData() {
        return behaviorStore.export();
      },

      importData(data, merge = false) {
        behaviorStore.import(data, merge);
        persistSave();
      },

      resetData() {
        behaviorStore.clear();
        if (persist) {
          try {
            removeStorage(storageKey);
          } catch {}
        }
      },
    };
  }

  return {
    name: COPILOT_PLUGIN_NAME,

    onInit({ filter, pluginManager }: PluginInitContext<TDraft>) {
      // 1. 初始化 BehaviorStore
      behaviorStore = new BehaviorStore();

      // 2. 恢复持久化数据
      if (persist) {
        try {
          const saved = readStorage(storageKey);
          if (saved) {
            behaviorStore.import(saved);
          }
        } catch {}
      }

      // 3. 注入冷启动数据（仅在无持久化数据时）
      if (coldStart && behaviorStore.size() === 0) {
        behaviorStore.import(coldStart);
      }

      // 4. 如果用户提供了 filterDefs，立即初始化引擎
      if (userFilterDefs && Object.keys(userFilterDefs).length > 0) {
        ensureEngine();
      }

      // 5. 暴露 API 到插件状态
      const api = buildApi();
      pluginManager.setState<CopilotPluginApi>(COPILOT_PLUGIN_NAME, api);

      // 6. 监听 apply:success 自动记录
      if (autoRecord) {
        filter.on('apply:success', ({ payload }) => {
          const applied = payload.applied as Record<string, unknown>;
          if (!applied || typeof applied !== 'object') return;

          // 确保引擎存在（可能是第一次 apply）
          ensureEngine(applied);

          // 提取 selections
          const selections = extractSelections(applied, trackFields);
          if (selections.length === 0) return;

          // 记录行为
          behaviorStore.recordSelections(selections);
          persistSave();

          // 更新 API（filterDefs 可能在首次 apply 后才推断出来）
          pluginManager.setState<CopilotPluginApi>(COPILOT_PLUGIN_NAME, buildApi());
        });
      }

      // 7. 标记就绪
      pluginManager.markReady(COPILOT_PLUGIN_NAME, true);
    },

    onDestroy() {
      // 最终一次持久化
      if (persist && behaviorStore) {
        persistSave();
      }
    },
  };
}
