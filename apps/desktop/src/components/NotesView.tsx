import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

const MAX_MEMO_LENGTH = 1_000_000

export function NotesView({ profileId }: { profileId: string }) {
  const [body, setBody] = useState('')
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('正在读取…')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)
  const latest = useRef('')
  const saved = useRef('')
  const pending = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const save = useCallback(async (report = true) => {
    window.clearTimeout(timer.current)
    const value = latest.current
    if (value === saved.current && pending.current === 0) {
      if (report) setStatus('已保存')
      return
    }
    pending.current += 1
    try {
      const memo = window.focusDesktop?.memo
      if (!memo) throw new Error('请在 Windows 桌面版打开备忘录。')
      await memo.write(profileId, value)
      saved.current = value
      if (report && latest.current === value) {
        setStatus('已保存')
        setError('')
      }
    } catch {
      if (report && latest.current === value) {
        setStatus('未保存')
        setError('保存失败。请按 Ctrl+S 重试，或复制全文保留内容。')
      }
    } finally {
      pending.current -= 1
    }
  }, [profileId])

  useEffect(() => {
    let active = true
    const memo = window.focusDesktop?.memo
    if (!memo) {
      setStatus('')
      setError('请在 Windows 桌面版打开备忘录。')
      return
    }
    void memo.read(profileId).then((value) => {
      if (!active) return
      latest.current = value
      saved.current = value
      setBody(value)
      setStatus('已保存')
      setReady(true)
    }).catch(() => {
      if (!active) return
      setStatus('')
      setError('读取失败。请重新打开备忘录。')
    })
    return () => {
      active = false
      window.clearTimeout(copyTimer.current)
      void save(false)
    }
  }, [profileId, save])

  return (
    <section className="notes-view" aria-label="备忘录编辑器">
      <div className="notes-toolbar">
        <span key={status} className="notes-status" role="status">{status}</span>
        <button type="button" className="ghost-button" disabled={!body} onClick={async () => {
          try {
            const memo = window.focusDesktop?.memo
            if (!memo) throw new Error('无法复制备忘录。')
            await memo.copy(latest.current)
            setCopied(true)
            window.clearTimeout(copyTimer.current)
            copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
            setError('')
          } catch {
            setError('复制失败。可选中文字后按 Ctrl+C。')
          }
        }}>{copied ? <Check size={15} className="notes-copy-check" /> : <Copy size={15} />} {copied ? '已复制' : '复制全文'}</button>
      </div>
      <textarea
        aria-label="备忘录正文"
        placeholder="写点什么，或粘贴一段文字…"
        className="notes-editor"
        value={body}
        disabled={!ready}
        spellCheck={false}
        maxLength={MAX_MEMO_LENGTH}
        onChange={(event) => {
          const value = event.target.value
          setCopied(false)
          latest.current = value
          setBody(value)
          setStatus('正在保存…')
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => void save(), 400)
        }}
        onBlur={() => { if (latest.current !== saved.current || pending.current) void save() }}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault()
            void save()
          }
        }}
      />
      {error && <p className="notes-error" role="alert">{error}</p>}
    </section>
  )
}
