import type {
  FocusSession,
  FontId,
  Habit,
  NavId,
  HabitFrequency,
  HabitPersistence,
  TodoItem,
  TodoList,
  WidgetKind,
  WidgetSnap,
  WorkspaceExtras,
  WorkspacePreferences,
} from './types'

export const WIDGET_KINDS: Array<{ kind: WidgetKind; label: string; description: string }> = [
  { kind: 'tasks', label: '任务', description: '直观聚焦任务列表' },
  { kind: 'calendar', label: '日历', description: '轻松查看所有日程' },
  { kind: 'quadrant', label: '四象限', description: '轻重缓急一目了然' },
  { kind: 'habits', label: '习惯', description: '轻松打卡养成好习惯' },
  { kind: 'countdown', label: '倒数纪念日', description: '记录每一个重要的日子' },
  { kind: 'assistant', label: 'AI 助手', description: '用自然语言管理任务' },
]

export const HABIT_GROUPS = ['其他', '健康', '学习', '工作', '生活'] as const
export const HABIT_EMOJIS = ['🌱', '💧', '📖', '🏃', '🧘', '☀️', '🌙', '🎯', '💪', '🍎', '✍️', '🎧'] as const
export const LIST_COLORS = ['#5b8cff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#64d2ff', '#ffd60a', '#8e8e93']

const DEFAULT_LIST_DEFS: Array<Pick<TodoList, 'id' | 'name' | 'color'>> = [
  { id: 'inbox', name: '收集箱', color: '#8e8e93' },
  { id: 'work', name: '工作', color: '#5b8cff' },
  { id: 'personal', name: '个人备忘', color: '#30d158' },
  { id: 'study', name: '学习安排', color: '#bf5af2' },
  { id: 'shopping', name: '购物清单', color: '#ff9f0a' },
  { id: 'fitness', name: '锻炼计划', color: '#ff453a' },
  { id: 'wish', name: '心愿清单', color: '#64d2ff' },
]

export const DEFAULT_PREFERENCES: WorkspacePreferences = {
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  dailyGoal: 8,
  sound: true,
  font: 'system',
  widget: { opacity: 100, darkMode: 'system', alwaysOnTop: true, snap: 'top-right', fontSize: 100 },
  navOrder: ['today', 'pomodoro', 'habits', 'calendar', 'quadrant', 'widgets', 'search', 'assistant', 'notes'],
  navHidden: [],
}

export const NAV_ITEMS: Array<{ id: NavId; label: string }> = [
  { id: 'today', label: '今天' },
  { id: 'pomodoro', label: '番茄专注' },
  { id: 'habits', label: '习惯' },
  { id: 'calendar', label: '日历' },
  { id: 'quadrant', label: '四象限' },
  { id: 'widgets', label: '概览' },
  { id: 'search', label: '搜索' },
  { id: 'assistant', label: 'AI 助手' },
  { id: 'notes', label: '备忘录' },
]

