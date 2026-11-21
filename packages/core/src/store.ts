import type { KeyValueStorage, TodoDraft, TodoItem } from './types'
import { compareTodos, sortTodos } from './todo'
import { normalizeTags } from './workspace'

const DEFAULT_KEY = 'focusnotes.todos.v1'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function cleanTitle(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 200) : ''
}

function cleanNotes(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 4000) : ''
}

function cleanDueAt(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function cleanListId(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : 'inbox'
}

function cleanReminder(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const minutes = Number(value)
  return Number.isFinite(minutes) ? Math.max(0, Math.min(10080, Math.round(minutes))) : null
}

/** 允许外部（旧版本 / 导入文件）数据缺字段，一律补齐后再进内存。 */
export function normalizeTodo(value: unknown): TodoItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const title = cleanTitle(record.title)
  if (!id || !title) return null
  const completed = Boolean(record.completed)
  return {
    id,
    title,
    notes: cleanNotes(record.notes),
    dueAt: cleanDueAt(record.dueAt),
    ...(Object.prototype.hasOwnProperty.call(record, 'reminderMinutesBefore')
      ? { reminderMinutesBefore: cleanReminder(record.reminderMinutesBefore) }
      : {}),
    important: Boolean(record.important),
    urgent: Boolean(record.urgent),
    completed,
    completedAt: typeof record.completedAt === 'string' ? record.completedAt : null,
    listId: cleanListId(record.listId),
    tags: normalizeTags(record.tags),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : nowIso(),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : nowIso(),
    revision: Number.isFinite(Number(record.revision)) ? Number(record.revision) : 0,
    deleted: Boolean(record.deleted),
  }
}

export function normalizeTodos(value: unknown): TodoItem[] {
  if (Array.isArray(value)) {
    return value.map(normalizeTodo).filter((todo): todo is TodoItem => todo !== null).slice(0, 5000)
  }
  if (value && typeof value === 'object' && Array.isArray((value as { todos?: unknown }).todos)) {
    return normalizeTodos((value as { todos: unknown }).todos)
  }
  return []
}

export class TodoStore {
  private todos: TodoItem[] = []
  private listeners = new Set<(items: TodoItem[]) => void>()
  private pending: Promise<void> = Promise.resolve()

  constructor(private readonly storage: KeyValueStorage, private readonly key = DEFAULT_KEY) {}

  get items(): TodoItem[] {
    return sortTodos(this.todos.filter((todo) => !todo.deleted))
  }

  /** 全部任务（含已删除），用于导入 / 导出与统计。 */
  get all(): TodoItem[] {
    return [...this.todos]
  }

