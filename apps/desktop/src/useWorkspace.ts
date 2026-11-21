import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createDefaultExtras,
  normalizeExtras,
  normalizeTodos,
  TodoStore,
  toggleHabitLog,
  type FocusSession,
  type Habit,
  type KeyValueStorage,
  type TodoDraft,
  type TodoItem,
  type WorkspaceExtras,
} from '@focusnotes/core'

const TODOS_KEY = 'focusnotes.todos.v1'
const EXTRAS_KEY = 'focusnotes.extras.v1'

export interface ProfileListLike {
  dir: string
  fallback?: boolean
  activeId: string
  activeName: string
  profiles: Array<{ id: string; name: string; count: number; pending: number; createdAt: string; updatedAt: string }>
}

export interface WorkspaceProfile {
  id: string
  name: string
}

export interface WorkspaceApi {
  ready: boolean
  todos: TodoItem[]
  extras: WorkspaceExtras
  profile: WorkspaceProfile
  dir: string
  profiles: ProfileListLike | null
  addTask(draft: TodoDraft): Promise<TodoItem>
  updateTask(id: string, draft: Partial<TodoDraft>): Promise<void>
  toggleTask(id: string): Promise<void>
  removeTask(id: string): Promise<void>
  restoreTask(id: string): Promise<void>
  purgeTask(id: string): Promise<void>
  purgeTrash(): Promise<void>
  updateExtras(patch: (current: WorkspaceExtras) => WorkspaceExtras): void
  replaceAll(todos: TodoItem[], extras: WorkspaceExtras): Promise<void>
  toggleHabit(habitId: string, day: string): void
  addHabit(habit: Habit): void
  updateHabit(habit: Habit): void
  removeHabit(habitId: string): void
  addFocusSession(session: FocusSession): void
  refreshProfile(): Promise<void>
  notify(title: string, body: string): void
}

function localExtras(): WorkspaceExtras {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY)
    return normalizeExtras(raw ? JSON.parse(raw) : null)
  } catch {
    return createDefaultExtras()
  }
}

