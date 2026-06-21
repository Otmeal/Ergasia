import type { WorkBlock } from '../../types'

export type TitleSuggestion = {
  title: string
  tagIds: string[]
  count: number
}

type Aggregate = {
  title: string
  count: number
  lastUsed: number
  tagIds: string[]
}

/**
 * Recommend previously-used work-block titles for the title field.
 *
 * Titles are de-duplicated case-insensitively. Ranking favours titles that were
 * used together with the currently-selected tags, then prefix matches, then how
 * often the title appears, and finally how recently it was used. Each suggestion
 * carries the tag set from its most recent occurrence so the caller can restore
 * both the title and its tags.
 */
export function buildTitleSuggestions(
  workBlocks: WorkBlock[],
  query: string,
  selectedTagIds: string[],
  limit = 6,
): TitleSuggestion[] {
  const trimmedQuery = query.trim().toLowerCase()
  const selected = new Set(selectedTagIds)
  const byKey = new Map<string, Aggregate>()

  for (const block of workBlocks) {
    const title = block.title.trim()

    if (!title) {
      continue
    }

    const key = title.toLowerCase()
    const startedAt = new Date(block.startedAt).getTime()
    const blockTagIds = block.tags.map((tag) => tag.id)
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, { title, count: 1, lastUsed: startedAt, tagIds: blockTagIds })
      continue
    }

    existing.count += 1

    if (startedAt > existing.lastUsed) {
      existing.lastUsed = startedAt
      existing.tagIds = blockTagIds
      existing.title = title
    }
  }

  const candidates = [...byKey.values()].filter((item) => {
    if (!trimmedQuery) {
      return true
    }

    if (item.title.toLowerCase() === trimmedQuery) {
      return false
    }

    return item.title.toLowerCase().includes(trimmedQuery)
  })

  const score = (item: Aggregate) => {
    const overlap = item.tagIds.reduce((sum, id) => (selected.has(id) ? sum + 1 : sum), 0)
    const tagScore = selected.size > 0 ? overlap / selected.size : 0
    const prefixBonus =
      trimmedQuery && item.title.toLowerCase().startsWith(trimmedQuery) ? 1 : 0

    return tagScore * 100 + prefixBonus * 10 + item.count
  }

  return candidates
    .sort((a, b) => {
      const diff = score(b) - score(a)
      return diff !== 0 ? diff : b.lastUsed - a.lastUsed
    })
    .slice(0, limit)
    .map((item) => ({ title: item.title, tagIds: item.tagIds, count: item.count }))
}
