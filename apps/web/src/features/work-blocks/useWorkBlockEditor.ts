import type { DateSelectArg, EventClickArg, EventDropArg, EventMountArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WorkBlock } from '../../types'
import { addMinutes, toDateTimeLocal } from '../../utils/dateTime'
import { getErrorMessage } from '../../utils/presentation'
import type { WorkspaceData } from '../workspace/useWorkspaceData'
import { blockToForm, createEmptyBlockForm, formToPayload } from './form'
import type { BlockForm, ViewMode } from './types'

export const trackingEventId = '__tracking__'

export type ContextMenuState = { blockId: string; x: number; y: number } | null

export type WorkBlockEditor = {
  selectedBlockId: string | null
  selectedBlock: WorkBlock | null
  blockForm: BlockForm
  isEditorOpen: boolean
  isTrackingEdit: boolean
  contextMenu: ContextMenuState
  selectBlock: (block: WorkBlock) => void
  openEditor: (block: WorkBlock) => void
  openTrackingEditor: (startedAt: Date, form: Pick<BlockForm, 'title' | 'notes' | 'tagIds'>) => void
  closeEditor: () => void
  saveBlock: () => Promise<void>
  deleteBlock: (blockId: string) => Promise<void>
  removeSelectedBlock: () => Promise<void>
  updateBlockForm: <Key extends keyof BlockForm>(key: Key, value: BlockForm[Key]) => void
  toggleBlockTag: (tagId: string) => void
  removeTagReference: (tagId: string) => void
  handleCalendarSelect: (selection: DateSelectArg) => Promise<void>
  handleEventDrop: (eventDrop: EventDropArg) => Promise<void>
  handleEventResize: (eventResize: EventResizeDoneArg) => Promise<void>
  handleEventClick: (eventClick: EventClickArg, onTrackingClick: () => void) => void
  handleEventDidMount: (info: EventMountArg) => void
  handleContextEdit: (blockId: string) => void
  handleContextDelete: (blockId: string) => void
  handleContextStartTracking: (
    blockId: string,
    onStart: (title: string, tagIds: string[]) => void,
  ) => void
}

