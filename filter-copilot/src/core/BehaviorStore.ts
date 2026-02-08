/**
 * BehaviorStore — 行为存储
 *
 * 职责：
 * - 记录筛选器使用顺序
 * - 维护顺序转移表（Markov）
 * - 维护使用频率
 * - 支持导入 / 导出
 */

interface TransitionTable {
  [from: string]: Record<string, number>
}

interface FrequencyTable {
  [key: string]: number
}

interface BehaviorData {
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
      if (typeof key !== 'string') {
        continue
      }

      // 更新频率
      this.frequency[key] = (this.frequency[key] ?? 0) + 1

      // 更新转移表：记录 sequence[i] → sequence[i+1] 的转移次数
      if (i < sequence.length - 1) {
        const next = sequence[i + 1]
        if (typeof next !== 'string') {
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
   * 导出全部行为数据
   */
  export(): BehaviorData {
    return {
      transitions: JSON.parse(JSON.stringify(this.transitions)),
      frequency: { ...this.frequency },
    }
  }

  /**
   * 导入行为数据
   */
  import(data: unknown): void {
    if (!data || typeof data !== 'object') {
      return
    }

    const d = data as Partial<BehaviorData>

    if (d.transitions && typeof d.transitions === 'object') {
      this.transitions = JSON.parse(JSON.stringify(d.transitions))
    }

    if (d.frequency && typeof d.frequency === 'object') {
      this.frequency = { ...d.frequency }
    }
  }
}
