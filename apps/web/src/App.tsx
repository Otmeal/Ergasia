import FullCalendar from '@fullcalendar/react'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
  EventMountArg,
} from '@fullcalendar/core'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createTag,
  createWorkBlock,
  deleteTag,
  deleteWorkBlock,
  getTags,
  getWorkBlocks,
  updateTag,
  updateWorkBlock,
} from './api'
import { MarkdownPreview } from './markdown'
import type { Tag, WorkBlock, WorkBlockPayload } from './types'
import './App.css'

type ViewMode = 'calendar' | 'list' | 'tags'

type BlockForm = {
  title: string
  notes: string
  startedAt: string
  endedAt: string
  tagIds: string[]
}

type TagForm = {
  name: string
  color: string
}

type TrackingDraft = {
  title: string
  notes: string
  tagIds: string[]
}

const defaultColor = '#2f9e8f'
const untaggedColor = '#9aa3a8'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [workBlocks, setWorkBlocks] = useState<WorkBlock[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [blockForm, setBlockForm] = useState<BlockForm>(() => createEmptyBlockForm())
  const [tagForm, setTagForm] = useState<TagForm>({ name: '', color: defaultColor })
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [status, setStatus] = useState('正在載入。')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ blockId: string; x: number; y: number } | null>(
    null,
  )
  const [trackingStartedAt, setTrackingStartedAt] = useState<Date | null>(() =>
    readTrackingStart(),
  )
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [elapsedEditing, setElapsedEditing] = useState(false)
  const [elapsedDraft, setElapsedDraft] = useState('')
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>(() => readTrackingDraft())
  const [isTrackingEdit, setIsTrackingEdit] = useState(false)
  const [trackingTagPickerOpen, setTrackingTagPickerOpen] = useState(false)

  const trackingTags = useMemo(
    () => tags.filter((tag) => trackingDraft.tagIds.includes(tag.id)),
    [tags, trackingDraft.tagIds],
  )

  const selectedBlock = useMemo(
    () => workBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [selectedBlockId, workBlocks],
  )

  const calendarEvents = useMemo<EventInput[]>(() => {
    const events: EventInput[] = workBlocks.map((block) => {
      const color = block.tags[0]?.color ?? untaggedColor

      return {
        id: block.id,
        title: block.title,
        start: block.startedAt,
        end: block.endedAt,
        backgroundColor: color,
        borderColor: color,
        textColor: getReadableTextColor(color),
        extendedProps: {
          tagNames: block.tags.map((tag) => tag.name).join(' · '),
        },
      }
    })

    if (trackingStartedAt) {
      const trackingColor = tags.find((tag) => trackingDraft.tagIds.includes(tag.id))?.color
      events.push({
        id: trackingEventId,
        title: trackingDraft.title.trim() || '追蹤中…',
        start: trackingStartedAt.toISOString(),
        end: new Date(Math.max(nowTick, trackingStartedAt.getTime() + 1000)).toISOString(),
        borderColor: trackingColor ?? defaultColor,
        classNames: ['tracking-event'],
        editable: false,
      })
    }

    return events
  }, [workBlocks, trackingStartedAt, nowTick, trackingDraft, tags])

  const refreshData = useCallback(async () => {
    const [nextBlocks, nextTags] = await Promise.all([getWorkBlocks(), getTags()])
    setWorkBlocks(nextBlocks)
    setTags(nextTags)
    return { nextBlocks, nextTags }
  }, [])

  useEffect(() => {
    void refreshData()
      .then(() => setStatus('已同步。'))
      .catch((error: unknown) => setStatus(getErrorMessage(error)))
  }, [refreshData])

  useEffect(() => {
    if (!trackingStartedAt) {
      return
    }

    setNowTick(Date.now())
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)

    return () => window.clearInterval(id)
  }, [trackingStartedAt])

  function selectBlock(block: WorkBlock) {
    setSelectedBlockId(block.id)
    setBlockForm(blockToForm(block))
    setViewMode((current) => (current === 'tags' ? 'list' : current))
  }

  function openEditor(block: WorkBlock) {
    setIsTrackingEdit(false)
    selectBlock(block)
    setIsEditorOpen(true)
  }

  function openTrackingEditor() {
    if (!trackingStartedAt) {
      return
    }

    setSelectedBlockId(null)
    setBlockForm({
      title: trackingDraft.title,
      notes: trackingDraft.notes,
      startedAt: toDateTimeLocal(trackingStartedAt),
      endedAt: toDateTimeLocal(new Date()),
      tagIds: trackingDraft.tagIds,
    })
    setIsTrackingEdit(true)
    setIsEditorOpen(true)
  }

  function closeEditor() {
    setIsEditorOpen(false)
    setIsTrackingEdit(false)
  }

  const handleEventDidMount = useCallback((info: EventMountArg) => {
    if (info.event.id === trackingEventId) {
      return
    }

    info.el.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      setContextMenu({ blockId: info.event.id, x: event.clientX, y: event.clientY })
    })
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

  function handleContextEdit(blockId: string) {
    const block = workBlocks.find((item) => item.id === blockId)
    setContextMenu(null)

    if (block) {
      openEditor(block)
    }
  }

  function handleContextDelete(blockId: string) {
    setContextMenu(null)
    void deleteBlock(blockId)
  }

  async function saveBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isTrackingEdit) {
      commitTrackingEdit()
      return
    }

    setIsSaving(true)

    try {
      const payload = formToPayload(blockForm)
      const saved = selectedBlockId
        ? await updateWorkBlock(selectedBlockId, payload)
        : await createWorkBlock(payload)

      await refreshData()
      selectBlock(saved)
      setIsEditorOpen(false)
      setStatus(selectedBlockId ? '時間區塊已更新。' : '時間區塊已建立。')
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteBlock(blockId: string) {
    setIsSaving(true)

    try {
      await deleteWorkBlock(blockId)
      await refreshData()

      if (selectedBlockId === blockId) {
        setSelectedBlockId(null)
        setBlockForm(createEmptyBlockForm())
        setIsEditorOpen(false)
      }

      setStatus('時間區塊已刪除。')
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function removeSelectedBlock() {
    if (!selectedBlockId) {
      return
    }

    await deleteBlock(selectedBlockId)
  }

  function persistTrackingDraft(draft: TrackingDraft) {
    localStorage.setItem(trackingDraftKey, JSON.stringify(draft))
    setTrackingDraft(draft)
  }

  function updateTrackingTitle(title: string) {
    persistTrackingDraft({ ...trackingDraft, title })
  }

  function toggleTrackingTag(tagId: string) {
    persistTrackingDraft({
      ...trackingDraft,
      tagIds: trackingDraft.tagIds.includes(tagId)
        ? trackingDraft.tagIds.filter((id) => id !== tagId)
        : [...trackingDraft.tagIds, tagId],
    })
  }

  async function toggleTimeTrack() {
    if (!trackingStartedAt) {
      const start = new Date()
      localStorage.setItem(trackingStorageKey, start.toISOString())
      localStorage.setItem(trackingDraftKey, JSON.stringify(trackingDraft))
      setTrackingStartedAt(start)
      setStatus('已開始追蹤時間。')
      return
    }

    setIsSaving(true)

    try {
      const endedAt = new Date()
      const safeEnd = endedAt > trackingStartedAt ? endedAt : addMinutes(trackingStartedAt, 1)
      const created = await createWorkBlock({
        title: trackingDraft.title.trim() || '未命名時間區塊',
        notes: trackingDraft.notes,
        startedAt: trackingStartedAt.toISOString(),
        endedAt: safeEnd.toISOString(),
        tagIds: trackingDraft.tagIds,
      })

      localStorage.removeItem(trackingStorageKey)
      localStorage.removeItem(trackingDraftKey)
      setTrackingStartedAt(null)
      setTrackingDraft({ ...defaultTrackingDraft })
      await refreshData()
      openEditor(created)
      setStatus('已停止追蹤，時間區塊已建立。')
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  function commitTrackingEdit() {
    const title = blockForm.title.trim()
    const start = new Date(blockForm.startedAt)

    if (!title) {
      setStatus('標題不可為空。')
      return
    }

    if (Number.isNaN(start.getTime())) {
      setStatus('時間格式不正確。')
      return
    }

    const draft: TrackingDraft = {
      title,
      notes: blockForm.notes,
      tagIds: blockForm.tagIds,
    }

    localStorage.setItem(trackingStorageKey, start.toISOString())
    localStorage.setItem(trackingDraftKey, JSON.stringify(draft))
    setTrackingStartedAt(start)
    setTrackingDraft(draft)
    setNowTick(Date.now())
    setIsTrackingEdit(false)
    setIsEditorOpen(false)
    setStatus('追蹤資料已更新。')
  }

  function beginEditElapsed() {
    if (!trackingStartedAt) {
      return
    }

    setElapsedDraft(formatElapsed(Date.now() - trackingStartedAt.getTime()))
    setElapsedEditing(true)
  }

  function commitElapsed() {
    setElapsedEditing(false)

    const ms = parseElapsed(elapsedDraft)

    if (ms === null || !trackingStartedAt) {
      return
    }

    const start = new Date(Date.now() - ms)
    localStorage.setItem(trackingStorageKey, start.toISOString())
    setTrackingStartedAt(start)
    setNowTick(Date.now())
  }

  async function handleCalendarSelect(selection: DateSelectArg) {
    selection.view.calendar.unselect()

    try {
      const payload = formToPayload({
        ...createEmptyBlockForm(selection.start, selection.end),
        title: '未命名時間區塊',
      })
      const created = await createWorkBlock(payload)

      await refreshData()
      openEditor(created)
      setStatus('時間區塊已建立。')
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
    }
  }

  async function handleEventDrop(eventDrop: EventDropArg) {
    await persistCalendarMove(
      eventDrop.event.id,
      eventDrop.event.start,
      eventDrop.event.end,
      eventDrop.revert,
    )
  }

  async function handleEventResize(eventResize: EventResizeDoneArg) {
    await persistCalendarMove(
      eventResize.event.id,
      eventResize.event.start,
      eventResize.event.end,
      eventResize.revert,
    )
  }

  function handleEventClick(eventClick: EventClickArg) {
    if (eventClick.event.id === trackingEventId) {
      openTrackingEditor()
      return
    }

    const block = workBlocks.find((item) => item.id === eventClick.event.id)

    if (block) {
      openEditor(block)
    }
  }

  async function persistCalendarMove(
    id: string,
    start: Date | null,
    end: Date | null,
    revert: () => void,
  ) {
    if (!start) {
      revert()
      return
    }

    const endedAt = end ?? addMinutes(start, 30)

    try {
      const updated = await updateWorkBlock(id, {
        startedAt: start.toISOString(),
        endedAt: endedAt.toISOString(),
      })
      await refreshData()

      if (selectedBlockId === id) {
        selectBlock(updated)
      }

      setStatus('時間區塊時間已更新。')
    } catch (error: unknown) {
      revert()
      setStatus(getErrorMessage(error))
    }
  }

  function updateBlockForm<Key extends keyof BlockForm>(key: Key, value: BlockForm[Key]) {
    setBlockForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function toggleBlockTag(tagId: string) {
    setBlockForm((current) => ({
      ...current,
      tagIds: current.tagIds.includes(tagId)
        ? current.tagIds.filter((id) => id !== tagId)
        : [...current.tagIds, tagId],
    }))
  }

  function editTag(tag: Tag) {
    setEditingTagId(tag.id)
    setTagForm({ name: tag.name, color: tag.color })
  }

  function resetTagForm() {
    setEditingTagId(null)
    setTagForm({ name: '', color: defaultColor })
  }

  async function saveTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)

    try {
      if (editingTagId) {
        await updateTag(editingTagId, {
          name: tagForm.name.trim(),
          color: tagForm.color,
        })
      } else {
        await createTag({
          name: tagForm.name.trim(),
          color: tagForm.color,
        })
      }

      await refreshData()
      resetTagForm()
      setStatus(editingTagId ? '標籤已更新。' : '標籤已建立。')
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function removeTag(id: string) {
    setIsSaving(true)

    try {
      await deleteTag(id)
      await refreshData()

      if (editingTagId === id) {
        resetTagForm()
      }

      setBlockForm((current) => ({
        ...current,
        tagIds: current.tagIds.filter((tagId) => tagId !== id),
      }))
      setStatus('標籤已刪除。')
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Ergasia</p>
          <h1>工作時間區塊</h1>
        </div>
        <nav className="view-tabs" aria-label="檢視">
          <button
            type="button"
            className={viewMode === 'calendar' ? 'active' : ''}
            onClick={() => setViewMode('calendar')}
          >
            日曆
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            清單
          </button>
          <button
            type="button"
            className={viewMode === 'tags' ? 'active' : ''}
            onClick={() => setViewMode('tags')}
          >
            標籤
          </button>
        </nav>
      </header>

      <section className="status-line" aria-live="polite">
        {status}
      </section>

      {viewMode === 'tags' ? (
        <TagManager
          editingTagId={editingTagId}
          isSaving={isSaving}
          onEdit={editTag}
          onRemove={removeTag}
          onReset={resetTagForm}
          onSubmit={saveTag}
          setTagForm={setTagForm}
          tagForm={tagForm}
          tags={tags}
        />
      ) : (
        <section className="workspace single">
          <div className="surface main-surface">
            <div className="surface-header">
              <div>
                <h2>{viewMode === 'calendar' ? '日曆' : '清單'}</h2>
                <p>{formatTotalDuration(workBlocks)}</p>
              </div>
              <div className="track-controls">
                <input
                  className="track-title-field"
                  type="text"
                  placeholder={trackingStartedAt ? '追蹤中的標題' : '準備追蹤的標題'}
                  aria-label="追蹤標題"
                  value={trackingDraft.title}
                  onChange={(event) => updateTrackingTitle(event.target.value)}
                />
                <div className="track-tag-select">
                  <button
                    type="button"
                    className={trackingTagPickerOpen ? 'icon-button active' : 'icon-button'}
                    aria-label="選擇追蹤標籤"
                    aria-expanded={trackingTagPickerOpen}
                    onClick={() => setTrackingTagPickerOpen((open) => !open)}
                  >
                    🏷
                    {trackingTags.length > 0 ? (
                      <span className="track-tag-count">{trackingTags.length}</span>
                    ) : null}
                  </button>
                  {trackingTagPickerOpen ? (
                    <fieldset className="tag-picker track-tag-picker">
                      <legend>追蹤標籤</legend>
                      {tags.length === 0 ? (
                        <p className="muted">尚無標籤。</p>
                      ) : (
                        tags.map((tag) => (
                          <label key={tag.id}>
                            <input
                              checked={trackingDraft.tagIds.includes(tag.id)}
                              type="checkbox"
                              onChange={() => toggleTrackingTag(tag.id)}
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
                    elapsedEditing
                      ? elapsedDraft
                      : trackingStartedAt
                        ? formatElapsed(nowTick - trackingStartedAt.getTime())
                        : '00:00:00'
                  }
                  disabled={!trackingStartedAt}
                  onFocus={beginEditElapsed}
                  onChange={(event) => setElapsedDraft(event.target.value)}
                  onBlur={commitElapsed}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur()
                    } else if (event.key === 'Escape') {
                      setElapsedEditing(false)
                    }
                  }}
                />
                <button
                  type="button"
                  className={trackingStartedAt ? 'danger-action' : 'primary-action'}
                  disabled={isSaving}
                  onClick={() => void toggleTimeTrack()}
                >
                  {trackingStartedAt ? '停止追蹤' : '開始追蹤時間'}
                </button>
              </div>
            </div>

            {viewMode === 'calendar' ? (
              <div className="calendar-wrap">
                <FullCalendar
                  allDaySlot={false}
                  buttonText={{
                    today: '今天',
                    week: '週',
                    day: '日',
                  }}
                  editable
                  eventClick={handleEventClick}
                  eventDidMount={handleEventDidMount}
                  eventDrop={handleEventDrop}
                  eventResize={handleEventResize}
                  events={calendarEvents}
                  headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'timeGridWeek,timeGridDay',
                  }}
                  height="100%"
                  initialView="timeGridWeek"
                  locale={zhTwLocale}
                  nowIndicator
                  plugins={[timeGridPlugin, interactionPlugin]}
                  select={handleCalendarSelect}
                  selectable
                  selectMirror
                  slotDuration="00:05:00"
                  snapDuration="00:01:00"
                  slotLabelFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  slotMaxTime="22:00:00"
                  slotMinTime="06:00:00"
                />
              </div>
            ) : (
              <WorkBlockList
                onSelect={openEditor}
                selectedBlockId={selectedBlockId}
                workBlocks={workBlocks}
              />
            )}
          </div>
        </section>
      )}

      {isEditorOpen ? (
        <div className="modal-overlay" role="presentation" onClick={closeEditor}>
          <div
            className="modal-card surface"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <BlockEditor
              blockForm={blockForm}
              isSaving={isSaving}
              isTracking={isTrackingEdit}
              onClose={closeEditor}
              onDelete={removeSelectedBlock}
              onSubmit={saveBlock}
              onTagToggle={toggleBlockTag}
              onUpdate={updateBlockForm}
              selectedBlock={selectedBlock}
              tags={tags}
            />
          </div>
        </div>
      ) : null}

      {contextMenu ? (
        <ul
          className="context-menu"
          role="menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <li>
            <button
              type="button"
              role="menuitem"
              onClick={() => handleContextEdit(contextMenu.blockId)}
            >
              編輯詳細資料
            </button>
          </li>
          <li>
            <button
              type="button"
              role="menuitem"
              className="danger"
              onClick={() => handleContextDelete(contextMenu.blockId)}
            >
              刪除時間區塊
            </button>
          </li>
        </ul>
      ) : null}
    </main>
  )
}

function WorkBlockList({
  onSelect,
  selectedBlockId,
  workBlocks,
}: {
  onSelect: (block: WorkBlock) => void
  selectedBlockId: string | null
  workBlocks: WorkBlock[]
}) {
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

function BlockEditor({
  blockForm,
  isSaving,
  isTracking,
  onClose,
  onDelete,
  onSubmit,
  onTagToggle,
  onUpdate,
  selectedBlock,
  tags,
}: {
  blockForm: BlockForm
  isSaving: boolean
  isTracking: boolean
  onClose: () => void
  onDelete: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onTagToggle: (tagId: string) => void
  onUpdate: <Key extends keyof BlockForm>(key: Key, value: BlockForm[Key]) => void
  selectedBlock: WorkBlock | null
  tags: Tag[]
}) {
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
    <>
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
    </>
  )
}

function TagManager({
  editingTagId,
  isSaving,
  onEdit,
  onRemove,
  onReset,
  onSubmit,
  setTagForm,
  tagForm,
  tags,
}: {
  editingTagId: string | null
  isSaving: boolean
  onEdit: (tag: Tag) => void
  onRemove: (id: string) => void
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  setTagForm: (next: TagForm) => void
  tagForm: TagForm
  tags: Tag[]
}) {
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

function TagPills({ tags }: { tags: Tag[] }) {
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

function createEmptyBlockForm(start?: Date, end?: Date): BlockForm {
  const startedAt = start ?? roundToNextQuarter(new Date())
  const endedAt = end && end > startedAt ? end : addMinutes(startedAt, 30)

  return {
    title: '',
    notes: '',
    startedAt: toDateTimeLocal(startedAt),
    endedAt: toDateTimeLocal(endedAt),
    tagIds: [],
  }
}

function blockToForm(block: WorkBlock): BlockForm {
  return {
    title: block.title,
    notes: block.notes ?? '',
    startedAt: toDateTimeLocal(new Date(block.startedAt)),
    endedAt: toDateTimeLocal(new Date(block.endedAt)),
    tagIds: block.tags.map((tag) => tag.id),
  }
}

function formToPayload(form: BlockForm): WorkBlockPayload {
  const title = form.title.trim()
  const startedAt = new Date(form.startedAt)
  const endedAt = new Date(form.endedAt)

  if (!title) {
    throw new Error('標題不可為空。')
  }

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    throw new Error('時間格式不正確。')
  }

  if (endedAt <= startedAt) {
    throw new Error('結束時間須晚於開始時間。')
  }

  return {
    title,
    notes: form.notes,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    tagIds: form.tagIds,
  }
}

function toDateTimeLocal(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

function roundToNextQuarter(date: Date): Date {
  const next = new Date(date)
  next.setSeconds(0, 0)
  const minutes = next.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15

  if (roundedMinutes === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0)
  } else {
    next.setMinutes(roundedMinutes)
  }

  return next
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

const trackingStorageKey = 'ergasia.tracking.startedAt'
const trackingDraftKey = 'ergasia.tracking.draft'
const trackingEventId = '__tracking__'
const defaultTrackingDraft: TrackingDraft = { title: '', notes: '', tagIds: [] }

function readTrackingDraft(): TrackingDraft {
  const stored = localStorage.getItem(trackingDraftKey)

  if (!stored) {
    return { ...defaultTrackingDraft }
  }

  try {
    const parsed = JSON.parse(stored) as Partial<TrackingDraft>

    return {
      title: typeof parsed.title === 'string' ? parsed.title : defaultTrackingDraft.title,
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      tagIds: Array.isArray(parsed.tagIds)
        ? parsed.tagIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return { ...defaultTrackingDraft }
  }
}

function readTrackingStart(): Date | null {
  const stored = localStorage.getItem(trackingStorageKey)

  if (!stored) {
    return null
  }

  const date = new Date(stored)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function parseElapsed(value: string): number | null {
  const parts = value.trim().split(':')

  if (parts.length === 0 || parts.length > 3) {
    return null
  }

  const numbers = parts.map((part) => Number(part))

  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) {
    return null
  }

  let hours = 0
  let minutes = 0
  let seconds = 0

  if (numbers.length === 3) {
    ;[hours, minutes, seconds] = numbers
  } else if (numbers.length === 2) {
    ;[minutes, seconds] = numbers
  } else {
    ;[seconds] = numbers
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

function formatRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const day = new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  }).format(startDate)
  const time = new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return `${day} ${time.format(startDate)}-${time.format(endDate)}`
}

function formatDuration(start: string, end: string): string {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) {
    return `${rest} 分`
  }

  if (rest === 0) {
    return `${hours} 小時`
  }

  return `${hours} 小時 ${rest} 分`
}

function formatTotalDuration(blocks: WorkBlock[]): string {
  const minutes = blocks.reduce(
    (total, block) =>
      total +
      Math.max(0, Math.round((new Date(block.endedAt).getTime() - new Date(block.startedAt).getTime()) / 60_000)),
    0,
  )
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return `合計 ${hours} 小時 ${rest} 分`
}

function getReadableTextColor(color: string): string {
  const normalized = color.replace('#', '')

  if (normalized.length !== 6) {
    return '#ffffff'
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.66 ? '#1d2528' : '#ffffff'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '發生未知錯誤。'
}

export default App
