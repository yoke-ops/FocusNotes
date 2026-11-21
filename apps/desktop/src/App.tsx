import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildSyncPayload, createGiteeSync, mergeSyncPayload, type GiteeConfig } from '@focusnotes/core'
import { CalendarPlus, ListTodo, X } from 'lucide-react'
import {
  dateKey,
  FONT_OPTIONS,
  LIST_COLORS,
  sortTodos,
  todayCompletion,
  type TodoDraft,
  type TodoItem,
} from '@focusnotes/core'
import { IconRail } from './components/IconRail'
import { MemosView } from './components/MemosView'
import { Sidebar } from './components/Sidebar'
import { TopBar, MiniTopBar } from './components/TopBar'
import { TaskListView } from './components/TaskListView'
import { TaskDialog } from './components/TaskDialog'
import { TaskRow } from './components/TaskRow'
import { QuickAdd } from './components/QuickAdd'
import { PomodoroView } from './components/PomodoroView'
import { HabitsView } from './components/HabitsView'
import { QuadrantView } from './components/QuadrantView'
import { CalendarView } from './components/CalendarView'
import { AssistantView } from './components/AssistantView'
import { WidgetView } from './components/WidgetView'
import { applyPalette, resolvePalette } from './palettes'
import { resolveMotion } from './motion'
import { SearchDialog } from './components/SearchDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { GlassBackdrop } from './components/GlassBackdrop'
import { ProfileDialog, type ActionResult } from './components/ProfileDialog'
import { useWorkspace } from './useWorkspace'
import { usePomodoroTimer } from './usePomodoroTimer'
import { activeListId, activeTag, listViewId } from './navigation'
import type { ViewId } from './navigation'
import type { ProfileResult, ThemeMode, WindowEffect } from './desktop'

interface EditorState {
  todo?: TodoItem
  defaultDueAt?: string | null
  defaultListId?: string
}

function loadThemeMode(): ThemeMode {
  const saved = window.localStorage.getItem('focusnotes.theme')
  return saved === 'light' || saved === 'dark' || saved === 'sun' ? saved : 'system'
}

function loadBool(key: string, fallback: boolean): boolean {
  const value = window.localStorage.getItem(key)
  return value === null ? fallback : value !== 'false'
}

