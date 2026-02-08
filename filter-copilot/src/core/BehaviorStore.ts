/**
 * BehaviorStore — 双维度行为存储
 *
 * 维护两个维度的行为数据：
 *
 * 【Key 维度】（原有）
 *   - transitions:  key → key 的 Markov 转移表
 *   - frequency:    key 的全局使用频率
 *
 * 【Value 维度】（新增）
 *   - contextTransitions: (key=value) → nextKey 的上下文感知转移
 *     "当用户选了 category=电子产品 时，下一步倾向选哪个筛选器"
 *
 *   - valuePairs:         (key=value) → (otherKey=otherValue) 的值共现
 *     "选了 category=电子产品 的用户，在 brand 里倾向选 Apple"
 *
 *   - valueFrequency:     key → { value: count } 的值频率表
 *     "brand 筛选器里，Apple 被选了 50 次，Samsung 被选了 30 次"
 */

import type { FilterSelection } from '../types/Filter'

// ──────────── 内部类型 ────────────

interface TransitionTable {
  [from: string]: Record<string, number>
}

interface FrequencyTable {
  [key: string]: number
}

/** (key=value) → nextKey → count */
type ContextTransitionTable = Record<string, Record<string, number>>

/** (key=value) → (otherKey=otherValue) → count */
type ValuePairTable = Record<string, Record<string, number>>

/** key → { value: count } */
type ValueFrequencyTable = Record<string, Record<string, number>>

// ──────────── 复合键工具 ────────────

const SEP = '\x01' // 使用不可见字符做分隔符，避免与正常文本冲突

export function compoundKey(key: string, value: string): string {
  return `${key}${SEP}${value}`
}

export function parseCompoundKey(compound: string): { key: string; value: string } | null {
  const idx = compound.indexOf(SEP)
  if (idx === -1) return null
  return { key: compound.slice(0, idx), value: compound.slice(idx + 1) }
}

// ──────────── 导出数据结构 ────────────

export interface BehaviorData {
  // Key 维度
  transitions: TransitionTable
  frequency: FrequencyTable
  // Value 维度
  contextTransitions?: ContextTransitionTable
  valuePairs?: ValuePairTable
  valueFrequency?: ValueFrequencyTable
}

// ──────────── BehaviorStore ────────────

export class BehaviorStore {
  // Key 维度
  private transitions: TransitionTable = {}
  private frequency: FrequencyTable = {}

  // Value 维度
  private contextTransitions: ContextTransitionTable = {}
  private valuePairs: ValuePairTable = {}
  private valueFrequency: ValueFrequencyTable = {}

  // ──────── Key 维度记录 ────────

  /**
   * 记录筛选器 key 使用序列（向后兼容）
   */
  record(sequence: string[]): void {
    if (!Array.isArray(sequence) || sequence.length === 0) return

    for (let i = 0; i < sequence.length; i++) {
      const key = sequence[i]
      if (typeof key !== 'string' || key === '') continue

      this.frequency[key] = (this.frequency[key] ?? 0) + 1

      if (i < sequence.length - 1) {
        const next = sequence[i + 1]
        if (typeof next !== 'string' || next === '') continue
        if (!this.transitions[key]) this.transitions[key] = {}
        this.transitions[key][next] = (this.transitions[key][next] ?? 0) + 1
      }
    }
  }

  // ──────── Value 维度记录 ────────

  /**
   * 记录带值的筛选器选择序列
   *
   * 同时更新：
   * 1. Key 维度（transitions + frequency）
   * 2. 上下文转移表（contextTransitions）
   * 3. 值共现表（valuePairs）
   * 4. 值频率表（valueFrequency）
   */
  recordSelections(selections: FilterSelection[]): void {
    if (!Array.isArray(selections) || selections.length === 0) return

    // 1. 更新 key 维度
    const keys = selections.map((s) => s.key)
    this.record(keys)

    // 2-4. 更新 value 维度
    for (let i = 0; i < selections.length; i++) {
      const sel = selections[i]
      if (!sel || typeof sel.key !== 'string' || sel.key === '') continue

      const values = this._normalizeValues(sel.value)
      if (values.length === 0) continue

      // 4. 值频率表
      for (const v of values) {
        if (!this.valueFrequency[sel.key]) this.valueFrequency[sel.key] = {}
        this.valueFrequency[sel.key][v] = (this.valueFrequency[sel.key][v] ?? 0) + 1
      }

      // 对后续的每个 selection，记录上下文转移和值共现
      for (let j = i + 1; j < selections.length; j++) {
        const later = selections[j]
        if (!later || typeof later.key !== 'string' || later.key === '') continue

        const laterValues = this._normalizeValues(later.value)
        if (laterValues.length === 0) continue

        for (const v of values) {
          const ck = compoundKey(sel.key, v)

          // 2. 上下文转移：(sel.key=v) → later.key
          if (!this.contextTransitions[ck]) this.contextTransitions[ck] = {}
          this.contextTransitions[ck][later.key] =
            (this.contextTransitions[ck][later.key] ?? 0) + 1

          // 3. 值共现：(sel.key=v) → (later.key=lv)
          for (const lv of laterValues) {
            const laterCk = compoundKey(later.key, lv)
            if (!this.valuePairs[ck]) this.valuePairs[ck] = {}
            this.valuePairs[ck][laterCk] = (this.valuePairs[ck][laterCk] ?? 0) + 1
          }
        }
      }
    }
  }

  // ──────── Key 维度查询 ────────

