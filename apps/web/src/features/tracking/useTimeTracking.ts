import { useCallback, useEffect, useState } from 'react'
import { removeMetadata, setMetadata } from '../../localData'
import type { WorkBlock } from '../../types'
import { addMinutes, parseElapsed } from '../../utils/dateTime'
import { getErrorMessage } from '../../utils/presentation'
import type { WorkspaceData } from '../workspace/useWorkspaceData'
import { defaultTrackingDraft, readTrackingState, trackingDraftKey, trackingStorageKey } from './storage'
import type { TrackingDraft } from './types'
import type { BlockForm } from '../work-blocks/types'

export type TimeTracking = {
  trackingStartedAt: Date | null
  trackingDraft: TrackingDraft
  nowTick: number
  elapsedEditing: boolean
  elapsedDraft: string
  trackingTagPickerOpen: boolean
  setElapsedDraft: (value: string) => void
  setTrackingTagPickerOpen: (open: boolean | ((current: boolean) => boolean)) => void
  cancelEditElapsed: () => void
  updateTrackingTitle: (title: string) => void
  toggleTrackingTag: (tagId: string) => void
  beginEditElapsed: () => void
  commitElapsed: () => void
  toggleTimeTrack: () => Promise<WorkBlock | null>
  commitTrackingEdit: (form: BlockForm) => boolean
}

export function useTimeTracking(workspace: WorkspaceData): TimeTracking {
  const [trackingStartedAt, setTrackingStartedAt] = useState<Date | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [elapsedEditing, setElapsedEditing] = useState(false)
  const [elapsedDraft, setElapsedDraft] = useState('')
  const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>(() => ({ ...defaultTrackingDraft }))
  const [trackingTagPickerOpen, setTrackingTagPickerOpen] = useState(false)

  const { createWorkBlock, runSync, setStatus } = workspace

  useEffect(() => {
    let cancelled = false

    void readTrackingState()
      .then((tracking) => {
        if (cancelled) {
          return
        }

        setTrackingStartedAt(tracking.startedAt)
        setTrackingDraft(tracking.draft)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(getErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [setStatus])

  useEffect(() => {
    if (!trackingStartedAt) {
      return
    }

    setNowTick(Date.now())
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)

    return () => window.clearInterval(id)
  }, [trackingStartedAt])

  const persistTrackingDraft = useCallback((draft: TrackingDraft) => {
    setTrackingDraft(draft)
    void setMetadata(trackingDraftKey, draft)
  }, [])

  const updateTrackingTitle = useCallback(
    (title: string) => persistTrackingDraft({ ...trackingDraft, title }),
    [persistTrackingDraft, trackingDraft],
  )

  const toggleTrackingTag = useCallback(
    (tagId: string) => {
      persistTrackingDraft({
        ...trackingDraft,
        tagIds: trackingDraft.tagIds.includes(tagId)
          ? trackingDraft.tagIds.filter((id) => id !== tagId)
          : [...trackingDraft.tagIds, tagId],
      })
    },
    [persistTrackingDraft, trackingDraft],
  )

  const toggleTimeTrack = useCallback(async (): Promise<WorkBlock | null> => {
    if (!trackingStartedAt) {
      const start = new Date()
      await setMetadata(trackingStorageKey, start.toISOString())
      await setMetadata(trackingDraftKey, trackingDraft)
      setTrackingStartedAt(start)
      setStatus('已開始追蹤時間。')
      return null
    }

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

      await removeMetadata(trackingStorageKey)
      await removeMetadata(trackingDraftKey)
      setTrackingStartedAt(null)
      setTrackingDraft({ ...defaultTrackingDraft })
      setStatus('已停止追蹤，時間區塊已建立。')
      void runSync()
      return created
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
      return null
    }
  }, [createWorkBlock, runSync, setStatus, trackingDraft, trackingStartedAt])

  const commitTrackingEdit = useCallback(
    (form: BlockForm): boolean => {
      const title = form.title.trim()
      const start = new Date(form.startedAt)

      if (!title) {
        setStatus('標題不可為空。')
        return false
      }

      if (Number.isNaN(start.getTime())) {
        setStatus('時間格式不正確。')
        return false
      }

      const draft: TrackingDraft = { title, notes: form.notes, tagIds: form.tagIds }
      void setMetadata(trackingStorageKey, start.toISOString())
      void setMetadata(trackingDraftKey, draft)
      setTrackingStartedAt(start)
      setTrackingDraft(draft)
      setNowTick(Date.now())
      setStatus('追蹤資料已更新。')
      return true
    },
    [setStatus],
  )

  const beginEditElapsed = useCallback(() => {
    if (!trackingStartedAt) {
      return
    }

    const totalSeconds = Math.max(0, Math.floor((Date.now() - trackingStartedAt.getTime()) / 1000))
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0')
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0')
    const seconds = (totalSeconds % 60).toString().padStart(2, '0')
    setElapsedDraft(`${hours}:${minutes}:${seconds}`)
    setElapsedEditing(true)
  }, [trackingStartedAt])

  const commitElapsed = useCallback(() => {
    setElapsedEditing(false)
    const ms = parseElapsed(elapsedDraft)

    if (ms === null || !trackingStartedAt) {
      return
    }

    const start = new Date(Date.now() - ms)
    void setMetadata(trackingStorageKey, start.toISOString())
    setTrackingStartedAt(start)
    setNowTick(Date.now())
  }, [elapsedDraft, trackingStartedAt])

  const cancelEditElapsed = useCallback(() => setElapsedEditing(false), [])

  return {
    trackingStartedAt,
    trackingDraft,
    nowTick,
    elapsedEditing,
    elapsedDraft,
    trackingTagPickerOpen,
    setElapsedDraft,
    setTrackingTagPickerOpen,
    cancelEditElapsed,
    updateTrackingTitle,
    toggleTrackingTag,
    beginEditElapsed,
    commitElapsed,
    toggleTimeTrack,
    commitTrackingEdit,
  }
}
