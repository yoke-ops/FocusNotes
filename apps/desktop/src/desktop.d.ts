import type { WorkspaceExtras } from '@focusnotes/core'

export {}

export interface ProfileSummary {
  id: string
  name: string
  count: number
  pending: number
  createdAt: string
  updatedAt: string
}

export interface ProfileList {
  dir: string
  fallback?: boolean
  activeId: string
  activeName: string
  profiles: ProfileSummary[]
}

export interface ProfileResult extends Partial<ProfileList> {
  ok: boolean
  error?: string
  message?: string
  canceled?: boolean
}

export interface WorkspaceDocument {
  profile: { id: string; name: string }
  todos: unknown[]
  extras: WorkspaceExtras | null
  dir: string
  fallback?: boolean
}

export interface ReminderPayload {
  enabled: boolean
  leadMinutes: number
  items: Array<{ id: string; title: string; dueAt: string | null; completed: boolean }>
  habits?: Array<{ id: string; name: string; reminder: string | null }>
}

export type ThemeMode = 'system' | 'light' | 'dark' | 'sun'
export type WindowEffect = 'solid' | 'frosted' | 'liquid'

export interface WidgetItem {
  id: string
  title: string
  dueAt: string | null
  important: boolean
  urgent: boolean
  tags: string[]
  overdue: boolean
}

export interface WidgetAppearance extends Pick<import('@focusnotes/core').WidgetPreferences, 'material' | 'opacity' | 'glassTransparency' | 'glassBlur' | 'snap' | 'fontSize'> {
  motion?: import('./motion').MotionMode
  fontFamily: string
}

export interface WidgetData {
  today: string
  appearance: WidgetAppearance
  items: WidgetItem[]
  agendaCounts: Record<string, number>
  quadrantCounts: Record<import('@focusnotes/core').Quadrant, number>
  widgets: import('@focusnotes/core').WidgetKind[]
  habits: import('@focusnotes/core').Habit[]
  habitLogs: Record<string, string[]>
  openCount: number
  doneToday: number
  completion: import('@focusnotes/core').TodayCompletion
  countdowns: Array<{ id: string; title: string; dueAt: string }>
}

export interface ThemeApplyPayload {
  resolved: 'dark' | 'light' | null
  mode: ThemeMode
  city: string
  sun: { sunrise: number; sunset: number } | null
  error: boolean
}

declare global {
  interface Window {
    focusDesktop?: {
      minimize(): void
      glassWallpaper(): Promise<string | null>
      close(): void
      setAlwaysOnTop(value: boolean): void
      setOpacity(value: number): void
      setMode(mode: 'full' | 'mini'): void
      onWorkspaceChanged(callback: () => void): () => void
      onNavigateView(callback: (view: string) => void): () => void
      setTheme(mode: ThemeMode): void
      onTheme(callback: (payload: ThemeApplyPayload) => void): () => void
      syncReminders(payload: ReminderPayload): void
      testReminder(): void
      notify(payload: { title: string; body: string; silent?: boolean }): void
      setWidgetEnabled(enabled: boolean): void
      exportPersonal(kind: 'lists' | 'habits' | 'history' | 'all'): Promise<{ ok: boolean; message?: string; canceled?: boolean }>
      importPersonal(): Promise<{ ok: boolean; message?: string; canceled?: boolean }>
      widget: {
        read(): Promise<WidgetData>
        toggle(id: string): Promise<{ ok: boolean; error?: string }>
        toggleHabit(habitId: string, day: string): Promise<{ ok: boolean; error?: string }>
        resize(width: number, height: number): void
        appearance(prefs: import('@focusnotes/core').WidgetPreferences & { motion?: import('./motion').MotionMode }): void
        add(title: string): Promise<{ ok: boolean; id?: string; error?: string }>
        openMain(view?: string): void
        close(): void
        onData(callback: (data: WidgetData) => void): () => void
      }
      workspace: {
        read(): Promise<WorkspaceDocument>
        write(data: { profileId: string; todos?: unknown[]; extras?: WorkspaceExtras; requireActive?: boolean }): Promise<{ ok: boolean; error?: string; count?: number }>
      }
      appVersion(): Promise<string>
  setZoom(value: number): Promise<number>
  gitee: {
    get(): Promise<{ owner: string; repo: string; branch: string; path: string; token: string; profileId: string | null } | null>
    set(config: { owner: string; repo: string; branch: string; path?: string; token: string }): Promise<{ ok: boolean; encrypted?: boolean; message?: string }>
  }
  profile: {
        read(): Promise<{ profile: { id: string; name: string }; todos: unknown[]; extras?: WorkspaceExtras | null }>
        write(raw: string): Promise<{ ok: boolean; error?: string; count?: number }>
        list(): Promise<ProfileList>
        create(name: string): Promise<ProfileResult>
        switchTo(id: string): Promise<ProfileResult>
        rename(id: string, name: string): Promise<ProfileResult>
        remove(id: string): Promise<ProfileResult>
        exportFile(id: string): Promise<ProfileResult>
        importFile(): Promise<ProfileResult>
        reveal(): Promise<ProfileResult>
      }
    }
  }
}