  getTransition(key: string): Record<string, number> {
    if (typeof key !== 'string') return {}
    return this.transitions[key] ?? {}
  }

  getFrequency(): Record<string, number> {
    return { ...this.frequency }
  }

  // ──────── Value 维度查询 ────────

  /**
   * 获取上下文感知的筛选器转移分布
   * "当 key=value 时，下一步各筛选器的使用次数"
   */
  getContextTransition(key: string, value: string): Record<string, number> {
    const ck = compoundKey(key, value)
    return this.contextTransitions[ck] ?? {}
  }

  /**
   * 获取值共现分布
   * "当 key=value 时，targetKey 中各值的被选次数"
   */
  getValuePairs(key: string, value: string, targetKey: string): Record<string, number> {
    const ck = compoundKey(key, value)
    const pairs = this.valuePairs[ck]
    if (!pairs) return {}

    const result: Record<string, number> = {}
    const prefix = targetKey + SEP
    const entries = Object.keys(pairs)
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.startsWith(prefix)) {
        const val = entry.slice(prefix.length)
        result[val] = pairs[entry]
      }
    }
    return result
  }

  /**
   * 获取某个筛选器的值频率分布
   * "brand 筛选器里各值被选了多少次"
   */
  getValueFrequency(key: string): Record<string, number> {
    return this.valueFrequency[key] ? { ...this.valueFrequency[key] } : {}
  }

  // ──────── 通用方法 ────────

  size(): number {
    return Object.keys(this.frequency).length
  }

  clear(): void {
    this.transitions = {}
    this.frequency = {}
    this.contextTransitions = {}
    this.valuePairs = {}
    this.valueFrequency = {}
  }

  export(): BehaviorData {
    return {
      transitions: JSON.parse(JSON.stringify(this.transitions)),
      frequency: { ...this.frequency },
      contextTransitions: JSON.parse(JSON.stringify(this.contextTransitions)),
      valuePairs: JSON.parse(JSON.stringify(this.valuePairs)),
      valueFrequency: JSON.parse(JSON.stringify(this.valueFrequency)),
    }
  }

  import(data: unknown, merge = false): void {
    if (!data || typeof data !== 'object') return
    const d = data as Partial<BehaviorData>

    if (merge) {
      this._mergeTable(d.frequency, this.frequency, 'flat')
      this._mergeTable(d.transitions, this.transitions, 'nested')
      this._mergeTable(d.contextTransitions, this.contextTransitions, 'nested')
      this._mergeTable(d.valuePairs, this.valuePairs, 'nested')
      this._mergeValueFrequency(d.valueFrequency)
    } else {
      if (d.transitions && typeof d.transitions === 'object') {
        this.transitions = JSON.parse(JSON.stringify(d.transitions))
      }
      if (d.frequency && typeof d.frequency === 'object') {
        this.frequency = { ...d.frequency }
      }
      if (d.contextTransitions && typeof d.contextTransitions === 'object') {
        this.contextTransitions = JSON.parse(JSON.stringify(d.contextTransitions))
      }
      if (d.valuePairs && typeof d.valuePairs === 'object') {
        this.valuePairs = JSON.parse(JSON.stringify(d.valuePairs))
      }
      if (d.valueFrequency && typeof d.valueFrequency === 'object') {
        this.valueFrequency = JSON.parse(JSON.stringify(d.valueFrequency))
      }
    }
  }

  // ──────── 内部工具 ────────

  private _normalizeValues(value: string | string[] | undefined): string[] {
    if (value === undefined || value === null) return []
    if (typeof value === 'string') return value === '' ? [] : [value]
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v !== '')
    return []
  }

  private _mergeTable(
    incoming: Record<string, unknown> | undefined,
    target: Record<string, unknown>,
    mode: 'flat' | 'nested',
  ): void {
    if (!incoming || typeof incoming !== 'object') return

    if (mode === 'flat') {
      const src = incoming as FrequencyTable
      const dst = target as FrequencyTable
      const keys = Object.keys(src)
      for (let i = 0; i < keys.length; i++) {
        const val = src[keys[i]]
        if (typeof val === 'number' && val > 0) {
          dst[keys[i]] = (dst[keys[i]] ?? 0) + val
        }
      }
    } else {
      const src = incoming as TransitionTable
      const dst = target as TransitionTable
      const fromKeys = Object.keys(src)
      for (let i = 0; i < fromKeys.length; i++) {
        const from = fromKeys[i]
        const toMap = src[from]
        if (!toMap || typeof toMap !== 'object') continue
        if (!dst[from]) dst[from] = {}
        const toKeys = Object.keys(toMap)
        for (let j = 0; j < toKeys.length; j++) {
          const to = toKeys[j]
          const val = toMap[to]
          if (typeof val === 'number' && val > 0) {
            dst[from][to] = (dst[from][to] ?? 0) + val
          }
        }
      }
    }
  }

  private _mergeValueFrequency(incoming: ValueFrequencyTable | undefined): void {
    if (!incoming || typeof incoming !== 'object') return
    const keys = Object.keys(incoming)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const valMap = incoming[key]
      if (!valMap || typeof valMap !== 'object') continue
      if (!this.valueFrequency[key]) this.valueFrequency[key] = {}
      const vals = Object.keys(valMap)
      for (let j = 0; j < vals.length; j++) {
        const v = vals[j]
        const cnt = valMap[v]
        if (typeof cnt === 'number' && cnt > 0) {
          this.valueFrequency[key][v] = (this.valueFrequency[key][v] ?? 0) + cnt
        }
      }
    }
  }
}
