import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createFilterCopilot, createFilterCopilotAsync } from '../src/index'
import type { FilterDefs } from '../src/types/Filter'
import type { BehaviorData } from '../src/core/BehaviorStore'

const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] },
  price: { label: '价格' },
  color: { label: '颜色' },
}

/**
 * 模拟全局热力数据——通常由运营端预先统计好的默认频率表
 */
const globalSeedData: BehaviorData = {
  transitions: {
    category: { brand: 50, price: 30, color: 20 },
    brand: { price: 40, color: 10 },
  },
  frequency: {
    category: 100,
    brand: 80,
    price: 60,
    color: 40,
  },
}

describe('冷启动（Cold Start）', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  // ──────────── 同步 API ────────────

  describe('createFilterCopilot — 同步冷启动', () => {
    it('无历史数据时应使用冷启动种子数据推荐', () => {
      const copilot = createFilterCopilot({
        userId: 'cold-user',
        filterDefs,
        coldStart: globalSeedData,
      })

      const result = copilot.recommend([])
      expect(result.length).toBeGreaterThan(0)
      expect(result.some((s) => s.score > 0)).toBe(true)

      // category 频率最高，应排第一
      expect(result[0].key).toBe('category')
    })

    it('选 category 后应优先推荐 brand（转移概率最高）', () => {
      const copilot = createFilterCopilot({
        userId: 'cold-user',
        filterDefs,
        coldStart: globalSeedData,
      })

      const result = copilot.recommend(['category'])
      expect(result[0].key).toBe('brand')
      expect(result[0].reason).toContain('sequence')
    })

    it('有持久化历史时应忽略冷启动数据', () => {
      // 先创建有持久化数据的实例
      const copilot1 = createFilterCopilot({
        userId: 'existing-user',
        filterDefs,
        persist: true,
      })
      copilot1.record({ sequence: ['color', 'price'] })

      // 用同样 userId + coldStart 创建新实例
      const copilot2 = createFilterCopilot({
        userId: 'existing-user',
        filterDefs,
        persist: true,
        coldStart: globalSeedData,
      })

      // 导出数据验证：应是持久化的数据而非冷启动数据
      const data = copilot2.export()
      // 持久化数据中 color 频率为 1，冷启动中为 40
      expect(data.frequency.color).toBe(1)
    })

    it('冷启动数据应能与后续真实行为共存', () => {
      const copilot = createFilterCopilot({
        userId: 'new-user',
        filterDefs,
        coldStart: globalSeedData,
      })

      // 记录真实行为
      copilot.record({ sequence: ['category', 'color'] })

      const data = copilot.export()
      // 频率应是冷启动 + 真实行为
      expect(data.frequency.category).toBe(101) // 100 + 1
      expect(data.frequency.color).toBe(41) // 40 + 1
    })

    it('无冷启动数据时不影响正常功能', () => {
      const copilot = createFilterCopilot({
        userId: 'no-cold',
        filterDefs,
      })

      const result = copilot.recommend([])
      expect(result.every((s) => s.score === 0)).toBe(true)
    })
  })

  // ──────────── 异步 API ────────────

  describe('createFilterCopilotAsync — 异步冷启动', () => {
    it('应支持静态种子数据', async () => {
      const copilot = await createFilterCopilotAsync({
        userId: 'async-cold',
        filterDefs,
        coldStart: globalSeedData,
      })

      const result = copilot.recommend([])
      expect(result[0].key).toBe('category')
      expect(result[0].score).toBeGreaterThan(0)
    })

    it('应支持异步加载函数', async () => {
      const loader = async (): Promise<BehaviorData> => {
        // 模拟从 CDN / API 加载全局热力数据
        return globalSeedData
      }

      const copilot = await createFilterCopilotAsync({
        userId: 'async-loader',
        filterDefs,
        coldStart: loader,
      })

      const result = copilot.recommend(['category'])
      expect(result[0].key).toBe('brand')
    })

    it('异步加载失败时不应阻断初始化', async () => {
      const failingLoader = async (): Promise<BehaviorData> => {
        throw new Error('Network error')
      }

      const copilot = await createFilterCopilotAsync({
        userId: 'async-fail',
        filterDefs,
        coldStart: failingLoader,
      })

      // 应正常工作，只是没有冷启动数据
      const result = copilot.recommend([])
      expect(result.every((s) => s.score === 0)).toBe(true)
    })

    it('有持久化数据时异步加载器不应被调用', async () => {
      // 先写入持久化数据
      const copilot1 = createFilterCopilot({
        userId: 'has-data',
        filterDefs,
        persist: true,
      })
      copilot1.record({ sequence: ['price'] })

      let loaderCalled = false
      const loader = async (): Promise<BehaviorData> => {
        loaderCalled = true
        return globalSeedData
      }

      await createFilterCopilotAsync({
        userId: 'has-data',
        filterDefs,
        persist: true,
        coldStart: loader,
      })

      expect(loaderCalled).toBe(false)
    })
  })
})
