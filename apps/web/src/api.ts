import type { Tag, TagPayload, WorkBlock, WorkBlockPayload } from './types'

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export function getWorkBlocks() {
  return request<WorkBlock[]>('/work-blocks')
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

async function request<ResponseBody>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return (await response.json()) as ResponseBody
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
