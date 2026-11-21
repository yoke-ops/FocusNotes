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
  saveError: string
  retrySave(): void
  addTask(draft: TodoDraft): Promise<TodoItem>
  updateTask(id: string, draft: Partial<TodoDraft>): Promise<void>
  toggleTask(id: string): Promise<void>
  removeTask(id: string): Promise<void>
  restoreTask(id: string): Promise<void>
  purgeTask(id: string): Promise<void>
  purgeTrash(): Promise<void>
  updateExtras(patch: (current: WorkspaceExtras) => WorkspaceExtras): void
  replaceAll(todos: TodoItem[], extras: WorkspaceExtras, profileId: string): Promise<void>
  toggleHabit(habitId: string, day: string): void
  addHabit(habit: Habit): void
  updateHabit(habit: Habit): void
  removeHabit(habitId: string): void
  addFocusSession(session: FocusSession): void
  refreshProfile(): Promise<void>
  refreshProfiles(): Promise<void>
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
  const [saveError, setSaveError] = useState('')

  const extrasRef = useRef(extras)
  const profileIdRef = useRef(profile.id)
  const changeVersion = useRef(0)
  const failedTasks = useRef(new Map<string, unknown[]>())
  const pendingTasks = useRef(new Map<string, unknown[]>())
  const pendingExtras = useRef(new Map<string, WorkspaceExtras>())
  const retrying = useRef(false)
  const storeRef = useRef<TodoStore | null>(null)

  const writeWorkspace = useCallback(async (data: { profileId: string; todos?: unknown[]; extras?: WorkspaceExtras; requireActive?: boolean }) => {
    const result = await desktop?.workspace.write(data)
    if (!result?.ok) throw new Error(result?.error || '保存失败，请重试。')
  }, [desktop])

  if (!storeRef.current) {
    const storage: KeyValueStorage = {
      async getItem() {
        return desktop ? null : localStorage.getItem(TODOS_KEY)
      },
      async setItem(_key, raw) {
        localStorage.setItem(TODOS_KEY, raw)
      },
      ...(desktop ? {
        prepareWrite(_key: string, raw: string) {
          const profileId = profileIdRef.current
          const todos = JSON.parse(raw) as unknown[]
          changeVersion.current++
          pendingTasks.current.set(profileId, todos)
          return async () => {
            try {
              await writeWorkspace({ profileId, todos })
              failedTasks.current.delete(profileId)
              if (!failedTasks.current.size && !pendingExtras.current.size) setSaveError('')
            } catch (reason) {
              failedTasks.current.set(profileId, todos)
              setSaveError(reason instanceof Error ? `待办未保存：${reason.message}` : '待办未保存。')
              throw reason
            } finally {
              if (pendingTasks.current.get(profileId) === todos) pendingTasks.current.delete(profileId)
            }
          }
        },
      } : {}),
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
          profileIdRef.current = doc.profile.id
          store.hydrate(doc.todos)
          const next = normalizeExtras(doc.extras)
          extrasRef.current = next
          setExtras(next)
          setProfile(doc.profile)
          setDir(doc.dir)
          if (!Array.isArray(doc.todos) || doc.todos.length === 0) {
            const legacy = localStorage.getItem(TODOS_KEY)
            const migrated = legacy ? normalizeTodos(JSON.parse(legacy)) : []
            if (migrated.length) {
              await store.replace(migrated)
              localStorage.removeItem(TODOS_KEY)
            }
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
        if (alive) setSaveError('无法读取或迁移工作区，请检查档案存储后重试。')
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

  const persistExtras = useCallback(async (profileId: string, next: WorkspaceExtras) => {
    pendingExtras.current.set(profileId, next)
    try {
      if (desktop) await writeWorkspace({ profileId, extras: next })
      else localStorage.setItem(EXTRAS_KEY, JSON.stringify(next))
      if (pendingExtras.current.get(profileId) === next) {
        pendingExtras.current.delete(profileId)
        if (!pendingExtras.current.size && !failedTasks.current.size) setSaveError('')
      }
    } catch (reason) {
      if (pendingExtras.current.get(profileId) === next) {
        setSaveError(reason instanceof Error ? `未保存设置：${reason.message}` : '未保存设置。')
      }
    }
  }, [desktop, writeWorkspace])

  /** 同步合并后整体替换内存与磁盘数据。 */
  const replaceAll = useCallback(async (nextTodos: TodoItem[], nextExtras: WorkspaceExtras, profileId: string) => {
    if (profileIdRef.current !== profileId) return
    const version = changeVersion.current
    if (desktop) await writeWorkspace({ profileId, todos: nextTodos, extras: nextExtras, requireActive: true })
    else localStorage.setItem(TODOS_KEY, JSON.stringify(nextTodos))
    if (profileIdRef.current !== profileId || changeVersion.current !== version) return
    setExtras(nextExtras)
    extrasRef.current = nextExtras
    store.hydrate(nextTodos)
  }, [desktop, store, writeWorkspace])

  const updateExtras = useCallback((patch: (current: WorkspaceExtras) => WorkspaceExtras) => {
    const next = normalizeExtras(patch(extrasRef.current))
    changeVersion.current++
    extrasRef.current = next
    setExtras(next)
    void persistExtras(profileIdRef.current, next)
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

  const refreshProfiles = useCallback(async () => {
    if (!desktop) return
    try { setProfiles((await desktop.profile.list()) as ProfileListLike) } catch { /* 档案列表读取失败。 */ }
  }, [desktop])

  const refreshProfile = useCallback(async () => {
    if (!desktop?.workspace) return
    const doc = await desktop.workspace.read()
    changeVersion.current++
    profileIdRef.current = doc.profile.id
    store.hydrate(pendingTasks.current.get(doc.profile.id) ?? failedTasks.current.get(doc.profile.id) ?? doc.todos)
    const next = pendingExtras.current.get(doc.profile.id) ?? normalizeExtras(doc.extras)
    extrasRef.current = next
    setExtras(next)
    setProfile(doc.profile)
    setDir(doc.dir)
    await refreshProfiles()
  }, [desktop, store, refreshProfiles])

  const retrySave = useCallback(async () => {
    if (retrying.current) return
    retrying.current = true
    try {
      for (const [profileId, todos] of failedTasks.current) {
        if (pendingTasks.current.has(profileId)) continue
        await writeWorkspace({ profileId, todos })
        if (failedTasks.current.get(profileId) === todos) failedTasks.current.delete(profileId)
      }
      for (const [id, next] of pendingExtras.current) await persistExtras(id, next)
      if (!failedTasks.current.size && !pendingExtras.current.size) {
        await refreshProfile()
        setSaveError('')
      }
    } catch (reason) {
      setSaveError(reason instanceof Error ? `重试失败：${reason.message}` : '保存重试失败。')
    } finally {
      retrying.current = false
    }
  }, [persistExtras, refreshProfile, writeWorkspace])

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
    saveError,
    retrySave,
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
    refreshProfiles,
    notify,
  }
}
