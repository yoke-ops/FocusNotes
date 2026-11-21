const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, Notification, dialog, shell, net, screen, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { randomUUID } = require('node:crypto')
const { execFile } = require('node:child_process')
const { glassWallpaper } = require('./wallpaper.cjs')

const development = !app.isPackaged
app.setName(development ? 'FocusNotes Dev' : 'FocusNotes')
app.setPath('userData', path.join(app.getPath('appData'), app.getName()))
app.setAppUserModelId(development ? 'com.focusnotes.desktop.dev' : 'com.focusnotes.desktop')

if (development) {
  app.on('browser-window-created', (_event, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'F12' && !input.isAutoRepeat) {
        event.preventDefault()
        window.webContents.toggleDevTools()
      }
    })
  })
}

/* 只允许一个实例：第二个进程直接退出，并把已有窗口唤到前台。 */
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

let mainWindow = null
let widgetWindow = null
let tray = null
let isQuitting = false
let trayHintShown = false

/* ── 数据目录：优先放在安装位置，写不进去时回退 Roaming ───── */

let dataDir = ''
let dataDirFallback = false

function resolveDataDir() {
  if (!app.isPackaged) return path.join(__dirname, '..', 'data-dev')
  const exeDir = path.dirname(app.getPath('exe'))
  const candidate = path.join(exeDir, 'FocusNotesData')
  try {
    fs.mkdirSync(candidate, { recursive: true })
    const probe = path.join(candidate, '.write-probe')
    fs.writeFileSync(probe, String(Date.now()), 'utf8')
    fs.rmSync(probe, { force: true })
    return candidate
  } catch {
    dataDirFallback = true
    return path.join(app.getPath('userData'), 'FocusNotesData')
  }
}

/* ── 记录档案：独立文件夹，一个档案一个 JSON ───────────────── */

const DEFAULT_PROFILE_ID = 'default'

function profileDir() { return path.join(dataDir, 'profiles') }
function metaPath() { return path.join(profileDir(), 'profiles.json') }

function ensureProfileDir() { fs.mkdirSync(profileDir(), { recursive: true }) }

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}

function writeJson(file, data) {
  ensureProfileDir()
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

function profileDocs() {
  ensureProfileDir()
  return fs.readdirSync(profileDir())
    .filter((name) => name.endsWith('.json') && name !== 'profiles.json' && !name.startsWith('.'))
    .map((name) => readJson(path.join(profileDir(), name), null))
    .filter((doc) => doc && typeof doc.id === 'string' && Array.isArray(doc.todos))
}

function saveDoc(doc) { writeJson(path.join(profileDir(), `${doc.id}.json`), doc) }

const MAX_MEMO_LENGTH = 1_000_000

function uniqueName(base, docs) {
  const trimmed = String(base || '').trim().slice(0, 40) || '新记录'
  if (!docs.some((doc) => doc.name === trimmed)) return trimmed
  let index = 2
  while (docs.some((doc) => doc.name === `${trimmed} (${index})`)) index += 1
  return `${trimmed} (${index})`
}

function ensureProfiles() {
  let docs = profileDocs()
  if (!docs.length) {
    const now = new Date().toISOString()
    const doc = { id: DEFAULT_PROFILE_ID, name: '我的待办', createdAt: now, updatedAt: now, todos: [] }
    saveDoc(doc)
    docs = [doc]
  }
  const meta = readJson(metaPath(), {})
  if (!docs.some((doc) => doc.id === meta.activeId)) writeJson(metaPath(), { activeId: docs[0].id })
  return docs
}

function activeDoc() {
  const meta = readJson(metaPath(), {})
  return readProfileDoc(meta.activeId) || ensureProfiles()[0]
}

function readProfileDoc(id) {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) return null
  const doc = readJson(path.join(profileDir(), `${id}.json`), null)
  return doc?.id === id && Array.isArray(doc.todos) ? doc : null
}

function setActive(id) { writeJson(metaPath(), { activeId: id }) }

function summary(doc) {
  const todos = doc.todos.filter((todo) => todo && !todo.deleted)
  return {
    id: doc.id,
    name: doc.name,
    count: todos.length,
    pending: todos.filter((todo) => !todo.completed).length,
    createdAt: typeof doc.createdAt === 'string' ? doc.createdAt : '',
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : (doc.createdAt || ''),
  }
}

function payload() {
  const docs = ensureProfiles()
  const active = activeDoc()
  return {
    dir: profileDir(),
    fallback: dataDirFallback,
    activeId: active.id,
    activeName: active.name,
    profiles: docs.map(summary).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
  }
}

function normalizeTodos(value) {
  if (!Array.isArray(value)) return null
  return value
    .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string')
    .slice(0, 5000)
}

