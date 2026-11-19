import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Plus, Sparkles } from 'lucide-react'
import { HybridSmartParser, type ParsedTodoDraft, type TodoDraft, type TodoList } from '@focusnotes/core'

interface QuickAddProps {
  lists: TodoList[]
  defaultListId: string
  defaultDueAt?: string | null
  placeholder?: string
  onAdd: (draft: TodoDraft) => Promise<unknown>
}

function humanDue(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function QuickAdd({ lists, defaultListId, defaultDueAt, placeholder = '添加任务，试试「明天下午3点提交报告」', onAdd }: QuickAddProps) {
  const parser = useMemo(() => new HybridSmartParser(), [])
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ParsedTodoDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    const value = text.trim()
    if (!value) {
      setPreview(null)
      return () => {
        alive = false
      }
    }
    const timer = window.setTimeout(() => {
      parser.parse(value).then((result) => {
        if (alive) setPreview(result)
      }).catch(() => { /* 预览失败不阻塞提交 */ })
    }, 220)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [text, parser])

  const submit = async () => {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    setError('')
    try {
      const parsed = await parser.parse(value)
      await onAdd({
        title: parsed.title || value,
        dueAt: parsed.dueAt ?? defaultDueAt ?? null,
        important: parsed.important,
        urgent: parsed.urgent,
        listId: defaultListId,
      })
      setText('')
      setPreview(null)
      inputRef.current?.focus()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '添加失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const due = preview?.dueAt ?? defaultDueAt
  return (
    <div className="quick-add">
      <div className="quick-add-field">
        <Plus size={18} className="quick-add-plus" />
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) void submit()
          }}
          placeholder={placeholder}
          aria-label="快速添加任务"
        />
        <button className="quick-submit" onClick={() => void submit()} disabled={!text.trim() || busy} aria-label="添加">
          {busy ? '…' : <CornerDownLeft size={15} />}
        </button>
      </div>
      {(text.trim() || error) && (
        <div className="quick-preview">
          {error ? (
            <span className="quick-error">{error}</span>
          ) : (
            <>
              <Sparkles size={13} />
              {preview?.title && <span className="preview-title">{preview.title}</span>}
              {due && <span className="preview-chip">{humanDue(due)}</span>}
              {preview?.important && <span className="preview-chip important">重要</span>}
              {preview?.urgent && <span className="preview-chip urgent">紧急</span>}
              {!preview?.dueAt && !preview?.important && !preview?.urgent && <span className="preview-hint">直接回车加入清单</span>}
            </>
          )}
          {lists.length > 0 && (
            <span className="preview-list">{lists.find((list) => list.id === defaultListId)?.name ?? '收集箱'}</span>
          )}
        </div>
      )}
    </div>
  )
}
