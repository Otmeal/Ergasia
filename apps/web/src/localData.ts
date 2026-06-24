import { syncOperations } from './api'
import type {
  SyncAction,
  SyncEntity,
  SyncOperation,
  SyncPayload,
  Tag,
  TagPayload,
  WorkBlock,
  WorkBlockPayload,
} from './types'

const dbName = 'ergasia.local-first'
const dbVersion = 1

type MetadataRecord<T = unknown> = {
  key: string
  value: T
}

type RawSnapshot = {
  workBlocks: WorkBlock[]
  tags: Tag[]
  operations: SyncOperation[]
}

export type LocalDataSnapshot = {
  workBlocks: WorkBlock[]
  tags: Tag[]
  pendingCount: number
}

export type SyncOutcome = {
  status: 'synced' | 'offline' | 'failed'
  snapshot: LocalDataSnapshot
  pendingCount: number
  failedCount: number
  error?: string
}

let dbPromise: Promise<IDBDatabase> | null = null
let activeSync: Promise<SyncOutcome> | null = null

export async function loadLocalData(): Promise<LocalDataSnapshot> {
  const raw = await readRawSnapshot()
  return toLocalSnapshot(raw)
}

export async function createLocalWorkBlock(payload: WorkBlockPayload): Promise<WorkBlock> {
  const raw = await readRawSnapshot()
  const normalized = normalizeWorkBlockPayload(payload)
  const now = new Date().toISOString()
  const record: WorkBlock = {
    id: payload.id ?? createId(),
    title: normalized.title,
    notes: normalized.notes ?? null,
    startedAt: normalized.startedAt,
    endedAt: normalized.endedAt,
    tags: resolveTags(raw.tags, normalized.tagIds ?? []),
    createdAt: now,
    updatedAt: now,
  }

  await writeStores((transaction) => {
    transaction.objectStore('workBlocks').put(record)
    transaction.objectStore('syncOperations').put(
      createOperation('workBlock', 'create', record.id, {
        title: record.title,
        notes: record.notes ?? undefined,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        tagIds: record.tags.map((tag) => tag.id),
      }),
    )
  })

  return record
}

export async function updateLocalWorkBlock(
  id: string,
  payload: Partial<WorkBlockPayload>,
): Promise<WorkBlock> {
  const raw = await readRawSnapshot()
  const current = raw.workBlocks.find((block) => block.id === id)

  if (!current) {
    throw new Error('時間區塊不存在。')
  }

  const normalized = normalizePartialWorkBlockPayload(current, payload)
  const updated: WorkBlock = {
    ...current,
    title: normalized.title,
    startedAt: normalized.startedAt,
    endedAt: normalized.endedAt,
    tags:
      payload.tagIds === undefined ? current.tags : resolveTags(raw.tags, normalized.tagIds ?? []),
    notes: payload.notes === undefined ? current.notes : (normalized.notes ?? null),
    updatedAt: new Date().toISOString(),
  }
  const syncPayload = toWorkBlockSyncPayload(payload, updated)

  await writeStores((transaction) => {
    transaction.objectStore('workBlocks').put(updated)
    transaction
      .objectStore('syncOperations')
      .put(createOperation('workBlock', 'update', updated.id, syncPayload))
  })

  return updated
}

export async function deleteLocalWorkBlock(id: string): Promise<void> {
  await writeStores((transaction) => {
    transaction.objectStore('workBlocks').delete(id)
    transaction.objectStore('syncOperations').put(createOperation('workBlock', 'delete', id))
  })
}

export async function createLocalTag(payload: TagPayload): Promise<Tag> {
  const raw = await readRawSnapshot()
  const normalized = normalizeTagPayload(payload)
  assertUniqueTagName(raw.tags, normalized.name)
  const now = new Date().toISOString()
  const record: Tag = {
    id: payload.id ?? createId(),
    name: normalized.name,
    color: normalized.color,
    createdAt: now,
    updatedAt: now,
    _count: { workBlocks: 0 },
  }

  await writeStores((transaction) => {
    transaction.objectStore('tags').put(record)
    transaction.objectStore('syncOperations').put(
      createOperation('tag', 'create', record.id, {
        name: record.name,
        color: record.color,
      }),
    )
  })

  return record
}

export async function updateLocalTag(id: string, payload: Partial<TagPayload>): Promise<Tag> {
  const raw = await readRawSnapshot()
  const current = raw.tags.find((tag) => tag.id === id)

  if (!current) {
    throw new Error('標籤不存在。')
  }

  const normalized = normalizePartialTagPayload(payload)
  const nextName = normalized.name ?? current.name
  assertUniqueTagName(raw.tags, nextName, id)
  const updated: Tag = {
    ...current,
    ...normalized,
    updatedAt: new Date().toISOString(),
  }
  const updatedBlocks = raw.workBlocks.map((block) => ({
    ...block,
    tags: block.tags.map((tag) => (tag.id === id ? { ...tag, ...updated } : tag)),
  }))

  await writeStores((transaction) => {
    transaction.objectStore('tags').put(updated)
    for (const block of updatedBlocks) {
      transaction.objectStore('workBlocks').put(block)
    }
    transaction
      .objectStore('syncOperations')
      .put(createOperation('tag', 'update', updated.id, normalized as SyncPayload))
  })

  return updated
}

