import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated, Easing, NativeModules, PermissionsAndroid, Platform, StatusBar, StyleSheet, TextInput, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Slider from '@react-native-community/slider'
import PagerView, { type PagerViewOnPageScrollEvent, type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import { CalendarDays, Check, Cloud, Database, Flame, ListTodo, NotebookPen, Plus, Upload, Download, Pencil, Settings, Timer } from 'lucide-react-native'
import {
  buildSyncPayload,
  clampReminderMinutes,
  createDefaultExtras,
  createGiteeSync,
  mergeSyncPayload,
  type GiteeConfig,
  dateKey,
  habitStreak,
  isHabitScheduled,
  mergeSyncedTodos,
  normalizeExtras,
  normalizeTodos,
  pageIndex,
  pageKey,
  PAGE_KEYS,
  resolvePageFromPager,
  QUADRANTS,
  TodoStore,
  toggleHabitLog,
  type FocusSession,
  type Quadrant,
  type TodoItem,
  type TodoList,
  type WorkspaceExtras,
} from '@focusnotes/core'
import { SmartComposer } from './src/components/SmartComposer'
import { MemosView } from './src/components/MemosView'
import { TodoItemCard } from './src/components/TodoItemCard'
import { EditTodoModal } from './src/components/EditTodoModal'
import { CalendarView } from './src/components/CalendarView'
import { HabitsView } from './src/components/HabitsView'
import { PomodoroView } from './src/components/PomodoroView'
import { TodoListDialog } from './src/components/TodoListDialog'
import { usePomodoroTimer } from './src/usePomodoroTimer'
import {
  ThemeProvider,
  ThemedKeyboardAvoidingView as KeyboardAvoidingView,
  ThemedPressable as Pressable,
  ThemedSafeAreaView as SafeAreaView,
  ThemedScrollView as ScrollView,
  ThemedText as Text,
  ThemedView as View,
} from './src/theme'

const storage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: async (key: string, value: string) => { await AsyncStorage.setItem(key, value) },
}

type Filter = 'all' | Quadrant
type Page = 'tasks' | 'calendar' | 'habits' | 'pomodoro' | 'memos' | 'data'
type LayoutDensity = 'compact' | 'standard' | 'spacious'
interface WidgetModule {
  updateTodos(json: string): void
  updateHabits(json: string): void
  updatePrefs(json: string): void
  syncTimer(json: string): void
  startNoise(scenes: string, volume: number): void
  setNoiseScenes(scenes: string): void
  setNoiseVolume(volume: number): void
  setNoiseSleepTimer(minutes: number): void
  stopNoise(): void
  syncReminders(json: string): void
  addToCalendar(title: string, notes: string, dueAt: string): Promise<boolean>
  exportData(json: string): Promise<boolean>
  importData(): Promise<{ contents: string } | null>
  openSyncFile(): Promise<{ contents: string; uri: string } | null>
  saveSyncFile(uri: string, json: string): Promise<boolean>
}
interface DataDocument { todos: unknown[]; extras?: unknown }

function quadrantOf(todo: TodoItem): Quadrant {
  return todo.important ? (todo.urgent ? 'important-urgent' : 'important-not-urgent') : (todo.urgent ? 'not-important-urgent' : 'not-important-not-urgent')
}

function mergeExtras(local: WorkspaceExtras, incoming: unknown): WorkspaceExtras {
  const remote = normalizeExtras(incoming)
  const lists = new Map(local.lists.map((item) => [item.id, item]))
  for (const item of remote.lists) lists.set(item.id, item)
  const habits = new Map(local.habits.map((item) => [item.id, item]))
  for (const item of remote.habits) habits.set(item.id, item)
  const habitLogs: Record<string, string[]> = {}
  for (const habit of habits.values()) {
    habitLogs[habit.id] = [...new Set([...(local.habitLogs[habit.id] ?? []), ...(remote.habitLogs[habit.id] ?? [])])].sort()
  }
  const sessions = new Map(local.focusSessions.map((item) => [item.id, item]))
  for (const item of remote.focusSessions) sessions.set(item.id, item)
  const hasPreferences = Boolean(incoming && typeof incoming === 'object' && !Array.isArray(incoming) && 'preferences' in incoming)
  return normalizeExtras({
    ...local,
    lists: [...lists.values()],
    habits: [...habits.values()],
    habitLogs,
    focusSessions: [...sessions.values()],
    preferences: hasPreferences ? remote.preferences : local.preferences,
    widgets: [...new Set([...local.widgets, ...remote.widgets])],
  })
}

function documentFromJson(raw: string): DataDocument {
  const parsed: unknown = JSON.parse(raw)
  if (Array.isArray(parsed)) return { todos: parsed }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { todos?: unknown }).todos)) {
    throw new Error('文件格式不正确，找不到待办数据。')
  }
  return parsed as DataDocument
}

const TAB_COUNT = 5
const TAB_PADDING = 12

