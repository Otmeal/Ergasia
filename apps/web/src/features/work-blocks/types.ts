export type BlockForm = {
  title: string
  notes: string
  startedAt: string
  endedAt: string
  tagIds: string[]
}

export type ViewMode = 'calendar' | 'list' | 'tags' | 'statistics' | 'settings'
