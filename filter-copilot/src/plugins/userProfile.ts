/**
 * 用户偏好插件（可选）
 *
 * 职责：
 * - 维护 filterKey → 权重 的映射
 * - 只影响排序，不影响候选集合
 */

export interface UserProfilePlugin {
  getPreferences(): Record<string, number>
  setPreferences(preferences: Record<string, number>): void
}

export function createUserProfilePlugin(
  initialPreferences?: Record<string, number>,
): UserProfilePlugin {
  let preferences: Record<string, number> = initialPreferences
    ? { ...initialPreferences }
    : {}

  return {
    /**
     * 获取当前用户偏好权重
     */
    getPreferences(): Record<string, number> {
      return { ...preferences }
    },

    /**
     * 更新用户偏好权重
     */
    setPreferences(newPreferences: Record<string, number>): void {
      preferences = { ...newPreferences }
    },
  }
}
