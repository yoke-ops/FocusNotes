import { useEffect, useId, useState } from 'react'
import {
  Bell,
  Check,
  Cloud,
  Database,
  Download,
  Droplets,
  FileSpreadsheet,
  FolderOpen,
  History,
  LayoutGrid,
  Magnet,
  Monitor,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Moon,
  NotebookPen,
  Palette,
  Pin,
  Settings2,
  Sparkles,
  Sun,
  Sunrise,
  Type,
  Upload,
  Waves,
  X,
} from 'lucide-react'
import {
  FONT_OPTIONS,
  NAV_ITEMS,
  WIDGET_KINDS,
  type FontId,
  type NavId,
  type WidgetKind,
  type WidgetPreferences,
  type WidgetSnap,
  type WorkspacePreferences,
} from '@focusnotes/core'
import type { ThemeMode, WindowEffect } from '../desktop'
import { PALETTES, type PaletteId } from '../palettes'
import { MOTION_OPTIONS, resolveMotion, type MotionMode } from '../motion'
import { GiteePanel } from './GiteePanel'

interface SettingsDialogProps {
  theme: ThemeMode
  palette: PaletteId
  dark: boolean
  onPalette: (palette: PaletteId) => void
  motion: MotionMode
  onMotion: (motion: MotionMode) => void
  alwaysOnTop: boolean
  opacity: number
  windowEffect: WindowEffect
  windowBlur: number
  widgetEnabled: boolean
  remindersEnabled: boolean
  leadMinutes: number
  preferences: WorkspacePreferences
  widgets: WidgetKind[]
  profileName: string
  dataDir: string
  onTheme: (theme: ThemeMode) => void
  onAlwaysOnTop: (value: boolean) => void
  onOpacity: (value: number) => void
  onWindowEffect: (effect: WindowEffect) => void
  onWindowBlur: (blur: number) => void
  onWidgetEnabled: (enabled: boolean) => void
  onReminders: (enabled: boolean, leadMinutes: number) => void
  onPreferences: (patch: Partial<WorkspacePreferences>) => void
  onWidgets: (widgets: WidgetKind[]) => void
  onWidgetPreferences: (patch: Partial<WidgetPreferences>) => void
  onNavigation: (patch: { navOrder?: NavId[]; navHidden?: NavId[] }) => void
  onExportPersonal: (kind: 'lists' | 'habits' | 'history' | 'all') => void
  onImportPersonal: () => void
  onOpenProfile: () => void
  onGiteeChanged?: () => void
  onReveal: () => void
  onClose: () => void
}

type Section = 'appearance' | 'reminders' | 'focus' | 'widgets' | 'data'

const THEMES: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'system', label: '跟随系统', icon: Monitor },
  { id: 'light', label: '浅色', icon: Sun },
  { id: 'dark', label: '深色', icon: Moon },
  { id: 'sun', label: '日出日落', icon: Sunrise },
]

const EFFECTS: { id: WindowEffect; label: string; hint: string; icon: typeof Sparkles }[] = [
  { id: 'solid', label: '纯色', hint: '清晰稳定', icon: Sparkles },
  { id: 'frosted', label: '毛玻璃', hint: '半透明雾面', icon: Waves },
  { id: 'liquid', label: '液态玻璃', hint: '半透明渐层与边缘高光', icon: Droplets },
]

function EffectPicker({ value, onChange }: { value: WindowEffect; onChange: (effect: WindowEffect) => void }) {
  return (
    <div className="effect-grid" role="group" aria-label="窗口质感">
      {EFFECTS.map(({ id, label, hint, icon: Icon }) => (
        <button type="button" key={id} className={`effect-card effect-${id}${id === value ? ' active' : ''}`}
          aria-pressed={id === value} onClick={() => onChange(id)}>
          <Icon size={16} aria-hidden="true" />
          <span><strong>{label}</strong><small>{hint}</small></span>
        </button>
      ))}
    </div>
  )
}

function BlurControl({ value, onChange }: { value: number; onChange: (blur: number) => void }) {
  return <label className="settings-row">
    <span><strong>模糊强度</strong><small>调整壁纸图层的模糊程度</small></span>
    <div className="range-wrap">
      <input type="range" min={0} max={32} step={1} value={value} aria-label="模糊强度"
        onChange={(event) => onChange(Number(event.target.value))} />
      <output>{value} px</output>
    </div>
  </label>
}

