import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'
import type { Tag } from '../../types'
import { getErrorMessage } from '../../utils/presentation'
import type { WorkspaceData } from '../workspace/useWorkspaceData'
import type { TagForm } from './types'

const defaultColor = '#8b5cf6'

export type TagEditor = {
  tagForm: TagForm
  editingTagId: string | null
  setTagForm: (form: TagForm) => void
  editTag: (tag: Tag) => void
  resetTagForm: () => void
  saveTag: (event: FormEvent<HTMLFormElement>) => Promise<void>
  removeTag: (id: string) => Promise<void>
}

export function useTagEditor(
  workspace: WorkspaceData,
  onTagDeleted: (id: string) => void,
): TagEditor {
  const [tagForm, setTagForm] = useState<TagForm>({ name: '', color: defaultColor })
  const [editingTagId, setEditingTagId] = useState<string | null>(null)

  const resetTagForm = useCallback(() => {
    setEditingTagId(null)
    setTagForm({ name: '', color: defaultColor })
  }, [])

  const editTag = useCallback((tag: Tag) => {
    setEditingTagId(tag.id)
    setTagForm({ name: tag.name, color: tag.color })
  }, [])

  const saveTag = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      try {
        const wasEditing = Boolean(editingTagId)

        if (editingTagId) {
          await workspace.updateTag(editingTagId, {
            name: tagForm.name.trim(),
            color: tagForm.color,
          })
        } else {
          await workspace.createTag({
            name: tagForm.name.trim(),
            color: tagForm.color,
          })
        }

        resetTagForm()
        workspace.setStatus(wasEditing ? '標籤已更新。' : '標籤已建立。')
        void workspace.runSync()
      } catch (error: unknown) {
        workspace.setStatus(getErrorMessage(error))
      }
    },
    [editingTagId, resetTagForm, tagForm, workspace],
  )

  const removeTag = useCallback(
    async (id: string) => {
      try {
        await workspace.deleteTag(id)

        if (editingTagId === id) {
          resetTagForm()
        }

        onTagDeleted(id)
        workspace.setStatus('標籤已刪除。')
        void workspace.runSync()
      } catch (error: unknown) {
        workspace.setStatus(getErrorMessage(error))
      }
    },
    [editingTagId, onTagDeleted, resetTagForm, workspace],
  )

  return { tagForm, editingTagId, setTagForm, editTag, resetTagForm, saveTag, removeTag }
}
