import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AppHeader } from './components/AppHeader'
import { StatusLine } from './components/StatusLine'
import { TagsPage } from './features/tags/TagsPage'
import { useTagEditor } from './features/tags/useTagEditor'
import { TimeTrackerControls } from './features/tracking/TimeTrackerControls'
import { useTimeTracking } from './features/tracking/useTimeTracking'
import { CalendarPage } from './features/work-blocks/CalendarPage'
import { createCalendarEvents } from './features/work-blocks/calendarEvents'
import { ListPage } from './features/work-blocks/ListPage'
import { WorkBlockContextMenu } from './features/work-blocks/WorkBlockContextMenu'
import { WorkBlockEditorModal } from './features/work-blocks/WorkBlockEditorModal'
import { useWorkBlockEditor } from './features/work-blocks/useWorkBlockEditor'
import type { ViewMode } from './features/work-blocks/types'
import { formatTotalDuration } from './utils/dateTime'
import { useWorkspaceData } from './features/workspace/useWorkspaceData'
import './App.css'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const workspace = useWorkspaceData()
  const workBlockEditor = useWorkBlockEditor(workspace, setViewMode)
  const tagEditor = useTagEditor(workspace, workBlockEditor.removeTagReference)
  const tracking = useTimeTracking(workspace)

  const calendarEvents = useMemo(
    () =>
      createCalendarEvents(
        workspace.workBlocks,
        tracking.trackingStartedAt,
        tracking.nowTick,
        tracking.trackingDraft.tagIds,
        tracking.trackingDraft.title,
        workspace.tags,
      ),
    [
      tracking.nowTick,
      tracking.trackingDraft.tagIds,
      tracking.trackingDraft.title,
      tracking.trackingStartedAt,
      workspace.tags,
      workspace.workBlocks,
    ],
  )

  function openTrackingEditor() {
    if (!tracking.trackingStartedAt) {
      return
    }

    workBlockEditor.openTrackingEditor(tracking.trackingStartedAt, tracking.trackingDraft)
  }

  function handleBlockSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (workBlockEditor.isTrackingEdit) {
      if (tracking.commitTrackingEdit(workBlockEditor.blockForm)) {
        workBlockEditor.closeEditor()
      }
      return
    }

    void workBlockEditor.saveBlock()
  }

  function handleTimeTrackToggle() {
    void tracking.toggleTimeTrack().then((created) => {
      if (created) {
        workBlockEditor.openEditor(created)
      }
    })
  }

  return (
    <main className="app-shell">
      <AppHeader viewMode={viewMode} onViewModeChange={setViewMode} />
      <StatusLine status={workspace.status} />

      {viewMode === 'tags' ? (
        <TagsPage
          editingTagId={tagEditor.editingTagId}
          isSaving={workspace.isSaving}
          tags={workspace.tags}
          tagForm={tagEditor.tagForm}
          setTagForm={tagEditor.setTagForm}
          onEdit={tagEditor.editTag}
          onRemove={tagEditor.removeTag}
          onReset={tagEditor.resetTagForm}
          onSubmit={tagEditor.saveTag}
        />
      ) : (
        <section className="workspace single">
          <div className="surface main-surface">
            <div className="surface-header">
              <div>
                <h2>{viewMode === 'calendar' ? '日曆' : '清單'}</h2>
                <p>{formatTotalDuration(workspace.workBlocks)}</p>
              </div>
              <TimeTrackerControls
                tags={workspace.tags}
                isSaving={workspace.isSaving}
                tracking={tracking}
                onToggle={handleTimeTrackToggle}
              />
            </div>

            {viewMode === 'calendar' ? (
              <CalendarPage
                events={calendarEvents}
                onSelect={(selection) => void workBlockEditor.handleCalendarSelect(selection)}
                onEventDrop={(eventDrop) => void workBlockEditor.handleEventDrop(eventDrop)}
                onEventResize={(eventResize) => void workBlockEditor.handleEventResize(eventResize)}
                onEventClick={(eventClick) => workBlockEditor.handleEventClick(eventClick, openTrackingEditor)}
                onEventDidMount={workBlockEditor.handleEventDidMount}
              />
            ) : (
              <ListPage
                onSelect={workBlockEditor.openEditor}
                onStartTracking={(title, tagIds) => void tracking.startTracking(title, tagIds)}
                selectedBlockId={workBlockEditor.selectedBlockId}
                workBlocks={workspace.workBlocks}
              />
            )}
          </div>
        </section>
      )}

      {workBlockEditor.isEditorOpen ? (
        <WorkBlockEditorModal
          blockForm={workBlockEditor.blockForm}
          isSaving={workspace.isSaving}
          isTracking={workBlockEditor.isTrackingEdit}
          selectedBlock={workBlockEditor.selectedBlock}
          tags={workspace.tags}
          onClose={workBlockEditor.closeEditor}
          onDelete={() => void workBlockEditor.removeSelectedBlock()}
          onSubmit={handleBlockSubmit}
          onTagToggle={workBlockEditor.toggleBlockTag}
          onUpdate={workBlockEditor.updateBlockForm}
        />
      ) : null}

      {workBlockEditor.contextMenu ? (
        <WorkBlockContextMenu
          contextMenu={workBlockEditor.contextMenu}
          onEdit={workBlockEditor.handleContextEdit}
          onDelete={workBlockEditor.handleContextDelete}
        />
      ) : null}
    </main>
  )
}

export default App