export const FONT_OPTIONS: Array<{ id: FontId; label: string; family: string; category: '无衬线' | '衬线' | '系统' }> = [
  { id: 'system', label: '系统默认', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif', category: '系统' },
  { id: 'source-han-sans', label: '思源黑体', family: '"Source Han Sans SC", "Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", sans-serif', category: '无衬线' },
  { id: 'source-han-serif', label: '思源宋体', family: '"Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "SimSun", serif', category: '衬线' },
  { id: 'pingfang', label: '苹方', family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', category: '无衬线' },
  { id: 'microsoft-yahei', label: '微软雅黑', family: '"Microsoft YaHei", "微软雅黑", sans-serif', category: '无衬线' },
  { id: 'georgia', label: 'Georgia 衬线', family: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif', category: '衬线' },
]

export function createDefaultLists(now = new Date()): TodoList[] {
  const createdAt = now.toISOString()
  return DEFAULT_LIST_DEFS.map((list) => ({ ...list, createdAt }))
}

export function createDefaultExtras(now = new Date()): WorkspaceExtras {
  return {
    version: 2,
    lists: createDefaultLists(now),
    habits: [],
    habitLogs: {},
    focusSessions: [],
    preferences: { ...DEFAULT_PREFERENCES },
    widgets: ['tasks'],
  }
}

/* ── 日期工具：全部使用本地时区，避免跨时区把任务分到错误的一天 ── */

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

export function dateKey(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function parseDateKey(value: string): Date | null {
  if (!isDateKey(value)) return null
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return dateKey(a) === dateKey(b) && dateKey(a) !== ''
}

/* ── 习惯 ─────────────────────────────────────────────────── */

export function isHabitScheduled(habit: Habit, date: Date): boolean {
  if (habit.archived) return false
  const start = parseDateKey(habit.startDate)
  if (start && startOfDay(date).getTime() < start.getTime()) return false
  const day = date.getDay()
  if (habit.frequency === 'weekdays') return day >= 1 && day <= 5
  if (habit.frequency === 'weekends') return day === 0 || day === 6
  return true
}

export function habitStreak(habit: Habit, logs: readonly string[], now = new Date()): number {
  const done = new Set(logs)
  let cursor = startOfDay(now)
  let streak = 0
  const today = dateKey(now)
  for (let guard = 0; guard < 730; guard += 1) {
    if (isHabitScheduled(habit, cursor)) {
      const key = dateKey(cursor)
      if (done.has(key)) streak += 1
      else if (key !== today) break
    }
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function habitLogsInRange(habit: Habit, logs: readonly string[], from: Date, days: number): boolean[] {
  const done = new Set(logs)
  const result: boolean[] = []
  for (let index = 0; index < days; index += 1) {
    const day = addDays(from, index)
    result.push(isHabitScheduled(habit, day) && done.has(dateKey(day)))
  }
  return result
}

export function toggleHabitLog(logs: readonly string[], day: string): string[] {
  if (!isDateKey(day)) return [...logs]
  const set = new Set(logs)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return [...set].sort()
}

/* ── 任务查询 ─────────────────────────────────────────────── */

export function dueDayKey(todo: Pick<TodoItem, 'dueAt'>): string | null {
  return todo.dueAt ? dateKey(todo.dueAt) || null : null
}

export function isDueOn(todo: Pick<TodoItem, 'dueAt'>, day: string): boolean {
  return dueDayKey(todo) === day
}

export function collectTags(todos: readonly TodoItem[]): string[] {
  const tags = new Set<string>()
  for (const todo of todos) {
    if (todo.deleted) continue
    for (const tag of todo.tags) tags.add(tag)
  }
  return [...tags].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function matchesTodo(todo: TodoItem, query: string): boolean {
  const term = query.trim().toLowerCase()
  if (!term) return true
  return [todo.title, todo.notes, ...todo.tags].some((value) => value.toLowerCase().includes(term))
}

export function normalizeTags(tags: unknown, max = 12): string[] {
  if (!Array.isArray(tags)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of tags) {
    if (typeof value !== 'string') continue
    const tag = value.trim().replace(/^#/, '').slice(0, 24)
    if (!tag || seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    result.push(tag)
    if (result.length >= max) break
  }
  return result
}

/* ── 专注统计 ─────────────────────────────────────────────── */

export interface FocusStats {
  todayCount: number
  todayMinutes: number
  totalCount: number
  totalMinutes: number
  weekMinutes: number
}

export function focusStats(sessions: readonly FocusSession[], now = new Date()): FocusStats {
  const today = dateKey(now)
  const weekStart = startOfDay(addDays(now, -6)).getTime()
  let todayCount = 0
  let todaySeconds = 0
  let totalSeconds = 0
  let weekSeconds = 0
  for (const session of sessions) {
    if (session.mode !== 'focus') continue
    const started = Date.parse(session.startedAt)
    if (!Number.isFinite(started) || started < weekStart) {
      totalSeconds += session.seconds
      continue
    }
    totalSeconds += session.seconds
    weekSeconds += session.seconds
    if (dateKey(session.startedAt) === today) {
      todayCount += 1
      todaySeconds += session.seconds
    }
  }
  return {
    todayCount,
    todayMinutes: Math.round(todaySeconds / 60),
    totalCount: sessions.filter((session) => session.mode === 'focus').length,
    totalMinutes: Math.round(totalSeconds / 60),
    weekMinutes: Math.round(weekSeconds / 60),
  }
}

/* ── 数据归一化：所有外部数据都必须经过这里 ───────────────── */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function text(value: unknown, fallback = '', max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback
}

function numberIn(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

function colorOf(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function normalizeList(value: unknown): TodoList | null {
  const record = asRecord(value)
  if (!record) return null
  const id = text(record.id, '', 64)
  const name = text(record.name, '', 40)
  if (!id || !name) return null
  return {
    id,
    name,
    color: colorOf(record.color, '#5b8cff'),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  }
}

function normalizeHabit(value: unknown): Habit | null {
  const record = asRecord(value)
  if (!record) return null
  const id = text(record.id, '', 64)
  const name = text(record.name, '', 60)
  if (!id || !name) return null
  const frequency: HabitFrequency = record.frequency === 'weekdays' || record.frequency === 'weekends' ? record.frequency : 'daily'
  const persistence: HabitPersistence = record.persistence === '30' || record.persistence === '60' || record.persistence === '90' ? record.persistence : 'forever'
  const startDate = typeof record.startDate === 'string' && isDateKey(record.startDate) ? record.startDate : dateKey(new Date())
  const reminder = typeof record.reminder === 'string' && /^\d{2}:\d{2}$/.test(record.reminder) ? record.reminder : null
  return {
    id,
    name,
    emoji: text(record.emoji, '🌱', 8) || '🌱',
    color: colorOf(record.color, '#30d158'),
    frequency,
    goal: numberIn(record.goal, 1, 1, 20),
    unit: text(record.unit, '次', 8) || '次',
    startDate,
    persistence,
    group: text(record.group, '其他', 20) || '其他',
    reminder,
    autoLog: Boolean(record.autoLog),
    archived: Boolean(record.archived),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
  }
}

function normalizeSession(value: unknown): FocusSession | null {
  const record = asRecord(value)
  if (!record) return null
  const id = text(record.id, '', 64)
  const startedAt = text(record.startedAt, '', 40)
  const endedAt = text(record.endedAt, '', 40)
  const seconds = numberIn(record.seconds, 0, 0, 24 * 3600)
  if (!id || !startedAt || !endedAt || seconds <= 0) return null
  return {
    id,
    startedAt,
    endedAt,
    seconds,
    mode: record.mode === 'break' ? 'break' : 'focus',
    taskId: typeof record.taskId === 'string' ? record.taskId : null,
  }
}

export function normalizeExtras(value: unknown, now = new Date()): WorkspaceExtras {
  const fallback = createDefaultExtras(now)
  const record = asRecord(value)
  if (!record) return fallback

  const lists: TodoList[] = []
  const listIds = new Set<string>()
  if (Array.isArray(record.lists)) {
    for (const item of record.lists.slice(0, 80)) {
      const list = normalizeList(item)
      if (!list || listIds.has(list.id)) continue
      listIds.add(list.id)
      lists.push(list)
    }
  }
  if (!lists.length) lists.push(...fallback.lists)
  if (!lists.some((list) => list.id === 'inbox')) lists.unshift(fallback.lists[0]!)

  const habits: Habit[] = []
  const habitIds = new Set<string>()
  if (Array.isArray(record.habits)) {
    for (const item of record.habits.slice(0, 200)) {
      const habit = normalizeHabit(item)
      if (!habit || habitIds.has(habit.id)) continue
      habitIds.add(habit.id)
      habits.push(habit)
    }
  }

  const habitLogs: Record<string, string[]> = {}
  const logsRecord = asRecord(record.habitLogs)
  if (logsRecord) {
    for (const habit of habits) {
      const raw = logsRecord[habit.id]
      if (!Array.isArray(raw)) continue
      const days = new Set<string>()
      for (const day of raw.slice(0, 2000)) {
        if (typeof day === 'string' && isDateKey(day)) days.add(day)
      }
      habitLogs[habit.id] = [...days].sort()
    }
  }

  const focusSessions: FocusSession[] = []
  if (Array.isArray(record.focusSessions)) {
    for (const item of record.focusSessions.slice(-3000)) {
      const session = normalizeSession(item)
      if (session) focusSessions.push(session)
    }
  }

  const prefRecord = asRecord(record.preferences) ?? {}
  const widgetPref = asRecord(prefRecord.widget) ?? {}
  const validSnaps: WidgetSnap[] = ['none', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'follow-app']
  const snap = widgetPref.snap
  const validNav = NAV_ITEMS.map((item) => item.id)
  const rawOrder = Array.isArray(prefRecord.navOrder) ? prefRecord.navOrder.filter((id): id is NavId => validNav.includes(id as NavId)) : []
  const navOrder = [...new Set([...rawOrder, ...validNav.filter((id) => !rawOrder.includes(id))])]
  const navHidden = Array.isArray(prefRecord.navHidden)
    ? [...new Set(prefRecord.navHidden.filter((id): id is NavId => validNav.includes(id as NavId)))]
    : []
  const preferences: WorkspacePreferences = {
    pomodoroMinutes: numberIn(prefRecord.pomodoroMinutes, DEFAULT_PREFERENCES.pomodoroMinutes, 1, 180),
    shortBreakMinutes: numberIn(prefRecord.shortBreakMinutes, DEFAULT_PREFERENCES.shortBreakMinutes, 1, 60),
    longBreakMinutes: numberIn(prefRecord.longBreakMinutes, DEFAULT_PREFERENCES.longBreakMinutes, 1, 120),
    dailyGoal: numberIn(prefRecord.dailyGoal, DEFAULT_PREFERENCES.dailyGoal, 1, 30),
    sound: prefRecord.sound !== false,
    font: FONT_OPTIONS.some((item) => item.id === prefRecord.font) ? prefRecord.font as FontId : 'system',
    widget: {
      opacity: numberIn(widgetPref.opacity, 100, 20, 100),
      darkMode: widgetPref.darkMode === 'light' || widgetPref.darkMode === 'dark' ? widgetPref.darkMode : 'system',
      alwaysOnTop: widgetPref.alwaysOnTop !== false,
      snap: typeof snap === 'string' && validSnaps.includes(snap as WidgetSnap) ? snap as WidgetSnap : 'top-right',
      fontSize: numberIn(widgetPref.fontSize, 100, 80, 140),
    },
    navOrder,
    navHidden,
  }

  const widgets: WidgetKind[] = []
  if (Array.isArray(record.widgets)) {
    for (const item of record.widgets) {
      if (WIDGET_KINDS.some((widget) => widget.kind === item) && !widgets.includes(item as WidgetKind)) {
        widgets.push(item as WidgetKind)
      }
    }
  }
  if (!widgets.length) widgets.push('tasks')

  return { version: 2, lists, habits, habitLogs, focusSessions, preferences, widgets }
}