export function useWorkspace(): WorkspaceApi {
  const desktop = typeof window !== 'undefined' ? window.focusDesktop : undefined
  const [ready, setReady] = useState(false)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [extras, setExtras] = useState<WorkspaceExtras>(() => createDefaultExtras())
  const [profile, setProfile] = useState<WorkspaceProfile>({ id: 'local', name: '本机记录' })
  const [dir, setDir] = useState('')
  const [profiles, setProfiles] = useState<ProfileListLike | null>(null)

  const extrasRef = useRef(extras)
  const storeRef = useRef<TodoStore | null>(null)

  if (!storeRef.current) {
    const storage: KeyValueStorage = {
      async getItem() {
        return null
      },
      async setItem(_key, raw) {
        let list: unknown = []
        try {
          list = JSON.parse(raw)
        } catch {
          return
        }
        if (desktop?.workspace) {
          await desktop.workspace.write({ todos: list as unknown[], extras: extrasRef.current })
        } else {
          localStorage.setItem(TODOS_KEY, raw)
        }
      },
    }
    storeRef.current = new TodoStore(storage)
  }
  const store = storeRef.current

  useEffect(() => {
    let alive = true
    const unsubscribe = store.subscribe(() => {
      if (alive) setTodos(store.all)
    })

    async function boot() {
      try {
        if (desktop?.workspace) {
          const doc = await desktop.workspace.read()
          if (!alive) return
          store.hydrate(doc.todos)
          const next = normalizeExtras(doc.extras)
          extrasRef.current = next
          setExtras(next)
          setProfile(doc.profile)
          setDir(doc.dir)
          if (!Array.isArray(doc.todos) || doc.todos.length === 0) {
            const legacy = localStorage.getItem(TODOS_KEY)
            const migrated = legacy ? normalizeTodos(JSON.parse(legacy)) : []
            if (migrated.length) await store.replace(migrated)
          }
          try {
            setProfiles((await desktop.profile.list()) as ProfileListLike)
          } catch { /* 档案列表失败不影响主界面 */ }
        } else {
          await store.load()
          const next = localExtras()
          extrasRef.current = next
          setExtras(next)
        }
      } catch {
        if (!alive) return
        await store.load().catch(() => undefined)
        const next = localExtras()
        extrasRef.current = next
        setExtras(next)
      } finally {
        if (alive) setReady(true)
      }
    }

    void boot()
    return () => {
      alive = false
      unsubscribe()
    }
  }, [desktop, store])

  const persistExtras = useCallback(async (next: WorkspaceExtras) => {
    if (desktop?.workspace) {
      await desktop.workspace.write({ todos: store.all, extras: next })
    } else {
      localStorage.setItem(EXTRAS_KEY, JSON.stringify(next))
    }
  }, [desktop, store])

  /** 同步合并后整体替换内存与磁盘数据。 */
  const replaceAll = useCallback(async (nextTodos: TodoItem[], nextExtras: WorkspaceExtras) => {
    setExtras(nextExtras)
    extrasRef.current = nextExtras
    store.hydrate(nextTodos)
    try {
      if (desktop?.workspace) await desktop.workspace.write({ todos: nextTodos, extras: nextExtras })
      else localStorage.setItem(TODOS_KEY, JSON.stringify(nextTodos))
    } catch { /* 持久化失败不阻塞界面 */ }
  }, [desktop, store])

  const updateExtras = useCallback((patch: (current: WorkspaceExtras) => WorkspaceExtras) => {
    setExtras((current) => {
      const next = normalizeExtras(patch(current))
      extrasRef.current = next
      void persistExtras(next).catch(() => undefined)
      return next
    })
  }, [persistExtras])

  const addTask = useCallback((draft: TodoDraft) => store.add(draft), [store])
  const updateTask = useCallback((id: string, draft: Partial<TodoDraft>) => store.update(id, draft), [store])
  const toggleTask = useCallback((id: string) => store.toggle(id), [store])
  const removeTask = useCallback((id: string) => store.remove(id), [store])
  const restoreTask = useCallback((id: string) => store.restore(id), [store])
  const purgeTask = useCallback((id: string) => store.purge(id), [store])
  const purgeTrash = useCallback(() => store.purgeTrash(), [store])

  const toggleHabit = useCallback((habitId: string, day: string) => {
    updateExtras((current) => ({
      ...current,
      habitLogs: {
        ...current.habitLogs,
        [habitId]: toggleHabitLog(current.habitLogs[habitId] ?? [], day),
      },
    }))
  }, [updateExtras])

  const addHabit = useCallback((habit: Habit) => {
    updateExtras((current) => ({ ...current, habits: [...current.habits, habit], habitLogs: { ...current.habitLogs, [habit.id]: [] } }))
  }, [updateExtras])

  const updateHabit = useCallback((habit: Habit) => {
    updateExtras((current) => ({ ...current, habits: current.habits.map((item) => (item.id === habit.id ? habit : item)) }))
  }, [updateExtras])

  const removeHabit = useCallback((habitId: string) => {
    updateExtras((current) => {
      const habitLogs = { ...current.habitLogs }
      delete habitLogs[habitId]
      return { ...current, habits: current.habits.filter((item) => item.id !== habitId), habitLogs }
    })
  }, [updateExtras])

  const addFocusSession = useCallback((session: FocusSession) => {
    updateExtras((current) => ({ ...current, focusSessions: [...current.focusSessions, session].slice(-3000) }))
  }, [updateExtras])

  const refreshProfile = useCallback(async () => {
    if (!desktop?.workspace) return
    const doc = await desktop.workspace.read()
    store.hydrate(doc.todos)
    const next = normalizeExtras(doc.extras)
    extrasRef.current = next
    setExtras(next)
    setProfile(doc.profile)
    setDir(doc.dir)
    try {
      setProfiles((await desktop.profile.list()) as ProfileListLike)
    } catch { /* 忽略 */ }
  }, [desktop, store])

  const notify = useCallback((title: string, body: string) => {
    if (desktop) desktop.notify({ title, body })
    else if (typeof Notification !== 'undefined') {
      try {
        new Notification(title, { body })
      } catch { /* 浏览器可能拒绝通知 */ }
    }
  }, [desktop])

  return {
    ready,
    todos,
    extras,
    profile,
    dir,
    profiles,
    addTask,
    updateTask,
    toggleTask,
    removeTask,
    restoreTask,
    purgeTask,
    purgeTrash,
    updateExtras,
    replaceAll,
    toggleHabit,
    addHabit,
    updateHabit,
    removeHabit,
    addFocusSession,
    refreshProfile,
    notify,
  }
}
