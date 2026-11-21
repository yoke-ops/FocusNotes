import {
  CalendarDays,
  CheckSquare,
  NotebookPen,
  Flame,
  LayoutGrid,
  Search,
  Settings,
  Sparkles,
  Sun,
  Moon,
  Timer,
  Gauge,
} from 'lucide-react'
import type { NavId } from '@focusnotes/core'
import type { ViewId } from '../navigation'
import type { CSSProperties } from 'react'

interface IconRailProps {
  view: ViewId
  theme: 'light' | 'dark'
  profileName: string
  onNavigate: (view: ViewId) => void
  onSearch: () => void
  onSettings: () => void
  onProfile: () => void
  onToggleTheme: () => void
  navOrder: NavId[]
  navHidden: NavId[]
}

const NAV_DEFS: Record<NavId, { id: NavId; label: string; icon: typeof CalendarDays }> = {
  today: { id: 'today', label: '今天', icon: CheckSquare },
  memos: { id: 'memos', label: '备忘录', icon: NotebookPen },
  pomodoro: { id: 'pomodoro', label: '番茄专注', icon: Timer },
  habits: { id: 'habits', label: '习惯', icon: Flame },
  calendar: { id: 'calendar', label: '日历', icon: CalendarDays },
  quadrant: { id: 'quadrant', label: '四象限', icon: LayoutGrid },
  widgets: { id: 'widgets', label: '概览', icon: Gauge },
  search: { id: 'search', label: '搜索', icon: Search },
  assistant: { id: 'assistant', label: 'AI 助手', icon: Sparkles },
}

export function IconRail({ view, theme, profileName, onNavigate, onSearch, onSettings, onProfile, onToggleTheme, navOrder, navHidden }: IconRailProps) {
  const isActive = (id: ViewId) => view === id || (id === 'today' && (view === 'recent' || view === 'inbox' || view.startsWith('list:') || view.startsWith('tag:')))
  // 渲染层兜底：navOrder 缺失的导航项也要显示，避免旧数据导致新功能不可见。
  const orderedNav = [
    ...navOrder.filter((id) => NAV_DEFS[id]),
    ...(Object.keys(NAV_DEFS) as NavId[]).filter((id) => !navOrder.includes(id)),
  ]
  const items = orderedNav.filter((id) => !navHidden.includes(id)).map((id) => NAV_DEFS[id]).filter(Boolean)
  const selectedIndex = items.findIndex((item) => isActive(item.id as ViewId))
  const handle = (id: NavId) => id === 'search' ? onSearch() : onNavigate(id as ViewId)
  return (
    <nav className="icon-rail" aria-label="主导航">
      <button className="rail-avatar" onClick={onProfile} title={`记录档案：${profileName}（在左上角侧栏展开）`} aria-label="切换记录档案">
        <span>{(profileName || 'F').slice(0, 1).toUpperCase()}</span>
      </button>
      <div className="rail-group rail-navigation">
        {selectedIndex >= 0 && <span className="rail-selection" aria-hidden="true"
          style={{ '--selected-index': selectedIndex } as CSSProperties} />}
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`rail-button${isActive(item.id as ViewId) ? ' active' : ''}`}
              onClick={() => handle(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive(item.id as ViewId) ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={1.8} />
            </button>
          )
        })}
      </div>
      <div className="rail-spacer" />
      <div className="rail-group rail-bottom">
        <button className="rail-button" onClick={onToggleTheme} title="切换明暗" aria-label="切换明暗">
          {theme === 'dark' ? <Sun size={19} strokeWidth={1.8} /> : <Moon size={19} strokeWidth={1.8} />}
        </button>
        <button className="rail-button" onClick={onSettings} title="设置" aria-label="设置">
          <Settings size={19} strokeWidth={1.8} />
        </button>
      </div>
    </nav>
  )
}
