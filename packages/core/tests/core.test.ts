import { describe, expect, it } from 'vitest'
import {
  compareTodos,
  createDefaultExtras,
  dateKey,
  getQuadrant,
  habitStreak,
  LocalSmartParser,
  mergeSyncedTodos,
  normalizeTodo,
  normalizeExtras,
  TodoStore,
  toggleHabitLog,
  type KeyValueStorage,
  type Habit,
  type TodoItem,
} from '../src/index'

function todo(patch: Partial<TodoItem>): TodoItem {
  return {
    id: '1', title: '任务', notes: '', dueAt: null, important: false, urgent: false,
    completed: false, completedAt: null, listId: 'inbox', tags: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 1, deleted: false, ...patch,
  }
}

class MemoryStorage implements KeyValueStorage {
  private values = new Map<string, string>()
  async getItem(key: string) { return this.values.get(key) ?? null }
  async setItem(key: string, value: string) { this.values.set(key, value) }
}

it('captures queued destinations and reports failed writes without breaking the queue', async () => {
  let profile = 'first'
  const writes: string[] = []
  const store = new TodoStore({
    getItem: async () => null,
    setItem: async () => {},
    prepareWrite: () => {
      const target = profile
      return async () => {
        writes.push(target)
        if (target === 'first') throw new Error('磁盘不可写')
      }
    },
  })
  const first = store.add({ title: '第一项' })
  profile = 'second'
  const second = store.add({ title: '第二项' })
  await expect(first).rejects.toThrow('磁盘不可写')
  await expect(second).resolves.toMatchObject({ title: '第二项' })
  expect(writes).toEqual(['first', 'second'])
})

describe('待办排序与四象限', () => {
  it('按 DDL 从近到远，无 DDL 和已完成任务靠后', () => {
    const values = [
      todo({ id: 'none' }),
      todo({ id: 'later', dueAt: '2026-12-01T00:00:00.000Z' }),
      todo({ id: 'soon', dueAt: '2026-01-02T00:00:00.000Z' }),
      todo({ id: 'done', dueAt: '2026-01-01T00:00:00.000Z', completed: true }),
    ]
    expect([...values].sort(compareTodos).map((item) => item.id)).toEqual(['soon', 'later', 'none', 'done'])
  })

  it('同等条件下紧急排在重要前面', () => {
    const values = [
      todo({ id: 'important', important: true, createdAt: '2026-01-01T00:00:00.000Z' }),
      todo({ id: 'urgent', urgent: true, createdAt: '2026-01-02T00:00:00.000Z' }),
      todo({ id: 'both', important: true, urgent: true, createdAt: '2026-01-03T00:00:00.000Z' }),
      todo({ id: 'plain', createdAt: '2026-01-01T00:00:00.000Z' }),
    ]
    expect([...values].sort(compareTodos).map((item) => item.id)).toEqual(['both', 'urgent', 'important', 'plain'])
  })

  it('正确计算四象限', () => {
    expect(getQuadrant(todo({ important: true, urgent: true }))).toBe('important-urgent')
    expect(getQuadrant(todo({ important: true }))).toBe('important-not-urgent')
    expect(getQuadrant(todo({ urgent: true }))).toBe('not-important-urgent')
    expect(getQuadrant(todo({}))).toBe('not-important-not-urgent')
  })
})