export function useWorkBlockEditor(
  workspace: WorkspaceData,
  setViewMode: (updater: (current: ViewMode) => ViewMode) => void,
): WorkBlockEditor {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [blockForm, setBlockForm] = useState<BlockForm>(() => createEmptyBlockForm())
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isTrackingEdit, setIsTrackingEdit] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  const selectedBlock = useMemo(
    () => workspace.workBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [selectedBlockId, workspace.workBlocks],
  )

  const selectBlock = useCallback(
    (block: WorkBlock) => {
      setSelectedBlockId(block.id)
      setBlockForm(blockToForm(block))
      setViewMode((current) => (current === 'tags' ? 'list' : current))
    },
    [setViewMode],
  )

  const openEditor = useCallback(
    (block: WorkBlock) => {
      setIsTrackingEdit(false)
      selectBlock(block)
      setIsEditorOpen(true)
    },
    [selectBlock],
  )

  const openTrackingEditor = useCallback(
    (startedAt: Date, form: Pick<BlockForm, 'title' | 'notes' | 'tagIds'>) => {
      setSelectedBlockId(null)
      setBlockForm({
        title: form.title,
        notes: form.notes,
        startedAt: toDateTimeLocal(startedAt),
        endedAt: toDateTimeLocal(new Date()),
        tagIds: form.tagIds,
      })
      setIsTrackingEdit(true)
      setIsEditorOpen(true)
    },
    [],
  )

  const closeEditor = useCallback(() => {
    setIsEditorOpen(false)
    setIsTrackingEdit(false)
  }, [])

  useEffect(() => {
    if (!contextMenu) {
      return
    }

    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setContextMenu(null)
      }
    }

    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  const saveBlock = useCallback(async () => {
    try {
      const payload = formToPayload(blockForm)
      const wasEditing = Boolean(selectedBlockId)
      const saved = selectedBlockId
        ? await workspace.updateWorkBlock(selectedBlockId, payload)
        : await workspace.createWorkBlock(payload)

      selectBlock(saved)
      setIsEditorOpen(false)
      workspace.setStatus(wasEditing ? '時間區塊已更新。' : '時間區塊已建立。')
      void workspace.runSync()
    } catch (error: unknown) {
      workspace.setStatus(getErrorMessage(error))
    }
  }, [blockForm, selectedBlockId, selectBlock, workspace])

  const deleteBlock = useCallback(
    async (blockId: string) => {
      try {
        await workspace.deleteWorkBlock(blockId)

        if (selectedBlockId === blockId) {
          setSelectedBlockId(null)
          setBlockForm(createEmptyBlockForm())
          setIsEditorOpen(false)
        }

        workspace.setStatus('時間區塊已刪除。')
        void workspace.runSync()
      } catch (error: unknown) {
        workspace.setStatus(getErrorMessage(error))
      }
    },
    [selectedBlockId, workspace],
  )

  const removeSelectedBlock = useCallback(async () => {
    if (selectedBlockId) {
      await deleteBlock(selectedBlockId)
    }
  }, [deleteBlock, selectedBlockId])

  const updateBlockForm = useCallback(<Key extends keyof BlockForm>(key: Key, value: BlockForm[Key]) => {
    setBlockForm((current) => ({ ...current, [key]: value }))
  }, [])

  const toggleBlockTag = useCallback((tagId: string) => {
    setBlockForm((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId],
    }))
  }, [])

  const removeTagReference = useCallback((tagId: string) => {
    setBlockForm((current) => ({
      ...current,
      tagIds: current.tagIds.filter((currentTagId) => currentTagId !== tagId),
    }))
  }, [])

  const handleCalendarSelect = useCallback(
    async (selection: DateSelectArg) => {
      selection.view.calendar.unselect()

      try {
        const payload = formToPayload({
          ...createEmptyBlockForm(selection.start, selection.end),
          title: '未命名時間區塊',
        })
        const created = await workspace.createWorkBlock(payload)

        openEditor(created)
        workspace.setStatus('時間區塊已建立。')
        void workspace.runSync()
      } catch (error: unknown) {
        workspace.setStatus(getErrorMessage(error))
      }
    },
    [openEditor, workspace],
  )

  const persistCalendarMove = useCallback(
    async (id: string, start: Date | null, end: Date | null, revert: () => void) => {
      if (!start) {
        revert()
        return
      }

      const endedAt = end ?? addMinutes(start, 30)

      try {
        const updated = await workspace.updateWorkBlock(id, {
          startedAt: start.toISOString(),
          endedAt: endedAt.toISOString(),
        })

        if (selectedBlockId === id) {
          selectBlock(updated)
        }

        workspace.setStatus('時間區塊時間已更新。')
        void workspace.runSync()
      } catch (error: unknown) {
        revert()
        workspace.setStatus(getErrorMessage(error))
      }
    },
    [selectedBlockId, selectBlock, workspace],
  )

  const handleEventDrop = useCallback(
    async (eventDrop: EventDropArg) =>
      persistCalendarMove(
        eventDrop.event.id,
        eventDrop.event.start,
        eventDrop.event.end,
        eventDrop.revert,
      ),
    [persistCalendarMove],
  )

  const handleEventResize = useCallback(
    async (eventResize: EventResizeDoneArg) =>
      persistCalendarMove(
        eventResize.event.id,
        eventResize.event.start,
        eventResize.event.end,
        eventResize.revert,
      ),
    [persistCalendarMove],
  )

  const handleEventClick = useCallback(
    (eventClick: EventClickArg, onTrackingClick: () => void) => {
      if (eventClick.event.id === trackingEventId) {
        onTrackingClick()
        return
      }

      const block = workspace.workBlocks.find((item) => item.id === eventClick.event.id)

      if (block) {
        openEditor(block)
      }
    },
    [openEditor, workspace.workBlocks],
  )

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    if (info.event.id === trackingEventId) {
      return
    }

    info.el.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      setContextMenu({ blockId: info.event.id, x: event.clientX, y: event.clientY })
    })
  }, [])

  const handleContextEdit = useCallback(
    (blockId: string) => {
      const block = workspace.workBlocks.find((item) => item.id === blockId)
      setContextMenu(null)

      if (block) {
        openEditor(block)
      }
    },
    [openEditor, workspace.workBlocks],
  )

  const handleContextDelete = useCallback(
    (blockId: string) => {
      setContextMenu(null)
      void deleteBlock(blockId)
    },
    [deleteBlock],
  )

  const handleContextStartTracking = useCallback(
    (blockId: string, onStart: (title: string, tagIds: string[]) => void) => {
      const block = workspace.workBlocks.find((item) => item.id === blockId)
      setContextMenu(null)

      if (block) {
        onStart(block.title, block.tags.map((tag) => tag.id))
      }
    },
    [workspace.workBlocks],
  )

  return {
    selectedBlockId,
    selectedBlock,
    blockForm,
    isEditorOpen,
    isTrackingEdit,
    contextMenu,
    selectBlock,
    openEditor,
    openTrackingEditor,
    closeEditor,
    saveBlock,
    deleteBlock,
    removeSelectedBlock,
    updateBlockForm,
    toggleBlockTag,
    removeTagReference,
    handleCalendarSelect,
    handleEventDrop,
    handleEventResize,
    handleEventClick,
    handleEventDidMount,
    handleContextEdit,
    handleContextDelete,
    handleContextStartTracking,
  }
}