function newProfileId() {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/* ── 到期提醒 ────────────────────────────────────────────── */

const reminder = { enabled: true, leadMinutes: 120, items: [], habits: [] }
let firedMap = {}
let reminderTimer = null

function firedPath() { return path.join(dataDir, 'reminders.json') }

function migrateLegacyData() {
  try {
    const legacyRoot = path.join(app.getPath('appData'), 'FocusNotes')
    const legacyProfiles = path.join(legacyRoot, 'profiles')
    if (fs.existsSync(legacyProfiles) && !profileDocs().length) {
      ensureProfileDir()
      for (const name of fs.readdirSync(legacyProfiles)) {
        if (name.endsWith('.json')) fs.copyFileSync(path.join(legacyProfiles, name), path.join(profileDir(), name))
      }
    }
    const legacyFired = path.join(legacyRoot, 'reminders.json')
    if (fs.existsSync(legacyFired) && !fs.existsSync(firedPath())) fs.copyFileSync(legacyFired, firedPath())
  } catch { /* 迁移失败则从空档案开始 */ }
}

function loadFired() {
  const raw = readJson(firedPath(), {})
  firedMap = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

function pruneFired(now) {
  for (const key of Object.keys(firedMap)) {
    const stamp = Number(firedMap[key])
    if (!Number.isFinite(stamp) || now - stamp > 7 * 24 * 3600 * 1000) delete firedMap[key]
  }
}

function saveFired() {
  try { writeJson(firedPath(), firedMap) } catch { /* 忽略持久化失败，不影响提醒本身 */ }
}

function formatSpan(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440)
    const hours = Math.round((minutes % 1440) / 60)
    return hours ? `${days} 天 ${hours} 小时` : `${days} 天`
  }
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`
  }
  return `${minutes} 分钟`
}

function showReminder(item, delta) {
  if (!Notification.isSupported()) return
  const due = new Date(Date.parse(item.dueAt))
  const time = `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`
  const notification = new Notification({
    title: delta >= 0 ? `${item.title} · 还有 ${formatSpan(delta)}` : `${item.title} · 已逾期 ${formatSpan(-delta)}`,
    body: delta >= 0 ? `截止时间 ${time}，现在开始处理还来得及。` : `原定 ${time} 截止，点击查看并调整计划。`,
    silent: false,
  })
  notification.on('click', () => { showWindow() })
  notification.show()
}

function checkReminders() {
  if (!reminder.enabled) return
  const now = Date.now()
  const lead = Math.max(1, Number(reminder.leadMinutes) || 120) * 60000
  let dirty = false
  for (const item of reminder.items) {
    if (!item || item.completed || !item.dueAt) continue
    const due = Date.parse(item.dueAt)
    if (!Number.isFinite(due)) continue
    const delta = due - now
    if (delta > lead) continue
    if (delta < -3 * 24 * 3600 * 1000) continue
    const key = `${item.id}@${item.dueAt}`
    if (firedMap[key]) continue
    firedMap[key] = now
    dirty = true
    showReminder(item, delta)
  }
  if (checkHabitReminders(now)) dirty = true
  if (dirty) { pruneFired(now); saveFired() }
}

// 习惯每日提醒：habit.reminder 是本地 HH:MM，按当天日期去重，每天每个习惯最多提醒一次。
function checkHabitReminders(now) {
  let dirty = false
  if (!reminder.enabled || !Array.isArray(reminder.habits)) return false
  const date = new Date(now)
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const current = date.getHours() * 60 + date.getMinutes()
  for (const habit of reminder.habits) {
    if (!habit || !habit.id || !habit.reminder || !/^\d{2}:\d{2}$/.test(habit.reminder)) continue
    const [hours, minutes] = habit.reminder.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours > 23 || minutes > 59) continue
    if (current < hours * 60 + minutes) continue
    const key = `habit:${habit.id}@${today}`
    if (firedMap[key]) continue
    firedMap[key] = now
    dirty = true
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: `${habit.name || '习惯'} · 该打卡了`,
        body: `今天 ${habit.reminder} 的习惯提醒，花一点时间完成它。`,
        silent: false,
      })
      notification.on('click', () => { showWindow(); mainWindow?.webContents.send('navigate:view', 'habits') })
      notification.show()
    }
  }
  return dirty
}

/* ── 深色模式：跟随系统 / 日出日落（OpenWeatherMap）───────── */

const OWM_KEY = '9102f8cf2ecd4342f714693aae47bddb'
const SUN_REFRESH_MS = 30 * 60 * 1000
const theme = { mode: 'system', resolved: null, city: '', sun: null }
let sunTimer = null
let sunFetchedAt = 0

function sunCachePath() { return path.join(dataDir, 'theme.json') }

function pushTheme(error) {
  mainWindow?.webContents.send('theme:apply', {
    resolved: theme.resolved,
    mode: theme.mode,
    city: theme.city,
    sun: theme.sun,
    error: Boolean(error),
  })
}

async function fetchJson(url) {
  const response = await net.fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function locate() {
  const cache = readJson(sunCachePath(), null)
  if (cache && typeof cache.lat === 'number' && typeof cache.lon === 'number') return cache
  for (const url of ['https://ipapi.co/json/', 'https://get.geojs.io/v1/ip/geo.json']) {
    try {
      const geo = await fetchJson(url)
      const lat = Number(geo.latitude ?? geo.lat)
      const lon = Number(geo.longitude ?? geo.lon)
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const located = { lat, lon, city: String(geo.city || ''), fetchedAt: Date.now() }
        writeJson(sunCachePath(), located)
        return located
      }
    } catch { /* 换下一个定位源 */ }
  }
  throw new Error('定位失败')
}

async function refreshSun() {
  const geo = await locate()
  const data = await fetchJson(`https://api.openweathermap.org/data/2.5/weather?lat=${geo.lat}&lon=${geo.lon}&appid=${OWM_KEY}&units=metric`)
  const sunrise = Number(data.sys?.sunrise) * 1000
  const sunset = Number(data.sys?.sunset) * 1000
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) throw new Error('未返回日出日落数据')
  theme.city = geo.city || ''
  theme.sun = { sunrise, sunset }
  sunFetchedAt = Date.now()
  try { writeJson(sunCachePath(), { ...geo, sunrise, sunset, fetchedAt: sunFetchedAt }) } catch { /* 缓存失败不影响 */ }
}

function evaluateSun() {
  if (!theme.sun) return
  const now = Date.now()
  theme.resolved = (now < theme.sun.sunrise || now >= theme.sun.sunset) ? 'dark' : 'light'
  pushTheme(false)
}

function stopSunSchedule() {
  if (sunTimer) { clearInterval(sunTimer); sunTimer = null }
}

