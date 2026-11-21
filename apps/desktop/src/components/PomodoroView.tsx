import { useMemo } from 'react'
import { Brain, CheckCircle2, Coffee, Moon, Music2, Pause, Play, RotateCcw, Square, Timer, Volume2, VolumeX } from 'lucide-react'
import { focusStats, type FocusSession, type TodayCompletion, type TodoItem, type WorkspacePreferences } from '@focusnotes/core'
import type { PomodoroTimerApi } from '../usePomodoroTimer'
import { SLEEP_OPTIONS, useWhiteNoise } from '../useWhiteNoise'

interface PomodoroViewProps {
  preferences: WorkspacePreferences
  sessions: FocusSession[]
  tasks: TodoItem[]
  timer: PomodoroTimerApi
  completion: TodayCompletion
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function sessionTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function PomodoroView({ preferences, sessions, tasks, timer, completion }: PomodoroViewProps) {
  const { mode, phase, running, remaining, elapsed, taskId, setMode, setTaskId, toggle, reset, finishStopwatch } = timer
  const noise = useWhiteNoise()

  const total = (phase === 'focus' ? preferences.pomodoroMinutes : preferences.shortBreakMinutes) * 60
  const stats = useMemo(() => focusStats(sessions), [sessions])
  const openTasks = tasks.filter((todo) => !todo.completed && !todo.deleted)

  const displaySeconds = mode === 'stopwatch' ? elapsed : remaining
  const progress = mode === 'stopwatch'
    ? Math.min(1, elapsed / (preferences.pomodoroMinutes * 60))
    : 1 - remaining / total
  const circumference = 2 * Math.PI * 118
  const goal = Math.max(1, preferences.dailyGoal)
  const recent = [...sessions].filter((session) => session.mode === 'focus').slice(-6).reverse()

  return (
    <div className="pomodoro-layout">
      <section className="pomodoro-main card">
        <div className="segmented">
          <button className={mode === 'countdown' ? 'active' : ''} onClick={() => setMode('countdown')}>番茄计时</button>
          <button className={mode === 'stopwatch' ? 'active' : ''} onClick={() => setMode('stopwatch')}>正计时</button>
        </div>

        <div className="pomodoro-phase">
          {phase === 'focus' ? <Brain size={14} /> : <Coffee size={14} />}
          {phase === 'focus' ? '专注' : '短休息'}
          <span className="phase-dot">·</span>
          {mode === 'countdown' ? `${Math.round(total / 60)} 分钟` : '自由计时'}
        </div>

        <div className={`timer-ring${phase === 'break' ? ' break' : ''}`}>
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <circle className="ring-track" cx="130" cy="130" r="118" />
            <circle
              className="ring-progress"
              cx="130"
              cy="130"
              r="118"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - Math.max(0, Math.min(1, progress)))}
            />
          </svg>
          <div className="timer-center">
            <strong>{formatClock(displaySeconds)}</strong>
            <span>{running ? '保持专注' : displaySeconds === total ? '准备好了就开始' : '已暂停'}</span>
          </div>
        </div>

