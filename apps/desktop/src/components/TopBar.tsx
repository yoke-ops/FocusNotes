import { Maximize2, Minimize2, Minus, NotebookPen, PanelLeftClose, PanelLeftOpen, Search, Settings2, X } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle: string
  sidebarVisible: boolean
  onToggleSidebar: () => void
  onSearch: () => void
  onSettings: () => void
  onMinimize: () => void
  onClose: () => void
  onMini: () => void
}

export function TopBar({ title, subtitle, sidebarVisible, onToggleSidebar, onSearch, onSettings, onMinimize, onClose, onMini }: TopBarProps) {
  const SidebarIcon = sidebarVisible ? PanelLeftClose : PanelLeftOpen
  const sidebarLabel = sidebarVisible ? '收起清单栏' : '展开清单栏'
  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button className="icon-button sidebar-toggle" onClick={onToggleSidebar} title={sidebarLabel}
          aria-label={sidebarLabel} aria-expanded={sidebarVisible} aria-controls="workspace-sidebar">
          <SidebarIcon size={18} />
        </button>
        <div className="topbar-title">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="icon-button" onClick={onSearch} title="搜索（Ctrl+K）" aria-label="搜索">
          <Search size={17} />
        </button>
        <button className="icon-button" onClick={onSettings} title="设置" aria-label="设置">
          <Settings2 size={17} />
        </button>
        <button className="icon-button" onClick={onMini} title="切换到迷你窗口" aria-label="切换到迷你窗口">
          <Minimize2 size={17} />
        </button>
        <span className="topbar-divider" />
        <button className="icon-button" onClick={onMinimize} title="最小化到托盘" aria-label="最小化到托盘">
          <Minus size={17} />
        </button>
        <button className="icon-button danger-hover" onClick={onClose} title="关闭" aria-label="关闭">
          <X size={17} />
        </button>
      </div>
    </header>
  )
}

export function MiniTopBar({ onExpand, onMinimize, onClose }: { onExpand: () => void; onMinimize: () => void; onClose: () => void }) {
  return (
    <header className="mini-topbar">
      <span className="mini-brand">
        <span className="brand-mark small"><NotebookPen size={12} /></span>
        FocusNotes
      </span>
      <div className="mini-actions">
        <button className="icon-button" onClick={onExpand} title="展开完整窗口" aria-label="展开完整窗口">
          <Maximize2 size={15} />
        </button>
        <button className="icon-button" onClick={onMinimize} title="最小化" aria-label="最小化">
          <Minus size={15} />
        </button>
        <button className="icon-button danger-hover" onClick={onClose} title="关闭" aria-label="关闭">
          <X size={15} />
        </button>
      </div>
    </header>
  )
}
