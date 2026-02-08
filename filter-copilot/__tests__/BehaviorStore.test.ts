import { describe, it, expect, beforeEach } from 'vitest'
import { BehaviorStore } from '../src/core/BehaviorStore'

describe('BehaviorStore', () => {
  let store: BehaviorStore

  beforeEach(() => {
    store = new BehaviorStore()
  })

  // ──────────── record ────────────

  describe('record', () => {
    it('应正确记录单个序列的频率', () => {
      store.record(['a', 'b', 'c'])
      const freq = store.getFrequency()
      expect(freq).toEqual({ a: 1, b: 1, c: 1 })
    })

    it('应正确累加多次记录的频率', () => {
      store.record(['a', 'b'])
      store.record(['a', 'c'])
      store.record(['a', 'b'])
      const freq = store.getFrequency()
      expect(freq.a).toBe(3)
      expect(freq.b).toBe(2)
      expect(freq.c).toBe(1)
    })

    it('应正确构建 Markov 转移表', () => {
      store.record(['a', 'b', 'c'])
      expect(store.getTransition('a')).toEqual({ b: 1 })
      expect(store.getTransition('b')).toEqual({ c: 1 })
      expect(store.getTransition('c')).toEqual({})
    })

    it('应累加相同转移的计数', () => {
      store.record(['a', 'b'])
      store.record(['a', 'b'])
      store.record(['a', 'c'])
      expect(store.getTransition('a')).toEqual({ b: 2, c: 1 })
    })

    it('空数组不应改变任何状态', () => {
      store.record([])
      expect(store.getFrequency()).toEqual({})
      expect(store.size()).toBe(0)
    })

    it('非数组输入不应抛异常', () => {
      store.record(null as unknown as string[])
      store.record(undefined as unknown as string[])
      store.record('hello' as unknown as string[])
      expect(store.size()).toBe(0)
    })

    it('序列中的空字符串应被跳过', () => {
      store.record(['a', '', 'b'])
      const freq = store.getFrequency()
      expect(freq).toEqual({ a: 1, b: 1 })
      // a → '' 被跳过，所以 a 不应有到 b 的转移（中间隔了空字符串）
      expect(store.getTransition('a')).toEqual({})
    })

    it('序列中的非字符串元素应被跳过', () => {
      store.record(['a', 123 as unknown as string, 'b'])
      const freq = store.getFrequency()
      expect(freq.a).toBe(1)
      expect(freq.b).toBe(1)
      expect(freq[123]).toBeUndefined()
    })

    it('单元素序列应只更新频率不更新转移', () => {
      store.record(['x'])
      expect(store.getFrequency()).toEqual({ x: 1 })
      expect(store.getTransition('x')).toEqual({})
    })
  })

  // ──────────── getTransition ────────────

  describe('getTransition', () => {
    it('未记录过的 key 应返回空对象', () => {
      expect(store.getTransition('unknown')).toEqual({})
    })

    it('非字符串输入应返回空对象', () => {
      expect(store.getTransition(123 as unknown as string)).toEqual({})
      expect(store.getTransition(null as unknown as string)).toEqual({})
    })
  })

  // ──────────── getFrequency ────────────

  describe('getFrequency', () => {
    it('初始状态应返回空对象', () => {
      expect(store.getFrequency()).toEqual({})
    })

    it('返回的对象应是副本，修改不影响内部', () => {
      store.record(['a'])
      const freq = store.getFrequency()
      freq.a = 999
      expect(store.getFrequency().a).toBe(1)
    })
  })

  // ──────────── size ────────────

  describe('size', () => {
    it('初始 size 为 0', () => {
      expect(store.size()).toBe(0)
    })

    it('应返回不同筛选器的总数', () => {
      store.record(['a', 'b', 'c'])
      expect(store.size()).toBe(3)
    })

    it('重复 key 不增加 size', () => {
      store.record(['a', 'b'])
      store.record(['a', 'b'])
      expect(store.size()).toBe(2)
    })
  })

  // ──────────── clear ────────────

  describe('clear', () => {
    it('应清空全部数据', () => {
      store.record(['a', 'b', 'c'])
      store.clear()
      expect(store.size()).toBe(0)
      expect(store.getFrequency()).toEqual({})
      expect(store.getTransition('a')).toEqual({})
    })
  })

  // ──────────── export / import ────────────

  describe('export', () => {
    it('应返回当前行为数据的深拷贝', () => {
      store.record(['a', 'b'])
      const data = store.export()
      expect(data).toEqual({
        transitions: { a: { b: 1 } },
        frequency: { a: 1, b: 1 },
      })
    })

    it('导出结果修改不应影响内部状态', () => {
      store.record(['a', 'b'])
      const data = store.export()
      data.frequency.a = 999
      data.transitions.a.b = 999
      expect(store.getFrequency().a).toBe(1)
      expect(store.getTransition('a').b).toBe(1)
    })
  })

  describe('import - 覆盖模式', () => {
    it('应用导入数据覆盖现有数据', () => {
      store.record(['x', 'y'])
      store.import({
        transitions: { a: { b: 5 } },
        frequency: { a: 10, b: 5 },
      })
      expect(store.getFrequency()).toEqual({ a: 10, b: 5 })
      expect(store.getTransition('a')).toEqual({ b: 5 })
      // 原有 x, y 数据被覆盖
      expect(store.getTransition('x')).toEqual({})
    })

    it('无效数据不应影响现有状态', () => {
      store.record(['a'])
      store.import(null)
      store.import(undefined)
      store.import(42)
      store.import('bad')
      expect(store.getFrequency()).toEqual({ a: 1 })
    })

    it('部分数据导入只覆盖有的字段', () => {
      store.record(['a', 'b'])
      store.import({ frequency: { x: 3 } })
      // frequency 被覆盖，但 transitions 保持不变
      expect(store.getFrequency()).toEqual({ x: 3 })
      expect(store.getTransition('a')).toEqual({ b: 1 })
    })
  })

  describe('import - 合并模式', () => {
    it('应累加频率和转移计数', () => {
      store.record(['a', 'b'])
      // a:1, b:1, a→b:1
      store.import(
        {
          transitions: { a: { b: 2, c: 1 } },
          frequency: { a: 3, c: 1 },
        },
        true,
      )
      // 频率：a = 1+3 = 4, b = 1 (未改), c = 0+1 = 1
      expect(store.getFrequency()).toEqual({ a: 4, b: 1, c: 1 })
      // 转移：a→b = 1+2 = 3, a→c = 0+1 = 1
      expect(store.getTransition('a')).toEqual({ b: 3, c: 1 })
    })

    it('合并空数据不应改变现有状态', () => {
      store.record(['a'])
      store.import({}, true)
      expect(store.getFrequency()).toEqual({ a: 1 })
    })
  })

  // ──────────── export → import 往返一致性 ────────────

  describe('export → import 往返', () => {
    it('导出再导入应还原相同状态', () => {
      store.record(['a', 'b', 'c'])
      store.record(['a', 'c'])
      const snapshot = store.export()

      const newStore = new BehaviorStore()
      newStore.import(snapshot)

      expect(newStore.export()).toEqual(snapshot)
    })
  })
})
