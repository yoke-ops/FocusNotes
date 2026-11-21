import { useState } from 'react'
import { Check, GripVertical, LayoutGrid } from 'lucide-react'
import { dateKey, getQuadrant, QUADRANTS, type Quadrant, type TodoDraft, type TodoItem } from '@focusnotes/core'
import { QUADRANT_GRID_ORDER, QUADRANT_ICONS } from '../taskIcons'

interface QuadrantViewProps {
  tasks: TodoItem[]
  onToggle: (id: string) => void
  onEdit: (todo: TodoItem) => void
  onUpdate: (id: string, draft: Partial<TodoDraft>) => void
}

export function QuadrantView({ tasks, onToggle, onEdit, onUpdate }: QuadrantViewProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<Quadrant | null>(null)
  const open = tasks.filter((todo) => !todo.deleted && !todo.completed)
  const done = tasks.filter((todo) => !todo.deleted && todo.completed).slice(0, 6)

  const drop = (quadrant: Quadrant) => {
    if (!dragging) return
    onUpdate(dragging, {
      important: quadrant === 'important-urgent' || quadrant === 'important-not-urgent',
      urgent: quadrant === 'important-urgent' || quadrant === 'not-important-urgent',
    })
    setDragging(null)
    setOver(null)
  }

  return (
    <div className="quadrant-view">
      <div className="quadrant-directions"><span>重要程度 →</span><span>紧急程度 ↑</span></div>
      <div className="quadrant-grid">
        {QUADRANT_GRID_ORDER.map((quadrant) => {
          const meta = QUADRANTS[quadrant]
          const Icon = QUADRANT_ICONS[quadrant]
          const items = open.filter((todo) => getQuadrant(todo) === quadrant)
          return (
            <section
              key={quadrant}
              className={`quadrant-panel${over === quadrant ? ' drag-over' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setOver(quadrant) }}
              onDragLeave={() => setOver((value) => (value === quadrant ? null : value))}
              onDrop={(event) => { event.preventDefault(); drop(quadrant) }}
            >
              <header>
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                <h3>{meta.label}</h3>
                <span className="quadrant-count">{items.length}</span>
              </header>
              <div className="quadrant-list">
                {items.length === 0 ? (
                  <p className="quadrant-empty">把任务拖到这里</p>
                ) : (
                  items.map((todo) => (
                    <div
                      key={todo.id}
                      className="quadrant-task"
                      draggable
                      onDragStart={() => setDragging(todo.id)}
                      onDragEnd={() => { setDragging(null); setOver(null) }}
                    >
                      <GripVertical size={13} className="drag-handle" />
                      <button className="mini-check" onClick={() => onToggle(todo.id)} aria-label="完成">
                        <Check size={10} />
                      </button>
                      <button className="quadrant-task-main" onClick={() => onEdit(todo)}>
                        <span>{todo.title}</span>
                        {todo.dueAt && <small className={dateKey(todo.dueAt) < dateKey(new Date()) ? 'overdue' : ''}>{new Date(todo.dueAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}</small>}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )
        })}
      </div>

      {done.length > 0 && (
        <section className="quadrant-done">
          <div className="section-heading"><span><LayoutGrid size={14} /> 最近完成</span><small>{done.length}</small></div>
          <div className="quadrant-done-list">
            {done.map((todo) => (
              <button key={todo.id} className="done-pill" onClick={() => onEdit(todo)}>
                <Check size={11} /> {todo.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