describe('离线存储', () => {
  it('新增、更新、完成和删除后可以恢复', async () => {
    const storage = new MemoryStorage()
    const store = new TodoStore(storage)
    const created = await store.add({ title: '  提交报告  ', dueAt: '2026-11-18T15:00:00+08:00', important: true })
    expect(created.title).toBe('提交报告')
    await store.toggle(created.id)
    expect(store.items[0]?.completed).toBe(true)
    await store.update(created.id, { title: '提交最终报告' })
    const restored = new TodoStore(storage)
    await restored.load()
    expect(restored.items[0]?.title).toBe('提交最终报告')
    await restored.remove(created.id)
    expect(restored.items).toHaveLength(0)
  })

  it('拒绝空标题与无效日期', async () => {
    const store = new TodoStore(new MemoryStorage())
    await expect(store.add({ title: '  ' })).rejects.toThrow('请输入待办标题')
    await expect(store.add({ title: '任务', dueAt: 'bad-date' })).rejects.toThrow('截止时间格式无效')
  })

  it('持久化可调的截止提醒，并规范化旧或异常数据', async () => {
    const storage = new MemoryStorage()
    const store = new TodoStore(storage)
    const created = await store.add({
      title: '项目评审',
      dueAt: '2026-11-18T15:00:00.000Z',
      reminderMinutesBefore: 15,
    })
    expect(created.reminderMinutesBefore).toBe(15)
    await store.update(created.id, { reminderMinutesBefore: 60 })
    const restored = new TodoStore(storage)
    await restored.load()
    expect(restored.items[0]?.reminderMinutesBefore).toBe(60)

    const older = normalizeTodo({ id: 'legacy', title: '旧数据' })
    expect(older).not.toHaveProperty('reminderMinutesBefore')
    expect(normalizeTodo({ id: 'odd', title: '异常数据', reminderMinutesBefore: -10 })?.reminderMinutesBefore).toBe(0)
  })

  it('软删除进入垃圾桶，可恢复也可彻底清除', async () => {
    const store = new TodoStore(new MemoryStorage())
    const created = await store.add({ title: '买牛奶', tags: ['生活', ' 生活 ', '#采购'] })
    expect(created.listId).toBe('inbox')
    expect(created.tags).toEqual(['生活', '采购'])
    await store.remove(created.id)
    expect(store.items).toHaveLength(0)
    expect(store.trashed).toHaveLength(1)
    await store.restore(created.id)
    expect(store.items).toHaveLength(1)
    await store.remove(created.id)
    await store.purge(created.id)
    expect(store.all).toHaveLength(0)
  })
})

describe('中文智能识别', () => {
  const now = new Date('2026-11-17T10:00:00+08:00')

  it('识别明天下午时间、重要与紧急', async () => {
    const result = await new LocalSmartParser().parse('提醒我明天下午3点提交重要且紧急的报告', now)
    expect(result.title).toContain('提交')
    expect(result.title).toContain('报告')
    expect(result.title).not.toContain('重要')
    expect(result.title).not.toContain('紧急')
    expect(result.title).not.toContain('下午3点')
    expect(result.important).toBe(true)
    expect(result.urgent).toBe(true)
    expect(new Date(result.dueAt!).getHours()).toBe(15)
  })

  it('没有日期时保留空 DDL 并给出提示', async () => {
    const result = await new LocalSmartParser().parse('阅读设计规范', now)
    expect(result.dueAt).toBeNull()
    expect(result.warnings).toHaveLength(1)
  })

  it('识别指定日期与时间', async () => {
    const result = await new LocalSmartParser().parse('12月5日 09:30 参加项目评审', now)
    expect(new Date(result.dueAt!).getMonth()).toBe(11)
    expect(new Date(result.dueAt!).getDate()).toBe(5)
    expect(new Date(result.dueAt!).getHours()).toBe(9)
    expect(new Date(result.dueAt!).getMinutes()).toBe(30)
  })

  it('识别“明晚”并默认晚间时间', async () => {
    const result = await new LocalSmartParser().parse('明晚交设计稿', now)
    expect(result.title).toBe('交设计稿')
    const due = new Date(result.dueAt!)
    expect(due.getDate()).toBe(18)
    expect(due.getHours()).toBe(20)
    expect(due.getMinutes()).toBe(0)
  })

  it('识别“明晚八点半”等中文数字时间', async () => {
    const result = await new LocalSmartParser().parse('明晚八点半交设计稿', now)
    expect(result.title).toBe('交设计稿')
    const due = new Date(result.dueAt!)
    expect(due.getDate()).toBe(18)
    expect(due.getHours()).toBe(20)
    expect(due.getMinutes()).toBe(30)
  })

  it('识别“明早”并默认上午时间', async () => {
    const result = await new LocalSmartParser().parse('明早整理会议室', now)
    expect(result.title).toBe('整理会议室')
    const due = new Date(result.dueAt!)
    expect(due.getDate()).toBe(18)
    expect(due.getHours()).toBe(9)
  })

  it('识别“今晚”组合词', async () => {
    const result = await new LocalSmartParser().parse('今晚十点前复盘今日工作', now)
    expect(result.title).toContain('复盘')
    expect(new Date(result.dueAt!).getDate()).toBe(17)
    expect(new Date(result.dueAt!).getHours()).toBe(22)
  })

  it('识别相对时长“半小时后/2小时后/3天后”', async () => {
    const half = await new LocalSmartParser().parse('半小时后起身活动', now)
    expect(new Date(half.dueAt!).getTime()).toBe(now.getTime() + 30 * 60000)
    expect(half.title).toBe('起身活动')
    const hours = await new LocalSmartParser().parse('2小时后关火', now)
    expect(new Date(hours.dueAt!).getTime()).toBe(now.getTime() + 2 * 3600000)
    const days = await new LocalSmartParser().parse('3天后交年度总结', now)
    expect(new Date(days.dueAt!).getDate()).toBe(20)
  })
})