function startSunSchedule() {
  stopSunSchedule()
  const cached = readJson(sunCachePath(), null)
  if (cached && Number.isFinite(Number(cached.sunrise)) && Number.isFinite(Number(cached.sunset))) {
    theme.city = String(cached.city || '')
    theme.sun = { sunrise: Number(cached.sunrise), sunset: Number(cached.sunset) }
    evaluateSun()
  }
  refreshSun().then(() => evaluateSun()).catch(() => { if (!theme.sun) pushTheme(true) })
  sunTimer = setInterval(() => {
    const task = Date.now() - sunFetchedAt > SUN_REFRESH_MS
      ? refreshSun().then(() => evaluateSun())
      : Promise.resolve(evaluateSun())
    task.catch(() => { /* 网络失败时沿用上次结果 */ })
  }, 60000)
}



/* ── 窗口与托盘 ──────────────────────────────────────────── */

function showWindow() {
  if (!mainWindow) { createWindow(); return }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function hideToTray(withHint) {
  if (!mainWindow) return
  mainWindow.hide()
  if (withHint && !trayHintShown) {
    trayHintShown = true
    if (Notification.isSupported()) {
      new Notification({ title: 'FocusNotes 已在后台运行', body: '点击任务栏右下角的托盘图标即可恢复窗口。' }).show()
    }
  }
}

const FULL_WINDOW = { width: 1180, height: 800 }
const MINI_WINDOW = { width: 340, height: 520 }

/** 大屏保持 1180×800，小屏按工作区收缩，避免窗口超出屏幕。 */
function fullBounds() {
  const area = screen.getPrimaryDisplay().workAreaSize
  return {
    width: Math.min(FULL_WINDOW.width, Math.max(920, area.width - 60)),
    height: Math.min(FULL_WINDOW.height, Math.max(620, area.height - 60)),
  }
}

function createWindow() {
  const bounds = fullBounds()
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 920,
    minHeight: 620,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))

  mainWindow.once('ready-to-show', () => { mainWindow.center(); mainWindow.show() })
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      hideToTray(false)
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })
}

/* ── 独立桌面小部件：滴答清单式悬浮窗 ─────────────────────── */

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 与 core 的 todayCompletion 口径一致：待办完成 + 习惯打卡 + 番茄。
// main.cjs 为 CommonJS，无法直接 import ESM core，故此处镜像实现；core 侧有对应单测锁定口径。
function todayCompletionMain({ todos, extras, now }) {
  const today = localDay(now)
  const tasks = todos.filter((item) => item.completed && !item.deleted && item.completedAt && localDay(new Date(item.completedAt)) === today).length
  const habits = Array.isArray(extras.habits)
    ? extras.habits.filter((habit) => {
        if (habit.archived) return false
        const start = habit.startDate ? Date.parse(habit.startDate) : Number.NaN
        if (Number.isFinite(start) && startOfDayLocal(new Date(start)) > startOfDayLocal(now)) return false
        if (habit.frequency === 'weekdays' && [0, 6].includes(now.getDay())) return false
        if (habit.frequency === 'weekends' && ![0, 6].includes(now.getDay())) return false
        const logs = extras.habitLogs && Array.isArray(extras.habitLogs[habit.id]) ? extras.habitLogs[habit.id] : []
        return logs.includes(today)
      }).length
    : 0
  const sessions = Array.isArray(extras.focusSessions)
    ? extras.focusSessions.filter((item) => item.mode === 'focus' && item.startedAt && localDay(new Date(item.startedAt)) === today).length
    : 0
  return { tasks, habits, pomodoros: sessions, total: tasks + habits + sessions }
}

function startOfDayLocal(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function widgetData(doc = activeDoc()) {
  const todos = (doc.todos || []).filter((todo) => todo && !todo.deleted)
  const open = todos.filter((todo) => !todo.completed).sort((a, b) => {
    const left = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY
    const right = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY
    return left - right
  })
  const extras = doc.extras && typeof doc.extras === 'object' ? doc.extras : {}
  const fontFamily = FONT_FAMILIES[extras.preferences?.font] || FONT_FAMILIES.system
  const savedMaterial = extras.preferences?.widget?.material
  const material = widgetMaterials.includes(savedMaterial) ? savedMaterial : 'frosted'
  const now = new Date()
  const agendaCounts = Object.fromEntries(Array.from({ length: 4 }, (_, offset) => {
    const day = new Date(now)
    day.setDate(day.getDate() + offset)
    return [localDay(day), 0]
  }))
  const quadrantCounts = { 'important-urgent': 0, 'important-not-urgent': 0, 'not-important-urgent': 0, 'not-important-not-urgent': 0 }
  for (const todo of open) {
    const quadrant = `${todo.important ? 'important' : 'not-important'}-${todo.urgent ? 'urgent' : 'not-urgent'}`
    quadrantCounts[quadrant]++
    if (!todo.dueAt) continue
    const day = localDay(new Date(todo.dueAt))
    if (Object.hasOwn(agendaCounts, day)) agendaCounts[day]++
  }
  const completion = todayCompletionMain({ todos, extras, now })
  return {
    today: localDay(now),
    appearance: { ...widgetPrefs, fontFamily, material },
    agendaCounts,
    quadrantCounts,
    items: open.slice(0, 12).map((todo) => ({
      id: todo.id,
      title: todo.title,
      dueAt: todo.dueAt || null,
      important: Boolean(todo.important),
      urgent: Boolean(todo.urgent),
      tags: Array.isArray(todo.tags) ? todo.tags : [],
      overdue: Boolean(todo.dueAt && Date.parse(todo.dueAt) < +now),
    })),
    widgets: Array.isArray(extras.widgets) ? extras.widgets : ['tasks'],
    habits: Array.isArray(extras.habits) ? extras.habits : [],
    habitLogs: extras.habitLogs && typeof extras.habitLogs === 'object' ? extras.habitLogs : {},
    openCount: open.length,
    doneToday: completion.total,
    completion,
    countdowns: open.filter((todo) => Array.isArray(todo.tags) && todo.tags.includes('纪念日') && todo.dueAt)
      .slice(0, 3)
      .map((todo) => ({ id: todo.id, title: todo.title, dueAt: todo.dueAt })),
  }
}

function pushWidgetData(doc) {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.webContents.send('widget:data', widgetData(doc))
}

function notifyWorkspaceChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('workspace:changed')
  pushWidgetData()
}

