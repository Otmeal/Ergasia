import type { SyncOperation, SyncResponse, Tag, TagPayload, WorkBlock, WorkBlockPayload } from './types'

const SYNC_BASE_URL_KEY = 'ergasia.sync-base-url'
const defaultApiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

let apiBase = readStoredBaseUrl() ?? defaultApiBase

function readStoredBaseUrl(): string | null {
  try {
    const stored = window.localStorage.getItem(SYNC_BASE_URL_KEY)?.trim()
    return stored ? stored : null
  } catch {
    return null
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export function getSyncBaseUrl(): string {
  return apiBase
}

export function getDefaultSyncBaseUrl(): string {
  return defaultApiBase
}

export function setSyncBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value)

  if (!normalized) {
    throw new Error('同步網址不可為空。')
  }

  try {
    new URL(normalized)
  } catch {
    throw new Error('同步網址格式不正確。')
  }

  apiBase = normalized

  try {
    window.localStorage.setItem(SYNC_BASE_URL_KEY, normalized)
  } catch {
    // 持久化失敗無妨，運行時值已更新。
  }

  return normalized
}

export function resetSyncBaseUrl(): string {
  apiBase = defaultApiBase

  try {
    window.localStorage.removeItem(SYNC_BASE_URL_KEY)
  } catch {
    // ignore
  }

  return apiBase
}

export function getWorkBlocks() {
  return request<WorkBlock[]>('/work-blocks')
}

export function checkHealth() {
  return request<{ status: string; timestamp: string }>('/health', {}, 2_500)
}

export function createWorkBlock(payload: WorkBlockPayload) {
  return request<WorkBlock>('/work-blocks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateWorkBlock(id: string, payload: Partial<WorkBlockPayload>) {
  return request<WorkBlock>(`/work-blocks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteWorkBlock(id: string) {
  return request<{ id: string }>(`/work-blocks/${id}`, {
    method: 'DELETE',
  })
}

export function getTags() {
  return request<Tag[]>('/tags')
}

export function createTag(payload: TagPayload) {
  return request<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTag(id: string, payload: Partial<TagPayload>) {
  return request<Tag>(`/tags/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTag(id: string) {
  return request<{ id: string }>(`/tags/${id}`, {
    method: 'DELETE',
  })
}

export function syncOperations(operations: SyncOperation[]) {
  return request<SyncResponse>('/sync', {
    method: 'POST',
    body: JSON.stringify({ operations }),
  })
}

async function request<ResponseBody>(path: string, init: RequestInit = {}, timeoutMs = 8_000) {
  const headers = new Headers(init.headers)
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(await readError(response))
    }

    return (await response.json()) as ResponseBody
  } finally {
    window.clearTimeout(timeout)
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] }

    if (Array.isArray(body.message)) {
      return body.message.join(' ')
    }

    if (body.message) {
      return body.message
    }
  } catch {
    return `API error ${response.status}`
  }

  return `API error ${response.status}`
}