const SNAP_OPTIONS: Array<{ id: WidgetSnap; label: string }> = [
  { id: 'none', label: '自由' },
  { id: 'top-left', label: '左上' },
  { id: 'top-right', label: '右上' },
  { id: 'bottom-left', label: '左下' },
  { id: 'bottom-right', label: '右下' },
  { id: 'top', label: '顶边' },
  { id: 'follow-app', label: '跟随应用' },
]

const WIDGET_LABELS: Record<WidgetKind, { title: string; hint: string }> = {
  tasks: { title: '任务', hint: '直观聚焦任务列表' },
  calendar: { title: '日历', hint: '轻松查看所有日程' },
  quadrant: { title: '四象限', hint: '轻重缓急一目了然' },
  habits: { title: '习惯', hint: '轻松打卡养成好习惯' },
  countdown: { title: '倒数纪念日', hint: '记录每一个重要的日子' },
  assistant: { title: 'AI 助手', hint: '用 AI 轻松管理任务' },
}

const SECTIONS: { id: Section; label: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: '外观与窗口', icon: Palette },
  { id: 'reminders', label: '提醒与通知', icon: Bell },
  { id: 'focus', label: '专注设置', icon: Settings2 },
  { id: 'widgets', label: '桌面小部件', icon: LayoutGrid },
  { id: 'data', label: '数据与档案', icon: Database },
]