/* 字体方案（与 core 的 FONT_OPTIONS 保持一致） */
const FONT_FAMILIES = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
  'source-han-sans': '"Source Han Sans SC", "Noto Sans CJK SC", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  'source-han-serif': '"Source Han Serif SC", "Noto Serif CJK SC", "Noto Serif SC", "SimSun", serif',
  pingfang: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  'microsoft-yahei': '"Microsoft YaHei", "微软雅黑", sans-serif',
  georgia: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif',
}

/* ── 小部件磁吸：桌面边角 / 跟随前台应用窗口 ─────────────── */

const widgetMaterials = ['classic', 'frosted', 'liquid']
const widgetPrefs = { opacity: 100, glassTransparency: 28, glassBlur: 14, snap: 'top-right', fontSize: 100, motion: 'full' }
const initialWidgetSize = { width: 168, height: 216 }
let widgetSize = initialWidgetSize
let snapTimer = null

function applyWidgetAppearance(prefs) {
  if (prefs && typeof prefs === 'object') {
    if (Number.isFinite(Number(prefs.opacity))) widgetPrefs.opacity = Math.min(100, Math.max(20, Number(prefs.opacity)))
    if (typeof prefs.glassTransparency === 'number' && Number.isFinite(prefs.glassTransparency)) {
      widgetPrefs.glassTransparency = Math.min(100, Math.max(0, Math.round(prefs.glassTransparency)))
    }
    if (typeof prefs.glassBlur === 'number' && Number.isFinite(prefs.glassBlur)) {
      widgetPrefs.glassBlur = Math.min(32, Math.max(0, Math.round(prefs.glassBlur)))
    }
    if (typeof prefs.snap === 'string') widgetPrefs.snap = prefs.snap
    if (['full', 'light', 'off'].includes(prefs.motion)) widgetPrefs.motion = prefs.motion
    if (Number.isFinite(Number(prefs.fontSize))) widgetPrefs.fontSize = Math.min(140, Math.max(80, Number(prefs.fontSize)))
  }
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  pushWidgetData()
}

/** Windows 下通过 PowerShell 读取前台窗口矩形；结果形如 "x,y,w,h"。 */
function foregroundRect() {
  return new Promise((resolve) => {
    const script = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public struct R{public int L;public int T;public int Rr;public int B;}public class W{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out R r);}' -ErrorAction SilentlyContinue; $r=New-Object R; $h=[W]::GetForegroundWindow(); if([W]::GetWindowRect($h,[ref]$r)){"$($r.L),$($r.T),$($r.Rr-$r.L),$($r.B-$r.T)"}`
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 2000, windowsHide: true }, (error, stdout) => {
      if (error) return resolve(null)
      const parts = String(stdout || '').trim().split(',').map(Number)
      if (parts.length === 4 && parts.every(Number.isFinite)) resolve({ x: parts[0], y: parts[1], width: parts[2], height: parts[3] })
      else resolve(null)
    })
  })
}

async function applySnap() {
  if (!widgetWindow || widgetWindow.isDestroyed() || widgetPrefs.snap === 'none') return
  const window = widgetWindow
  const snap = widgetPrefs.snap
  const display = screen.getDisplayNearestPoint(window.getBounds())
  const area = display.workArea
  const gap = 12
  let x = area.x + gap
  let y = area.y + gap
  let foreground = null

  if (snap === 'follow-app') {
    foreground = await foregroundRect()
    if (window !== widgetWindow || window.isDestroyed() || widgetPrefs.snap !== snap) return
  }

  // At fractional Windows display scales, feeding getSize() back into setBounds can grow the window.
  const { width, height } = widgetSize
  if (foreground && foreground.width > 100 && foreground.height > 100 && foreground.x > -30000) {
    x = foreground.x + foreground.width - width - gap
    y = foreground.y + 4
  } else {
    if (['top-right', 'top', 'bottom-right', 'follow-app'].includes(snap)) x = area.x + area.width - width - gap
    if (snap === 'bottom-left' || snap === 'bottom-right') y = area.y + area.height - height - gap
  }
  window.setBounds({ x: Math.round(x), y: Math.round(y), width, height })
}

function startSnapTimer() {
  clearInterval(snapTimer)
  snapTimer = widgetPrefs.snap === 'follow-app' ? setInterval(() => void applySnap(), 1200) : null
}

function createWidgetWindow() {
  widgetSize = initialWidgetSize
  widgetWindow = new BrowserWindow({
    ...initialWidgetSize,
    minWidth: 150,
    minHeight: 160,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) widgetWindow.loadURL(new URL('widget.html', process.env.VITE_DEV_SERVER_URL).href)
  else widgetWindow.loadFile(path.join(__dirname, '../dist/widget.html'))

  widgetWindow.once('ready-to-show', () => {
    applyWidgetAppearance()
    setTimeout(() => void applySnap(), 60)
    if (widgetShouldShow) widgetWindow.showInactive()
  })
  widgetWindow.on('will-resize', (_event, { width, height }) => { widgetSize = { width, height } })
  widgetWindow.on('closed', () => { widgetWindow = null })
}

let widgetShouldShow = false

function setWidgetVisible(visible) {
  widgetShouldShow = Boolean(visible)
  if (visible) {
    if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow()
    else { pushWidgetData(); widgetWindow.showInactive() }
  } else if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.hide()
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray.png')
  if (!fs.existsSync(iconPath)) return
  tray = new Tray(nativeImage.createFromPath(iconPath))
  tray.setToolTip('FocusNotes 桌面待办')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 FocusNotes', click: () => showWindow() },
    { label: '显示/隐藏桌面小部件', click: () => {
      const visible = widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()
      setWidgetVisible(!visible)
    } },
    { label: '隐藏到托盘', click: () => hideToTray(false) },
    { type: 'separator' },
    { label: '退出 FocusNotes', click: () => { isQuitting = true; app.quit() } },
  ]))
  tray.on('click', () => {
    if (!mainWindow) return
    if (mainWindow.isVisible()) mainWindow.hide()
    else showWindow()
  })
  tray.on('double-click', () => showWindow())
}

