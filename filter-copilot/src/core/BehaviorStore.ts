/**
 * BehaviorStore — 行为存储
 *
 * 职责：
 * - 记录筛选器使用顺序
 * - 维护顺序转移表（Markov）
 * - 维护使用频率
 * - 支持导入 / 导出 / 清空
 */

interface TransitionTable {
  [from: string]: Record<string, number>
}

interface FrequencyTable {
  [key: string]: number
}

export interface BehaviorData {
  transitions: TransitionTable
  frequency: FrequencyTable
}

export class BehaviorStore {
  private transitions: TransitionTable = {}
  private frequency: FrequencyTable = {}

  /**
   * 记录一次筛选器使用序列
   * 更新转移表和频率表
   */
  record(sequence: string[]): void {
    if (!Array.isArray(sequence) || sequence.length === 0) {
      return
    }

    for (let i = 0; i < sequence.length; i++) {
      const key = sequence[i]
      if (typeof key !== 'string' || key === '') {
        continue
      }

      // 更新频率
      this.frequency[key] = (this.frequency[key] ?? 0) + 1

      // 更新转移表：记录 sequence[i] → sequence[i+1] 的转移次数
      if (i < sequence.length - 1) {
        const next = sequence[i + 1]
        if (typeof next !== 'string' || next === '') {
          continue
        }
        if (!this.transitions[key]) {
          this.transitions[key] = {}
        }
        this.transitions[key][next] = (this.transitions[key][next] ?? 0) + 1
      }
    }
  }

  /**
   * 获取某个筛选器之后的转移概率分布
   */
  getTransition(key: string): Record<string, number> {
    if (typeof key !== 'string') {
      return {}
    }
    return this.transitions[key] ?? {}
  }

  /**
   * 获取全局使用频率
   */
  getFrequency(): Record<string, number> {
    return { ...this.frequency }
  }

  /**
   * 获取已记录的不同筛选器总数
   */
  size(): number {
    return Object.keys(this.frequency).length
  }

  /**
   * 清空全部行为数据
   */
  clear(): void {
    this.transitions = {}
    this.frequency = {}
  }

  /**
   * 导出全部行为数据（深拷贝，不影响内部状态）
   */
  export(): BehaviorData {
    return {
      transitions: JSON.parse(JSON.stringify(this.transitions)),
      frequency: { ...this.frequency },
    }
  }

  /**
   * 导入行为数据（增量合并 — 累加到现有数据上）
   * 传入 merge=false 时覆盖而非合并
   */
  import(data: unknown, merge = false): void {
    if (!data || typeof data !== 'object') {
      return
    }

    const d = data as Partial<BehaviorData>

    if (merge) {
      // 增量合并：累加频率和转移计数
      if (d.frequency && typeof d.frequency === 'object') {
        const incoming = d.frequency as FrequencyTable
        const keys = Object.keys(incoming)
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i]
          const val = incoming[k]
          if (typeof val === 'number' && val > 0) {
            this.frequency[k] = (this.frequency[k] ?? 0) + val
          }
        }
      }

      if (d.transitions && typeof d.transitions === 'object') {
        const incoming = d.transitions as TransitionTable
        const fromKeys = Object.keys(incoming)
        for (let i = 0; i < fromKeys.length; i++) {
          const from = fromKeys[i]
          const toMap = incoming[from]
          if (!toMap || typeof toMap !== 'object') continue
          if (!this.transitions[from]) {
            this.transitions[from] = {}
          }
          const toKeys = Object.keys(toMap)
          for (let j = 0; j < toKeys.length; j++) {
            const to = toKeys[j]
            const val = toMap[to]
            if (typeof val === 'number' && val > 0) {
              this.transitions[from][to] = (this.transitions[from][to] ?? 0) + val
            }
          }
        }
      }
    } else {
      // 覆盖模式（向后兼容原有行为）
      if (d.transitions && typeof d.transitions === 'object') {
        this.transitions = JSON.parse(JSON.stringify(d.transitions))
      }

      if (d.frequency && typeof d.frequency === 'object') {
        this.frequency = { ...d.frequency }
      }
    }
  }
}
