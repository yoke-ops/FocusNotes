import { useEffect, useMemo, useState } from 'react'
import { NotebookPen, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { MEMO_CONTENT_LIMIT, type Memo } from '@focusnotes/core'

interface Props {
  memos: Memo[]
  onSave(memo: Memo): void
  onDelete(id: string): void
}

function blank(): Memo {
  const now = new Date().toISOString()
  return { id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, title: '', content: '', pinned: false, createdAt: now, updatedAt: now, revision: 1, deleted: false }
}

export function MemosView({ memos, onSave, onDelete }: Props) {
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)
  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    const alive = memos.filter((item) => !item.deleted)
    const filtered = keyword ? alive.filter((item) => `${item.title}\n${item.content}`.toLowerCase().includes(keyword)) : alive
    return [...filtered].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
  }, [memos, query])

  const active = visible.find((item) => item.id === activeId) ?? visible[0] ?? null

  return <div className="memos-view">
    <aside className="memos-list">
      <div className="memos-search">
        <Search size={14} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索备忘录" />
      </div>
      <button className="memos-new" onClick={() => { const memo = blank(); onSave(memo); setActiveId(memo.id) }}><Plus size={14} /> 新建备忘录</button>
      <div className="memos-items">
        {visible.length === 0 && <p className="memos-hint">还没有备忘录，点上方新建。</p>}
        {visible.map((item) => <button key={item.id} className={`memos-item${active?.id === item.id ? ' active' : ''}`} onClick={() => setActiveId(item.id)}>
          <span className="memos-item-title">{item.pinned && <Pin size={11} />}{item.title || '无标题'}</span>
          <span className="memos-item-preview">{item.content.slice(0, 60) || '（空）'}</span>
          <span className="memos-item-time">{new Date(item.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {item.content.length} 字</span>
        </button>)}
      </div>
    </aside>

    <MemoEditor key={active?.id ?? 'none'} memo={active} onSave={onSave} onDelete={(id) => { onDelete(id); setActiveId(null) }} />
  </div>
}

function MemoEditor({ memo, onSave, onDelete }: { memo: Memo | null; onSave(memo: Memo): void; onDelete(id: string): void }) {
  const [title, setTitle] = useState(memo?.title ?? '')
  const [content, setContent] = useState(memo?.content ?? '')
  const [revision, setRevision] = useState(memo?.revision ?? 1)

  useEffect(() => { setTitle(memo?.title ?? ''); setContent(memo?.content ?? ''); setRevision(memo?.revision ?? 1) }, [memo?.id])

  if (!memo) return <section className="memos-editor"><div className="memos-empty"><NotebookPen size={30} /><p>选择或新建一条备忘录</p></div></section>

  function commit(patch: Partial<Memo>) {
    const next = { ...memo!, ...patch, updatedAt: new Date().toISOString(), revision: revision + 1 }
    setRevision(next.revision)
    onSave(next)
  }

  return <section className="memos-editor">
    <div className="memos-toolbar">
      <button className="ghost-button small" onClick={() => commit({ pinned: !memo.pinned })}>
        {memo.pinned ? <PinOff size={13} /> : <Pin size={13} />}{memo.pinned ? '取消置顶' : '置顶'}
      </button>
      <span className="memos-counter">{content.length} / {MEMO_CONTENT_LIMIT}</span>
      <button className="ghost-button small danger" onClick={() => { if (confirm('删除这条备忘录？')) onDelete(memo.id) }}><Trash2 size={13} /> 删除</button>
    </div>
    <input className="memos-title-input" value={title} placeholder="标题" maxLength={200}
      onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title !== memo.title) commit({ title }) }} />
    <textarea className="memos-content-input" value={content} placeholder="正文…（支持长文本）"
      onChange={(event) => setContent(event.target.value.slice(0, MEMO_CONTENT_LIMIT))} onBlur={() => { if (content !== memo.content) commit({ content }) }} />
  </section>
}