export default function App() {
  useEffect(() => {
    const saved = Number(localStorage.getItem('focusnotes.uiScale') ?? 1)
    if (Number.isFinite(saved) && saved >= 0.8 && saved <= 1.4 && saved !== 1) void window.focusDesktop?.setZoom(saved)
  }, [])

  const ws = useWorkspace()
  const timer = usePomodoroTimer(ws.extras.preferences, ws.addFocusSession, ws.notify)
  const [view, setView] = useState<ViewId>('today')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [deleting, setDeleting] = useState<TodoItem | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profilesOpen, setProfilesOpen] = useState(false)
  const [error, setError] = useState('')
  const [compactWorkspace, setCompactWorkspace] = useState(() => window.matchMedia('(max-width: 940px)').matches)
  const [sidebarPreference, setSidebarPreference] = useState(() => window.localStorage.getItem('focusnotes.sidebar'))
  const sidebarVisible = sidebarPreference === null ? !compactWorkspace : sidebarPreference === 'open'

  useEffect(() => {
    const query = window.matchMedia('(max-width: 940px)')
    const update = () => setCompactWorkspace(query.matches)
    query.addEventListener('change', update)
    update()
    return () => query.removeEventListener('change', update)
  }, [])

  function toggleSidebar() {
    const next = sidebarVisible ? 'closed' : 'open'
    setSidebarPreference(next)
    window.localStorage.setItem('focusnotes.sidebar', next)
  }

  const [mini, setMini] = useState(() => window.localStorage.getItem('focusnotes.mode') === 'mini')
  const [opacity, setOpacity] = useState(() => {
    const stored = Number(window.localStorage.getItem('focusnotes.opacity') ?? 100)
    return Number.isFinite(stored) ? (stored <= 1 ? Math.round(stored * 100) : stored) : 100
  })
  const [alwaysOnTop, setAlwaysOnTop] = useState(() => loadBool('focusnotes.pin', true))
  const [windowEffect, setWindowEffect] = useState<WindowEffect>(() => {
    const saved = window.localStorage.getItem('focusnotes.effect')
    return saved === 'frosted' || saved === 'liquid' ? saved : 'solid'
  })
  const [windowBlur, setWindowBlur] = useState(() => {
    const value = Number(localStorage.getItem('focusnotes.blur') ?? 14)
    return Number.isFinite(value) ? Math.min(32, Math.max(0, Math.round(value))) : 14
  })
  const [widgetEnabled, setWidgetEnabled] = useState(() => loadBool('focusnotes.widget', true))
  const [themeMode, setThemeMode] = useState<ThemeMode>(loadThemeMode)
  const [palette, setPalette] = useState(() => resolvePalette(window.localStorage.getItem('focusnotes.palette') ?? 'mist').id)
  const [motion, setMotion] = useState(() => resolveMotion(window.localStorage.getItem('focusnotes.motion')))

  useEffect(() => {
    document.documentElement.dataset.motion = motion
    window.localStorage.setItem('focusnotes.motion', motion)
  }, [motion])
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const [remindEnabled, setRemindEnabled] = useState(() => loadBool('focusnotes.remind', true))
  const [leadMinutes, setLeadMinutes] = useState(() => Number(window.localStorage.getItem('focusnotes.remindMinutes') ?? 15))
  const [sunInfo, setSunInfo] = useState<{ city: string; sunrise: number; sunset: number } | null>(null)

  const todos = ws.todos
  const active = useMemo(() => todos.filter((todo) => !todo.deleted), [todos])
  const open = useMemo(() => sortTodos(active.filter((todo) => !todo.completed)), [active])
  const completed = useMemo(() => active.filter((todo) => todo.completed), [active])
  const trashed = useMemo(() => todos.filter((todo) => todo.deleted), [todos])
  const lists = ws.extras.lists
  const todayKey = dateKey(new Date())

  const activeList = activeListId(view)
  const activeTagName = activeTag(view)
  const listName = activeList ? lists.find((list) => list.id === activeList)?.name ?? '清单' : ''

  useEffect(() => { window.focusDesktop?.setAlwaysOnTop(alwaysOnTop); window.localStorage.setItem('focusnotes.pin', String(alwaysOnTop)) }, [alwaysOnTop])
  useEffect(() => {
    window.localStorage.setItem('focusnotes.effect', windowEffect)
  }, [windowEffect])
  useEffect(() => { window.localStorage.setItem('focusnotes.blur', String(windowBlur)) }, [windowBlur])
  useEffect(() => {
    window.focusDesktop?.setWidgetEnabled(widgetEnabled)
    window.localStorage.setItem('focusnotes.widget', String(widgetEnabled))
  }, [widgetEnabled])
  const refreshRef = useRef(ws.refreshProfile)
  refreshRef.current = ws.refreshProfile
  useEffect(() => window.focusDesktop?.onWorkspaceChanged(() => {
    void refreshRef.current().catch(() => setError('无法刷新工作区，请重试。'))
  }), [])
  const refreshProfiles = ws.refreshProfiles
  useEffect(() => { if (profilesOpen) void refreshProfiles() }, [profilesOpen, refreshProfiles])

  // 工作区偏好变化时，把字体与小组件外观同步到主窗口与小部件。
  useEffect(() => {
    const prefs = ws.extras.preferences
    const family = FONT_OPTIONS.find((item) => item.id === prefs.font)?.family || FONT_OPTIONS[0]!.family
    document.documentElement.style.setProperty('--app-font', family)
    window.focusDesktop?.widget.appearance({ ...prefs.widget, motion })
  }, [ws.extras.preferences.font, ws.extras.preferences.widget, motion])

  useEffect(() => {
    applyPalette(palette)
    window.localStorage.setItem('focusnotes.palette', palette)
  }, [palette])

  useEffect(() => window.focusDesktop?.onNavigateView((view) => setView(view as ViewId)), [])
  useEffect(() => { window.focusDesktop?.setOpacity(opacity / 100); window.localStorage.setItem('focusnotes.opacity', String(opacity)) }, [opacity])
  useEffect(() => { window.focusDesktop?.setMode(mini ? 'mini' : 'full'); window.localStorage.setItem('focusnotes.mode', mini ? 'mini' : 'full') }, [mini])

  useEffect(() => {
    window.localStorage.setItem('focusnotes.remind', String(remindEnabled))
    window.localStorage.setItem('focusnotes.remindMinutes', String(leadMinutes))
    window.focusDesktop?.syncReminders({
      enabled: remindEnabled,
      leadMinutes,
      items: active.map(({ id, title, dueAt, completed }) => ({ id, title, dueAt, completed })),
      habits: ws.extras.habits
        .filter((habit) => !habit.archived && habit.reminder)
        .map((habit) => ({ id: habit.id, name: habit.name, reminder: habit.reminder })),
    })
  }, [active, remindEnabled, leadMinutes, ws.extras.habits])

  useEffect(() => {
    window.localStorage.setItem('focusnotes.theme', themeMode)
    window.focusDesktop?.setTheme(themeMode)
    window.localStorage.setItem('focusnotes.mode', mini ? 'mini' : 'full')
    if (themeMode === 'light' || themeMode === 'dark') { setDark(themeMode === 'dark'); return }
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    if (themeMode === 'system') setDark(query.matches)
    const onChange = (event: MediaQueryListEvent) => { if (themeMode === 'system') setDark(event.matches) }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [themeMode, mini])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => window.focusDesktop?.onTheme((payload) => {
    if (payload.error) {
      setSunInfo(null)
      setDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
      return
    }
    if (payload.resolved) setDark(payload.resolved === 'dark')
    setSunInfo(payload.sun ? { city: payload.city || '', sunrise: payload.sun.sunrise, sunset: payload.sun.sunset } : null)
  }), [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = useCallback(async (action: Promise<unknown>) => {
    try { await action; setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败，请重试。') }
  }, [])

  const openNew = (defaults?: Partial<EditorState>) => setEditor({ defaultListId: 'inbox', ...defaults })
  const openTask = (todo: TodoItem) => setEditor({ todo })

  const addList = (name: string) => {
    const colors = LIST_COLORS
    const id = crypto.randomUUID()
    ws.updateExtras((current) => ({
      ...current,
      lists: [...current.lists, { id, name, color: colors[current.lists.length % colors.length]!, createdAt: new Date().toISOString() }],
    }))
    setView(listViewId(id))
  }

  const applyProfileResult = (result: ProfileResult, success: string): ActionResult => {
    if (result.ok) void ws.refreshProfile()
    return { ok: result.ok, message: result.message || result.error || (result.ok ? success : '操作失败，请重试。') }
  }

  const profileHandlers = {
    async switch(id: string): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '记录切换需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.switchTo(id), '已切换记录档案。')
    },
    async create(name: string): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '新建档案需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.create(name), '已创建记录档案。')
    },
    async rename(id: string, name: string): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '重命名需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.rename(id, name), '已重命名。')
    },
    async remove(id: string): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '删除档案需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.remove(id), '已删除记录档案。')
    },
    async exportFile(id: string): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '导出需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.exportFile(id), '已导出记录。')
    },
    async importFile(): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '导入需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.importFile(), '已导入记录。')
    },
    async reveal(): Promise<ActionResult> {
      const api = window.focusDesktop?.profile
      if (!api) return { ok: false, message: '打开文件夹需在 Windows 桌面端使用。' }
      return applyProfileResult(await api.reveal(), '已打开档案文件夹。')
    },
  }

  const completion = useMemo(() => todayCompletion({
    todos: active,
    habits: ws.extras.habits,
    habitLogs: ws.extras.habitLogs,
    sessions: ws.extras.focusSessions,
  }), [active, ws.extras.habits, ws.extras.habitLogs, ws.extras.focusSessions])

  const counts = {
    today: open.filter((todo) => todo.dueAt && dateKey(todo.dueAt) <= todayKey).length,
    recent: open.filter((todo) => todo.updatedAt >= new Date(Date.now() - 6 * 86_400_000).toISOString()).length,
    inbox: open.filter((todo) => todo.listId === 'inbox').length,
    completed: completed.length,
    trash: trashed.length,
  }

  let title = '今天'
  let subtitle = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })
  let content: ReactNode = null

  if (view === 'today') {
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const defaultDueAt = endOfToday.toISOString()
    const todayTasks = open.filter((todo) => todo.dueAt && dateKey(todo.dueAt) <= todayKey)
    const todayCompleted = completed.filter((todo) => todo.completedAt && dateKey(todo.completedAt) === todayKey)
    content = <TaskListView
      key="today"
      today
      tasks={todayTasks}
      completedTasks={todayCompleted}
      lists={lists}
      defaultListId="inbox"
      defaultDueAt={defaultDueAt}
      countdown={active.filter((todo) => todo.tags.includes('纪念日') && todo.dueAt && !todo.completed).slice(0, 4)}
      emptyTitle="今天没有待办"
      onAdd={ws.addTask}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onDelete={(id) => setDeleting(todos.find((todo) => todo.id === id) ?? null)}
      onNewTask={() => openNew({ defaultDueAt })}
    />
  } else if (view === 'recent') {
    const weekAgo = new Date(Date.now() - 6 * 86_400_000).toISOString()
    const recentTasks = open.filter((todo) => todo.updatedAt >= weekAgo || (todo.dueAt && todo.dueAt >= weekAgo.slice(0, 10) && dateKey(todo.dueAt) <= todayKey))
    const recentDone = completed.filter((todo) => todo.completedAt && todo.completedAt >= weekAgo)
    content = <TaskListView
      tasks={recentTasks}
      completedTasks={recentDone}
      lists={lists}
      defaultListId="inbox"
      emptyTitle="最近 7 天很安静"
      emptyHint="这里会显示最近创建、修改和完成的任务。"
      onAdd={ws.addTask}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onDelete={(id) => setDeleting(todos.find((todo) => todo.id === id) ?? null)}
      onNewTask={() => openNew()}
    />
  } else if (view === 'inbox' || activeList || activeTagName) {
    const listId = activeList ?? (view === 'inbox' ? 'inbox' : null)
    const scoped = active.filter((todo) => (listId ? todo.listId === listId : todo.tags.includes(activeTagName!)))
    title = activeList ? listName : activeTagName ? `#${activeTagName}` : '收集箱'
    subtitle = `${scoped.filter((todo) => !todo.completed).length} 件待办`
    content = <TaskListView
      tasks={scoped.filter((todo) => !todo.completed)}
      completedTasks={scoped.filter((todo) => todo.completed)}
      lists={lists}
      defaultListId={listId ?? 'inbox'}
      showQuickAdd
      emptyTitle={activeList ? '这个清单还是空的' : activeTagName ? '还没有带这个标签的任务' : '收集箱已清空'}
      emptyHint="把脑子里的事情先放进来，稍后再整理。"
      onAdd={ws.addTask}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onDelete={(id) => setDeleting(todos.find((todo) => todo.id === id) ?? null)}
      onNewTask={() => openNew({ defaultListId: listId ?? 'inbox' })}
    />
  } else if (view === 'completed') {
    title = '已完成'
    subtitle = `共 ${completed.length} 件`
    content = <TaskListView
      tasks={[]}
      completedTasks={completed}
      lists={lists}
      defaultListId="inbox"
      emptyTitle="还没有完成的任务"
      emptyHint="完成第一件小事之后，它会出现在这里。"
      onAdd={ws.addTask}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onDelete={(id) => setDeleting(todos.find((todo) => todo.id === id) ?? null)}
      onNewTask={() => openNew()}
    />
  } else if (view === 'trash') {
    title = '垃圾桶'
    subtitle = `${trashed.length} 条记录`
    content = <TaskListView
      tasks={[]}
      completedTasks={[]}
      lists={lists}
      defaultListId="inbox"
      trash
      emptyTitle="垃圾桶是空的"
      emptyHint="删除的任务会先放在这里，可以恢复。"
      onAdd={ws.addTask}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onDelete={() => undefined}
      onRestore={(id) => void run(ws.restoreTask(id))}
      onPurge={(id) => void run(ws.purgeTask(id))}
      onPurgeAll={() => void run(ws.purgeTrash())}
      onNewTask={() => setView('today')}
    />
  } else if (view === 'pomodoro') {
    title = '番茄专注'
    subtitle = '一次只做一件事'
    content = <PomodoroView
      preferences={ws.extras.preferences}
      sessions={ws.extras.focusSessions}
      tasks={open}
      timer={timer}
      completion={completion}
    />
  } else if (view === 'memos') {
    title = '备忘录'
    subtitle = '记录长文字，随时回看'
    content = <MemosView
      memos={ws.extras.memos}
      onSave={(memo) => ws.updateExtras((current) => ({ ...current, memos: [memo, ...(current.memos ?? []).filter((item) => item.id !== memo.id)] }))}
      onDelete={(id) => ws.updateExtras((current) => ({
        ...current,
        memos: current.memos.map((memo) => memo.id === id
          ? { ...memo, deleted: true, updatedAt: new Date().toISOString(), revision: memo.revision + 1 }
          : memo),
      }))}
    />
  } else if (view === 'habits') {
    title = '习惯'
    subtitle = '每天一点点，长期看得见'
    content = <HabitsView
      habits={ws.extras.habits}
      habitLogs={ws.extras.habitLogs}
      onToggle={ws.toggleHabit}
      onAdd={ws.addHabit}
      onUpdate={ws.updateHabit}
      onDelete={ws.removeHabit}
    />
  } else if (view === 'calendar') {
    title = '日历'
    subtitle = '把时间放进格子里'
    content = <CalendarView
      tasks={active}
      lists={lists}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onDelete={(id) => setDeleting(todos.find((todo) => todo.id === id) ?? null)}
      onCreate={(day) => {
        const due = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0)
        openNew({ defaultDueAt: due.toISOString() })
      }}
    />
  } else if (view === 'quadrant') {
    title = '四象限'
    subtitle = '先做重要的事'
    content = <QuadrantView
      tasks={active}
      onToggle={(id) => void run(ws.toggleTask(id))}
      onEdit={openTask}
      onUpdate={(id, draft) => void run(ws.updateTask(id, draft))}
    />
  } else if (view === 'assistant') {
    title = 'AI 助手'
    subtitle = '本地运行，数据不出设备'
    content = <AssistantView tasks={active} onAddTask={(draft) => void run(ws.addTask(draft))} onNavigate={setView} />
  } else if (view === 'widgets') {
    title = '概览'
    subtitle = '一屏看到今天'
    content = <WidgetView
      widgets={ws.extras.widgets}
      tasks={active}
      lists={lists}
      habits={ws.extras.habits}
      habitLogs={ws.extras.habitLogs}
      completion={completion}
      onNavigate={setView}
      onToggleTask={(id) => void run(ws.toggleTask(id))}
      onToggleHabit={ws.toggleHabit}
    />
  }

  const searchDialog = searchOpen && <SearchDialog
    tasks={todos}
    lists={lists}
    onClose={() => setSearchOpen(false)}
    onOpenTask={openTask}
    onNavigate={setView}
  />

  const taskDialog = editor && <TaskDialog
    todo={editor.todo}
    lists={lists}
    defaultListId={editor.defaultListId ?? editor.todo?.listId ?? 'inbox'}
    defaultDueAt={editor.defaultDueAt ?? null}
    onClose={() => setEditor(null)}
    onSave={async (draft: TodoDraft, id?: string) => {
      if (id) await ws.updateTask(id, draft)
      else await ws.addTask(draft)
    }}
    onDelete={(id) => { setEditor(null); setDeleting(todos.find((todo) => todo.id === id) ?? null) }}
  />

  const [giteeReady, setGiteeReady] = useState(0)
  const [cloudTarget, setCloudTarget] = useState<{ profileId: string; config: GiteeConfig } | null>(null)
  const [uploading, setUploading] = useState(false)
  const latestWorkspace = useRef(ws)
  latestWorkspace.current = ws
  const lastUpload = useRef<{ target: typeof cloudTarget; todos: typeof ws.todos; extras: typeof ws.extras } | null>(null)

  /** 读取加密保存的 Gitee 配置并首次拉取。 */
  useEffect(() => {
    if (!ws.ready) return
    const profileId = ws.profile.id
    setCloudTarget(null)
    let alive = true
    void (async () => {
      const config = await window.focusDesktop?.gitee.get().catch(() => null)
      if (!alive || !config?.owner || !config?.repo || !config?.token || config.profileId !== profileId) return
      try {
        const remote = await createGiteeSync(config, fetch).pull()
        const current = latestWorkspace.current
        if (!alive || current.profile.id !== profileId) return
        if (remote && !current.saveError) {
          const merged = mergeSyncPayload(buildSyncPayload(current.todos, current.extras), remote)
          await current.replaceAll(merged.todos, {
            ...merged.extras, preferences: current.extras.preferences, widgets: current.extras.widgets,
          }, profileId)
        }
        if (alive) setCloudTarget({ profileId, config })
      } catch {
        if (alive) setError('Gitee 拉取失败。可在设置中重新连接。')
      }
    })()
    return () => { alive = false }
  }, [giteeReady, ws.ready, ws.profile.id])

  /** 本地变更后 3 秒防抖提交，避免连续编辑产生大量 commit。 */
  useEffect(() => {
    if (!cloudTarget || cloudTarget.profileId !== ws.profile.id || uploading || ws.saveError) return
    const previous = lastUpload.current
    if (previous?.target === cloudTarget && previous.todos === ws.todos && previous.extras === ws.extras) return
    const timer = setTimeout(() => {
      lastUpload.current = { target: cloudTarget, todos: ws.todos, extras: ws.extras }
      setUploading(true)
      void createGiteeSync(cloudTarget.config, fetch)
        .push(buildSyncPayload(ws.todos, ws.extras), { mergeRemote: true })
        .catch(() => { if (latestWorkspace.current.profile.id === cloudTarget.profileId) setError('Gitee 提交失败，修改已保留在本机。') })
        .finally(() => setUploading(false))
    }, 3000)
    return () => clearTimeout(timer)
  }, [cloudTarget, uploading, ws.todos, ws.extras, ws.profile.id, ws.saveError])

  const confirmDialog = deleting && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleting(null) }}>
    <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-label="删除任务">
      <h2>移到垃圾桶？</h2>
      <p>“{deleting.title}”会先放进垃圾桶，可以随时恢复。</p>
      <div className="confirm-actions">
        <button className="ghost-button" onClick={() => setDeleting(null)}>取消</button>
        <button className="danger-button" onClick={() => { void run(ws.removeTask(deleting.id)); setDeleting(null) }}>删除</button>
      </div>
    </div>
  </div>

  const profilesDialog = profilesOpen && ws.profiles && <ProfileDialog
    anchored
    dir={ws.profiles.dir}
    activeId={ws.profiles.activeId}
    profiles={ws.profiles.profiles}
    fallback={ws.profiles.fallback}
    onClose={() => setProfilesOpen(false)}
    onSwitch={profileHandlers.switch}
    onCreate={profileHandlers.create}
    onRename={profileHandlers.rename}
    onDelete={profileHandlers.remove}
    onExport={profileHandlers.exportFile}
    onImport={profileHandlers.importFile}
    onReveal={profileHandlers.reveal}
  />

  const settings = settingsOpen && <SettingsDialog
    theme={themeMode}
    palette={palette}
    dark={dark}
    onPalette={setPalette}
    motion={motion}
    onMotion={setMotion}
    alwaysOnTop={alwaysOnTop}
    opacity={opacity}
    windowEffect={windowEffect}
    windowBlur={windowBlur}
    widgetEnabled={widgetEnabled}
    remindersEnabled={remindEnabled}
    leadMinutes={leadMinutes}
    preferences={ws.extras.preferences}
    widgets={ws.extras.widgets}
    profileName={ws.profile.name}
    dataDir={ws.dir}
    onTheme={setThemeMode}
    onAlwaysOnTop={setAlwaysOnTop}
    onOpacity={setOpacity}
    onWindowEffect={setWindowEffect}
    onWindowBlur={setWindowBlur}
    onWidgetEnabled={setWidgetEnabled}
    onReminders={(enabled, minutes) => { setRemindEnabled(enabled); setLeadMinutes(minutes) }}
    onPreferences={(patch) => ws.updateExtras((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }))}
    onWidgets={(widgets) => ws.updateExtras((current) => ({ ...current, widgets }))}
    onWidgetPreferences={(patch) => ws.updateExtras((current) => ({ ...current, preferences: { ...current.preferences, widget: { ...current.preferences.widget, ...patch } } }))}
    onNavigation={(patch) => ws.updateExtras((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }))}
    onExportPersonal={(kind) => { void window.focusDesktop?.exportPersonal(kind).then((result) => { if (!result.canceled) setError(result.message || '') }) }}
    onImportPersonal={() => { void window.focusDesktop?.importPersonal().then((result) => { if (!result.canceled) setError(result.message || '') }) }}
    onOpenProfile={() => { setSettingsOpen(false); setProfilesOpen(true) }}
    onGiteeChanged={() => setGiteeReady((value) => value + 1)}
    onReveal={() => { void profileHandlers.reveal() }}
    onClose={() => setSettingsOpen(false)}
  />

  if (mini) {
    return <div className={`app-shell mini effect-${windowEffect}`}>
      {windowEffect !== 'solid' && <GlassBackdrop blur={windowBlur} />}
      <MiniTopBar onExpand={() => setMini(false)} onMinimize={() => window.focusDesktop?.minimize()} onClose={() => window.focusDesktop?.close()} />
      <main className="mini-content">
        <div className="mini-head">
          <span>{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
          <button className="ghost-button small" onClick={() => openNew()}><CalendarPlus size={13} /> 新建</button>
        </div>
        <QuickAdd lists={lists} defaultListId="inbox" onAdd={ws.addTask} />
        <div className="mini-list">
          {open.length === 0 ? <div className="empty-state small"><ListTodo size={24} /><p>今天已经清空。</p></div> :
            open.slice(0, 12).map((todo) => <TaskRow key={todo.id} todo={todo} lists={lists} compact onToggle={(id) => void run(ws.toggleTask(id))} onEdit={openTask} onDelete={(id) => setDeleting(todos.find((item) => item.id === id) ?? null)} />)}
        </div>
      </main>
      {taskDialog}
      {confirmDialog}
      {profilesDialog}
      {(ws.saveError || error) && <div className="toast" role="alert">{ws.saveError || error}{ws.saveError
        ? <button onClick={ws.retrySave}>重试</button>
        : <button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button>}</div>}
    </div>
  }

  return <div className={`app-shell effect-${windowEffect}`}>
    {windowEffect !== 'solid' && <GlassBackdrop blur={windowBlur} />}
    <IconRail
      view={view}
      theme={dark ? 'dark' : 'light'}
      profileName={ws.profile.name}
      onNavigate={setView}
      onSearch={() => setSearchOpen(true)}
      onSettings={() => setSettingsOpen(true)}
      onProfile={() => setProfilesOpen(true)}
      onToggleTheme={() => setThemeMode(dark ? 'light' : 'dark')}
      navOrder={ws.extras.preferences.navOrder}
      navHidden={ws.extras.preferences.navHidden}
    />
    <Sidebar visible={sidebarVisible} view={view} todos={todos} lists={lists} onNavigate={setView} onAddList={addList} profileName={ws.profile.name} onProfile={() => setProfilesOpen(true)} />
    <main className="workspace">
      <TopBar
        title={title}
        subtitle={subtitle}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={toggleSidebar}
        onSearch={() => setSearchOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onMini={() => setMini(true)}
        onMinimize={() => window.focusDesktop?.minimize()}
        onClose={() => window.focusDesktop?.close()}
      />
      <div className="workspace-scroll">
        {!ws.ready ? <div className="empty-state card"><ListTodo size={28} /><p>正在读取工作区…</p></div> : <div className="view-content" key={view}>{content}</div>}
      </div>
    </main>

    {searchDialog}
    {taskDialog}
    {confirmDialog}
    {settings}
    {profilesDialog}

    {(ws.saveError || error) && <div className="toast" role="alert">{ws.saveError || error}{ws.saveError
      ? <button onClick={ws.retrySave}>重试</button>
      : <button onClick={() => setError('')} aria-label="关闭提示"><X size={14} /></button>}</div>}
  </div>
}
