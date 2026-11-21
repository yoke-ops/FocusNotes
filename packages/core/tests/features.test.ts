import { describe, expect, it } from 'vitest'
import {
  clampReminderMinutes,
  normalizeExtras,
  pageIndex,
  pageKey,
  PAGE_KEYS,
  resolvePageFromPager,
  sleepTimerRemaining,
  todayCompletion,
  type FocusSession,
  type Habit,
  type TodoItem,
} from '../src/index'

function habit(id: string, patch: Partial<Habit> = {}): Habit {
  return {
    id, name: id, emoji: '✅', color: '#0071e3', frequency: 'daily', goal: 1, unit: '次',
    startDate: '2026-01-01', persistence: 'forever', group: '', reminder: null, autoLog: false,
    archived: false, createdAt: '2026-01-01T00:00:00.000Z', ...patch,
  }
}

function todo(patch: Partial<TodoItem>): TodoItem {
  return {
    id: '1', title: '任务', notes: '', dueAt: null, important: false, urgent: false,
    completed: false, completedAt: null, listId: 'inbox', tags: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1, deleted: false, ...patch,
  }
}

function session(patch: Partial<FocusSession>): FocusSession {
  return {
    id: 's1', taskId: null, mode: 'focus', seconds: 1500,
    startedAt: '2026-11-19T09:00:00.000Z', endedAt: '2026-11-19T09:25:00.000Z', ...patch,
  }
}

describe('sleepTimerRemaining', () => {
  it('returns remaining milliseconds before expiry', () => {
    const started = new Date(2026, 10, 19, 9, 0, 0).toISOString()
    const now = new Date(2026, 10, 19, 9, 10, 0)
    expect(sleepTimerRemaining(started, 30, now)).toBe(20 * 60_000)
  })

  it('returns zero or negative once expired', () => {
    const started = new Date(2026, 10, 19, 9, 0, 0).toISOString()
    const now = new Date(2026, 10, 19, 9, 35, 0)
    expect(sleepTimerRemaining(started, 30, now)).toBeLessThanOrEqual(0)
  })

  it('treats invalid duration as immediately expired', () => {
    const started = new Date(2026, 10, 19, 9, 0, 0).toISOString()
    const now = new Date(2026, 10, 19, 9, 1, 0)
    expect(sleepTimerRemaining(started, 0, now)).toBe(0)
    expect(sleepTimerRemaining(started, -5, now)).toBe(0)
    expect(sleepTimerRemaining('not-a-date', 30, now)).toBe(0)
  })
})

describe('todayCompletion', () => {
  const now = new Date(2026, 10, 19, 12, 0, 0)
  const today = '2026-11-19'
  const yesterday = '2026-11-18'

  it('aggregates finished todos, checked habits and focus sessions into today total', () => {
    const result = todayCompletion({
      todos: [
        todo({ id: 't1', completed: true, completedAt: new Date(2026, 10, 19, 8, 0).toISOString() }),
        todo({ id: 't2', completed: true, completedAt: new Date(2026, 10, 19, 10, 0).toISOString() }),
        todo({ id: 't3', completed: true, completedAt: new Date(2026, 10, 18, 10, 0).toISOString() }),
        todo({ id: 't4', completed: false }),
        todo({ id: 't5', completed: true, completedAt: new Date(2026, 10, 19, 11, 0).toISOString(), deleted: true }),
        todo({ id: 't6', completed: true, completedAt: null }),
      ],
      habits: [habit('h1'), habit('h2'), habit('h3')],
      habitLogs: { h1: [today], h2: [yesterday], h3: [today] },
      sessions: [session({ id: 's1' }), session({ id: 's2', startedAt: new Date(2026, 10, 18, 9, 0).toISOString() })],
    }, now)

    expect(result).toEqual({ tasks: 2, habits: 2, pomodoros: 1, total: 5 })
  })

  it('does not count archived or unscheduled habits', () => {
    const result = todayCompletion({
      todos: [],
      habits: [habit('archived', { archived: true }), habit('weekend', { frequency: 'weekends' }), habit('not-started', { startDate: '2026-12-01' })],
      habitLogs: { archived: [today], weekend: [today], 'not-started': [today] },
      sessions: [],
    }, now)

    // 2026-11-19 是周四，weekends 习惯当天不安排
    expect(result.habits).toBe(0)
    expect(result.total).toBe(0)
  })

  it('returns zero counts for empty input', () => {
    expect(todayCompletion({ todos: [], habits: [], habitLogs: {}, sessions: [] }, now)).toEqual({
      tasks: 0, habits: 0, pomodoros: 0, total: 0,
    })
  })
})

describe('clampReminderMinutes', () => {
  it('clamps into 0..10080 and rounds to integer', () => {
    expect(clampReminderMinutes(-10)).toBe(0)
    expect(clampReminderMinutes(5.6)).toBe(6)
    expect(clampReminderMinutes(20000)).toBe(10080)
    expect(clampReminderMinutes(45)).toBe(45)
  })

  it('returns null for invalid values', () => {
    expect(clampReminderMinutes(null)).toBeNull()
    expect(clampReminderMinutes(undefined)).toBeNull()
    expect(clampReminderMinutes('abc')).toBeNull()
    expect(clampReminderMinutes(Number.NaN)).toBeNull()
  })
})


describe('page navigation mapping', () => {
  it('maps every page key to its index and back', () => {
    expect(PAGE_KEYS).toEqual(['tasks', 'calendar', 'habits', 'pomodoro', 'memos'])
    PAGE_KEYS.forEach((key, index) => {
      expect(pageIndex(key)).toBe(index)
      expect(pageKey(index)).toBe(key)
    })
  })

  it('clamps out-of-range indexes to page bounds', () => {
    expect(pageKey(-1)).toBe(PAGE_KEYS[0])
    expect(pageKey(999)).toBe(PAGE_KEYS[PAGE_KEYS.length - 1])
    expect(pageIndex('data' as never)).toBe(0)
  })
})


describe('resolvePageFromPager (settings page regression)', () => {
  it('keeps settings page when a pager event fires while settings is open', () => {
    // BUG 复现：设置页打开时 PagerView 仍挂载，分页事件曾把 page 改回业务页导致设置闪退
    for (let position = 0; position < PAGE_KEYS.length; position += 1) {
      expect(resolvePageFromPager('data', position)).toBe('data')
    }
  })

  it('follows pager position for the four swipeable pages', () => {
    PAGE_KEYS.forEach((key, index) => {
      expect(resolvePageFromPager(key, index)).toBe(key)
    })
    expect(resolvePageFromPager('tasks', 2)).toBe('habits')
  })
})


describe('normalizeExtras navigation backfill', () => {
  it('inserts newly added nav items right after 今天 instead of appending to the end', () => {
    const legacy = {
      version: 2, lists: [], habits: [], habitLogs: {}, focusSessions: [], memos: [],
      preferences: { navOrder: ['today', 'pomodoro', 'habits'], navHidden: [] },
    }
    const out = normalizeExtras(legacy as never)
    const order = out.preferences.navOrder
    expect(order[0]).toBe('today')
    expect(order).toContain('memos')
    // 新增项应紧跟 today，而不是被追加到末尾
    expect(order.indexOf('memos')).toBe(1)
  })

  it('defaults to hiding the search entry for legacy data', () => {
    const legacy = { version: 2, preferences: { navHidden: [] } }
    const out = normalizeExtras(legacy as never)
    expect(out.preferences.navHidden).toContain('search')
  })
})
