import type { FormEvent } from 'react'
import type { Tag } from '../../types'
import type { TagForm } from './types'

type TagsPageProps = {
  editingTagId: string | null
  isSaving: boolean
  tags: Tag[]
  tagForm: TagForm
  setTagForm: (next: TagForm) => void
  onEdit: (tag: Tag) => void
  onRemove: (id: string) => void
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function TagsPage({
  editingTagId,
  isSaving,
  tags,
  tagForm,
  setTagForm,
  onEdit,
  onRemove,
  onReset,
  onSubmit,
}: TagsPageProps) {
  return (
    <section className="workspace tags-workspace">
      <div className="surface main-surface">
        <div className="surface-header">
          <div>
            <h2>標籤種類</h2>
            <p>{tags.length} 個標籤</p>
          </div>
        </div>

        <div className="tag-list">
          {tags.length === 0 ? (
            <p className="empty-state">尚無標籤。</p>
          ) : (
            tags.map((tag) => (
              <div key={tag.id} className="tag-row">
                <button type="button" className="tag-main" onClick={() => onEdit(tag)}>
                  <span className="color-dot large" style={{ backgroundColor: tag.color }} />
                  <span>{tag.name}</span>
                  <small>{tag._count?.workBlocks ?? 0} 時間區塊</small>
                </button>
                <button
                  type="button"
                  className="danger-action compact"
                  disabled={isSaving}
                  onClick={() => onRemove(tag.id)}
                >
                  刪除
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <aside className="surface editor-surface">
        <div className="surface-header">
          <div>
            <h2>{editingTagId ? '編輯標籤' : '新增標籤'}</h2>
            <p>{tagForm.color}</p>
          </div>
        </div>

        <form className="editor-form" onSubmit={onSubmit}>
          <label>
            <span>名稱</span>
            <input
              required
              type="text"
              value={tagForm.name}
              onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })}
            />
          </label>
          <label>
            <span>顏色</span>
            <input
              type="color"
              value={tagForm.color}
              onChange={(event) => setTagForm({ ...tagForm, color: event.target.value })}
            />
          </label>
          <div className="tag-preview" style={{ borderColor: tagForm.color }}>
            <span className="color-dot large" style={{ backgroundColor: tagForm.color }} />
            <strong>{tagForm.name || '標籤名稱'}</strong>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-action" disabled={isSaving}>
              儲存
            </button>
            {editingTagId ? (
              <button type="button" className="ghost-action" disabled={isSaving} onClick={onReset}>
                取消
              </button>
            ) : null}
          </div>
        </form>
      </aside>
    </section>
  )
}
