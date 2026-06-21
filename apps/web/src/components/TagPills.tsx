import type { Tag } from '../types'

export function TagPills({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) {
    return <span className="muted">無</span>
  }

  return (
    <div className="tag-pills">
      {tags.map((tag) => (
        <span key={tag.id} className="tag-pill" style={{ borderColor: tag.color }}>
          <span className="color-dot" style={{ backgroundColor: tag.color }} />
          {tag.name}
        </span>
      ))}
    </div>
  )
}
