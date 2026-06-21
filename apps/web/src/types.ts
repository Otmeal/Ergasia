export type Tag = {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
  _count?: {
    workBlocks: number
  }
}

export type WorkBlock = {
  id: string
  title: string
  notes: string | null
  startedAt: string
  endedAt: string
  tags: Tag[]
  createdAt: string
  updatedAt: string
}

export type WorkBlockPayload = {
  id?: string
  title: string
  notes?: string
  startedAt: string
  endedAt: string
  tagIds?: string[]
}

export type TagPayload = {
  id?: string
  name: string
  color: string
}

export type SyncEntity = 'tag' | 'workBlock'

export type SyncAction = 'create' | 'update' | 'delete'

export type SyncPayload = Record<string, unknown>

export type SyncOperation = {
  operationId: string
  entity: SyncEntity
  action: SyncAction
  recordId: string
  payload?: SyncPayload
  queuedAt: string
}

export type SyncOperationResult = {
  operationId: string
  entity: SyncEntity
  action: SyncAction
  recordId: string
  status: 'applied' | 'failed'
  message?: string
}

export type SyncResponse = {
  results: SyncOperationResult[]
  workBlocks: WorkBlock[]
  tags: Tag[]
  serverTime: string
}
