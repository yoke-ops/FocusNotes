import { useState } from 'react'
import { Check, Download, FolderOpen, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import type { ProfileSummary } from '../desktop'

export interface ActionResult { ok: boolean; message: string }

interface Props {
  anchored?: boolean
  dir: string
  activeId: string
  profiles: ProfileSummary[]
  fallback?: boolean
  onClose(): void
  onSwitch(id: string): Promise<ActionResult>
  onCreate(name: string): Promise<ActionResult>
  onRename(id: string, name: string): Promise<ActionResult>
  onDelete(id: string): Promise<ActionResult>
  onExport(id: string): Promise<ActionResult>
  onImport(): Promise<ActionResult>
  onReveal(): Promise<ActionResult>
}

function formatStamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '本地记录'
  return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function ProfileDialog({ anchored, dir, activeId, profiles, fallback, onClose, onSwitch, onCreate, onRename, onDelete, onExport, onImport, onReveal }: Props) {
  const [draftName, setDraftName] = useState('')
  const [renamingId, setRenamingId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const [confirmId, setConfirmId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(true)

  async function run(action: () => Promise<ActionResult>, fallback: string): Promise<ActionResult> {
    setBusy(true)
    try {
      const result = await action()
      setMessage(result.message || fallback)
      setMessageOk(result.ok)
      return result
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : fallback
      setMessage(text)
      setMessageOk(false)
      return { ok: false, message: text }
    } finally {
      setBusy(false)
    }
  }

  async function create() {
    const name = draftName.trim()
    if (!name) { setMessage('请输入档案名称，例如“工作”“家里”。'); setMessageOk(false); return }
    const result = await run(() => onCreate(name), '已创建记录档案。')
    if (result.ok) setDraftName('')
  }

  async function submitRename(id: string) {
    const name = renameValue.trim()
    if (!name) { setMessage('档案名称不能为空。'); setMessageOk(false); return }
    const result = await run(() => onRename(id, name), '已重命名。')
    if (result.ok) setRenamingId('')
  }

  return <div className={anchored ? 'profile-anchor-backdrop' : 'modal-backdrop'} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div className={`profile-dialog${anchored ? ' anchored' : ' modal'}`} role="dialog" aria-modal="true" aria-label="记录档案">
      <div className="modal-head">
        <div><span className="modal-kicker">PROFILES</span><h2>记录档案</h2></div>
        <button className="icon-button small" onClick={onClose} aria-label="关闭"><X size={16} /></button>
      </div>
      <p className="profile-intro">每个档案是一份独立记录，保存在本机专用文件夹中。切换档案即可在不同使用者之间切换。</p>
      {fallback && <p className="profile-warning">安装目录不可写，档案已改存到上面的备用目录。</p>}

      <div className="profile-list">
        {profiles.map((profile) => {
          const active = profile.id === activeId
          return <article key={profile.id} className={`profile-row ${active ? 'active' : ''}`}>
            <button className="profile-main" onClick={() => { if (!active) void run(() => onSwitch(profile.id), '已切换记录档案。') }} disabled={busy}>
              <span className="profile-radio">{active && <Check size={11} strokeWidth={3} />}</span>
              <span className="profile-text">
                {renamingId === profile.id
                  ? <input className="profile-name-input" autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)}
                      onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
                        if (event.key === 'Enter') { event.preventDefault(); void submitRename(profile.id) }
                        if (event.key === 'Escape') { event.stopPropagation(); setRenamingId('') }
                      }} />
                  : <span className="profile-name">{profile.name}{active && <em>当前</em>}</span>}
                <span className="profile-meta">{profile.pending} 项待办 · 共 {profile.count} 条 · {formatStamp(profile.updatedAt)}</span>
              </span>
            </button>
            <div className="profile-actions">
              {renamingId === profile.id
                ? <button className="mini-action confirm" onClick={() => void submitRename(profile.id)} aria-label="保存名称" disabled={busy}><Check size={13} /></button>
                : <button className="mini-action" onClick={() => { setRenamingId(profile.id); setRenameValue(profile.name) }} aria-label={`重命名${profile.name}`}><Pencil size={13} /></button>}
              <button className="mini-action" onClick={() => { void run(() => onExport(profile.id), '已导出记录。') }} aria-label={`导出${profile.name}`} disabled={busy}><Download size={13} /></button>
              <button className={`mini-action ${confirmId === profile.id ? 'confirm-danger' : ''}`} disabled={busy || profiles.length <= 1}
                onClick={() => {
                  if (confirmId === profile.id) { setConfirmId(''); void run(() => onDelete(profile.id), '已删除档案。') }
                  else setConfirmId(profile.id)
                }} aria-label={confirmId === profile.id ? `确认删除${profile.name}` : `删除${profile.name}`}>
                {confirmId === profile.id ? <Check size={13} /> : <Trash2 size={13} />}
              </button>
            </div>
          </article>
        })}
      </div>

      {confirmId && <p className="profile-warning">再次点击红色按钮即删除该档案。文件会移入档案目录下的 <code>_trash</code> 子文件夹，可手动找回。</p>}

      <div className="profile-create">
        <input value={draftName} placeholder="新档案名称，例如：工作" disabled={busy}
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void create() } }} />
        <button className="secondary-button" onClick={() => void create()} disabled={busy}><Plus size={14} />新建</button>
      </div>

      <div className="profile-footer">
        <button className="ghost-button" onClick={() => { void run(() => onImport(), '已导入记录。') }} disabled={busy}><Upload size={13} />导入记录</button>
        <button className="ghost-button" onClick={() => { void run(() => onReveal(), '已打开档案文件夹。') }} disabled={busy}><FolderOpen size={13} />打开文件夹</button>
      </div>

      <p className="profile-path" title={dir}>{dir || '档案目录将在桌面端显示'}</p>
      {message && <p className={`profile-message ${messageOk ? '' : 'error'}`} role="status">{message}</p>}
    </div>
  </div>
}
