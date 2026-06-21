import type { ViewMode } from '../features/work-blocks/types'

type AppHeaderProps = {
  viewMode: ViewMode
  onViewModeChange: (viewMode: ViewMode) => void
}

export function AppHeader({ viewMode, onViewModeChange }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Ergasia</p>
        <h1>工作時間區塊</h1>
      </div>
      <nav className="view-tabs" aria-label="檢視">
        <button
          type="button"
          className={viewMode === 'calendar' ? 'active' : ''}
          onClick={() => onViewModeChange('calendar')}
        >
          日曆
        </button>
        <button
          type="button"
          className={viewMode === 'list' ? 'active' : ''}
          onClick={() => onViewModeChange('list')}
        >
          清單
        </button>
        <button
          type="button"
          className={viewMode === 'tags' ? 'active' : ''}
          onClick={() => onViewModeChange('tags')}
        >
          標籤
        </button>
      </nav>
    </header>
  )
}
