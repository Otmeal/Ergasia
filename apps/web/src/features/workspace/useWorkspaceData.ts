import { useCallback, useEffect, useState } from 'react'
import {
  createLocalTag,
  createLocalWorkBlock,
  deleteLocalTag,
  deleteLocalWorkBlock,
  loadLocalData,
  syncLocalData,
  updateLocalTag,
  updateLocalWorkBlock,
  type LocalDataSnapshot,
} from '../../localData'
import type { Tag, TagPayload, WorkBlock, WorkBlockPayload } from '../../types'
import { formatPendingStatus, formatSyncOutcome, getErrorMessage } from '../../utils/presentation'

export type WorkspaceData = {
  workBlocks: WorkBlock[]
  tags: Tag[]
  status: string
  isSaving: boolean
  setStatus: (status: string) => void
  refreshData: () => Promise<LocalDataSnapshot>
  runSync: () => Promise<void>
  createWorkBlock: (payload: WorkBlockPayload) => Promise<WorkBlock>
  updateWorkBlock: (id: string, payload: Partial<WorkBlockPayload>) => Promise<WorkBlock>
  deleteWorkBlock: (id: string) => Promise<void>
  createTag: (payload: TagPayload) => Promise<Tag>
  updateTag: (id: string, payload: Partial<TagPayload>) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
}

export function useWorkspaceData(): WorkspaceData {
  const [workBlocks, setWorkBlocks] = useState<WorkBlock[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [status, setStatus] = useState('正在載入。')
  const [isSaving, setIsSaving] = useState(false)

  const applySnapshot = useCallback((snapshot: LocalDataSnapshot) => {
    setWorkBlocks(snapshot.workBlocks)
    setTags(snapshot.tags)
  }, [])

  const refreshData = useCallback(async () => {
    const snapshot = await loadLocalData()
    applySnapshot(snapshot)
    return snapshot
  }, [applySnapshot])

  const runSync = useCallback(async () => {
    setStatus('同步中。')

    try {
      const outcome = await syncLocalData()
      applySnapshot(outcome.snapshot)
      setStatus(formatSyncOutcome(outcome))
    } catch (error: unknown) {
      setStatus(getErrorMessage(error))
      throw error
    }
  }, [applySnapshot])

  useEffect(() => {
    let cancelled = false

    void loadLocalData()
      .then((snapshot) => {
        if (cancelled) {
          return
        }

        applySnapshot(snapshot)
        setStatus(formatPendingStatus(snapshot.pendingCount))
        void runSync()
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus(getErrorMessage(error))
        }
      })

    return () => {
      cancelled = true
    }
  }, [applySnapshot, runSync])

  useEffect(() => {
    const sync = () => void runSync()
    const intervalId = window.setInterval(sync, 30_000)

    window.addEventListener('online', sync)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('online', sync)
    }
  }, [runSync])

  const performMutation = useCallback(
    async <Result,>(action: () => Promise<Result>): Promise<Result> => {
      setIsSaving(true)

      try {
        const result = await action()
        await refreshData()
        return result
      } finally {
        setIsSaving(false)
      }
    },
    [refreshData],
  )

  const createWorkBlock = useCallback(
    (payload: WorkBlockPayload) => performMutation(() => createLocalWorkBlock(payload)),
    [performMutation],
  )
  const updateWorkBlock = useCallback(
    (id: string, payload: Partial<WorkBlockPayload>) =>
      performMutation(() => updateLocalWorkBlock(id, payload)),
    [performMutation],
  )
  const deleteWorkBlock = useCallback(
    (id: string) => performMutation(() => deleteLocalWorkBlock(id)),
    [performMutation],
  )
  const createTag = useCallback(
    (payload: TagPayload) => performMutation(() => createLocalTag(payload)),
    [performMutation],
  )
  const updateTag = useCallback(
    (id: string, payload: Partial<TagPayload>) => performMutation(() => updateLocalTag(id, payload)),
    [performMutation],
  )
  const deleteTag = useCallback(
    (id: string) => performMutation(() => deleteLocalTag(id)),
    [performMutation],
  )

  return {
    workBlocks,
    tags,
    status,
    isSaving,
    setStatus,
    refreshData,
    runSync,
    createWorkBlock,
    updateWorkBlock,
    deleteWorkBlock,
    createTag,
    updateTag,
    deleteTag,
  }
}
