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

export interface WidgetAppearance {
  palette?: string
  opacity: number
  darkMode: 'system' | 'light' | 'dark'
  snap: import('@focusnotes/core').WidgetSnap
  fontSize: number
  fontFamily: string
}

export interface WidgetData {
  today: string
  appearance: WidgetAppearance
  items: WidgetItem[]
  widgets: import('@focusnotes/core').WidgetKind[]
  habits: import('@focusnotes/core').Habit[]
  habitLogs: Record<string, string[]>
  openCount: number
  doneToday: number
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
      close(): void
      setAlwaysOnTop(value: boolean): void
      setOpacity(value: number): void
      setEffect(effect: WindowEffect): void
      setMode(mode: 'full' | 'mini'): void
      onWorkspaceChanged(callback: () => void): () => void
      onNavigateView(callback: (view: string) => void): () => void
      setTheme(mode: ThemeMode): void
      onTheme(callback: (payload: ThemeApplyPayload) => void): () => void
      syncReminders(payload: ReminderPayload): void
      testReminder(): void
      notify(payload: { title: string; body: string; silent?: boolean }): void
      setWidgetEnabled(enabled: boolean): void
      memo: {
        read(profileId: string): Promise<string>
        write(profileId: string, body: string): Promise<void>
        copy(body: string): Promise<void>
      }
      exportPersonal(kind: 'lists' | 'habits' | 'history' | 'all'): Promise<{ ok: boolean; message?: string; canceled?: boolean }>
      importPersonal(): Promise<{ ok: boolean; message?: string; canceled?: boolean }>
      widget: {
        read(): Promise<WidgetData>
        toggle(id: string): Promise<{ ok: boolean; error?: string }>
        toggleHabit(habitId: string, day: string): Promise<{ ok: boolean; error?: string }>
        resize(width: number, height: number): void
        appearance(prefs: import('@focusnotes/core').WidgetPreferences & { palette: import('./palettes').PaletteId }): void
        add(title: string): Promise<{ ok: boolean; id?: string; error?: string }>
        openMain(view?: string): void
        close(): void
        onData(callback: (data: WidgetData) => void): () => void
      }
      workspace: {
        read(): Promise<WorkspaceDocument>
        write(data: { todos: unknown[]; extras: WorkspaceExtras }): Promise<{ ok: boolean; error?: string; count?: number }>
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