export async function deleteLocalTag(id: string): Promise<void> {
  const raw = await readRawSnapshot()
  const updatedBlocks = raw.workBlocks.map((block) => ({
    ...block,
    tags: block.tags.filter((tag) => tag.id !== id),
    updatedAt: block.tags.some((tag) => tag.id === id) ? new Date().toISOString() : block.updatedAt,
  }))

  await writeStores((transaction) => {
    transaction.objectStore('tags').delete(id)
    for (const block of updatedBlocks) {
      transaction.objectStore('workBlocks').put(block)
    }
    transaction.objectStore('syncOperations').put(createOperation('tag', 'delete', id))
  })
}

export async function syncLocalData(): Promise<SyncOutcome> {
  if (activeSync) {
    return activeSync
  }

  activeSync = performSync().finally(() => {
    activeSync = null
  })

  return activeSync
}

export async function getMetadata<T>(key: string): Promise<T | null> {
  const db = await openDatabase()
  const transaction = db.transaction('metadata', 'readonly')
  const record = await requestToPromise<MetadataRecord<T> | undefined>(
    transaction.objectStore('metadata').get(key),
  )
  await transactionDone(transaction)
  return record?.value ?? null
}

export async function setMetadata<T>(key: string, value: T): Promise<void> {
  await writeStores((transaction) => {
    transaction.objectStore('metadata').put({ key, value })
  })
}

export async function removeMetadata(key: string): Promise<void> {
  await writeStores((transaction) => {
    transaction.objectStore('metadata').delete(key)
  })
}