export default function App() {
  const store = useMemo(() => new TodoStore(storage), [])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [extras, setExtras] = useState<WorkspaceExtras>(() => createDefaultExtras())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')
  const [page, setPage] = useState<Page>('tasks')
  const [selectedListId, setSelectedListId] = useState('all')
  const [editingList, setEditingList] = useState<TodoList | 'new' | null>(null)
  const [editing, setEditing] = useState<TodoItem | 'new' | null>(null)
  const [defaultDueAt, setDefaultDueAt] = useState<string | null>(null)
  const [layoutDensity, setLayoutDensity] = useState<LayoutDensity>('standard')
  const [layoutScale, setLayoutScale] = useState(1)
  const [defaultReminderMinutesBefore, setDefaultReminderMinutesBefore] = useState(10)
  const [gitee, setGitee] = useState<GiteeConfig | null>(null)
  const [giteeDraft, setGiteeDraft] = useState({ owner: '', repo: '', branch: 'master', path: 'focusnotes/data.json', token: '' })
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const [syncNote, setSyncNote] = useState('')
  const systemColorScheme = useColorScheme()
  const extrasRef = useRef(extras)
  extrasRef.current = extras
  const pagerRef = useRef<PagerView>(null)
  const pillX = useRef(new Animated.Value(0)).current
  const [tabBarWidth, setTabBarWidth] = useState(0)
  const darkMode = extras.preferences.widget.darkMode
  const isDark = darkMode === 'dark' || (darkMode === 'system' && systemColorScheme === 'dark')
  const pageBg = isDark ? '#171a20' : '#f5f5f7'
  const tabBorder = isDark ? '#2c3038' : '#e5e5ea'
  const fontScale = extras.preferences.widget.fontSize / 100

  const updateExtras = useCallback(async (update: (current: WorkspaceExtras) => WorkspaceExtras) => {
    const next = normalizeExtras(update(extrasRef.current))
    extrasRef.current = next
    setExtras(next)
    await AsyncStorage.setItem('focusnotes.extras.v1', JSON.stringify(next))
  }, [])

  const saveFocusSession = useCallback((session: FocusSession) => updateExtras((current) => ({
    ...current,
    focusSessions: [...current.focusSessions, session].slice(-3000),
  })), [updateExtras])
  const timer = usePomodoroTimer(extras.preferences, saveFocusSession)

  useEffect(() => {
    const unsubscribe = store.subscribe(() => setTodos(store.all))
    Promise.all([store.load(), AsyncStorage.getItem('focusnotes.extras.v1')])
      .then(([, raw]) => setExtras(normalizeExtras(raw ? JSON.parse(raw) : null)))
      .catch((reason) => Alert.alert('读取失败', reason instanceof Error ? reason.message : '本地数据读取失败。'))
      .finally(() => setLoading(false))
    return unsubscribe
  }, [store])

  useEffect(() => {
    void AsyncStorage.getItem('focusnotes.mobileDensity')
      .then((value) => {
        if (value === 'compact' || value === 'standard' || value === 'spacious') setLayoutDensity(value)
        const scale = Number(value)
        if (Number.isFinite(scale) && scale >= 0.8 && scale <= 1.3) setLayoutScale(scale)
      })
      .catch((reason) => Alert.alert('读取失败', reason instanceof Error ? reason.message : '无法读取界面布局设置。'))
  }, [])

  useEffect(() => {
    void AsyncStorage.getItem('focusnotes.mobileDefaultReminder')
      .then((value) => {
        const minutes = Number(value)
        const clamped = clampReminderMinutes(value, 120)
        if (clamped !== null) setDefaultReminderMinutesBefore(clamped)
      })
      .catch((reason) => Alert.alert('读取失败', reason instanceof Error ? reason.message : '无法读取提醒设置。'))
  }, [])

  useEffect(() => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    const payload = todos.filter((todo) => !todo.completed && !todo.deleted).slice(0, 12).map((todo) => ({ id: todo.id, title: todo.title, dueAt: todo.dueAt, color: QUADRANTS[quadrantOf(todo)].color }))
    widget?.updateTodos(JSON.stringify(payload))
  }, [todos])

  useEffect(() => {
    if (loading) return
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    const reminders = todos
      .filter((todo) => !todo.completed && !todo.deleted && Boolean(todo.dueAt))
      .map((todo) => ({
        id: todo.id,
        title: todo.title,
        dueAt: todo.dueAt,
        reminderMinutesBefore: todo.reminderMinutesBefore === undefined
          ? defaultReminderMinutesBefore
          : todo.reminderMinutesBefore ?? 0,
      }))
      .filter((todo) => todo.reminderMinutesBefore > 0)
    widget?.syncReminders(JSON.stringify(reminders))
  }, [todos, loading, defaultReminderMinutesBefore])

  useEffect(() => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    const now = new Date()
    const today = dateKey(now)
    const habits = extras.habits.filter((habit) => !habit.archived).slice(0, 3).map((habit) => {
      const logs = extras.habitLogs[habit.id] ?? []
      return { name: habit.name, emoji: habit.emoji, color: habit.color, streak: habitStreak(habit, logs, now), done: logs.includes(today), scheduled: isHabitScheduled(habit, now) }
    })
    widget?.updateHabits(JSON.stringify(habits))
    widget?.updatePrefs(JSON.stringify(extras.preferences.widget))
  }, [extras, systemColorScheme])

  useEffect(() => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    if (!widget) return
    if (!timer.running) {
      widget.syncTimer(JSON.stringify({ running: false }))
      return
    }
    widget.syncTimer(JSON.stringify({
      running: true,
      mode: timer.mode,
      phase: timer.phase,
      remaining: timer.remaining,
      elapsed: timer.elapsed,
    }))
  }, [timer.running, timer.mode, timer.phase])

  useEffect(() => () => {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    widget?.syncTimer(JSON.stringify({ running: false }))
    widget?.stopNoise()
  }, [])

  function run(action: Promise<unknown>) {
    action.catch((reason) => Alert.alert('操作失败', reason instanceof Error ? reason.message : '请稍后重试。'))
  }

  function saveExtras(next: WorkspaceExtras) {
    return updateExtras(() => next)
  }

  async function requestNotificationPermission() {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return
    try {
      const permission = 'android.permission.POST_NOTIFICATIONS'
      const status = await PermissionsAndroid.request(permission)
      if (status !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('通知权限未开启', '提醒和计时通知无法显示。可在系统设置中为 FocusNotes 开启通知权限。')
      }
    } catch (reason) {
      Alert.alert('通知权限请求失败', reason instanceof Error ? reason.message : '请在系统设置中允许 FocusNotes 显示通知。')
    }
  }

  async function toggleTimer() {
    if (!timer.running) await requestNotificationPermission()
    timer.toggle()
  }

  function changeLayoutScale(value: number) {
    const scale = Math.round(Math.min(1.3, Math.max(0.8, value)) * 20) / 20
    setLayoutScale(scale)
    setLayoutDensity(scale < 0.92 ? 'compact' : scale > 1.12 ? 'spacious' : 'standard')
    void AsyncStorage.setItem('focusnotes.mobileDensity', String(scale))
      .catch((reason) => Alert.alert('保存失败', reason instanceof Error ? reason.message : '无法保存界面布局设置。'))
  }

  function changeDefaultReminder(minutes: number) {
    const value = clampReminderMinutes(minutes, 120) ?? 0
    setDefaultReminderMinutesBefore(value)
    void AsyncStorage.setItem('focusnotes.mobileDefaultReminder', String(value))
      .catch((reason) => Alert.alert('保存失败', reason instanceof Error ? reason.message : '无法保存提醒设置。'))
  }

  function changeAppearance(mode: 'system' | 'light' | 'dark') {
    run(updateExtras((current) => ({
      ...current,
      preferences: { ...current.preferences, widget: { ...current.preferences.widget, darkMode: mode } },
    })))
  }

  function changeFontSize(size: number) {
    run(updateExtras((current) => ({
      ...current,
      preferences: { ...current.preferences, widget: { ...current.preferences.widget, fontSize: size } },
    })))
  }

  /** 指示条按槽位宽度做原生驱动的补位动画（不逐帧走 JS，滑动结束才动，避免掉帧）。 */
  function movePill(index: number) {
    const slot = tabBarWidth > 0 ? (tabBarWidth - TAB_PADDING * 2) / TAB_COUNT : 0
    if (!slot) return
    Animated.timing(pillX, {
      toValue: index * slot,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }

  function goToPage(next: Page) {
    const wasSettings = page === 'data'
    setPage(next)
    if (next === 'data') return
    const target = pageIndex(next)
    movePill(target)
    if (wasSettings) {
      // 从设置页返回时 PagerView 刚从 display:none 恢复，等一帧布局完成后再切页。
      requestAnimationFrame(() => pagerRef.current?.setPage(target))
    } else {
      pagerRef.current?.setPage(target)
    }
  }

  function onPageSelected(event: PagerViewOnPageSelectedEvent) {
    const position = event.nativeEvent.position
    movePill(position)
    // 设置页打开时忽略分页事件，避免设置页被切走。
    setPage((current) => resolvePageFromPager(current, position))
  }

  useEffect(() => {
    if (tabBarWidth <= 0) return
    const slot = (tabBarWidth - TAB_PADDING * 2) / TAB_COUNT
    pillX.setValue(pageIndex(page) * slot)
    // 只在第一次测量到宽度时定位，后续由 movePill 动画驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabBarWidth])

  const giteeRef = useRef<GiteeConfig | null>(null)
  const syncingRef = useRef(false)
  const skipPushRef = useRef(false)
  const loadedRef = useRef(false)

  /** 读取已保存的 Gitee 配置。 */
  useEffect(() => {
    void AsyncStorage.getItem('focusnotes.gitee')
      .then((raw) => {
        if (!raw) return
        const parsed = JSON.parse(raw) as GiteeConfig
        if (parsed?.owner && parsed?.repo && parsed?.token) {
          setGitee(parsed)
          giteeRef.current = parsed
          setGiteeDraft({ owner: parsed.owner, repo: parsed.repo, branch: parsed.branch || 'master', path: parsed.path || 'focusnotes/data.json', token: parsed.token })
        }
      })
      .catch(() => undefined)
  }, [])

  /** 进入应用先 pull 一次，把远端合并进本地。 */
  useEffect(() => {
    if (!gitee || loadedRef.current) return
    loadedRef.current = true
    void pullFromGitee()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitee?.owner, gitee?.repo, gitee?.token])

  async function pullFromGitee() {
    const config = giteeRef.current
    if (!config || syncingRef.current) return
    syncingRef.current = true
    setSyncState('syncing')
    try {
      const api = createGiteeSync(config, fetch)
      const remote = await api.pull()
      if (remote) {
        skipPushRef.current = true
        const merged = mergeSyncPayload(buildSyncPayload(store.all, extrasRef.current), remote)
        await store.replace(merged.todos)
        await saveExtras(merged.extras)
        setSyncNote(`已合并远端数据（${new Date().toLocaleTimeString('zh-CN')}）`)
      } else {
        setSyncNote('远端还没有数据，首次保存后会自动上传')
      }
      setSyncState('ok')
    } catch (reason) {
      setSyncState('error')
      setSyncNote(reason instanceof Error ? reason.message : '拉取失败')
    } finally {
      syncingRef.current = false
    }
  }

  /** 把当前状态提交到 Gitee（一次 commit）。 */
  async function pushToGitee() {
    const config = giteeRef.current
    if (!config || syncingRef.current) return
    syncingRef.current = true
    setSyncState('syncing')
    try {
      const api = createGiteeSync(config, fetch)
      await api.push(buildSyncPayload(store.all, extrasRef.current))
      setSyncState('ok')
      setSyncNote(`已上传（${new Date().toLocaleTimeString('zh-CN')}）`)
    } catch (reason) {
      setSyncState('error')
      setSyncNote(reason instanceof Error ? reason.message : '上传失败')
    } finally {
      syncingRef.current = false
    }
  }

  /** 修改后 3 秒防抖提交，短时间连续改动合并成一次 commit。 */
  useEffect(() => {
    const config = giteeRef.current
    if (!config || loading) return
    if (skipPushRef.current) { skipPushRef.current = false; return }
    const timer = setTimeout(() => { void pushToGitee() }, 3000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos, extras, loading])

  async function saveGiteeConfig() {
    const owner = giteeDraft.owner.trim()
    const repo = giteeDraft.repo.trim()
    const token = giteeDraft.token.trim()
    if (!owner || !repo || !token) { Alert.alert('配置不完整', '填写 Gitee 用户名、仓库名和私人令牌。'); return }
    const config: GiteeConfig = { owner, repo, branch: giteeDraft.branch.trim() || 'master', token, path: giteeDraft.path.trim() || 'focusnotes/data.json' }
    setGitee(config)
    giteeRef.current = config
    loadedRef.current = false
    skipPushRef.current = true
    await AsyncStorage.setItem('focusnotes.gitee', JSON.stringify(config)).catch(() => undefined)
    try {
      const ok = await createGiteeSync(config, fetch).test()
      Alert.alert(ok ? '连接成功' : '连接失败', ok ? '配置已保存，正在同步。' : '请检查用户名、仓库名与令牌权限。')
    } catch {
      Alert.alert('连接失败', '无法访问 Gitee，请检查网络。')
    }
  }

  async function saveList(name: string, color: string) {
    const selected = editingList !== 'new' ? editingList : null
    if (extras.lists.some((list) => list.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() && list.id !== selected?.id)) {
      Alert.alert('清单名称已存在', '请使用一个尚未被占用的名称。')
      return
    }
    if (selected) {
      await updateExtras((current) => ({ ...current, lists: current.lists.map((list) => list.id === selected.id ? { ...list, name, color } : list) }))
    } else {
      const list: TodoList = {
        id: `list-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        color,
        createdAt: new Date().toISOString(),
      }
      await updateExtras((current) => ({ ...current, lists: [...current.lists, list] }))
      setSelectedListId(list.id)
    }
    setEditingList(null)
  }

  function deleteList(list: TodoList) {
    if (list.id === 'inbox') return
    Alert.alert('删除这个清单？', `“${list.name}”中的待办会移到“收集箱”。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => run((async () => {
        await Promise.all(store.all.filter((todo) => todo.listId === list.id).map((todo) => store.update(todo.id, { listId: 'inbox' })))
        await updateExtras((current) => ({ ...current, lists: current.lists.filter((item) => item.id !== list.id) }))
        if (selectedListId === list.id) setSelectedListId('inbox')
        setEditingList(null)
      })()) },
    ])
  }

  function confirmDelete(todo: TodoItem) {
    Alert.alert('删除这条待办？', `“${todo.title}”将从本机移除。`, [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => run(store.remove(todo.id)) }])
  }

  function openNew(dueAt: string | null = null) {
    setDefaultDueAt(dueAt)
    setEditing('new')
  }

  function withWidget(): WidgetModule {
    const widget = NativeModules.FocusNotesWidget as WidgetModule | undefined
    if (!widget) throw new Error('当前平台不支持文件操作，请在 Android 版本中使用。')
    return widget
  }

  async function exportData() {
    const doc = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), todos: store.all, extras }, null, 2)
    const saved = await withWidget().exportData(doc)
    if (saved) Alert.alert('导出完成', '完整备份已保存到你选择的位置。')
  }

  async function importData() {
    const picked = await withWidget().importData()
    if (!picked) return
    const incoming = documentFromJson(picked.contents)
    const mergedTodos = mergeSyncedTodos(store.all, normalizeTodos(incoming.todos))
    await store.replace(mergedTodos)
    await saveExtras(mergeExtras(extrasRef.current, incoming.extras))
    Alert.alert('导入完成', '文件中的待办、习惯记录和专注历史已合并到本机。')
  }

  async function syncFile() {
    const picked = await withWidget().openSyncFile()
    if (!picked) return
    const incoming = documentFromJson(picked.contents)
    const mergedTodos = mergeSyncedTodos(store.all, normalizeTodos(incoming.todos))
    const mergedExtras = mergeExtras(extrasRef.current, incoming.extras)
    await store.replace(mergedTodos)
    await saveExtras(mergedExtras)
    const updated = JSON.stringify({ version: 1, syncedAt: new Date().toISOString(), todos: mergedTodos, extras: mergedExtras }, null, 2)
    await withWidget().saveSyncFile(picked.uri, updated)
    Alert.alert('同步完成', '本机与所选 JSON 文件已合并。选择云盘中的同一文件即可在设备间同步。')
  }

  const visible = todos.filter((todo) => !todo.deleted && (filter === 'all' || quadrantOf(todo) === filter))
  const activeCount = todos.filter((todo) => !todo.completed && !todo.deleted && (selectedListId === 'all' || todo.listId === selectedListId)).length
  const activeLists = extras.lists
  const selectedList = activeLists.find((list) => list.id === selectedListId)

  return <ThemeProvider dark={isDark} fontScale={fontScale}>
  <SafeAreaView style={styles.safe}>
    <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? '#171a20' : '#f5f5f7'} />
    <KeyboardAvoidingView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.brand} onPress={() => setPage('data')} accessibilityLabel="打开设置" accessibilityRole="button">
          <View style={styles.brandMark}><Check size={14} color="#fff" strokeWidth={3} /><View style={styles.brandGear}><Settings size={8} color="#fff" strokeWidth={3} /></View></View>
          <Text style={styles.brandText}>FocusNotes</Text>
        </Pressable>
      </View>
      <View style={[styles.tabsBar, { backgroundColor: pageBg, borderBottomColor: tabBorder }]} onLayout={(event) => setTabBarWidth(event.nativeEvent.layout.width)}>
        {tabBarWidth > 0 && <Animated.View pointerEvents="none" style={[styles.tabPill, {
          width: (tabBarWidth - TAB_PADDING * 2) / TAB_COUNT - 8,
          backgroundColor: isDark ? '#1e3a5c' : '#d8eaff',
          transform: [{ translateX: pillX }],
        }]} />}
        {([
          ['tasks', ListTodo, '待办'], ['calendar', CalendarDays, '日历'], ['habits', Flame, '习惯'], ['pomodoro', Timer, '专注'], ['memos', NotebookPen, '备忘'],
        ] as const).map(([key, Icon, label]) => <Pressable key={key} style={styles.tabSlot} onPress={() => goToPage(key)}>
          <View style={[styles.tabInner, page === key && styles.tabInnerActive]}>
            <Icon size={15} color={page === key ? '#0071e3' : '#6e6e73'} />
            <Text style={[styles.tabText, page === key && styles.tabTextSelected]}>{label}</Text>
          </View>
        </Pressable>)}
      </View>
      <PagerView ref={pagerRef} style={[styles.pager, page === 'data' && styles.pagerHidden]} initialPage={pageIndex(page)} onPageSelected={onPageSelected} keyboardDismissMode="on-drag" overdrag={false}>
        <View style={[styles.pagerPage, { backgroundColor: pageBg }]} collapsable={false} key="tasks">
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.round(110 * layoutScale) }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.intro, { marginVertical: Math.round(22 * layoutScale) }]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>此刻，专注。</Text><Text style={styles.subtitle}>{activeCount ? `${activeCount} 项待办，按截止时间有序推进。` : '一切安排妥当，保持从容。'}</Text></View></View>
          <View style={[styles.listPickerHeader, { marginBottom: Math.round(8 * layoutScale) }]}>
            <Text style={styles.listPickerTitle}>清单</Text>
            {selectedList && <Pressable style={styles.manageList} onPress={() => setEditingList(selectedList)}><Pencil size={12} color="#6e6e73" /><Text style={styles.manageListText}>管理</Text></Pressable>}
            <Pressable style={styles.manageList} onPress={() => setEditingList('new')}><Plus size={14} color="#0071e3" /><Text style={styles.addListText}>新清单</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.listPills, { paddingBottom: Math.round(14 * layoutScale) }]}>
            <Pressable style={[styles.listPill, selectedListId === 'all' && styles.listPillSelected]} onPress={() => setSelectedListId('all')}>
              <Text style={[styles.listPillText, selectedListId === 'all' && styles.listPillTextSelected]}>全部</Text>
            </Pressable>
            {activeLists.map((list) => <Pressable key={list.id} style={[styles.listPill, selectedListId === list.id && styles.listPillSelected]} onPress={() => setSelectedListId(list.id)} onLongPress={() => setEditingList(list)}>
              <View style={[styles.listPillDot, { backgroundColor: list.color }]} />
              <Text numberOfLines={1} style={[styles.listPillText, selectedListId === list.id && styles.listPillTextSelected]}>{list.name}</Text>
              <Text style={styles.listPillCount}>{todos.filter((todo) => todo.listId === list.id && !todo.completed && !todo.deleted).length}</Text>
            </Pressable>)}
          </ScrollView>
          <SmartComposer onAdd={async (draft) => {
            if (draft.dueAt && defaultReminderMinutesBefore > 0) await requestNotificationPermission()
            await store.add({ ...draft, listId: selectedListId === 'all' ? (draft.listId ?? 'inbox') : selectedListId })
          }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {(['all', ...Object.keys(QUADRANTS)] as Filter[]).map((key) => <Pressable key={key} style={[styles.filter, filter === key && styles.filterSelected]} onPress={() => setFilter(key)}>{key !== 'all' && <View style={[styles.filterDot, { backgroundColor: QUADRANTS[key].color }]} />}<Text style={[styles.filterText, filter === key && styles.filterTextSelected]}>{key === 'all' ? '全部' : key === 'important-urgent' ? '紧急重要' : key === 'not-important-urgent' ? '紧急' : key === 'important-not-urgent' ? '重要' : '其他'}</Text></Pressable>)}
          </ScrollView>
          <View style={[styles.list, { gap: Math.round(9 * layoutScale) }]}>
            {loading ? <View style={styles.empty}><ListTodo size={30} color="#8e8d93" /><Text style={styles.emptyTitle}>正在读取待办…</Text></View> : (() => {
              const listTodos = visible.filter((todo) => selectedListId === 'all' || todo.listId === selectedListId)
              return listTodos.length ? listTodos.map((todo) => <TodoItemCard key={todo.id} todo={todo} onToggle={(id) => run(store.toggle(id))} onEdit={setEditing} onDelete={confirmDelete} />) : <View style={styles.empty}><ListTodo size={32} color="#8e8d93" /><Text style={styles.emptyTitle}>{selectedList ? `“${selectedList.name}”还没有待办` : filter === 'all' ? '暂无待办' : '此象限暂无待办'}</Text><Text style={styles.emptyText}>用一句话，轻松安排下一件事。</Text></View>
            })()}
          </View>
          <Text style={styles.localStatus}><Text style={styles.savedDot}>●</Text> 已保存在本机</Text>
          </ScrollView>
          <Pressable style={styles.fab} onPress={() => openNew()} accessibilityLabel="新建待办"><Plus size={27} color="#fff" /></Pressable>
        </View>
        <View style={[styles.pagerPage, { backgroundColor: pageBg }]} collapsable={false} key="calendar">
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.round(100 * layoutScale) }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.intro, { marginVertical: Math.round(22 * layoutScale) }]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>安排每一天。</Text><Text style={styles.subtitle}>按日期查看和安排待办。</Text></View></View>
            <CalendarView tasks={todos} onCreate={(day) => openNew(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9).toISOString())} onEdit={setEditing} onToggle={(id) => run(store.toggle(id))} />
          </ScrollView>
        </View>
        <View style={[styles.pagerPage, { backgroundColor: pageBg }]} collapsable={false} key="habits">
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.round(100 * layoutScale) }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.intro, { marginVertical: Math.round(22 * layoutScale) }]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>每天进步一点。</Text><Text style={styles.subtitle}>记录习惯，坚持看得见。</Text></View></View>
            <HabitsView
              habits={extras.habits}
              habitLogs={extras.habitLogs}
              onToggle={(habitId, day) => run(updateExtras((current) => ({ ...current, habitLogs: { ...current.habitLogs, [habitId]: toggleHabitLog(current.habitLogs[habitId] ?? [], day) } })))}
              onAdd={(habit) => run(updateExtras((current) => ({ ...current, habits: [...current.habits, habit], habitLogs: { ...current.habitLogs, [habit.id]: [] } })))}
              onUpdate={(habit) => run(updateExtras((current) => ({ ...current, habits: current.habits.map((item) => item.id === habit.id ? habit : item) })))}
              onDelete={(habitId) => { run(updateExtras((current) => { const habitLogs = { ...current.habitLogs }; delete habitLogs[habitId]; return { ...current, habits: current.habits.filter((habit) => habit.id !== habitId), habitLogs } })) }}
            />
          </ScrollView>
        </View>
        <View style={[styles.pagerPage, { backgroundColor: pageBg }]} collapsable={false} key="pomodoro">
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.round(100 * layoutScale) }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.intro, { marginVertical: Math.round(22 * layoutScale) }]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>专注一件事。</Text><Text style={styles.subtitle}>番茄时钟与可混搭的沉浸环境音。</Text></View></View>
            <PomodoroView
              preferences={extras.preferences}
              sessions={extras.focusSessions}
              tasks={todos}
              timer={timer}
              onAdjustFocusMinutes={(minutes) => run(updateExtras((current) => ({ ...current, preferences: { ...current.preferences, pomodoroMinutes: minutes } })))}
              onToggleTimer={() => run(toggleTimer())}
              onRequestNotification={() => requestNotificationPermission()}
            />
          </ScrollView>
        </View>
        <View style={[styles.pagerPage, { backgroundColor: pageBg }]} collapsable={false} key="memos">
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.round(110 * layoutScale) }]} keyboardShouldPersistTaps="handled">
            <View style={[styles.intro, { marginVertical: Math.round(22 * layoutScale) }]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>随手记下。</Text><Text style={styles.subtitle}>长文字备忘录，随时回看。</Text></View></View>
            <MemosView
              memos={extras.memos}
              onSave={(memo) => run(updateExtras((current) => ({ ...current, memos: [memo, ...(current.memos ?? []).filter((item) => item.id !== memo.id)] })))}
              onDelete={(id) => run(updateExtras((current) => ({ ...current, memos: (current.memos ?? []).filter((item) => item.id !== id) })))}
            />
          </ScrollView>
        </View>
      </PagerView>
      {page === 'data' && <ScrollView style={styles.settingsOverlay} contentContainerStyle={[styles.content, { paddingBottom: Math.round(100 * layoutScale) }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.intro, { marginVertical: Math.round(22 * layoutScale) }]}><View style={styles.introText}><Text style={styles.eyebrow}>MY FOCUS</Text><Text style={styles.title}>设置，按你的习惯。</Text><Text style={styles.subtitle}>外观、提醒、存储和同步。</Text></View></View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>Gitee 云同步</Text><Text style={styles.actionHint}>{gitee ? `${gitee.owner}/${gitee.repo} · ${syncState === 'syncing' ? '同步中…' : syncState === 'ok' ? '已连接' : syncState === 'error' ? '同步失败' : '未同步'}` : '填写后自动上传下载，数据存在你自己的 Gitee 私有仓库'}</Text></View>
            {(['owner', 'repo', 'branch', 'path', 'token'] as const).map((field) => <View key={field} style={styles.giteeRow}>
              <Text style={styles.giteeLabel}>{field === 'owner' ? '用户名' : field === 'repo' ? '仓库' : field === 'branch' ? '分支' : field === 'path' ? '路径' : '令牌'}</Text>
              <TextInput style={styles.giteeInput} value={giteeDraft[field]} autoCapitalize="none" autoCorrect={false}
                secureTextEntry={field === 'token'} placeholder={field === 'token' ? '在 Gitee 设置里生成，仅本机保存' : field === 'branch' ? 'master' : field === 'path' ? 'focusnotes/data.json' : ''}
                placeholderTextColor="#8e8d93"
                onChangeText={(value) => setGiteeDraft((current) => ({ ...current, [field]: value }))} />
            </View>)}
            <View style={styles.giteeActions}>
              <Pressable style={styles.giteeSave} onPress={() => void saveGiteeConfig()}><Text style={styles.giteeSaveText}>保存并连接</Text></Pressable>
              {gitee && <Pressable style={styles.giteeAction} onPress={() => void pullFromGitee()}><Text style={styles.giteeActionText}>立即拉取</Text></Pressable>}
              {gitee && <Pressable style={styles.giteeAction} onPress={() => void pushToGitee()}><Text style={styles.giteeActionText}>立即上传</Text></Pressable>}
            </View>
            {!!syncNote && <Text style={styles.giteeNote}>{syncNote}</Text>}
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>外观模式</Text><Text style={styles.actionHint}>跟随系统，或手动选择明暗主题</Text></View>
            <View style={styles.optionRow}>{([
              ['system', '跟随系统'], ['light', '浅色'], ['dark', '深色'],
            ] as const).map(([value, label]) => <Pressable key={value} style={[styles.densityButton, darkMode === value && styles.densityButtonSelected]} onPress={() => changeAppearance(value)}><Text style={[styles.densityText, darkMode === value && styles.densityTextSelected]}>{label}</Text></Pressable>)}</View>
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>字体大小</Text><Text style={styles.actionHint}>当前 {extras.preferences.widget.fontSize}% · 线性调整</Text></View>
            <Slider style={styles.settingSlider} minimumValue={80} maximumValue={140} step={5}
              value={extras.preferences.widget.fontSize} onSlidingComplete={(value) => changeFontSize(Math.round(value))}
              minimumTrackTintColor="#0071e3" maximumTrackTintColor="#d1d1d6" thumbTintColor="#0071e3" />
            <Text style={styles.sliderScale}><Text>80%</Text><Text>140%</Text></Text>
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>默认提前提醒</Text><Text style={styles.actionHint}>{defaultReminderMinutesBefore === 0 ? '关闭' : `当前 ${defaultReminderMinutesBefore} 分钟前`} · 可拖动调整</Text></View>
            <Slider style={styles.settingSlider} minimumValue={0} maximumValue={120} step={5}
              value={defaultReminderMinutesBefore} onSlidingComplete={(value) => changeDefaultReminder(Math.round(value))}
              minimumTrackTintColor="#0071e3" maximumTrackTintColor="#d1d1d6" thumbTintColor="#0071e3" />
            <Text style={styles.sliderScale}><Text>关闭</Text><Text>120 分钟</Text></Text>
          </View>
          <View style={styles.layoutSettings}>
            <View><Text style={styles.actionTitle}>界面高度</Text><Text style={styles.actionHint}>当前 {Math.round(layoutScale * 100)}% · 紧凑 / 标准 / 宽松</Text></View>
            <Slider style={styles.settingSlider} minimumValue={0.8} maximumValue={1.3} step={0.05}
              value={layoutScale} onSlidingComplete={changeLayoutScale}
              minimumTrackTintColor="#0071e3" maximumTrackTintColor="#d1d1d6" thumbTintColor="#0071e3" />
            <Text style={styles.sliderScale}><Text>紧凑</Text><Text>标准</Text><Text>宽松</Text></Text>
          </View>
          <View style={styles.dataInfo}><Database size={20} color="#0071e3" /><View style={styles.dataInfoText}><Text style={styles.dataTitle}>本地数据存储</Text><Text style={styles.dataHint}>待办、习惯和专注记录保存在此设备的应用存储中。</Text></View></View>
          <Pressable style={styles.dataAction} onPress={() => run(exportData())}><Download size={17} color="#0071e3" /><View style={styles.actionText}><Text style={styles.actionTitle}>导出完整备份</Text><Text style={styles.actionHint}>保存为 JSON 文件，可用于迁移或恢复</Text></View></Pressable>
          <Pressable style={styles.dataAction} onPress={() => run(importData())}><Upload size={17} color="#0071e3" /><View style={styles.actionText}><Text style={styles.actionTitle}>导入并合并</Text><Text style={styles.actionHint}>选择备份文件，合并待办、习惯和历史</Text></View></Pressable>
          <Pressable style={styles.dataAction} onPress={() => run(syncFile())}><Cloud size={17} color="#0071e3" /><View style={styles.actionText}><Text style={styles.actionTitle}>同步云盘文件</Text><Text style={styles.actionHint}>选择云盘中的同一 JSON 文件，双向合并数据</Text></View></Pressable>
          <Text style={styles.syncNote}>云盘同步通过 Android 文件选择器访问你授权的云盘，不会把数据上传到 FocusNotes 服务器。</Text>
      </ScrollView>}
    </KeyboardAvoidingView>
    {editing && <EditTodoModal
      todo={editing === 'new' ? undefined : editing}
      lists={activeLists}
      defaultListId={selectedListId === 'all' ? 'inbox' : selectedListId}
      defaultDueAt={defaultDueAt}
      defaultReminderMinutesBefore={defaultReminderMinutesBefore}
      onClose={() => { setEditing(null); setDefaultDueAt(null) }}
      onSave={async (draft) => {
        if (draft.dueAt && (draft.reminderMinutesBefore ?? 0) > 0) await requestNotificationPermission()
        if (editing === 'new') await store.add(draft)
        else await store.update(editing.id, draft)
      }}
      onAddToCalendar={(title, notes, dueAt) => withWidget().addToCalendar(title, notes, dueAt)}
    />}
    {editingList && <TodoListDialog
      list={editingList === 'new' ? undefined : editingList}
      onClose={() => setEditingList(null)}
      onSave={(name, color) => { run(saveList(name, color)) }}
      onDelete={editingList !== 'new' && editingList.id !== 'inbox' ? () => deleteList(editingList) : undefined}
    />}
  </SafeAreaView>
  </ThemeProvider>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f5f7' },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandGear: { position: 'absolute', right: -3, bottom: -3, width: 13, height: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#1d1d1f' },
  brandMark: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#0071e3' },
  brandText: { color: '#1d1d1f', fontSize: 14, fontWeight: '600', letterSpacing: -.2 },
  cloudButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  cloudText: { color: '#6e6e73', fontSize: 11 },
  content: { paddingHorizontal: 18, paddingBottom: 100 },
  settingSlider: { width: '100%', height: 40, marginTop: 6 },
  giteeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  giteeLabel: { width: 48, color: '#8e8d93', fontSize: 11 },
  giteeInput: { flex: 1, minHeight: 40, paddingHorizontal: 12, color: '#1d1d1f', fontSize: 13, borderRadius: 9, backgroundColor: '#f5f5f7' },
  giteeActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  giteeSave: { minHeight: 38, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#0071e3' },
  giteeSaveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  giteeAction: { minHeight: 38, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#f5f5f7' },
  giteeActionText: { color: '#0071e3', fontSize: 12 },
  giteeNote: { marginTop: 8, color: '#8e8d93', fontSize: 10 },
  sliderScale: { flexDirection: 'row', justifyContent: 'space-between', color: '#8e8d93', fontSize: 10 },
  contentCompact: { paddingBottom: 76 },
  contentSpacious: { paddingBottom: 120 },
  intro: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 22 },
  introCompact: { marginVertical: 14 },
  introSpacious: { marginVertical: 30 },
  introText: { flex: 1 },
  eyebrow: { color: '#0071e3', fontSize: 10, fontWeight: '700', letterSpacing: 1.6 },
  title: { marginTop: 5, color: '#1d1d1f', fontSize: 32, fontWeight: '600', lineHeight: 38, letterSpacing: -1.1 },
  subtitle: { marginTop: 7, color: '#6e6e73', fontSize: 12, lineHeight: 18 },
  filters: { gap: 6, paddingVertical: 18 },
  tabsBar: { flexDirection: 'row', position: 'relative', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  tabSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabPill: { position: 'absolute', left: 16, top: 10, bottom: 10, borderRadius: 14 },
  tabInner: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 14 },
  tabInnerActive: {},
  tabsLayer: { flexGrow: 0 },
  pager: { flex: 1 },
  pagerHidden: { display: 'none' },
  settingsOverlay: { flex: 1 },
  pagerPage: { flex: 1 },
  tabsCompact: { paddingVertical: 6 },
  tabsSpacious: { paddingVertical: 18 },
  tabSelected: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  tabText: { color: '#6e6e73', fontSize: 12 },
  tabTextSelected: { color: '#0071e3', fontWeight: '600' },
  listPickerHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 1, marginBottom: 8 },
  listPickerHeaderCompact: { marginBottom: 3 },
  listPickerTitle: { color: '#8e8d93', fontSize: 11, fontWeight: '600', letterSpacing: .5 },
  manageList: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7 },
  manageListText: { color: '#6e6e73', fontSize: 10 },
  addListText: { color: '#0071e3', fontSize: 10, fontWeight: '600' },
  listPills: { gap: 7, paddingBottom: 14 },
  listPillsCompact: { paddingBottom: 8 },
  listPill: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, borderWidth: 1, borderColor: '#e5e5ea', borderRadius: 18, backgroundColor: '#fff' },
  listPillSelected: { borderColor: '#a8ceff', backgroundColor: '#eef6ff' },
  listPillDot: { width: 7, height: 7, borderRadius: 4 },
  listPillText: { maxWidth: 112, color: '#6e6e73', fontSize: 11 },
  listPillTextSelected: { color: '#0071e3', fontWeight: '600' },
  listPillCount: { color: '#a1a1aa', fontSize: 9 },
  filter: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 14, borderRadius: 19 },
  filterSelected: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterText: { color: '#6e6e73', fontSize: 12 },
  filterTextSelected: { color: '#1d1d1f', fontWeight: '600' },
  list: { gap: 9 },
  listSpacious: { gap: 14 },
  empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 12, color: '#48484a', fontSize: 15, fontWeight: '600' },
  emptyText: { marginTop: 7, color: '#8e8d93', fontSize: 12 },
  localStatus: { marginTop: 22, color: '#8e8d93', fontSize: 10, textAlign: 'center' },
  savedDot: { color: '#30a46c' },
  dataCard: { gap: 4, padding: 16, borderRadius: 16, backgroundColor: '#fff' },
  layoutSettings: { gap: 11, paddingBottom: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  densityOptions: { flexDirection: 'row', gap: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  densityButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#f5f5f7' },
  densityButtonSelected: { backgroundColor: '#eaf3ff' },
  densityText: { color: '#6e6e73', fontSize: 11 },
  densityTextSelected: { color: '#0071e3', fontWeight: '600' },
  dataInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  dataInfoText: { flex: 1 },
  dataTitle: { color: '#1d1d1f', fontSize: 14, fontWeight: '600' },
  dataHint: { marginTop: 4, color: '#8e8d93', fontSize: 11, lineHeight: 16 },
  dataAction: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f0f0f2' },
  actionText: { flex: 1 },
  actionTitle: { color: '#1d1d1f', fontSize: 13, fontWeight: '600' },
  actionHint: { marginTop: 4, color: '#8e8d93', fontSize: 10, lineHeight: 14 },
  syncNote: { marginTop: 12, color: '#8e8d93', fontSize: 10, lineHeight: 15 },
  fab: { position: 'absolute', right: 22, bottom: 28, width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: '#0071e3', shadowColor: '#0071e3', shadowOpacity: .3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
})