  get trashed(): TodoItem[] {
    return this.todos
      .filter((todo) => todo.deleted)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  subscribe(listener: (items: TodoItem[]) => void): () => void {
    this.listeners.add(listener)
    listener(this.items)
    return () => {
      this.listeners.delete(listener)
    }
  }

  async load(): Promise<void> {
    const raw = await this.storage.getItem(this.key)
    if (!raw) {
      this.emit()
      return
    }
    try {
      this.todos = normalizeTodos(JSON.parse(raw))
    } catch {
      this.todos = []
    }
    this.emit()
  }

  /** 直接用外部文档填充（Electron 工作区 / 导入），不写回存储。 */
  hydrate(value: unknown): void {
    this.todos = normalizeTodos(value)
    this.emit()
  }

  async add(draft: TodoDraft): Promise<TodoItem> {
    const title = cleanTitle(draft.title)
    if (!title) throw new Error('请输入待办标题')
    const dueAt = cleanDueAt(draft.dueAt)
    if (draft.dueAt && !dueAt) throw new Error('截止时间格式无效')
    const timestamp = nowIso()
    const todo: TodoItem = {
      id: createId(),
      title,
      notes: cleanNotes(draft.notes),
      dueAt,
      ...(draft.reminderMinutesBefore === undefined ? {} : { reminderMinutesBefore: cleanReminder(draft.reminderMinutesBefore) }),
      important: Boolean(draft.important),
      urgent: Boolean(draft.urgent),
      completed: false,
      completedAt: null,
      listId: cleanListId(draft.listId),
      tags: normalizeTags(draft.tags),
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 0,
      deleted: false,
    }
    this.todos = [todo, ...this.todos]
    await this.persist()
    return todo
  }

  async update(id: string, draft: Partial<TodoDraft>): Promise<void> {
    const index = this.todos.findIndex((todo) => todo.id === id)
    if (index < 0) return
    const current = this.todos[index]!
    const next: TodoItem = {
      ...current,
      title: draft.title === undefined ? current.title : cleanTitle(draft.title) || current.title,
      notes: draft.notes === undefined ? current.notes : cleanNotes(draft.notes),
      dueAt: draft.dueAt === undefined ? current.dueAt : cleanDueAt(draft.dueAt),
      reminderMinutesBefore: draft.reminderMinutesBefore === undefined ? current.reminderMinutesBefore : cleanReminder(draft.reminderMinutesBefore),
      important: draft.important === undefined ? current.important : Boolean(draft.important),
      urgent: draft.urgent === undefined ? current.urgent : Boolean(draft.urgent),
      listId: draft.listId === undefined ? current.listId : cleanListId(draft.listId),
      tags: draft.tags === undefined ? current.tags : normalizeTags(draft.tags),
      updatedAt: nowIso(),
      revision: current.revision + 1,
    }
    this.todos = this.todos.map((todo, at) => (at === index ? next : todo))
    await this.persist()
  }

  async toggle(id: string): Promise<void> {
    const index = this.todos.findIndex((todo) => todo.id === id)
    if (index < 0) return
    const current = this.todos[index]!
    const completed = !current.completed
    const next: TodoItem = {
      ...current,
      completed,
      completedAt: completed ? nowIso() : null,
      updatedAt: nowIso(),
      revision: current.revision + 1,
    }
    this.todos = this.todos.map((todo, at) => (at === index ? next : todo))
    await this.persist()
  }

  async remove(id: string): Promise<void> {
    const index = this.todos.findIndex((todo) => todo.id === id)
    if (index < 0) return
    const current = this.todos[index]!
    this.todos = this.todos.map((todo, at) => (at === index ? { ...current, deleted: true, updatedAt: nowIso(), revision: current.revision + 1 } : todo))
    await this.persist()
  }

  async restore(id: string): Promise<void> {
    const index = this.todos.findIndex((todo) => todo.id === id)
    if (index < 0) return
    const current = this.todos[index]!
    this.todos = this.todos.map((todo, at) => (at === index ? { ...current, deleted: false, updatedAt: nowIso(), revision: current.revision + 1 } : todo))
    await this.persist()
  }

  async purge(id: string): Promise<void> {
    this.todos = this.todos.filter((todo) => todo.id !== id)
    await this.persist()
  }

  async purgeTrash(): Promise<void> {
    this.todos = this.todos.filter((todo) => !todo.deleted)
    await this.persist()
  }

  /** 供同步层写入合并后的结果；会重新排序并持久化。 */
  async replace(todos: readonly TodoItem[]): Promise<void> {
    this.todos = normalizeTodos(todos).sort(compareTodos)
    await this.persist()
  }

  private async persist(): Promise<void> {
    const payload = JSON.stringify(this.todos)
    const write = this.storage.prepareWrite?.(this.key, payload)
    const result = this.pending.then(write ?? (() => this.storage.setItem(this.key, payload)))
    this.pending = result.catch(() => undefined)
    // Legacy adapters keep their existing best-effort persistence behavior.
    await (write ? result : this.pending)
    this.emit()
  }

  private emit(): void {
    const items = this.items
    for (const listener of this.listeners) listener(items)
  }
}
