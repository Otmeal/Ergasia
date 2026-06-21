import { TagPills } from '../../components/TagPills'
import type { WorkBlock } from '../../types'
import { formatDuration, formatRange } from '../../utils/dateTime'

type ListPageProps = {
  onSelect: (block: WorkBlock) => void
  selectedBlockId: string | null
  workBlocks: WorkBlock[]
}

export function ListPage({ onSelect, selectedBlockId, workBlocks }: ListPageProps) {
  if (workBlocks.length === 0) {
    return <p className="empty-state">尚無時間區塊。</p>
  }

  return (
    <div className="list-wrap">
      <table>
        <thead>
          <tr>
            <th>標題</th>
            <th>時間</th>
            <th>長度</th>
            <th>標籤</th>
          </tr>
        </thead>
        <tbody>
          {workBlocks.map((block) => (
            <tr key={block.id} className={selectedBlockId === block.id ? 'selected' : ''}>
              <td>
                <button type="button" className="link-button" onClick={() => onSelect(block)}>
                  {block.title}
                </button>
              </td>
              <td>{formatRange(block.startedAt, block.endedAt)}</td>
              <td>{formatDuration(block.startedAt, block.endedAt)}</td>
              <td>
                <TagPills tags={block.tags} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
