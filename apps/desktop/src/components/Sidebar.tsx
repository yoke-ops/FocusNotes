import { useMemo, useState } from 'react'
import { CheckCircle2, Folder, Hash, Inbox, ListChecks, NotebookPen, Plus, Trash2 } from 'lucide-react'
import { addDays, dateKey, type TodoItem, type TodoList } from '@focusnotes/core'
import { listViewId, tagViewId, type ViewId } from '../navigation'

interface SidebarProps {
  visible: boolean
  view: ViewId
  todos: TodoItem[]
  lists: TodoList[]
  onNavigate: (view: ViewId) => void
  onAddList: (name: string) => void
}

function countActive(todos: TodoItem[]): number {
  return todos.filter((todo) => !todo.completed && !todo.deleted).length
}
export function Sidebar({ visible, view, todos, lists, onNavigate, onAddList }: SidebarProps) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const stats = useMemo(() => {
    const today = dateKey(new Date())
    const weekAgo = dateKey(addDays(new Date(), -6))
    const active = todos.filter((todo) => !todo.deleted)
    const open = active.filter((todo) => !todo.completed)
    return {
      today: open.filter((todo) => todo.dueAt && dateKey(todo.dueAt) <= today).length,
      recent: open.filter((todo) => dateKey(todo.updatedAt) >= weekAgo).length,
      inbox: open.filter((todo) => todo.listId === 'inbox').length,
      completed: active.filter((todo) => todo.completed).length,
      trash: todos.filter((todo) => todo.deleted).length,
    }
  }, [todos])

  const listCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const todo of todos) {
      if (todo.deleted || todo.completed) continue
      map.set(todo.listId, (map.get(todo.listId) ?? 0) + 1)
    }
    return map
  }, [todos])

  const tags = useMemo(() => {
    const map = new Map<string, number>()
    for (const todo of todos) {
      if (todo.deleted) continue
      for (const tag of todo.tags) map.set(tag, (map.get(tag) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN')).slice(0, 12)
  }, [todos])

  const commitList = () => {
    const value = name.trim()
    if (value) onAddList(value)
    setName('')
    setAdding(false)
  }

  const smart = [
    { id: 'today' as const, label: '今天', icon: ListChecks, count: stats.today },
    { id: 'recent' as const, label: '最近 7 天', icon: Inbox, count: stats.recent },
    { id: 'inbox' as const, label: '收集箱', icon: Inbox, count: stats.inbox },
  ]

  return (
    <aside id="workspace-sidebar" className="sidebar" hidden={!visible} aria-label="任务清单">
      <div className="brand">
        <span className="brand-mark"><NotebookPen size={17} /></span>
        <div className="brand-text">
          <strong>FocusNotes</strong>
          <small>专注 · 待办 · 习惯</small>
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="smart-list">
          {smart.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`side-row${view === item.id ? ' active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <Icon size={16} strokeWidth={1.8} />
                <span className="side-label">{item.label}</span>
                {item.count > 0 && <span className="side-count">{item.count}</span>}
              </button>
            )
          })}
        </div>

        <section className="side-section">
          <div className="side-heading">
            <span>清单</span>
            <button className="icon-ghost tiny" onClick={() => setAdding((value) => !value)} title="新建清单" aria-label="新建清单">
              <Plus size={14} />
            </button>
          </div>
          {adding && (
            <input
              className="side-input"
              autoFocus
              placeholder="清单名称，回车创建"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={commitList}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitList()
                if (event.key === 'Escape') {
                  setName('')
                  setAdding(false)
                }
              }}
            />
          )}
          {lists.filter((list) => list.id !== 'inbox').map((list) => {
            const active = view === listViewId(list.id)
            const count = listCounts.get(list.id) ?? 0
            return (
              <button
                key={list.id}
                className={`side-row list-row${active ? ' active' : ''}`}
                onClick={() => onNavigate(listViewId(list.id))}
              >
                <Folder size={16} strokeWidth={1.8} style={{ color: list.color }} />
                <span className="side-label">{list.name}</span>
                {count > 0 && <span className="side-count">{count}</span>}
              </button>
            )
          })}
        </section>

        {tags.length > 0 && (
          <section className="side-section">
            <div className="side-heading">
              <span>标签</span>
            </div>
            <div className="tag-cloud">
              {tags.map(([tag, count]) => (
                <button
                  key={tag}
                  className={`tag-chip${view === tagViewId(tag) ? ' active' : ''}`}
                  onClick={() => onNavigate(tagViewId(tag))}
                >
                  <Hash size={11} />
                  {tag}
                  <em>{count}</em>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="sidebar-foot">
        <button className={`side-row${view === 'completed' ? ' active' : ''}`} onClick={() => onNavigate('completed')}>
          <CheckCircle2 size={16} strokeWidth={1.8} />
          <span className="side-label">已完成</span>
          <span className="side-count">{stats.completed}</span>
        </button>
        <button className={`side-row${view === 'trash' ? ' active' : ''}`} onClick={() => onNavigate('trash')}>
          <Trash2 size={16} strokeWidth={1.8} />
          <span className="side-label">垃圾桶</span>
          {stats.trash > 0 && <span className="side-count">{stats.trash}</span>}
        </button>
      </div>
    </aside>
  )
}
