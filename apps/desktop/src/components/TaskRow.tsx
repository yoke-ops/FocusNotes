import { CalendarClock, Check, Flag, RotateCcw, Trash2 } from 'lucide-react'
import type { TodoItem, TodoList } from '@focusnotes/core'
import { getQuadrant, QUADRANTS } from '@focusnotes/core'
import { formatDue } from '../date'
import { useRef, useState } from 'react'
import { taskMotionDuration } from '../motion'
import { listIcon, QUADRANT_ICONS } from '../taskIcons'

interface TaskRowProps {
  todo: TodoItem
  lists: TodoList[]
  compact?: boolean
  onToggle: (id: string) => void
  onEdit: (todo: TodoItem) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onPurge?: (id: string) => void
}

export function TaskRow({ todo, lists, compact, onToggle, onEdit, onDelete, onRestore, onPurge }: TaskRowProps) {
  const row = useRef<HTMLDivElement>(null)
  const toggling = useRef(false)
  const [completing, setCompleting] = useState(false)
  async function toggle() {
    if (toggling.current) return
    const duration = taskMotionDuration()
    if (todo.completed || duration === 0 || !row.current) {
      onToggle(todo.id)
      return
    }
    toggling.current = true
    setCompleting(true)
    const height = row.current.getBoundingClientRect().height
    let fallback: number | undefined
    try {
      const animation = row.current.animate([
        { height: `${height}px`, opacity: 1 },
        { height: `${height}px`, opacity: .6, offset: .4 },
        { height: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px', opacity: 0 },
      ], { duration, easing: 'cubic-bezier(.2,.7,.2,1)' })
      await Promise.race([
        animation.finished,
        new Promise<void>((resolve) => { fallback = window.setTimeout(resolve, duration + 90) }),
      ])
    } catch { /* A canceled animation still commits the user's action. */ }
    finally { window.clearTimeout(fallback) }
    onToggle(todo.id)
    toggling.current = false
    setCompleting(false)
  }
  const list = lists.find((item) => item.id === todo.listId)
  const ListIcon = listIcon(todo.listId)
  const quadrant = getQuadrant(todo)
  const PriorityIcon = QUADRANT_ICONS[quadrant]
  const due = todo.dueAt ? formatDue(todo, new Date()) : ''
  const overdue = Boolean(todo.dueAt && !todo.completed && Date.parse(todo.dueAt) < Date.now())
  return (
    <div ref={row} className={`task-row${todo.completed ? ' done' : ''}${compact ? ' compact' : ''}${completing ? ' completing' : ''}`}>
      {todo.deleted ? (
        <>
          <span className="task-deleted-mark">已删除</span>
          <div className="task-main">
            <span className="task-title">{todo.title}</span>
            <span className="task-meta">移入垃圾桶 · 可恢复</span>
          </div>
          <div className="task-actions">
            {onRestore && (
              <button className="icon-ghost" onClick={() => onRestore(todo.id)} title="恢复任务" aria-label="恢复任务">
                <RotateCcw size={15} />
              </button>
            )}
            {onPurge && (
              <button className="icon-ghost danger-hover" onClick={() => onPurge(todo.id)} title="彻底删除" aria-label="彻底删除">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <button
            className={`task-check${todo.completed || completing ? ' checked' : ''}`}
            onClick={() => void toggle()}
            disabled={completing}
            aria-label={todo.completed ? '标记为未完成' : '标记为完成'}
            aria-pressed={todo.completed}
          >
            {(todo.completed || completing) && <Check size={12} strokeWidth={3} />}
          </button>
          <button className="task-main" onClick={() => onEdit(todo)}>
            <span className="task-title">{todo.title}</span>
            {!compact && todo.notes && <span className="task-notes">{todo.notes}</span>}
            <span className="task-meta">
              {due && (
                <span className={`task-due${overdue ? ' overdue' : ''}`}>
                  <CalendarClock size={12} />
                  {due}
                </span>
              )}
              {list && (
                <span className="task-list-name">
                  <ListIcon size={12} strokeWidth={1.8} aria-hidden="true" />
                  {list.name}
                </span>
              )}
              <span className="task-priority" role="img" aria-label={QUADRANTS[quadrant].label} title={QUADRANTS[quadrant].label}>
                <PriorityIcon size={13} strokeWidth={1.8} aria-hidden="true" />
              </span>
              {!compact && todo.tags.map((tag) => <span className="task-tag" key={tag}>#{tag}</span>)}
            </span>
          </button>
          <div className="task-actions">
            <button className="icon-ghost" onClick={() => onEdit(todo)} title="编辑任务" aria-label="编辑任务">
              <Flag size={14} />
            </button>
            <button className="icon-ghost danger-hover" onClick={() => onDelete(todo.id)} title="删除任务" aria-label="删除任务">
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
