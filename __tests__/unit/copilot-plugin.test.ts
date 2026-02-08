import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import { createCopilotPlugin, COPILOT_PLUGIN_NAME } from '../../src/plugins/copilot/plugin';
import type { CopilotPluginApi } from '../../src/plugins/copilot/types';
import type { BehaviorData } from '../../../filter-copilot/src/core/BehaviorStore';

// 定义筛选器草稿类型
interface TestDraft {
  category?: string;
  brand?: string;
  price?: string;
  color?: string;
  tags?: string[];
}

// 筛选器定义（带依赖关系）
const filterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] as string[] },
  price: { label: '价格' },
  color: { label: '颜色' },
};

// 冷启动种子数据
const coldStartData: BehaviorData = {
  transitions: { category: { brand: 10, price: 5 } },
  frequency: { category: 20, brand: 15, price: 10, color: 5 },
  contextTransitions: {},
  valuePairs: {},
  valueFrequency: {
    brand: { Apple: 10, Samsung: 5, Huawei: 2 },
  },
};

describe('CopilotPlugin', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  // ──────── 插件注册与初始化 ────────

  describe('注册与初始化', () => {
    it('应正确注册并标记就绪', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'u1', filterDefs }),
        ],
      });

      expect(filter.plugin.has(COPILOT_PLUGIN_NAME)).toBe(true);
      expect(filter.plugin.isReady(COPILOT_PLUGIN_NAME)).toBe(true);

      filter.dispose();
    });

    it('getState 应返回完整 API', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'u1', filterDefs }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME);
      expect(typeof api?.recommend).toBe('function');
      expect(typeof api?.recommendValues).toBe('function');
      expect(typeof api?.sortOptions).toBe('function');
      expect(typeof api?.record).toBe('function');
      expect(typeof api?.exportData).toBe('function');
      expect(typeof api?.importData).toBe('function');
      expect(typeof api?.resetData).toBe('function');

      filter.dispose();
    });
  });

  // ──────── 冷启动 ────────

  describe('冷启动', () => {
    it('冷启动数据应驱动初始推荐', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'cold', filterDefs, coldStart: coldStartData }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      const suggestions = api.recommend([]);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].key).toBe('category'); // 频率最高

      filter.dispose();
    });

    it('coldStart + recommendValues 应返回值排序', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'cold', filterDefs, coldStart: coldStartData }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      const values = api.recommendValues('brand', [], ['Apple', 'Samsung', 'Huawei', 'Xiaomi']);
      expect(values[0].value).toBe('Apple');
      expect(values.length).toBe(4);

      filter.dispose();
    });
  });

  // ──────── 手动记录 ────────

  describe('手动记录', () => {
    it('record 后推荐应有变化', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'u1', filterDefs }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;

      // 初始：全 0 分
      const before = api.recommend([]);
      expect(before.every((s) => s.score === 0)).toBe(true);

      // 记录行为
      api.record({
        sequence: ['category', 'brand'],
        selections: [
          { key: 'category', value: '手机' },
          { key: 'brand', value: 'Apple' },
        ],
      });

      // 推荐应有变化
      const after = api.recommend([]);
      expect(after.some((s) => s.score > 0)).toBe(true);

      filter.dispose();
    });
  });

  // ──────── sortOptions（与现有 OptionItem 兼容）────────

  describe('sortOptions', () => {
    it('应对 OptionItem 列表按推荐分排序', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'u1', filterDefs, coldStart: coldStartData }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;

      // 模拟 useOptions 返回的 OptionItem[]
      const brands = [
        { label: '华为', value: 'Huawei' },
        { label: '三星', value: 'Samsung' },
        { label: '苹果', value: 'Apple' },
        { label: '小米', value: 'Xiaomi' },
      ];

      const sorted = api.sortOptions('brand', [], brands);

      // Apple 应排第一（冷启动频率最高）
      expect(sorted[0].value).toBe('Apple');
      expect(sorted[0].score).toBeGreaterThan(0);
      // 原始字段应保留
      expect(sorted[0].label).toBe('苹果');
      // 所有选项应保留
      expect(sorted.length).toBe(4);

      filter.dispose();
    });

    it('应兼容 number 类型的 value', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'u1', filterDefs, coldStart: coldStartData }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;

      const options = [
        { label: 'Option 1', value: 1 },
        { label: 'Option 2', value: 2 },
      ];

      // 不应报错
      const sorted = api.sortOptions('price', [], options);
      expect(sorted.length).toBe(2);

      filter.dispose();
    });
  });

  // ──────── 持久化 ────────

  describe('持久化', () => {
    it('persist=true 时应写入 localStorage', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'persist-u', filterDefs, persist: true }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      api.record({ sequence: ['category', 'brand'] });

      const key = 'filter-copilot:copilot:persist-u';
      expect(localStorage.getItem(key)).not.toBeNull();

      filter.dispose();
    });

    it('新实例应恢复持久化数据', () => {
      // 第一个实例
      const filter1 = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'persist-u', filterDefs, persist: true }),
        ],
      });
      const api1 = filter1.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      api1.record({
        sequence: ['category', 'brand'],
        selections: [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' }],
      });
      filter1.dispose();

      // 第二个实例
      const filter2 = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'persist-u', filterDefs, persist: true }),
        ],
      });
      const api2 = filter2.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      const suggestions = api2.recommend([{ key: 'category', value: '手机' }]);
      expect(suggestions.some((s) => s.score > 0)).toBe(true);

      filter2.dispose();
    });

    it('resetData 应清空 localStorage', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'reset-u', filterDefs, persist: true }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      api.record({ sequence: ['category'] });

      const key = 'filter-copilot:copilot:reset-u';
      expect(localStorage.getItem(key)).not.toBeNull();

      api.resetData();
      expect(localStorage.getItem(key)).toBeNull();

      filter.dispose();
    });
  });

  // ──────── 自动记录（apply:success）────────

  describe('自动记录', () => {
    it('apply 后应自动记录行为', async () => {
      const filter = createFilter<TestDraft>({
        defaultValues: { category: '', brand: '' },
        plugins: [
          createCopilotPlugin({ userId: 'auto-u', persist: false }),
        ],
      });

      // 模拟用户操作
      filter.setValue('category', '手机');
      filter.setValue('brand', 'Apple');

      // 触发 onMount（模拟 React 挂载）
      filter.form.onMount();
      await filter.apply();

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      const data = api.exportData();

      // 应有记录
      expect(data.frequency.category).toBeGreaterThan(0);
      expect(data.frequency.brand).toBeGreaterThan(0);

      // 值频率也应有记录
      expect(data.valueFrequency?.category?.['手机']).toBeGreaterThan(0);
      expect(data.valueFrequency?.brand?.Apple).toBeGreaterThan(0);

      filter.dispose();
    });

    it('autoRecord=false 时不应自动记录', async () => {
      const filter = createFilter<TestDraft>({
        defaultValues: { category: '' },
        plugins: [
          createCopilotPlugin({ userId: 'no-auto', persist: false, autoRecord: false }),
        ],
      });

      filter.setValue('category', '手机');
      filter.form.onMount();
      await filter.apply();

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      const data = api.exportData();
      expect(Object.keys(data.frequency).length).toBe(0);

      filter.dispose();
    });
  });

  // ──────── 值感知推荐 ────────

  describe('值感知推荐', () => {
    it('不同值应产生不同的推荐排序', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'val-u', filterDefs, persist: false }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;

      // 训练：手机 → brand，服装 → color
      for (let i = 0; i < 5; i++) {
        api.record({ sequence: ['category', 'brand'], selections: [
          { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
        ]});
        api.record({ sequence: ['category', 'color'], selections: [
          { key: 'category', value: '服装' }, { key: 'color', value: '红色' },
        ]});
      }

      // 手机 → brand 优先
      const r1 = api.recommend([{ key: 'category', value: '手机' }]);
      expect(r1[0].key).toBe('brand');

      // 服装 → color 优先
      const r2 = api.recommend([{ key: 'category', value: '服装' }]);
      expect(r2[0].key).toBe('color');

      filter.dispose();
    });
  });

  // ──────── 导入导出 ────────

  describe('导入导出', () => {
    it('exportData → importData 应还原状态', () => {
      const filter = createFilter<TestDraft>({
        plugins: [
          createCopilotPlugin({ userId: 'io-u', filterDefs, persist: false }),
        ],
      });

      const api = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME)!;
      api.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
      ]});

      const exported = api.exportData();
      api.resetData();

      // 重置后无推荐
      expect(api.recommend([]).every((s) => s.score === 0)).toBe(true);

      // 导入后恢复
      api.importData(exported);
      expect(api.recommend([]).some((s) => s.score > 0)).toBe(true);

      filter.dispose();
    });
  });
});
