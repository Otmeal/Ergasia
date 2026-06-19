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
  title: string
  notes?: string
  startedAt: string
  endedAt: string
  tagIds?: string[]
}

export type TagPayload = {
  name: string
  color: string
}