        <div className="timer-controls">
          <button className="primary-button big" onClick={toggle}>
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? '暂停' : '开始'}
          </button>
          {mode === 'stopwatch' && elapsed > 0 && (
            <button className="ghost-button" onClick={finishStopwatch}>
              <Square size={14} /> 结束并记录
            </button>
          )}
          <button className="icon-button" onClick={reset} title="重置" aria-label="重置">
            <RotateCcw size={16} />
          </button>
        </div>

        {openTasks.length > 0 && (
          <label className="focus-task-select">
            <span>关联任务</span>
            <select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
              <option value="">不关联，只专注</option>
              {openTasks.slice(0, 30).map((todo) => (
                <option key={todo.id} value={todo.id}>{todo.title}</option>
              ))}
            </select>
          </label>
        )}
      </section>

      <aside className="pomodoro-side">
        <section className="overview-grid">
          <div className="stat-card accent">
            <span>今日完成</span>
            <strong>{completion.total}</strong>
            <small>待办 {completion.tasks} · 习惯 {completion.habits} · 番茄 {completion.pomodoros}</small>
          </div>
          <div className="stat-card">
            <span>今日番茄</span>
            <strong>{stats.todayCount}</strong>
            <small>目标 {goal} 个</small>
          </div>
          <div className="stat-card">
            <span>今日专注时长</span>
            <strong>{stats.todayMinutes}<em>m</em></strong>
            <small>本周 {stats.weekMinutes} 分钟</small>
          </div>
          <div className="stat-card">
            <span>总番茄</span>
            <strong>{stats.totalCount}</strong>
            <small>累计 {stats.totalMinutes} 分钟</small>
          </div>
          <div className="stat-card accent">
            <span>今日目标</span>
            <strong>{Math.min(100, Math.round((stats.todayCount / goal) * 100))}<em>%</em></strong>
            <div className="goal-bar"><span style={{ width: `${Math.min(100, (stats.todayCount / goal) * 100)}%` }} /></div>
          </div>
        </section>

        <section className="card noise-card">
          <div className="section-heading">
            <span><Music2 size={15} /> 白噪音</span>
            {noise.playing && <span className="noise-mix-hint">{noise.active.length} 种混合</span>}
            {noise.playing && <button className="noise-stop" onClick={noise.stop} aria-label="停止白噪音"><VolumeX size={13} /> 停止</button>}
          </div>
          <div className="noise-grid">
            {noise.scenes.map((item) => (
              <button key={item.id}
                className={`noise-scene${noise.active.includes(item.id) ? ' active' : ''}`}
                onClick={() => noise.toggle(item.id)}
                title={`${item.hint}（可多选混合，最多 4 种）`}>
                <span className={`noise-icon ${item.icon}`} />
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
          <label className="noise-volume">
            <Volume2 size={13} />
            <input type="range" min={0} max={100} value={noise.volume} onChange={(event) => noise.setVolume(Number(event.target.value))} aria-label="白噪音音量" />
            <span>{noise.volume}%</span>
          </label>
          <div className="noise-sleep">
            <span className="noise-sleep-label"><Moon size={12} /> 睡眠定时</span>
            <div className="noise-sleep-options">
              <button className={`noise-sleep-chip${noise.sleepMinutes === null ? ' active' : ''}`} onClick={() => noise.setSleep(null)}>关闭</button>
              {SLEEP_OPTIONS.map((minutes) => (
                <button key={minutes}
                  className={`noise-sleep-chip${noise.sleepMinutes === minutes ? ' active' : ''}`}
                  onClick={() => noise.setSleep(minutes)}>{minutes}分</button>
              ))}
            </div>
            {noise.playing && noise.sleepMinutes !== null && (
              <span className="noise-sleep-remaining">
                剩余 {Math.ceil(noise.sleepRemaining / 60_000)} 分钟 · 最后 15 秒渐弱停止
              </span>
            )}
          </div>
        </section>

        <section className="card records-card">
          <div className="section-heading">
            <span><Timer size={15} /> 专注记录</span>
            <small>{recent.length} 条</small>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state small">
              <span className="empty-illustration"><Coffee size={28} /><CheckCircle2 size={14} className="empty-spark" /></span>
              <h3>还没有专注记录</h3>
              <p>完成第一个番茄后，这里会出现你的节奏。</p>
            </div>
          ) : (
            <ul className="record-list">
              {recent.map((session) => {
                const task = tasks.find((todo) => todo.id === session.taskId)
                return (
                  <li key={session.id}>
                    <span className="record-dot" />
                    <div>
                      <strong>{task?.title ?? '自由专注'}</strong>
                      <small>{sessionTime(session.startedAt)} · {Math.max(1, Math.round(session.seconds / 60))} 分钟</small>
                    </div>
                    <span className="record-badge">完成</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
