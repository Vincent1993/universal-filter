import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPersistencePlugin } from '../src/plugins/persistence'
import { createUserProfilePlugin } from '../src/plugins/userProfile'

// ──────────── PersistencePlugin ────────────

describe('PersistencePlugin', () => {
  const userId = 'test-user-001'
  const expectedKey = `filter-copilot:${userId}`

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('save 应将数据序列化后写入 localStorage', () => {
    const plugin = createPersistencePlugin(userId)
    const data = { transitions: { a: { b: 1 } }, frequency: { a: 1 } }
    plugin.save(data)

    const raw = localStorage.getItem(expectedKey)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual(data)
  })

  it('load 应从 localStorage 读取并反序列化数据', () => {
    const plugin = createPersistencePlugin(userId)
    const data = { transitions: {}, frequency: { x: 5 } }
    localStorage.setItem(expectedKey, JSON.stringify(data))

    const loaded = plugin.load()
    expect(loaded).toEqual(data)
  })

  it('无数据时 load 应返回 null', () => {
    const plugin = createPersistencePlugin(userId)
    expect(plugin.load()).toBeNull()
  })

  it('localStorage 中存储损坏时 load 应返回 null', () => {
    const plugin = createPersistencePlugin(userId)
    localStorage.setItem(expectedKey, '{invalid json!!!')
    expect(plugin.load()).toBeNull()
  })

  it('clear 应删除 localStorage 中的数据', () => {
    const plugin = createPersistencePlugin(userId)
    plugin.save({ test: true })
    expect(localStorage.getItem(expectedKey)).not.toBeNull()

    plugin.clear()
    expect(localStorage.getItem(expectedKey)).toBeNull()
  })

  it('不同 userId 使用不同存储 key', () => {
    const plugin1 = createPersistencePlugin('user-a')
    const plugin2 = createPersistencePlugin('user-b')

    plugin1.save({ user: 'a' })
    plugin2.save({ user: 'b' })

    expect(plugin1.load()).toEqual({ user: 'a' })
    expect(plugin2.load()).toEqual({ user: 'b' })
  })

  it('save/load 往返应保持数据一致', () => {
    const plugin = createPersistencePlugin(userId)
    const complex = {
      transitions: { a: { b: 3, c: 1 }, b: { c: 2 } },
      frequency: { a: 5, b: 3, c: 2 },
    }
    plugin.save(complex)
    expect(plugin.load()).toEqual(complex)
  })
})

// ──────────── UserProfilePlugin ────────────

describe('UserProfilePlugin', () => {
  it('应正确初始化偏好', () => {
    const plugin = createUserProfilePlugin({ price: 2, color: 0.5 })
    expect(plugin.getPreferences()).toEqual({ price: 2, color: 0.5 })
  })

  it('无初始偏好时应返回空对象', () => {
    const plugin = createUserProfilePlugin()
    expect(plugin.getPreferences()).toEqual({})
  })

  it('setPreferences 应完全替换偏好', () => {
    const plugin = createUserProfilePlugin({ old: 1 })
    plugin.setPreferences({ new: 2 })
    expect(plugin.getPreferences()).toEqual({ new: 2 })
  })

  it('getPreferences 返回的是副本，修改不影响内部', () => {
    const plugin = createUserProfilePlugin({ a: 1 })
    const prefs = plugin.getPreferences()
    prefs.a = 999
    prefs.b = 100
    expect(plugin.getPreferences()).toEqual({ a: 1 })
  })

  it('初始数据也不应被外部修改影响', () => {
    const initial = { x: 1 }
    const plugin = createUserProfilePlugin(initial)
    initial.x = 999
    expect(plugin.getPreferences().x).toBe(1)
  })
})
