import { useEffect, useState } from 'react'
import { CloudUpload, Link2, RefreshCw } from 'lucide-react'

interface Config { owner: string; repo: string; branch: string; path: string; token: string }

/** Gitee 同步配置面板：令牌经主进程 safeStorage 加密后落盘，渲染层不持久化明文。 */
export function GiteePanel({ onChanged }: { onChanged(): void }) {
  const [draft, setDraft] = useState<Config>({ owner: '', repo: '', branch: 'master', path: 'focusnotes/data.json', token: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void window.focusDesktop?.gitee.get().then((config) => {
      if (config) {
        setDraft({ owner: config.owner, repo: config.repo, branch: config.branch, path: config.path, token: config.token })
        if (!config.profileId) setStatus('请在原来使用该云端文件的档案中重新保存连接。')
      }
    }).catch(() => undefined)
  }, [])

  async function save() {
    if (!draft.owner.trim() || !draft.repo.trim() || !draft.token.trim()) { setStatus('用户名、仓库与令牌都要填。'); return }
    setBusy(true)
    try {
      const result = await window.focusDesktop?.gitee.set(draft)
      if (result?.ok) {
        setStatus(result.encrypted ? '已保存（令牌已加密）' : '已保存（当前系统不支持加密，令牌未落盘）')
        onChanged()
      } else setStatus(result?.message ?? '保存失败')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败')
    } finally { setBusy(false) }
  }

  return <div className="settings-group">
    <span className="settings-label"><CloudUpload size={12} /> Gitee 云同步</span>
    <p className="settings-hint">同步连接绑定当前档案。为不同档案指定不同的仓库文件路径。令牌仅保存在本机并加密。</p>
    {([['owner', '用户名'], ['repo', '仓库'], ['branch', '分支'], ['path', '文件路径'], ['token', '私人令牌']] as const).map(([key, label]) =>
      <div className="field" key={key}>
        <span>{label}</span>
        <input value={draft[key]} placeholder={key === 'token' ? '在 Gitee 设置里生成' : key === 'path' ? 'focusnotes/data.json' : ''}
          type={key === 'token' ? 'password' : 'text'} autoComplete="off"
          onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
      </div>)}
    <div className="gitee-actions">
      <button className="primary-button small" onClick={() => void save()} disabled={busy}><Link2 size={13} /> 保存并连接</button>
      <button className="ghost-button small" onClick={() => { setBusy(true); void window.focusDesktop?.gitee.get().then(() => setStatus('配置已就绪')).finally(() => setBusy(false)) }}><RefreshCw size={13} /> 重新读取</button>
      {!!status && <span className="gitee-status">{status}</span>}
    </div>
  </div>
}
