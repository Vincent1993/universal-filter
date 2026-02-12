import { describe, it, expect } from 'vitest'
import { RuleEngine } from '../src/core/RuleEngine'
import type { FilterDefs } from '../src/types/Filter'

const defs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] },
  model: { label: '型号', dependsOn: ['category', 'brand'] },
  color: { label: '颜色' },
  price: { label: '价格', dependsOn: ['category'] },
}

describe('RuleEngine', () => {
  const engine = new RuleEngine(defs)

  // ──────────── isValid ────────────

  describe('isValid', () => {
    it('无依赖的筛选器总是可用', () => {
      expect(engine.isValid('category', [])).toBe(true)
      expect(engine.isValid('color', [])).toBe(true)
      expect(engine.isValid('category', ['brand'])).toBe(true)
    })

    it('依赖全部满足时返回 true', () => {
      expect(engine.isValid('brand', ['category'])).toBe(true)
      expect(engine.isValid('model', ['category', 'brand'])).toBe(true)
      expect(engine.isValid('price', ['category'])).toBe(true)
    })

    it('依赖部分缺失时返回 false', () => {
      expect(engine.isValid('brand', [])).toBe(false)
      expect(engine.isValid('model', ['category'])).toBe(false)
      expect(engine.isValid('model', ['brand'])).toBe(false)
    })

    it('未注册的 key 返回 false', () => {
      expect(engine.isValid('unknown', [])).toBe(false)
      expect(engine.isValid('notExist', ['category'])).toBe(false)
    })

    it('非字符串输入返回 false', () => {
      expect(engine.isValid(123 as unknown as string, [])).toBe(false)
      expect(engine.isValid(null as unknown as string, [])).toBe(false)
      expect(engine.isValid(undefined as unknown as string, [])).toBe(false)
    })

    it('context 中有多余 key 不影响判断', () => {
      expect(engine.isValid('brand', ['category', 'color', 'extra'])).toBe(true)
    })

    it('dependsOn 为空数组等同于无依赖', () => {
      const localDefs: FilterDefs = {
        test: { label: '测试', dependsOn: [] },
      }
      const localEngine = new RuleEngine(localDefs)
      expect(localEngine.isValid('test', [])).toBe(true)
    })
  })

  // ──────────── getAvailable ────────────

  describe('getAvailable', () => {
    it('空 context 返回所有无依赖的筛选器', () => {
      const available = engine.getAvailable([])
      expect(available).toContain('category')
      expect(available).toContain('color')
      expect(available).not.toContain('brand')
      expect(available).not.toContain('model')
      expect(available).not.toContain('price')
    })

    it('已选的筛选器应被排除', () => {
      const available = engine.getAvailable(['category'])
      expect(available).not.toContain('category')
      expect(available).toContain('brand')
      expect(available).toContain('color')
      expect(available).toContain('price')
    })

    it('逐步满足依赖应解锁更多筛选器', () => {
      const step1 = engine.getAvailable(['category'])
      expect(step1).toContain('brand')
      expect(step1).not.toContain('model')

      const step2 = engine.getAvailable(['category', 'brand'])
      expect(step2).toContain('model')
      expect(step2).toContain('color')
      expect(step2).toContain('price')
    })

    it('全部选完后返回空数组', () => {
      const all = Object.keys(defs)
      expect(engine.getAvailable(all)).toEqual([])
    })

    it('非数组输入返回空数组', () => {
      expect(engine.getAvailable(null as unknown as string[])).toEqual([])
    })
  })
})
