import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Bot, CalendarDays, Check, Flame, LayoutGrid, ListTodo, Plus, Timer, X } from 'lucide-react'
import {
  QUADRANTS,
  addDays,
  dateKey,
  habitStreak,
  isHabitScheduled,
  startOfDay,
  type Habit,
  type WidgetKind,
} from '@focusnotes/core'
import type { WidgetData } from './desktop'
import { resolveMotion } from './motion'
import { GlassBackdrop } from './components/GlassBackdrop'
import { QUADRANT_GRID_ORDER, QUADRANT_ICONS } from './taskIcons'

const META: Record<WidgetKind, { title: string; icon: typeof ListTodo; view: string }> = {
  tasks: { title: '任务', icon: ListTodo, view: 'today' },
  calendar: { title: '日历', icon: CalendarDays, view: 'calendar' },
  quadrant: { title: '四象限', icon: LayoutGrid, view: 'quadrant' },
  habits: { title: '习惯', icon: Flame, view: 'habits' },
  countdown: { title: '倒数纪念日', icon: Timer, view: 'today' },
  assistant: { title: 'AI 助手', icon: Bot, view: 'assistant' },
}

function shortDue(dueAt: string | null, overdue: boolean, today: string): string {
  if (!dueAt) return ''
  const date = new Date(dueAt)
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  if (key === today) return overdue ? `逾 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function daysUntil(dueAt: string, today: string): number {
  const target = startOfDay(new Date(dueAt)).getTime()
  const base = startOfDay(new Date(`${today}T00:00:00`)).getTime()
  return Math.ceil((target - base) / 86_400_000)
}

function Section({ kind, children, onOpen }: { kind: WidgetKind; children: ReactNode; onOpen: (kind: WidgetKind) => void }) {
  const meta = META[kind]
  const Icon = meta.icon
  return <section className="widget-section">
    <header>
      <button className="widget-section-title" onClick={() => onOpen(kind)} title={`打开${meta.title}`}>
        <Icon size={10} /> {meta.title}
      </button>
      <button className="widget-section-open" onClick={() => onOpen(kind)} aria-label={`打开${meta.title}`}>↗</button>
    </header>
    <div className="widget-section-body">{children}</div>
  </section>
}

export function WidgetWindow() {
  const [data, setData] = useState<WidgetData | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const material = data?.appearance.material ?? 'frosted'

  useEffect(() => {
    const off = window.focusDesktop?.widget.onData(setData)
    window.focusDesktop?.widget.read().then(setData).catch(() => undefined)
    return off
  }, [])

  useEffect(() => {
    const appearance = data?.appearance
    document.documentElement.dataset.motion = resolveMotion(appearance?.motion)
    const root = document.documentElement
    root.style.setProperty('--app-font', appearance?.fontFamily || '')
    root.style.setProperty('--w-scale', String((appearance?.fontSize || 100) / 100))
    root.style.setProperty('--w-density', `${appearance?.opacity ?? 100}%`)
    root.style.setProperty('--w-glass-transparency', `${appearance?.glassTransparency ?? 28}%`)
  }, [data?.appearance])

  const kinds = useMemo(() => data?.widgets?.length ? data.widgets : (['tasks'] as WidgetKind[]), [data])

  // 模块数量变化时调整窗口高度：单模块保持紧凑，多模块增高但始终小于完整窗口。
  useEffect(() => {
    const height = Math.min(560, Math.max(216, 120 + kinds.length * 88))
    window.focusDesktop?.widget.resize?.(260, height)
  }, [kinds.length])

  const openView = useCallback((kind: WidgetKind) => window.focusDesktop?.widget.openMain(META[kind].view), [])

  const add = useCallback(async () => {
    const clean = title.trim()
    if (!clean || busy) return
    setBusy(true)
    try {
      const result = await window.focusDesktop?.widget.add(clean)
      if (result?.ok) { setTitle(''); setMessage('') }
      else setMessage(result?.error ?? '添加失败')
    } catch {
      setMessage('添加失败')
    } finally {
      setBusy(false)
    }
  }, [title, busy])

  const toggle = useCallback(async (id: string) => {
    try { await window.focusDesktop?.widget.toggle(id) } catch { setMessage('同步失败') }
  }, [])

  const toggleHabit = useCallback(async (habitId: string, day: string) => {
    try { await window.focusDesktop?.widget.toggleHabit(habitId, day) } catch { setMessage('同步失败') }
  }, [])

  const todayDate = useMemo(() => (data ? startOfDay(new Date(`${data.today}T00:00:00`)) : startOfDay(new Date())), [data])

  return <div className="widget-window" data-material={material}>
    {material !== 'classic' && <GlassBackdrop blur={data?.appearance.glassBlur ?? 14} />}
    <header className="widget-grip">
      <button className="widget-close" onClick={() => window.focusDesktop?.widget.close()} aria-label="关闭小部件"><X size={10} /></button>
    </header>

    <div className="widget-scroll">
      {data?.completion && <div className="widget-completion-bar">
        <span>今日完成 <strong>{data.completion.total}</strong></span>
        <small>待办 {data.completion.tasks} · 习惯 {data.completion.habits} · 番茄 {data.completion.pomodoros}</small>
      </div>}
      {kinds.map((kind) => {
        if (kind === 'tasks') return <Section key={kind} kind={kind} onOpen={openView}>
          {data?.items.length ? data.items.slice(0, 4).map((item) => (
            <div key={item.id} className="widget-task">
              <button className="widget-check" onClick={() => void toggle(item.id)} aria-label={`完成 ${item.title}`}><Check size={8} strokeWidth={3} /></button>
              <span className="widget-task-title" title={item.title}>{item.title}</span>
              <span className={`widget-task-time${item.overdue ? ' overdue' : ''}`}>{shortDue(item.dueAt, item.overdue, data.today)}</span>
            </div>
          )) : <p className="widget-empty">暂无任务</p>}
          <div className="widget-composer">
            <input value={title} placeholder="添加任务…" onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void add() }} />
            <button onClick={() => void add()} disabled={busy || !title.trim()} aria-label="添加任务"><Plus size={11} /></button>
          </div>
        </Section>

        if (kind === 'calendar') return <Section key={kind} kind={kind} onOpen={openView}>
          <div className="widget-agenda">
            {Array.from({ length: 4 }, (_, index) => {
              const day = addDays(todayDate, index)
              const key = dateKey(day)
              const count = data?.agendaCounts?.[key] ?? 0
              return <div key={key} className={`widget-agenda-row${index === 0 ? ' today' : ''}`}>
                <span>{index === 0 ? '今天' : `${day.getMonth() + 1}/${day.getDate()}`}</span>
                <strong>{count ? `${count} 项` : '空闲'}</strong>
              </div>
            })}
          </div>
        </Section>

        if (kind === 'quadrant') return <Section key={kind} kind={kind} onOpen={openView}>
          <div className="widget-quadrants">
            {QUADRANT_GRID_ORDER.map((quadrant) => {
              const Icon = QUADRANT_ICONS[quadrant]
              const count = data?.quadrantCounts?.[quadrant] ?? 0
              const label = QUADRANTS[quadrant].label
              return <div key={quadrant} className="widget-quadrant" role="img" aria-label={`${label}，${count} 项`} title={label}>
                <Icon size={16} aria-hidden="true" focusable="false" />
                <strong>{count}</strong>
              </div>
            })}
          </div>
        </Section>

        if (kind === 'habits') {
          const habits = (data?.habits ?? []).filter((habit: Habit) => !habit.archived).slice(0, 3)
          return <Section key={kind} kind={kind} onOpen={openView}>
            {habits.length ? habits.map((habit) => {
              const logs = data?.habitLogs[habit.id] ?? []
              const done = logs.includes(data?.today ?? '')
              const scheduled = isHabitScheduled(habit, todayDate)
              return <div key={habit.id} className="widget-habit">
                <span>{habit.name}</span>
                <span className="widget-habit-streak">{habitStreak(habit, logs, todayDate)}天</span>
                <button className={`habit-check${done ? ' done' : ''}`} disabled={!scheduled}
                  onClick={() => void toggleHabit(habit.id, data?.today ?? '')}>{done ? '✓' : scheduled ? '打卡' : '休'}</button>
              </div>
            }) : <p className="widget-empty">暂无习惯</p>}
          </Section>
        }

        if (kind === 'countdown') return <Section key={kind} kind={kind} onOpen={openView}>
          {(data?.countdowns ?? []).length ? (data?.countdowns ?? []).map((item) => {
            const days = daysUntil(item.dueAt, data?.today ?? '')
            return <div key={item.id} className="widget-countdown">
              <strong>{days >= 0 ? days : Math.abs(days)}</strong>
              <span>{days >= 0 ? '天后' : '天前'} · {item.title}</span>
            </div>
          }) : <p className="widget-empty">给任务加「纪念日」标签</p>}
        </Section>

        if (kind === 'assistant') return <Section key={kind} kind={kind} onOpen={openView}>
          <p className="widget-assistant">今天想先做什么？让我帮你排优先级。</p>
          <button className="widget-assistant-btn" onClick={() => openView('assistant')}>问问助手 →</button>
        </Section>

        return null
      })}
    </div>
    {message && <p className="widget-message" role="alert">{message}</p>}
  </div>
}
