export type Quadrant = 'important-urgent' | 'important-not-urgent' | 'not-important-urgent' | 'not-important-not-urgent'

export interface TodoItem {
  id: string
  title: string
  notes: string
  dueAt: string | null
  reminderMinutesBefore?: number | null
  important: boolean
  urgent: boolean
  completed: boolean
  completedAt: string | null
  listId: string
  tags: string[]
  createdAt: string
  updatedAt: string
  revision: number
  deleted: boolean
}

export interface TodoDraft {
  title: string
  notes?: string
  dueAt?: string | null
  reminderMinutesBefore?: number | null
  important?: boolean
  urgent?: boolean
  listId?: string
  tags?: string[]
}

export interface ParsedTodoDraft extends TodoDraft {
  confidence: number
  recognizedTerms: string[]
  warnings: string[]
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  /** Capture destination and other write context before a snapshot enters the queue. */
  prepareWrite?(key: string, value: string): () => Promise<void>
}

export interface UserSession {
  userId: string
  displayName: string
  accessToken: string
  expiresAt: string
}

export type IntegrationState = 'unconfigured' | 'ready' | 'connected' | 'error'

/** 清单：任务的一级归属，内置「收集箱」。 */
export interface TodoList {
  id: string
  name: string
  color: string
  createdAt: string
}

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends'
export type HabitPersistence = 'forever' | '30' | '60' | '90'

/** 习惯定义。打卡记录单独存放在 WorkspaceExtras.habitLogs。 */
export interface Habit {
  id: string
  name: string
  emoji: string
  color: string
  frequency: HabitFrequency
  /** 每天目标次数，1 表示当日完成打卡。 */
  goal: number
  unit: string
  startDate: string
  persistence: HabitPersistence
  group: string
  reminder: string | null
  autoLog: boolean
  archived: boolean
  createdAt: string
}

export interface FocusSession {
  id: string
  startedAt: string
  endedAt: string
  seconds: number
  mode: 'focus' | 'break'
  taskId: string | null
}

export type WidgetKind = 'tasks' | 'calendar' | 'quadrant' | 'habits' | 'countdown' | 'assistant'

/** 小部件吸附方式：桌面四角/边缘，或依附前台应用窗口。 */
export type WidgetSnap = 'none' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'follow-app'

/** 内置字体方案：系统 / 无衬线（思源黑体等）/ 衬线（思源宋体等）。 */
export type FontId = 'system' | 'source-han-sans' | 'source-han-serif' | 'pingfang' | 'microsoft-yahei' | 'georgia'

/** 左侧功能栏可排序/隐藏的视图。 */
export type NavId = 'today' | 'memos' | 'pomodoro' | 'habits' | 'calendar' | 'quadrant' | 'widgets' | 'search' | 'assistant'

export interface WidgetPreferences {
  material: 'frosted' | 'classic' | 'liquid'
  /** Background density percentage. */
  opacity: number
  /** Transparency of the tint applied over the native blur. */
  glassTransparency: number
  glassBlur: number
  darkMode: 'system' | 'light' | 'dark'
  alwaysOnTop: boolean
  snap: WidgetSnap
  /** UI 文字缩放百分比：80 – 140。 */
  fontSize: number
}

export interface WorkspacePreferences {
  pomodoroMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  dailyGoal: number
  sound: boolean
  font: FontId
  widget: WidgetPreferences
  navOrder: NavId[]
  navHidden: NavId[]
}

/** 备忘录：独立于待办的长文本记录。 */
export interface Memo {
  id: string
  title: string
  content: string
  pinned: boolean
  createdAt: string
  updatedAt: string
  revision: number
  deleted: boolean
}

export interface WorkspaceExtras {
  version: number
  lists: TodoList[]
  habits: Habit[]
  /** habitId -> 已打卡日期（YYYY-MM-DD，本地时区）。 */
  habitLogs: Record<string, string[]>
  focusSessions: FocusSession[]
  memos: Memo[]
  preferences: WorkspacePreferences
  /** 已添加到桌面小部件的类型。 */
  widgets: WidgetKind[]
}