function registerIpc() {
  ipcMain.handle('window:glass-wallpaper', (event) => {
    if (event.sender !== mainWindow?.webContents && event.sender !== widgetWindow?.webContents) return null
    return glassWallpaper()
  })
  ipcMain.on('window:minimize', () => hideToTray(true))
  ipcMain.on('window:close', () => hideToTray(false))
  ipcMain.on('window:set-always-on-top', (_event, value) => mainWindow?.setAlwaysOnTop(Boolean(value), 'screen-saver'))
  ipcMain.on('window:set-opacity', (_event, value) => {
    const opacity = Math.min(1, Math.max(0.2, Number(value)))
    if (Number.isFinite(opacity)) mainWindow?.setOpacity(opacity)
  })
  ipcMain.on('window:set-mode', (_event, mode) => {
    if (!mainWindow) return
    if (mode === 'mini') {
      mainWindow.setMinimumSize(300, 400)
      mainWindow.setSize(MINI_WINDOW.width, MINI_WINDOW.height)
    } else {
      const bounds = fullBounds()
      mainWindow.setMinimumSize(920, 620)
      mainWindow.setSize(bounds.width, bounds.height)
      mainWindow.center()
    }
  })

  ipcMain.on('theme:set', (_event, mode) => {
    theme.mode = ['system', 'light', 'dark', 'sun'].includes(mode) ? mode : 'system'
    stopSunSchedule()
    if (theme.mode === 'sun') { startSunSchedule(); return }
    theme.sun = null
    theme.city = ''
    if (theme.mode === 'dark' || theme.mode === 'light') {
      theme.resolved = theme.mode
      pushTheme(false)
    } else {
      theme.resolved = null
      pushTheme(false)
    }
  })

  ipcMain.on('reminders:sync', (_event, data) => {
    if (data && typeof data === 'object') {
      reminder.enabled = data.enabled !== false
      const lead = Number(data.leadMinutes)
      if (Number.isFinite(lead)) reminder.leadMinutes = Math.min(7 * 24 * 60, Math.max(1, lead))
      reminder.items = Array.isArray(data.items) ? data.items.slice(0, 500) : []
      reminder.habits = Array.isArray(data.habits) ? data.habits.slice(0, 200) : []
      const pending = reminder.items.filter((item) => item && !item.completed).length
      tray?.setToolTip(pending ? `FocusNotes · ${pending} 项待办` : 'FocusNotes 桌面待办')
    }
    checkReminders()
  })

  ipcMain.on('reminders:test', () => {
    if (!Notification.isSupported()) return
    const notification = new Notification({
      title: '提醒已开启',
      body: `将在待办截止前 ${formatSpan(Math.max(1, reminder.leadMinutes) * 60000)} 通知你。`,
    })
    notification.on('click', () => showWindow())
    notification.show()
  })

  ipcMain.handle('profile:read', () => {
    const doc = activeDoc()
    return { profile: { id: doc.id, name: doc.name }, todos: doc.todos, extras: doc.extras ?? null }
  })

  ipcMain.handle('profile:write', (_event, raw) => {
    try {
      const parsed = normalizeTodos(JSON.parse(String(raw ?? '[]')))
      if (!parsed) return { ok: false, error: '待办数据格式无效。' }
      const doc = activeDoc()
      doc.todos = parsed
      doc.updatedAt = new Date().toISOString()
      saveDoc(doc)
      notifyWorkspaceChanged()
      return { ok: true, count: doc.todos.length }
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : '写入档案失败。' }
    }
  })

  ipcMain.handle('workspace:read', () => {
    const doc = activeDoc()
    return {
      profile: { id: doc.id, name: doc.name },
      todos: doc.todos,
      extras: doc.extras ?? null,
      dir: profileDir(),
      fallback: dataDirFallback,
    }
  })

  ipcMain.handle('workspace:write', (_event, data) => {
    try {
      const doc = readProfileDoc(data?.profileId)
      if (!doc) return { ok: false, error: '找不到要保存的记录档案。' }
      const isActive = doc.id === readJson(metaPath(), {}).activeId
      if (data.requireActive && !isActive) return { ok: false, error: '档案已切换，本次同步未应用。' }
      const todos = data.todos === undefined ? undefined : normalizeTodos(data.todos)
      if (todos === null) return { ok: false, error: '待办数据格式无效。' }
      const extras = data && data.extras && typeof data.extras === 'object' ? data.extras : null
      if (extras && JSON.stringify(extras).length > 8 * 1024 * 1024) {
        return { ok: false, error: '扩展数据过大，已拒绝写入。' }
      }
      if (todos) doc.todos = todos
      if (extras) doc.extras = extras
      doc.updatedAt = new Date().toISOString()
      saveDoc(doc)
      if (isActive) pushWidgetData(doc)
      return { ok: true, count: doc.todos.length }
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : '写入工作区失败。' }
    }
  })

  ipcMain.on('app:notify', (_event, data) => {
    if (!Notification.isSupported() || !data) return
    const title = String(data.title || 'FocusNotes').slice(0, 80)
    const body = String(data.body || '').slice(0, 240)
    const notification = new Notification({ title, body, silent: data.silent === true })
    notification.on('click', () => showWindow())
    notification.show()
  })

  ipcMain.handle('widget:read', () => widgetData())

  ipcMain.on('widget:open-main', (_event, view) => {
    showWindow()
    if (view) {
      const send = () => mainWindow?.webContents.send('navigate:view', view)
      if (mainWindow?.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send)
      else setTimeout(send, 30)
    }
  })
  ipcMain.on('widget:close', () => { if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.hide() })
  ipcMain.on('widget:set-enabled', (_event, enabled) => setWidgetVisible(Boolean(enabled)))

  ipcMain.handle('widget:toggle', (_event, id) => {
    const doc = activeDoc()
    const todo = (doc.todos || []).find((item) => item && item.id === id && !item.deleted)
    if (!todo) return { ok: false, error: '任务不存在。' }
    todo.completed = !todo.completed
    todo.completedAt = todo.completed ? new Date().toISOString() : null
    todo.updatedAt = new Date().toISOString()
    todo.revision = (Number(todo.revision) || 1) + 1
    saveDoc(doc)
    notifyWorkspaceChanged()
    return { ok: true }
  })

  ipcMain.on('widget:resize', (_event, size) => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return
    const width = Math.min(520, Math.max(200, Number(size?.width) || 260))
    const height = Math.min(720, Math.max(180, Number(size?.height) || 216))
    widgetSize = { width, height }
    widgetWindow.setSize(width, height)
    void applySnap()
  })

  ipcMain.on('widget:appearance', (_event, prefs) => {
    const previousSnap = widgetPrefs.snap
    applyWidgetAppearance(prefs)
    if (widgetPrefs.snap !== previousSnap) {
      startSnapTimer()
      void applySnap()
    }
  })

  ipcMain.handle('widget:toggle-habit', (_event, data) => {
    const habitId = data && data.habitId
    const day = data && data.day
    if (!habitId || !/^\d{4}-\d{2}-\d{2}$/.test(String(day))) return { ok: false, error: '日期格式无效。' }
    const doc = activeDoc()
    const extras = doc.extras && typeof doc.extras === 'object' ? doc.extras : {}
    const logs = extras.habitLogs && typeof extras.habitLogs === 'object' ? { ...extras.habitLogs } : {}
    const current = Array.isArray(logs[habitId]) ? logs[habitId] : []
    const set = new Set(current)
    if (set.has(day)) set.delete(day)
    else set.add(day)
    logs[habitId] = [...set].sort()
    doc.extras = { ...extras, habitLogs: logs }
    doc.updatedAt = new Date().toISOString()
    saveDoc(doc)
    notifyWorkspaceChanged()
    return { ok: true }
  })

  ipcMain.handle('widget:add', (_event, title) => {
    const clean = String(title || '').trim().slice(0, 200)
    if (!clean) return { ok: false, error: '请输入任务内容。' }
    const doc = activeDoc()
    const now = new Date().toISOString()
    const todo = {
      id: randomUUID(), title: clean, notes: '', dueAt: null,
      important: false, urgent: false, completed: false, completedAt: null,
      listId: 'inbox', tags: [], createdAt: now, updatedAt: now, revision: 1, deleted: false,
    }
    doc.todos = [...(doc.todos || []), todo]
    doc.updatedAt = now
    saveDoc(doc)
    notifyWorkspaceChanged()
    return { ok: true, id: todo.id }
  })

  ipcMain.handle('profile:list', () => payload())

  ipcMain.handle('profile:create', (_event, name) => {
    const docs = ensureProfiles()
    const now = new Date().toISOString()
    const doc = { id: newProfileId(), name: uniqueName(name, docs), createdAt: now, updatedAt: now, todos: [] }
    saveDoc(doc)
    setActive(doc.id)
    return { ok: true, ...payload() }
  })

  ipcMain.handle('profile:switch', (_event, id) => {
    const docs = ensureProfiles()
    const doc = docs.find((item) => item.id === id)
  if (!doc) return { ok: false, error: '记录档案不存在。' }
  setActive(doc.id)
  notifyWorkspaceChanged()
  return { ok: true, ...payload() }
})

  ipcMain.handle('profile:rename', (_event, data) => {
    const id = data && data.id
    const name = String((data && data.name) || '').trim()
    if (!name) return { ok: false, error: '档案名称不能为空。' }
    const docs = ensureProfiles()
    const doc = docs.find((item) => item.id === id)
    if (!doc) return { ok: false, error: '记录档案不存在。' }
    doc.name = uniqueName(name, docs.filter((item) => item.id !== id))
    doc.updatedAt = new Date().toISOString()
    saveDoc(doc)
    return { ok: true, ...payload() }
  })

  ipcMain.handle('profile:delete', (_event, id) => {
    const docs = ensureProfiles()
    const doc = docs.find((item) => item.id === id)
    if (!doc) return { ok: false, error: '记录档案不存在。' }
    if (docs.length <= 1) return { ok: false, error: '至少保留一个记录档案。' }
    const trashDir = path.join(profileDir(), '_trash')
    fs.mkdirSync(trashDir, { recursive: true })
    fs.renameSync(path.join(profileDir(), `${doc.id}.json`), path.join(trashDir, `${doc.id}-${Date.now()}.json`))
    const meta = readJson(metaPath(), {})
    if (meta.activeId === doc.id) setActive(docs.filter((item) => item.id !== doc.id)[0].id)
    return { ok: true, ...payload() }
  })

  ipcMain.handle('profile:export', async (event, id) => {
    const docs = ensureProfiles()
    const doc = docs.find((item) => item.id === id) || activeDoc()
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeName = doc.name.replace(/[\\/:*?"<>|]/g, '') || 'record'
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const target = await dialog.showSaveDialog(owner, {
      title: '导出待办记录',
      defaultPath: path.join(app.getPath('documents'), `FocusNotes-${safeName}-${stamp}.json`),
      filters: [{ name: 'FocusNotes 记录', extensions: ['json'] }],
    })
    if (target.canceled || !target.filePath) return { ok: false, canceled: true, message: '已取消导出。' }
    fs.writeFileSync(target.filePath, JSON.stringify({
      app: 'FocusNotes', version: 2, exportedAt: new Date().toISOString(), profile: doc.name,
      todos: doc.todos, extras: doc.extras ?? null,
      ...(typeof doc.memo === 'string' && doc.memo ? { memo: doc.memo } : {}),
    }, null, 2), 'utf8')
    return { ok: true, message: `已导出到 ${target.filePath}` }
  })

  ipcMain.handle('profile:import', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const picked = await dialog.showOpenDialog(owner, {
      title: '导入待办记录',
      properties: ['openFile'],
      filters: [{ name: 'FocusNotes 记录', extensions: ['json'] }],
    })
    if (picked.canceled || !picked.filePaths.length) return { ok: false, canceled: true, message: '已取消导入。' }
    try {
      const raw = JSON.parse(fs.readFileSync(picked.filePaths[0], 'utf8'))
      const todos = normalizeTodos(Array.isArray(raw) ? raw : raw && raw.todos)
      const memo = typeof raw?.memo === 'string' ? raw.memo : ''
      if (memo.length > MAX_MEMO_LENGTH) return { ok: false, message: '备忘录不能超过 100 万字符。' }
      if (!todos || (!todos.length && !memo)) return { ok: false, message: '文件中没有可导入的待办或备忘录。' }
      const docs = ensureProfiles()
      const baseName = path.basename(picked.filePaths[0], '.json').replace(/^FocusNotes-/, '').replace(/-\d{8}$/, '')
      const now = new Date().toISOString()
      const doc = {
        id: newProfileId(), name: uniqueName(baseName || '导入的记录', docs), createdAt: now, updatedAt: now,
        todos, ...(memo ? { memo } : {}), extras: raw && typeof raw === 'object' && raw.extras && typeof raw.extras === 'object' ? raw.extras : null,
      }
      saveDoc(doc)
      setActive(doc.id)
      return { ok: true, message: memo ? `已导入备忘录和 ${todos.length} 项待办。` : `已导入 ${todos.length} 项待办。`, ...payload() }
    } catch {
      return { ok: false, message: '文件无法解析，请选择 FocusNotes 导出的 JSON 记录。' }
    }
  })

  /* 个人文件：清单表格、习惯与历史记录导出为 CSV / JSON */
  ipcMain.handle('personal:export', async (event, kind) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const doc = activeDoc()
    const extras = doc.extras && typeof doc.extras === 'object' ? doc.extras : {}
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const labels = { lists: '清单表格', habits: '习惯记录', history: '历史信息' }
    const label = labels[kind] || '个人数据'
    const target = await dialog.showSaveDialog(owner, {
      title: `导出${label}`,
      defaultPath: path.join(app.getPath('documents'), `FocusNotes-${label}-${stamp}.${kind === 'all' ? 'json' : 'csv'}`),
      filters: kind === 'all' ? [{ name: 'JSON', extensions: ['json'] }] : [{ name: 'CSV 表格', extensions: ['csv'] }],
    })
    if (target.canceled || !target.filePath) return { ok: false, canceled: true, message: '已取消导出。' }

    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const toCsv = (head, rows) => [head, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
    let content = ''
    try {
      if (kind === 'all') {
        content = JSON.stringify({
          app: 'FocusNotes', version: 1, exportedAt: new Date().toISOString(), profile: doc.name,
          todos: doc.todos, lists: extras.lists || [], habits: extras.habits || [],
          habitLogs: extras.habitLogs || {}, focusSessions: extras.focusSessions || [],
        }, null, 2)
      } else if (kind === 'lists') {
        const lists = Array.isArray(extras.lists) ? extras.lists : []
        const rows = []
        for (const list of lists) {
          const items = (doc.todos || []).filter((todo) => todo.listId === list.id && !todo.deleted)
          if (!items.length) rows.push([list.name, '（空清单）', '', '', ''])
          for (const todo of items) rows.push([list.name, todo.title, todo.completed ? '已完成' : '待办', todo.dueAt || '', (todo.tags || []).join(' ')])
        }
        content = '\uFEFF' + toCsv(['清单', '事项', '状态', '截止时间', '标签'], rows)
      } else if (kind === 'habits') {
        const habits = Array.isArray(extras.habits) ? extras.habits : []
        const logs = extras.habitLogs || {}
        const rows = habits.map((habit) => [
          habit.name, habit.emoji, habit.frequency, habit.goal, habit.unit,
          (logs[habit.id] || []).join(';'), habit.archived ? '已归档' : '进行中',
        ])
        content = '\uFEFF' + toCsv(['习惯', '图标', '频率', '每日目标', '单位', '打卡日期', '状态'], rows)
      } else if (kind === 'history') {
        const sessions = Array.isArray(extras.focusSessions) ? extras.focusSessions : []
        const rows = sessions.slice(-1000).map((session) => [
          session.startedAt, session.endedAt || '', session.seconds, session.mode,
          (doc.todos || []).find((todo) => todo.id === session.taskId)?.title || '',
        ])
        const logs = extras.habitLogs || {}
        for (const [habitId, days] of Object.entries(logs)) {
          for (const day of days) rows.push([day, '', '', 'habit', (extras.habits || []).find((habit) => habit.id === habitId)?.name || habitId])
        }
        content = '\uFEFF' + toCsv(['时间', '结束时间', '时长(秒)', '类型', '关联对象'], rows)
      }
      fs.writeFileSync(target.filePath, content, 'utf8')
      return { ok: true, message: `已导出到 ${target.filePath}` }
    } catch (reason) {
      return { ok: false, message: reason instanceof Error ? reason.message : '导出失败。' }
    }
  })

  ipcMain.handle('personal:import', async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) || mainWindow
    const picked = await dialog.showOpenDialog(owner, {
      title: '导入个人数据', properties: ['openFile'],
      filters: [{ name: '数据文件', extensions: ['json', 'csv'] }],
    })
    if (picked.canceled || !picked.filePaths.length) return { ok: false, canceled: true, message: '已取消导入。' }
    try {
      const raw = fs.readFileSync(picked.filePaths[0], 'utf8')
      const doc = activeDoc()
      const extras = doc.extras && typeof doc.extras === 'object' ? { ...doc.extras } : {}
      if (picked.filePaths[0].toLowerCase().endsWith('.json')) {
        const data = JSON.parse(raw)
        if (!data || !Array.isArray(data.todos) && !Array.isArray(data.habits) && !Array.isArray(data.lists)) {
          return { ok: false, message: '文件中没有可导入的数据。' }
        }
        if (Array.isArray(data.todos)) doc.todos = normalizeTodos(data.todos) || []
        if (Array.isArray(data.lists)) extras.lists = data.lists.slice(0, 80)
        if (Array.isArray(data.habits)) extras.habits = data.habits.slice(0, 200)
        if (data.habitLogs && typeof data.habitLogs === 'object') extras.habitLogs = data.habitLogs
        if (Array.isArray(data.focusSessions)) extras.focusSessions = data.focusSessions.slice(-3000)
      } else {
        const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean)
        const parse = (line) => (line.match(/("([^"]|"")*"|[^,]*)/g) || []).map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"'))
        const rows = lines.slice(1).map(parse)
        if (!rows.length) return { ok: false, message: '文件中没有可导入的数据。' }
        const head = parse(lines[0])
        if (head.includes('事项') && head.includes('状态')) {
          const listMap = new Map((extras.lists || []).map((list) => [list.name, list.id]))
          const todos = rows.map((row, index) => ({
            id: randomUUID(), title: String(row[1] || '').trim() || `导入事项 ${index + 1}`,
            notes: '', dueAt: null, important: false, urgent: false, completed: String(row[2]) === '已完成',
            completedAt: null, listId: listMap.get(String(row[0])) || 'inbox', tags: [],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1, deleted: false,
          })).filter((todo) => todo.title)
          doc.todos = [...(doc.todos || []), ...todos]
        } else {
          const byName = new Map((extras.habits || []).map((habit) => [habit.name, habit]))
          const logs = { ...(extras.habitLogs || {}) }
          for (const row of rows) {
            const habit = byName.get(String(row[0]))
            if (habit && String(row[5])) logs[habit.id] = String(row[5]).split(';').filter(Boolean)
          }
          extras.habitLogs = logs
        }
      }
      doc.extras = extras
      doc.updatedAt = new Date().toISOString()
      saveDoc(doc)
      notifyWorkspaceChanged()
      return { ok: true, message: '个人数据已导入。' }
    } catch {
      return { ok: false, message: '文件无法解析，请选择 FocusNotes 导出的数据文件。' }
    }
  })

