import type { ContextMenuState } from './useWorkBlockEditor'

type WorkBlockContextMenuProps = {
  contextMenu: Exclude<ContextMenuState, null>
  onEdit: (blockId: string) => void
  onDelete: (blockId: string) => void
}

export function WorkBlockContextMenu({
  contextMenu,
  onEdit,
  onDelete,
}: WorkBlockContextMenuProps) {
  return (
    <ul
      className="context-menu"
      role="menu"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <li>
        <button type="button" role="menuitem" onClick={() => onEdit(contextMenu.blockId)}>
          編輯詳細資料
        </button>
      </li>
      <li>
        <button
          type="button"
          role="menuitem"
          className="danger"
          onClick={() => onDelete(contextMenu.blockId)}
        >
          刪除時間區塊
        </button>
      </li>
    </ul>
  )
}