export function SettingsDialog(props: SettingsDialogProps) {
  const [section, setSection] = useState<Section>('appearance')
  const [glassControlsOpen, setGlassControlsOpen] = useState(false)
  const glassControlsId = useId()
  const widget = props.preferences.widget
  const [version, setVersion] = useState('0.1.1')
  const [uiScale, setUiScale] = useState(() => {
    const saved = Number(localStorage.getItem('focusnotes.uiScale') ?? 1)
    return Number.isFinite(saved) && saved >= 0.8 && saved <= 1.4 ? saved : 1
  })

  useEffect(() => {
    void window.focusDesktop?.appVersion().then((value) => { if (value) setVersion(value) }).catch(() => undefined)
  }, [])

  function changeUiScale(value: number) {
    const next = Math.round(Math.min(1.4, Math.max(0.8, value)) * 20) / 20
    setUiScale(next)
    localStorage.setItem('focusnotes.uiScale', String(next))
    void window.focusDesktop?.setZoom(next)
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) props.onClose() }}>
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="设置">
        <aside className="settings-nav">
          <div className="settings-title"><Settings2 size={16} /><span>设置</span></div>
          {SECTIONS.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} className={section === item.id ? 'active' : ''} onClick={() => setSection(item.id)}>
                <Icon size={15} /> {item.label}
              </button>
            )
          })}
          <div className="settings-nav-foot">
            <span className="brand-mark small"><NotebookPen size={12} /></span>
            <div><strong>FocusNotes</strong><small>v{version}</small></div>
          </div>
        </aside>

        <section className="settings-body">
          <button className="icon-button settings-close" onClick={props.onClose} aria-label="关闭"><X size={16} /></button>

          {section === 'appearance' && (
            <>
              <header className="settings-head"><h2>外观与窗口</h2><p>让 FocusNotes 更符合你的桌面。</p></header>
              <div className="settings-group">
                <span className="settings-label">深浅模式</span>
                <div className="theme-grid">
                  {THEMES.map((theme) => {
                    const Icon = theme.icon
                    return (
                      <button key={theme.id} className={`theme-card${props.theme === theme.id ? ' active' : ''}`} onClick={() => props.onTheme(theme.id)}>
                        <span className={`theme-preview ${theme.id}`}><Icon size={16} /></span>
                        <span>{theme.label}</span>
                        {props.theme === theme.id && <Check size={13} className="theme-check" />}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="settings-group">
                <span className="settings-label"><Palette size={12} /> 配色方案</span>
                <div className="palette-grid" role="group" aria-label="配色方案">
                  {PALETTES.map((palette) => {
                    const colors = props.dark ? palette.dark : palette.light
                    const selected = props.palette === palette.id
                    return <button type="button" key={palette.id} className={`palette-card${selected ? ' active' : ''}`}
                      aria-pressed={selected} onClick={() => props.onPalette(palette.id)}>
                      <span className="palette-swatches" aria-hidden="true">
                        {[colors[0], colors[1], colors[2], colors[5]].map((color) => (
                          <i key={color} style={{ backgroundColor: color }} />
                        ))}
                      </span>
                      <span>{palette.label}</span>
                      {selected && <Check size={13} className="palette-check" aria-hidden="true" />}
                    </button>
                  })}
                </div>
              </div>
              <div className="settings-group">
                <label className="settings-row">
                  <span><strong>动效强度</strong><small>同时跟随系统的减少动画设置</small></span>
                  <select aria-label="动效强度" value={props.motion}
                    onChange={(event) => props.onMotion(resolveMotion(event.target.value))}>
                    {MOTION_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="settings-group">
                <span className="settings-label"><Type size={12} /> 显示字体</span>
                <div className="font-grid">
                  {FONT_OPTIONS.map((font) => (
                    <button key={font.id} className={`font-card${props.preferences.font === font.id ? ' active' : ''}`}
                      style={{ fontFamily: font.family }}
                      onClick={() => props.onPreferences({ font: font.id as FontId })}>
                      <span className="font-sample">Aa 文字</span>
                      <strong>{font.label}</strong>
                      <small>{font.category}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-group">
                <label className="settings-row">
                  <span><strong>窗口透明度</strong><small>20% – 100% 线性调节</small></span>
                  <div className="range-wrap">
                    <input type="range" min={20} max={100} step={1} value={props.opacity} onChange={(event) => props.onOpacity(Number(event.target.value))} />
                    <output>{Math.round(props.opacity)}%</output>
                  </div>
                </label>
              </div>
              <div className="settings-group">
                <span className="settings-label"><Palette size={12} /> 界面文字大小</span>
                <p className="settings-hint">整体缩放界面文字与控件，当前 {Math.round(uiScale * 100)}%。</p>
                <input type="range" min={0.8} max={1.4} step={0.05} value={uiScale}
                  onChange={(event) => changeUiScale(Number(event.target.value))} aria-label="界面文字大小" />
                <div className="scale-legend"><span>80%</span><span>100%</span><span>140%</span></div>
              </div>
              <div className="settings-group">
                <span className="settings-label">窗口质感</span>
                <EffectPicker value={props.windowEffect} onChange={props.onWindowEffect} />
                {props.windowEffect !== 'solid' && <BlurControl value={props.windowBlur} onChange={props.onWindowBlur} />}
              </div>
              <div className="settings-group">
                <label className="settings-row">
                  <span><strong>窗口置顶</strong><small>始终显示在其他应用之上</small></span>
                  <button className={`switch${props.alwaysOnTop ? ' on' : ''}`} onClick={() => props.onAlwaysOnTop(!props.alwaysOnTop)} aria-label="窗口置顶"><i /></button>
                </label>
              </div>
              <div className="settings-group">
                <span className="settings-label"><LayoutGrid size={12} /> 左侧功能栏</span>
                <div className="nav-list">
                  {(() => {
                    const full = NAV_ITEMS.map((item) => item.id)
                    const ordered = [...props.preferences.navOrder.filter((id) => full.includes(id)), ...full.filter((id) => !props.preferences.navOrder.includes(id))]
                    return ordered
                  })().map((id, index, list) => {
                    const meta = NAV_ITEMS.find((item) => item.id === id)
                    const hidden = props.preferences.navHidden.includes(id)
                    return <div key={id} className={`nav-row${hidden ? ' hidden' : ''}`}>
                      <button className="mini-action" disabled={index === 0}
                        onClick={() => {
                          const next = [...list]
                          ;[next[index - 1], next[index]] = [next[index]!, next[index - 1]!]
                          props.onNavigation({ navOrder: next })
                        }} aria-label="上移"><ArrowUp size={11} /></button>
                      <button className="mini-action" disabled={index === list.length - 1}
                        onClick={() => {
                          const next = [...list]
                          ;[next[index], next[index + 1]] = [next[index + 1]!, next[index]!]
                          props.onNavigation({ navOrder: next })
                        }} aria-label="下移"><ArrowDown size={11} /></button>
                      <span className="nav-label">{meta?.label ?? id}</span>
                      <button className="mini-action" onClick={() => props.onNavigation({
                        navHidden: hidden ? props.preferences.navHidden.filter((item) => item !== id) : [...props.preferences.navHidden, id],
                      })} aria-label={hidden ? '显示' : '隐藏'}>{hidden ? <EyeOff size={11} /> : <Eye size={11} />}</button>
                    </div>
                  })}
                </div>
                <p className="settings-hint">用箭头调整顺序，点击眼睛图标显示或隐藏功能项。</p>
              </div>
            </>
          )}

          {section === 'reminders' && (
            <>
              <header className="settings-head"><h2>提醒与通知</h2><p>在合适的时间提醒你，而不是打断你。</p></header>
              <div className="settings-group">
                <label className="settings-row">
                  <span><strong>启用提醒</strong><small>到期任务会通过系统通知提醒</small></span>
                  <button className={`switch${props.remindersEnabled ? ' on' : ''}`} onClick={() => props.onReminders(!props.remindersEnabled, props.leadMinutes)} aria-label="启用提醒"><i /></button>
                </label>
                <label className="settings-row">
                  <span><strong>提前提醒</strong><small>在截止时间之前多久提醒</small></span>
                  <select value={props.leadMinutes} onChange={(event) => props.onReminders(props.remindersEnabled, Number(event.target.value))} disabled={!props.remindersEnabled}>
                    {[0, 5, 10, 15, 30, 60].map((minute) => <option key={minute} value={minute}>{minute === 0 ? '准时' : `${minute} 分钟`}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          {section === 'focus' && (
            <>
              <header className="settings-head"><h2>专注设置</h2><p>配置番茄钟和每日目标。</p></header>
              <div className="settings-group two-col">
                <label className="settings-field"><span>专注时长（分钟）</span><input type="number" min={1} max={180} value={props.preferences.pomodoroMinutes} onChange={(event) => props.onPreferences({ pomodoroMinutes: Number(event.target.value) })} /></label>
                <label className="settings-field"><span>短休息（分钟）</span><input type="number" min={1} max={60} value={props.preferences.shortBreakMinutes} onChange={(event) => props.onPreferences({ shortBreakMinutes: Number(event.target.value) })} /></label>
                <label className="settings-field"><span>长休息（分钟）</span><input type="number" min={1} max={120} value={props.preferences.longBreakMinutes} onChange={(event) => props.onPreferences({ longBreakMinutes: Number(event.target.value) })} /></label>
                <label className="settings-field"><span>每日目标（个番茄）</span><input type="number" min={1} max={24} value={props.preferences.dailyGoal} onChange={(event) => props.onPreferences({ dailyGoal: Number(event.target.value) })} /></label>
              </div>
              <div className="settings-group">
                <label className="settings-row">
                  <span><strong>完成提示音</strong><small>每段专注结束时播放轻提示</small></span>
                  <button className={`switch${props.preferences.sound ? ' on' : ''}`} onClick={() => props.onPreferences({ sound: !props.preferences.sound })} aria-label="提示音"><i /></button>
                </label>
              </div>
            </>
          )}

          {section === 'widgets' && (
            <>
              <header className="settings-head"><h2>桌面小部件</h2><p>独立悬浮小窗，随手完成今天的事。</p></header>
              <div className="settings-group">
                <label className="settings-row">
                  <span><strong>显示桌面小部件</strong><small>桌面浮窗，可被其他应用窗口覆盖</small></span>
                  <button className={`switch${props.widgetEnabled ? ' on' : ''}`} onClick={() => props.onWidgetEnabled(!props.widgetEnabled)} aria-label="显示桌面小部件"><i /></button>
                </label>
              </div>
              <div className="settings-group">
                <span className="settings-label"><Palette size={12} /> 小组件外观</span>
                <EffectPicker value={widget.material === 'classic' ? 'solid' : widget.material}
                  onChange={(effect) => props.onWidgetPreferences({ material: effect === 'solid' ? 'classic' : effect })} />
                {widget.material !== 'classic' && <BlurControl value={widget.glassBlur} onChange={(glassBlur) => props.onWidgetPreferences({ glassBlur })} />}
                {widget.material !== 'classic' && (
                  <>
                    <div className="settings-row">
                      <span><strong>雾面透明度</strong><small>数值越高，背景越通透</small></span>
                      <button type="button" className="secondary-button" aria-expanded={glassControlsOpen}
                        aria-controls={glassControlsId} aria-label={`调整雾面透明度，当前 ${widget.glassTransparency}%`}
                        onClick={() => setGlassControlsOpen((open) => !open)}>
                        {glassControlsOpen ? '收起' : '调整'} · {widget.glassTransparency}%
                      </button>
                    </div>
                    <div id={glassControlsId} hidden={!glassControlsOpen}>
                      <label className="settings-row">
                        <span><strong>透明度</strong></span>
                        <div className="range-wrap">
                          <input type="range" min={0} max={100} step={1} value={widget.glassTransparency}
                            aria-label="雾面透明度" aria-valuetext={`${widget.glassTransparency}%`}
                            onChange={(event) => props.onWidgetPreferences({ glassTransparency: Number(event.target.value) })} />
                          <output>{widget.glassTransparency}%</output>
                        </div>
                      </label>
                    </div>
                  </>
                )}
                {widget.material === 'classic' && <label className="settings-row">
                  <span><strong>底色浓度</strong><small>数值越高，背景底色越实</small></span>
                  <div className="range-wrap">
                    <input type="range" min={20} max={100} step={1} value={props.preferences.widget.opacity}
                      onChange={(event) => props.onWidgetPreferences({ opacity: Number(event.target.value) })} />
                    <output>{props.preferences.widget.opacity}%</output>
                  </div>
                </label>}
                <label className="settings-row">
                  <span><strong><Type size={12} /> 文字大小</strong><small>调整小组件的字号</small></span>
                  <div className="range-wrap">
                    <input type="range" min={80} max={140} step={5} value={props.preferences.widget.fontSize}
                      onChange={(event) => props.onWidgetPreferences({ fontSize: Number(event.target.value) })} />
                    <output>{props.preferences.widget.fontSize}%</output>
                  </div>
                </label>
              </div>
              <div className="settings-group">
                <span className="settings-label"><Magnet size={12} /> 磁吸位置</span>
                <div className="snap-grid">
                  {SNAP_OPTIONS.map((option) => (
                    <button key={option.id}
                      className={`snap-chip${props.preferences.widget.snap === option.id ? ' active' : ''}`}
                      onClick={() => props.onWidgetPreferences({ snap: option.id })}>{option.label}</button>
                  ))}
                </div>
                <p className="settings-hint">「跟随应用」会吸附到当前前台窗口右上角，并随其移动。</p>
              </div>
              <div className="settings-group widget-settings">
                {WIDGET_KINDS.map(({ kind }) => {
                  const meta = WIDGET_LABELS[kind]
                  const active = props.widgets.includes(kind)
                  return (
                    <button key={kind} className={`widget-setting${active ? ' active' : ''}`} onClick={() => props.onWidgets(active ? props.widgets.filter((item) => item !== kind) : [...props.widgets, kind])}>
                      <span className={`widget-setting-icon${active ? ' active' : ''}`}>{active ? <Check size={14} /> : '+'}</span>
                      <span><strong>{meta.title}</strong><small>{meta.hint}</small></span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {section === 'data' && (
            <>
              <header className="settings-head"><h2>数据与档案</h2><p>所有数据都保存在本机。</p></header>
              <GiteePanel onChanged={() => props.onGiteeChanged?.()} />
              <div className="settings-group">
                <button className="settings-row clickable" onClick={props.onOpenProfile}>
                  <span><strong>当前档案</strong><small>{props.profileName}</small></span>
                  <span className="row-arrow">切换 / 管理 →</span>
                </button>
                <div className="settings-row">
                  <span><strong>数据目录</strong><small className="path-text">{props.dataDir || '浏览器本地存储'}</small></span>
                  <button className="ghost-button small" onClick={props.onReveal}>打开目录</button>
                </div>
              </div>
              <div className="settings-group">
                <span className="settings-label"><FileSpreadsheet size={12} /> 个人文件</span>
                <div className="personal-grid">
                  <button className="personal-item" onClick={() => props.onExportPersonal('lists')}><Download size={13} /><span><strong>清单表格</strong><small>导出 CSV</small></span></button>
                  <button className="personal-item" onClick={() => props.onExportPersonal('habits')}><Download size={13} /><span><strong>习惯记录</strong><small>导出 CSV</small></span></button>
                  <button className="personal-item" onClick={() => props.onExportPersonal('history')}><History size={13} /><span><strong>历史信息</strong><small>打卡与专注</small></span></button>
                  <button className="personal-item" onClick={() => props.onExportPersonal('all')}><FolderOpen size={13} /><span><strong>完整备份</strong><small>导出 JSON</small></span></button>
                  <button className="personal-item wide" onClick={props.onImportPersonal}><Upload size={13} /><span><strong>导入个人文件</strong><small>支持 CSV / JSON，合并到当前档案</small></span></button>
                </div>
              </div>
              <div className="settings-note">
                <Cloud size={15} />
                <p>FocusNotes 不上传任务内容。档案以 JSON 保存在本机，清单与习惯可导出为 CSV 表格。</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
