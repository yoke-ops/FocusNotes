import { useMemo } from 'react'
import { ArrowRight, Bot, CalendarDays, Check, Flame, LayoutGrid, ListTodo, Sparkles, Timer } from 'lucide-react'
import {
  QUADRANTS,
  dateKey,
  getQuadrant,
  habitStreak,
  isHabitScheduled,
  startOfDay,
  type Habit,
  type TodayCompletion,
  type TodoItem,
  type TodoList,
  type WidgetKind,
} from '@focusnotes/core'
import type { ViewId } from '../navigation'
import { QUADRANT_GRID_ORDER, QUADRANT_ICONS } from '../taskIcons'

interface WidgetViewProps {
  widgets: WidgetKind[]
  tasks: TodoItem[]
  lists: TodoList[]
  habits: Habit[]
  habitLogs: Record<string, string[]>
  completion: TodayCompletion
  onNavigate: (view: ViewId) => void
  onToggleTask: (id: string) => void
  onToggleHabit: (habitId: string, day: string) => void
}

const META: Record<WidgetKind, { title: string; icon: typeof ListTodo; view: ViewId }> = {
  tasks: { title: '任务', icon: ListTodo, view: 'today' },
  calendar: { title: '日历', icon: CalendarDays, view: 'calendar' },
  quadrant: { title: '四象限', icon: LayoutGrid, view: 'quadrant' },
  habits: { title: '习惯', icon: Flame, view: 'habits' },
  countdown: { title: '倒数纪念日', icon: Timer, view: 'today' },
  assistant: { title: 'AI 助手', icon: Bot, view: 'assistant' },
}

export function WidgetView({ widgets, tasks, lists, habits, habitLogs, completion, onNavigate, onToggleTask, onToggleHabit }: WidgetViewProps) {
  const open = tasks.filter((todo) => !todo.deleted && !todo.completed)
  const today = dateKey(new Date())
  const dueToday = open.filter((todo) => todo.dueAt && dateKey(todo.dueAt) === today)
  const countdowns = useMemo(
    () => tasks.filter((todo) => !todo.deleted && todo.tags.includes('纪念日') && todo.dueAt).slice(0, 3),
    [tasks],
  )
  const activeHabits = habits.filter((habit) => !habit.archived)

  if (widgets.length === 0) {
    return (
      <div className="empty-state card">
        <span className="empty-illustration"><LayoutGrid size={30} /></span>
        <h3>还没有启用小部件</h3>
        <p>去设置里挑选想在首页看到的模块。</p>
      </div>
    )
  }

  return (
    <div className="widget-view">
      <section className="widget-card widget-completion">
        <header><span><Check size={15} /> 今日完成</span><strong className="widget-completion-total">{completion.total}</strong></header>
        <div className="widget-completion-detail">
          <span>待办 {completion.tasks}</span><span>习惯 {completion.habits}</span><span>番茄 {completion.pomodoros}</span>
        </div>
      </section>
      {widgets.map((kind) => {
        const meta = META[kind]
        const Icon = meta.icon
        return (
          <section key={kind} className={`widget-card widget-${kind}`}>
            <header>
              <span><Icon size={15} /> {meta.title}</span>
              <button className="widget-more" onClick={() => onNavigate(meta.view)} aria-label={`打开${meta.title}`}><ArrowRight size={14} /></button>
            </header>

            {kind === 'tasks' && (
              <>
                <div className="widget-stat"><strong>{open.length}</strong><span>件待办 · 今天到期 {dueToday.length} 件</span></div>
                <div className="widget-list">
                  {open.slice(0, 4).map((todo) => {
                    const list = lists.find((item) => item.id === todo.listId)
                    return (
                      <div key={todo.id} className="widget-task">
                        <button className="mini-check" onClick={() => onToggleTask(todo.id)} aria-label="完成"><Check size={10} /></button>
                        <span>{todo.title}</span>
                        <i style={{ background: list?.color ?? 'var(--accent)' }} />
                      </div>
                    )
                  })}
                  {open.length === 0 && <p className="widget-empty">今天清空了，享受一下。</p>}
                </div>
              </>
            )}

            {kind === 'calendar' && (
              <div className="widget-list">
                {Array.from({ length: 4 }, (_, index) => {
                  const day = new Date()
                  day.setDate(day.getDate() + index)
                  const key = dateKey(day)
                  const items = open.filter((todo) => todo.dueAt && dateKey(todo.dueAt) === key)
                  return (
                    <div key={key} className="widget-agenda">
                      <span className={index === 0 ? 'today' : ''}>{index === 0 ? '今天' : `${day.getMonth() + 1}/${day.getDate()}`}</span>
                      <strong>{items.length ? `${items.length} 项安排` : '空闲'}</strong>
                      {items[0] && <small>{items[0].title}</small>}
                    </div>
                  )
                })}
              </div>
            )}

            {kind === 'quadrant' && (
              <div className="widget-quadrants">
                {QUADRANT_GRID_ORDER.map((quadrant) => {
                  const Icon = QUADRANT_ICONS[quadrant]
                  return <div key={quadrant}>
                    <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
                    <strong>{open.filter((todo) => getQuadrant(todo) === quadrant).length}</strong>
                    <small>{QUADRANTS[quadrant].label}</small>
                  </div>
                })}
              </div>
            )}

            {kind === 'habits' && (
              <div className="widget-list">
                {activeHabits.slice(0, 4).map((habit) => {
                  const done = (habitLogs[habit.id] ?? []).includes(today)
                  const scheduled = isHabitScheduled(habit, new Date())
                  return (
                    <div key={habit.id} className="widget-habit">
                      <span>{habit.emoji} {habit.name}</span>
                      <span className="widget-habit-meta"><Flame size={11} /> {habitStreak(habit, habitLogs[habit.id] ?? [], new Date())}</span>
                      <button
                        className={`habit-check small${done ? ' done' : ''}`}
                        disabled={!scheduled}
                        onClick={() => onToggleHabit(habit.id, today)}
                      >
                        {done ? '已打卡' : scheduled ? '打卡' : '休息'}
                      </button>
                    </div>
                  )
                })}
                {activeHabits.length === 0 && <p className="widget-empty">还没有习惯，去创建一个。</p>}
              </div>
            )}

            {kind === 'countdown' && (
              <div className="widget-list">
                {countdowns.length === 0 ? (
                  <p className="widget-empty">给任务加上「纪念日」标签，就会在这里倒数。</p>
                ) : (
                  countdowns.map((todo) => {
                    const days = Math.ceil((startOfDay(new Date(todo.dueAt!)).getTime() - startOfDay(new Date()).getTime()) / 86_400_000)
                    return (
                      <div key={todo.id} className="widget-countdown">
                        <strong>{days >= 0 ? days : Math.abs(days)}</strong>
                        <span>{days >= 0 ? '天后' : '天前'} · {todo.title}</span>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {kind === 'assistant' && (
              <div className="widget-assistant">
                <span className="assistant-orb"><Sparkles size={18} /></span>
                <p>今天想先做什么？我可以帮你排优先级。</p>
                <button className="primary-button small" onClick={() => onNavigate('assistant')}>问问助手 <ArrowRight size={13} /></button>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