async function performSync(): Promise<SyncOutcome> {
  const before = await readRawSnapshot()

  try {
    const operations = [...before.operations].sort(compareOperations)
    const response = await syncOperations(operations)
    const appliedOperationIds = new Set(
      response.results
        .filter((result) => result.status === 'applied')
        .map((result) => result.operationId),
    )
    const failedCount = response.results.length - appliedOperationIds.size

    await mergeRemoteSnapshot(response.workBlocks, response.tags, appliedOperationIds)

    const snapshot = await loadLocalData()
    return {
      status: failedCount > 0 ? 'failed' : 'synced',
      snapshot,
      pendingCount: snapshot.pendingCount,
      failedCount,
    }
  } catch (error: unknown) {
    const snapshot = toLocalSnapshot(before)
    return {
      status: 'offline',
      snapshot,
      pendingCount: snapshot.pendingCount,
      failedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function mergeRemoteSnapshot(
  remoteWorkBlocks: WorkBlock[],
  remoteTags: Tag[],
  appliedOperationIds: Set<string>,
): Promise<void> {
  const raw = await readRawSnapshot()
  const remainingOperations = raw.operations.filter(
    (operation) => !appliedOperationIds.has(operation.operationId),
  )
  const pendingTagIds = new Set(
    remainingOperations.filter((operation) => operation.entity === 'tag').map((operation) => operation.recordId),
  )
  const pendingWorkBlockIds = new Set(
    remainingOperations
      .filter((operation) => operation.entity === 'workBlock')
      .map((operation) => operation.recordId),
  )
  const remoteTagIds = new Set(remoteTags.map((tag) => tag.id))
  const remoteWorkBlockIds = new Set(remoteWorkBlocks.map((block) => block.id))

  await writeStores((transaction) => {
    const tagStore = transaction.objectStore('tags')
    const workBlockStore = transaction.objectStore('workBlocks')
    const operationStore = transaction.objectStore('syncOperations')

    for (const operationId of appliedOperationIds) {
      operationStore.delete(operationId)
    }

    for (const tag of remoteTags) {
      if (!pendingTagIds.has(tag.id)) {
        tagStore.put(tag)
      }
    }

    for (const tag of raw.tags) {
      if (!pendingTagIds.has(tag.id) && !remoteTagIds.has(tag.id)) {
        tagStore.delete(tag.id)
      }
    }

    for (const block of remoteWorkBlocks) {
      if (!pendingWorkBlockIds.has(block.id)) {
        workBlockStore.put(block)
      }
    }

    for (const block of raw.workBlocks) {
      if (!pendingWorkBlockIds.has(block.id) && !remoteWorkBlockIds.has(block.id)) {
        workBlockStore.delete(block.id)
      }
    }
  })
}

async function readRawSnapshot(): Promise<RawSnapshot> {
  const db = await openDatabase()
  const transaction = db.transaction(['workBlocks', 'tags', 'syncOperations'], 'readonly')
  const workBlocksRequest = transaction.objectStore('workBlocks').getAll()
  const tagsRequest = transaction.objectStore('tags').getAll()
  const operationsRequest = transaction.objectStore('syncOperations').getAll()
  const [workBlocks, tags, operations] = await Promise.all([
    requestToPromise<WorkBlock[]>(workBlocksRequest),
    requestToPromise<Tag[]>(tagsRequest),
    requestToPromise<SyncOperation[]>(operationsRequest),
  ])
  await transactionDone(transaction)

  return {
    workBlocks,
    tags,
    operations,
  }
}

function toLocalSnapshot(raw: RawSnapshot): LocalDataSnapshot {
  const workBlocks = [...raw.workBlocks].sort(compareWorkBlocks)
  const tags = attachTagCounts(raw.tags, workBlocks).sort(compareTags)

  return {
    workBlocks,
    tags,
    pendingCount: raw.operations.length,
  }
}

function attachTagCounts(tags: Tag[], workBlocks: WorkBlock[]): Tag[] {
  return tags.map((tag) => ({
    ...tag,
    _count: {
      workBlocks: workBlocks.filter((block) =>
        block.tags.some((blockTag) => blockTag.id === tag.id),
      ).length,
    },
  }))
}

function normalizeTagPayload(payload: TagPayload): TagPayload {
  const name = payload.name.trim()

  if (!name) {
    throw new Error('標籤名稱不可為空。')
  }

  if (!isHexColor(payload.color)) {
    throw new Error('標籤顏色格式不正確。')
  }

  return {
    ...payload,
    name,
  }
}

function normalizePartialTagPayload(payload: Partial<TagPayload>): Partial<TagPayload> {
  const normalized: Partial<TagPayload> = {}

  if (payload.name !== undefined) {
    normalized.name = normalizeTagPayload({ name: payload.name, color: payload.color ?? '#000000' }).name
  }

  if (payload.color !== undefined) {
    if (!isHexColor(payload.color)) {
      throw new Error('標籤顏色格式不正確。')
    }

    normalized.color = payload.color
  }

  return normalized
}

function normalizeWorkBlockPayload(payload: WorkBlockPayload): WorkBlockPayload {
  const title = payload.title.trim()
  const startedAt = new Date(payload.startedAt)
  const endedAt = new Date(payload.endedAt)

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
    ...payload,
    title,
    notes: normalizeOptionalText(payload.notes),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    tagIds: uniqueStrings(payload.tagIds ?? []),
  }
}

function normalizePartialWorkBlockPayload(
  current: WorkBlock,
  payload: Partial<WorkBlockPayload>,
): WorkBlockPayload {
  return normalizeWorkBlockPayload({
    title: payload.title ?? current.title,
    notes: payload.notes ?? current.notes ?? '',
    startedAt: payload.startedAt ?? current.startedAt,
    endedAt: payload.endedAt ?? current.endedAt,
    tagIds: payload.tagIds ?? current.tags.map((tag) => tag.id),
  })
}

function toWorkBlockSyncPayload(
  payload: Partial<WorkBlockPayload>,
  updated: WorkBlock,
): SyncPayload {
  return {
    ...(payload.title !== undefined ? { title: updated.title } : {}),
    ...(payload.notes !== undefined ? { notes: updated.notes ?? '' } : {}),
    ...(payload.startedAt !== undefined ? { startedAt: updated.startedAt } : {}),
    ...(payload.endedAt !== undefined ? { endedAt: updated.endedAt } : {}),
    ...(payload.tagIds !== undefined ? { tagIds: updated.tags.map((tag) => tag.id) } : {}),
  }
}

function resolveTags(tags: Tag[], tagIds: string[]): Tag[] {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  return tagIds.map((tagId) => tagMap.get(tagId)).filter((tag): tag is Tag => Boolean(tag))
}

function assertUniqueTagName(tags: Tag[], name: string, ignoreId?: string): void {
  if (tags.some((tag) => tag.id !== ignoreId && tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('標籤名稱已存在。')
  }
}

function createOperation(
  entity: SyncEntity,
  action: SyncAction,
  recordId: string,
  payload?: SyncPayload,
): SyncOperation {
  const queuedAt = new Date().toISOString()

  return {
    operationId: `${queuedAt}-${createId()}`,
    entity,
    action,
    recordId,
    ...(payload ? { payload } : {}),
    queuedAt,
  }
}

async function writeStores(write: (transaction: IDBTransaction) => void): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(['workBlocks', 'tags', 'syncOperations', 'metadata'], 'readwrite')
  write(transaction)
  await transactionDone(transaction)
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains('workBlocks')) {
        db.createObjectStore('workBlocks', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('tags')) {
        db.createObjectStore('tags', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('syncOperations')) {
        db.createObjectStore('syncOperations', { keyPath: 'operationId' })
      }

      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata', { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open local database.'))
  })

  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.'))
  })
}

function createId(): string {
  return crypto.randomUUID()
}

function compareTags(left: Tag, right: Tag): number {
  return left.name.localeCompare(right.name)
}

function compareWorkBlocks(left: WorkBlock, right: WorkBlock): number {
  return left.startedAt.localeCompare(right.startedAt) || left.createdAt.localeCompare(right.createdAt)
}

function compareOperations(left: SyncOperation, right: SyncOperation): number {
  return left.queuedAt.localeCompare(right.queuedAt)
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : undefined
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(value)
}
