import { useState } from 'react'
import { CalendarHeart, CheckCircle2, ChevronDown, Inbox, Plus, Sparkles, Trash2 } from 'lucide-react'
import type { TodoDraft, TodoItem, TodoList } from '@focusnotes/core'
import { isOverdue } from '@focusnotes/core'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'

interface TaskListViewProps {
  tasks: TodoItem[]
  completedTasks: TodoItem[]
  lists: TodoList[]
  defaultListId: string
  defaultDueAt?: string | null
  today?: boolean
  showQuickAdd?: boolean
  countdown?: TodoItem[]
  emptyTitle: string
  emptyHint?: string
  trash?: boolean
  onAdd: (draft: TodoDraft) => Promise<unknown>
  onToggle: (id: string) => void
  onEdit: (todo: TodoItem) => void
  onDelete: (id: string) => void
  onRestore?: (id: string) => void
  onPurge?: (id: string) => void
  onPurgeAll?: () => void
  onNewTask: () => void
}

function dayDiff(iso: string | null): number {
  if (!iso) return 0
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 0
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  return Math.round((target - start) / 86400000)
}

export function TaskListView({
  tasks,
  completedTasks,
  lists,
  defaultListId,
  defaultDueAt,
  today = false,
  showQuickAdd = true,
  countdown = [],
  emptyTitle,
  emptyHint,
  trash,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
  onPurgeAll,
  onNewTask,
}: TaskListViewProps) {
  const [showCompleted, setShowCompleted] = useState(!today)
  const upcoming = countdown.filter((todo) => !todo.completed && todo.dueAt && !todo.deleted).slice(0, 4)
  const now = new Date()
  const groups = today
    ? [
        { label: '逾期', tasks: tasks.filter((todo) => isOverdue(todo, now)), overdue: true },
        { label: '今天到期', tasks: tasks.filter((todo) => !isOverdue(todo, now)), overdue: false },
      ].filter((group) => group.tasks.length > 0)
    : [{ label: '', tasks, overdue: false }]

  return (
    <div className={`task-view${today ? ' today-tasks' : ''}`}>
      {showQuickAdd && (
        <div className={today ? 'today-composer' : undefined}>
          <QuickAdd lists={lists} defaultListId={defaultListId} defaultDueAt={defaultDueAt}
            placeholder={today ? '添加今天的任务' : undefined} onAdd={onAdd} />
        </div>
      )}

      <section className="task-section">
        <div className="section-heading">
          <span>{trash ? '垃圾桶' : '待办'}</span>
          <small>{tasks.length} 项</small>
          {trash && tasks.length > 0 && onPurgeAll && (
            <button className="text-button danger" onClick={onPurgeAll}>
              <Trash2 size={13} /> 清空
            </button>
          )}
        </div>

        {tasks.length === 0 ? (
          <div className="empty-state">
            {!today && <span className="empty-illustration">
              {trash ? <Trash2 size={30} /> : <Inbox size={30} />}
              <Sparkles size={15} className="empty-spark" />
            </span>}
            <h3>{emptyTitle}</h3>
            {emptyHint && <p>{emptyHint}</p>}
            {!trash && (
              <button className="ghost-button" onClick={onNewTask}>
                <Plus size={14} /> {today ? '添加任务' : '新建任务'}
              </button>
            )}
          </div>
        ) : groups.map((group) => (
          <div className={today ? 'today-task-group' : undefined} key={group.label}>
            {group.label && <h3 className={`today-group-title${group.overdue ? ' overdue' : ''}`}>{group.label}</h3>}
            <div className="task-list">
              {group.tasks.map((todo) => (
                <TaskRow
                  key={todo.id}
                  todo={todo}
                  lists={lists}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRestore={onRestore}
                  onPurge={onPurge}
                />
              ))}
            </div>
          </div>
        ))}
      </section>

      {!trash && completedTasks.length > 0 && (
        <section className="task-section completed-section">
          <button className="section-heading as-button" aria-expanded={showCompleted} onClick={() => setShowCompleted((value) => !value)}>
            <span><CheckCircle2 size={15} /> 已完成</span>
            <small>{completedTasks.length}</small>
            <ChevronDown className={`chevron${showCompleted ? ' open' : ''}`} size={14} aria-hidden="true" />
          </button>
          {showCompleted && (
            <div className="task-list completed">
              {completedTasks.map((todo) => (
                <TaskRow key={todo.id} todo={todo} lists={lists} compact onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="countdown-section">
          <div className="section-heading">
            <span><CalendarHeart size={15} /> 倒数纪念日</span>
          </div>
          <div className="countdown-grid">
            {upcoming.map((todo) => {
              const diff = dayDiff(todo.dueAt)
              const list = lists.find((item) => item.id === todo.listId)
              return (
                <button key={todo.id} className="countdown-card" onClick={() => onEdit(todo)}>
                  <span className="countdown-days">
                    {diff === 0 ? '今天' : diff > 0 ? <><strong>{diff}</strong> 天</> : <><strong>{Math.abs(diff)}</strong> 天前</>}
                  </span>
                  <span className="countdown-title">{todo.title}</span>
                  <span className="countdown-meta" style={{ color: list?.color }}>{list?.name ?? '收集箱'}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