describe('云同步冲突规则', () => {
  it('优先保留修订号更高的版本，并合并新增任务', () => {
    const local = todo({ id: 'same', title: '本机版本', revision: 2 })
    const remoteNewer = todo({ id: 'same', title: '云端版本', revision: 3 })
    const remoteAdded = todo({ id: 'new', title: '云端新增' })
    const result = mergeSyncedTodos([local], [remoteNewer, remoteAdded])
    expect(result.find((item) => item.id === 'same')?.title).toBe('云端版本')
    expect(result.find((item) => item.id === 'new')?.title).toBe('云端新增')
  })
})

describe('习惯与工作区', () => {
  const habit: Habit = {
    id: 'h1', name: '喝水', emoji: '💧', color: '#30d158', frequency: 'daily', goal: 1,
    unit: '次', startDate: '2026-11-01', persistence: 'forever', group: '健康',
    reminder: null, autoLog: false, archived: false, createdAt: '2026-11-01T00:00:00.000Z',
  }
  const now = new Date(2026, 10, 17, 10, 0, 0)

  it('连续打卡天数会在今天未打卡时保留到昨天', () => {
    expect(dateKey(now)).toBe('2026-11-17')
    expect(habitStreak(habit, ['2026-11-15', '2026-11-16', '2026-11-17'], now)).toBe(3)
    expect(habitStreak(habit, ['2026-11-15', '2026-11-16'], now)).toBe(2)
    expect(habitStreak(habit, ['2026-11-13', '2026-11-16'], now)).toBe(1)
  })

  it('打卡记录可以切换', () => {
    expect(toggleHabitLog([], '2026-11-17')).toEqual(['2026-11-17'])
    expect(toggleHabitLog(['2026-11-17'], '2026-11-17')).toEqual([])
    expect(toggleHabitLog(['2026-11-17'], 'bad')).toEqual(['2026-11-17'])
  })

  it('坏数据会被归一化，默认清单始终存在', () => {
    const extras = normalizeExtras({
      lists: [{ id: 'custom', name: '自定义' }],
      habits: [{ id: 'h2', name: '阅读', frequency: 'weekdays', goal: 99 }],
      habitLogs: { h2: ['2026-11-17', 'bad', '2026-11-17'] },
      widgets: ['habits', 'habits', 'nope'],
      preferences: { pomodoroMinutes: '50' },
    }, new Date(2026, 0, 1))
    expect(extras.lists[0]?.id).toBe('inbox')
    expect(extras.lists).toHaveLength(2)
    expect(extras.habits[0]?.goal).toBe(20)
    expect(extras.habitLogs.h2).toEqual(['2026-11-17'])
    expect(extras.widgets).toEqual(['habits'])
    expect(extras.preferences.pomodoroMinutes).toBe(50)
    expect(createDefaultExtras(now).lists).toHaveLength(7)
  })
})
