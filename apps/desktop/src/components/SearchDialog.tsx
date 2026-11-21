import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, Search, X } from 'lucide-react'
import { matchesTodo, type TodoItem, type TodoList } from '@focusnotes/core'
import { listViewId, type ViewId } from '../navigation'
import { listIcon } from '../taskIcons'

interface SearchDialogProps {
  tasks: TodoItem[]
  lists: TodoList[]
  onClose: () => void
  onOpenTask: (todo: TodoItem) => void
  onNavigate: (view: ViewId) => void
}

export function SearchDialog({ tasks, lists, onClose, onOpenTask, onNavigate }: SearchDialogProps) {
  const [tab, setTab] = useState<'tasks' | 'lists'>('tasks')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const taskResults = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return tasks.filter((todo) => !todo.deleted).slice(0, 8)
    return tasks.filter((todo) => matchesTodo(todo, trimmed)).slice(0, 20)
  }, [query, tasks])

  const listResults = useMemo(() => {
    const trimmed = query.trim()
    return lists.filter((list) => !trimmed || list.name.includes(trimmed))
  }, [query, lists])

  return (
    <div className="modal-backdrop search-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="搜索">
        <div className="search-field">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === 'tasks' ? '搜索任务标题、备注或标签' : '搜索清单'}
          />
          <button className="icon-button" onClick={onClose} aria-label="关闭搜索"><X size={16} /></button>
        </div>

        <div className="search-tabs">
          <button className={tab === 'tasks' ? 'active' : ''} onClick={() => setTab('tasks')}>任务 <small>{taskResults.length}</small></button>
          <button className={tab === 'lists' ? 'active' : ''} onClick={() => setTab('lists')}>清单 <small>{listResults.length}</small></button>
        </div>

        <div className="search-results">
          {tab === 'tasks' ? (
            taskResults.length === 0 ? (
              <div className="search-empty">没有匹配的任务，换个关键词试试。</div>
            ) : (
              taskResults.map((todo) => {
                const list = lists.find((item) => item.id === todo.listId)
                return (
                  <button key={todo.id} className="search-result" onClick={() => { onOpenTask(todo); onClose() }}>
                    <span className={`search-check${todo.completed ? ' done' : ''}`}>{todo.completed ? <Check size={11} /> : null}</span>
                    <span className="search-result-text">
                      <strong className={todo.completed ? 'done' : ''}>{todo.title}</strong>
                      <small>
                        {list?.name ?? '收集箱'}
                        {todo.dueAt ? ` · ${new Date(todo.dueAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                )
              })
            )
          ) : listResults.length === 0 ? (
            <div className="search-empty">没有匹配的清单。</div>
          ) : (
            listResults.map((list) => {
              const count = tasks.filter((todo) => todo.listId === list.id && !todo.deleted && !todo.completed).length
              const Icon = listIcon(list.id)
              return (
                <button key={list.id} className="search-result" onClick={() => { onNavigate(listViewId(list.id)); onClose() }}>
                  <span className="list-dot"><Icon size={15} strokeWidth={1.8} aria-hidden="true" /></span>
                  <span className="search-result-text"><strong>{list.name}</strong><small>{count} 件待办</small></span>
                  <ArrowRight size={14} />
                </button>
              )
            })
          )}
        </div>
        <footer className="search-footer">
          <span>按 Esc 关闭</span>
          <span>Enter 打开</span>
        </footer>
      </div>
    </div>
  )
}
