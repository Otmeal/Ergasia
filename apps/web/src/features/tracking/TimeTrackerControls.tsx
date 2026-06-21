import { useMemo } from 'react'
import type { Tag } from '../../types'
import { formatElapsed } from '../../utils/dateTime'
import type { TimeTracking } from './useTimeTracking'

type TimeTrackerControlsProps = {
  tags: Tag[]
  isSaving: boolean
  tracking: TimeTracking
  onToggle: () => void
}

export function TimeTrackerControls({
  tags,
  isSaving,
  tracking,
  onToggle,
}: TimeTrackerControlsProps) {
  const trackingTags = useMemo(
    () => tags.filter((tag) => tracking.trackingDraft.tagIds.includes(tag.id)),
    [tags, tracking.trackingDraft.tagIds],
  )

  return (
    <div className="track-controls">
      <input
        className="track-title-field"
        type="text"
        placeholder={tracking.trackingStartedAt ? '追蹤中的標題' : '準備追蹤的標題'}
        aria-label="追蹤標題"
        value={tracking.trackingDraft.title}
        onChange={(event) => tracking.updateTrackingTitle(event.target.value)}
      />
      <div className="track-tag-select">
        <button
          type="button"
          className={tracking.trackingTagPickerOpen ? 'icon-button active' : 'icon-button'}
          aria-label="選擇追蹤標籤"
          aria-expanded={tracking.trackingTagPickerOpen}
          onClick={() => tracking.setTrackingTagPickerOpen((open) => !open)}
        >
          🏷
          {trackingTags.length > 0 ? (
            <span className="track-tag-count">{trackingTags.length}</span>
          ) : null}
        </button>
        {tracking.trackingTagPickerOpen ? (
          <fieldset className="tag-picker track-tag-picker">
            <legend>追蹤標籤</legend>
            {tags.length === 0 ? (
              <p className="muted">尚無標籤。</p>
            ) : (
              tags.map((tag) => (
                <label key={tag.id}>
                  <input
                    checked={tracking.trackingDraft.tagIds.includes(tag.id)}
                    type="checkbox"
                    onChange={() => tracking.toggleTrackingTag(tag.id)}
                  />
                  <span className="color-dot" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                </label>
              ))
            )}
          </fieldset>
        ) : null}
      </div>
      <input
        className="elapsed-field"
        type="text"
        inputMode="numeric"
        aria-label="已追蹤時間"
        value={
          tracking.elapsedEditing
            ? tracking.elapsedDraft
            : tracking.trackingStartedAt
              ? formatElapsed(tracking.nowTick - tracking.trackingStartedAt.getTime())
              : '00:00:00'
        }
        disabled={!tracking.trackingStartedAt}
        onFocus={tracking.beginEditElapsed}
        onChange={(event) => tracking.setElapsedDraft(event.target.value)}
        onBlur={tracking.commitElapsed}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            tracking.cancelEditElapsed()
          }
        }}
      />
      <button
        type="button"
        className={tracking.trackingStartedAt ? 'danger-action' : 'primary-action'}
        disabled={isSaving}
        onClick={onToggle}
      >
        {tracking.trackingStartedAt ? '停止追蹤' : '開始追蹤時間'}
      </button>
    </div>
  )
}