/* ── Gitee 同步配置：令牌用 safeStorage 加密后落盘 ────────────── */
function giteeConfigPath() { return path.join(dataDir, 'gitee.json') }

ipcMain.handle('app:version', () => app.getVersion())

ipcMain.handle('ui:set-zoom', (_event, value) => {
  const zoom = Math.min(1.4, Math.max(0.8, Number(value) || 1))
  const target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
  if (target && !target.isDestroyed()) target.webContents.setZoomFactor(zoom)
  return zoom
})

ipcMain.handle('gitee:get', () => {
  try {
    const raw = JSON.parse(fs.readFileSync(giteeConfigPath(), 'utf8'))
    let token = ''
    if (raw.token && safeStorage.isEncryptionAvailable()) {
      try { token = safeStorage.decryptString(Buffer.from(raw.token, 'base64')) } catch { token = '' }
    }
    return { owner: raw.owner || '', repo: raw.repo || '', branch: raw.branch || 'master', path: raw.path || 'focusnotes/data.json', profileId: raw.profileId || null, token }
  } catch { return null }
})

ipcMain.handle('gitee:set', (_event, config) => {
  try {
    const record = {
      owner: String(config?.owner || '').trim(),
      repo: String(config?.repo || '').trim(),
      branch: String(config?.branch || 'master').trim() || 'master',
      path: String(config?.path || 'focusnotes/data.json').trim() || 'focusnotes/data.json',
      profileId: activeDoc().id,
      token: safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(config?.token || '')).toString('base64') : '',
    }
    const previous = readJson(giteeConfigPath(), null)
    if (previous?.profileId && previous.profileId !== record.profileId &&
      previous.owner === record.owner && previous.repo === record.repo && previous.branch === record.branch && previous.path === record.path) {
      return { ok: false, message: '这个远端文件已绑定另一份本地档案，请为当前档案使用不同的文件路径。' }
    }
    writeJson(giteeConfigPath(), record)
    return { ok: true, encrypted: safeStorage.isEncryptionAvailable() }
  } catch (error) { return { ok: false, message: String(error) } }
})

  ipcMain.handle('profile:reveal', async () => {
    ensureProfileDir()
    const error = await shell.openPath(profileDir())
    return error ? { ok: false, message: error } : { ok: true, message: profileDir() }
  })
}

if (gotLock) {
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    dataDir = resolveDataDir()
    ensureProfileDir()
    migrateLegacyData()
    registerIpc()
    loadFired()
    ensureProfiles()
    createWindow()
    createWidgetWindow()
    createTray()
    reminderTimer = setInterval(checkReminders, 30000)
    app.on('activate', () => { if (!mainWindow || mainWindow.isDestroyed()) createWindow() })
  })
}

app.on('before-quit', () => { isQuitting = true })
app.on('will-quit', () => { if (reminderTimer) clearInterval(reminderTimer); stopSunSchedule() })
app.on('window-all-closed', () => { /* 保留托盘运行。 */ })
