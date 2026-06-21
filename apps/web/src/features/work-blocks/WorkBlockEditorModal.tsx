import { useState } from 'react'
import type { FormEvent } from 'react'
import { MarkdownPreview } from '../../markdown'
import type { Tag, WorkBlock } from '../../types'
import { formatElapsed, parseElapsed, toDateTimeLocal } from '../../utils/dateTime'
import type { BlockForm } from './types'

type WorkBlockEditorModalProps = {
  blockForm: BlockForm
  isSaving: boolean
  isTracking: boolean
  selectedBlock: WorkBlock | null
  tags: Tag[]
  onClose: () => void
  onDelete: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTagToggle: (tagId: string) => void
  onUpdate: <Key extends keyof BlockForm>(key: Key, value: BlockForm[Key]) => void
}

export function WorkBlockEditorModal({
  blockForm,
  isSaving,
  isTracking,
  selectedBlock,
  tags,
  onClose,
  onDelete,
  onSubmit,
  onTagToggle,
  onUpdate,
}: WorkBlockEditorModalProps) {
  const heading = isTracking ? '編輯追蹤中區塊' : selectedBlock ? '編輯' : '新增'
  const selectedTags = tags.filter((tag) => blockForm.tagIds.includes(tag.id))
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [notesPreview, setNotesPreview] = useState(false)
  const [durationDraft, setDurationDraft] = useState<string | null>(null)
  const durationMs = Math.max(
    0,
    new Date(blockForm.endedAt).getTime() - new Date(blockForm.startedAt).getTime(),
  )

  function commitDuration() {
    if (durationDraft === null) {
      return
    }

    const ms = parseElapsed(durationDraft)
    setDurationDraft(null)

    if (ms === null) {
      return
    }

    if (isTracking) {
      const end = new Date(blockForm.endedAt).getTime()
      onUpdate('startedAt', toDateTimeLocal(new Date(end - ms)))
    } else {
      const start = new Date(blockForm.startedAt).getTime()
      onUpdate('endedAt', toDateTimeLocal(new Date(start + ms)))
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card surface"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="surface-header editor-header">
          <h2>{heading}</h2>
          <button type="button" className="icon-button" aria-label="關閉" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="editor-form block-editor-form" onSubmit={onSubmit}>
          <input
            required
            className="title-input"
            type="text"
            placeholder="標題"
            aria-label="標題"
            value={blockForm.title}
            onChange={(event) => onUpdate('title', event.target.value)}
          />

          <div className="tag-row-inline">
            {selectedTags.length === 0 ? (
              <span className="muted">未加標籤</span>
            ) : (
              selectedTags.map((tag) => (
                <span key={tag.id} className="tag-pill" style={{ borderColor: tag.color }}>
                  <span className="color-dot" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </span>
              ))
            )}
            <button
              type="button"
              className={tagPickerOpen ? 'icon-button active' : 'icon-button'}
              aria-label="選擇標籤"
              aria-expanded={tagPickerOpen}
              onClick={() => setTagPickerOpen((open) => !open)}
            >
              🏷
            </button>
          </div>

          {tagPickerOpen ? (
            <fieldset className="tag-picker">
              <legend>標籤</legend>
              {tags.length === 0 ? (
                <p className="muted">尚無標籤。</p>
              ) : (
                tags.map((tag) => (
                  <label key={tag.id}>
                    <input
                      checked={blockForm.tagIds.includes(tag.id)}
                      type="checkbox"
                      onChange={() => onTagToggle(tag.id)}
                    />
                    <span className="color-dot" style={{ backgroundColor: tag.color }} />
                    <span>{tag.name}</span>
                  </label>
                ))
              )}
            </fieldset>
          ) : null}

          <div className="time-row">
            <input
              required
              type="time"
              aria-label="開始"
              value={blockForm.startedAt.slice(11, 16)}
              onChange={(event) =>
                onUpdate('startedAt', `${blockForm.startedAt.slice(0, 10)}T${event.target.value}`)
              }
            />
            <span className="time-arrow" aria-hidden="true">
              →
            </span>
            {isTracking ? (
              <span className="time-tracking">追蹤中…</span>
            ) : (
              <input
                required
                type="time"
                aria-label="結束"
                value={blockForm.endedAt.slice(11, 16)}
                onChange={(event) =>
                  onUpdate('endedAt', `${blockForm.endedAt.slice(0, 10)}T${event.target.value}`)
                }
              />
            )}
            <input
              className="time-duration-field"
              type="text"
              inputMode="numeric"
              aria-label="總時間"
              value={durationDraft ?? formatElapsed(durationMs)}
              onFocus={() => setDurationDraft(formatElapsed(durationMs))}
              onChange={(event) => setDurationDraft(event.target.value)}
              onBlur={commitDuration}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur()
                } else if (event.key === 'Escape') {
                  setDurationDraft(null)
                }
              }}
            />
          </div>

          <div className="notes-section">
            <div className="notes-header">
              <span>Notes</span>
              <button
                type="button"
                className="notes-toggle"
                onClick={() => setNotesPreview((preview) => !preview)}
              >
                {notesPreview ? '編輯' : '預覽'}
              </button>
            </div>
            {notesPreview ? (
              <div className="markdown-panel">
                <MarkdownPreview source={blockForm.notes} />
              </div>
            ) : (
              <textarea
                rows={8}
                placeholder="支援 Markdown"
                value={blockForm.notes}
                onChange={(event) => onUpdate('notes', event.target.value)}
              />
            )}
          </div>

          <div className="form-actions editor-footer">
            {selectedBlock ? (
              <button type="button" className="delete-link" disabled={isSaving} onClick={onDelete}>
                刪除
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="primary-action" disabled={isSaving}>
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
