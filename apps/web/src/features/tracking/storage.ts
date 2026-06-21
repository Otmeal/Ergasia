import { getMetadata, setMetadata } from '../../localData'
import type { TrackingDraft } from './types'

export const trackingStorageKey = 'ergasia.tracking.startedAt'
export const trackingDraftKey = 'ergasia.tracking.draft'
export const defaultTrackingDraft: TrackingDraft = { title: '', notes: '', tagIds: [] }

export async function readTrackingState(): Promise<{ draft: TrackingDraft; startedAt: Date | null }> {
  const [storedDraft, storedStartedAt] = await Promise.all([
    getMetadata<Partial<TrackingDraft>>(trackingDraftKey),
    getMetadata<string>(trackingStorageKey),
  ])
  let draft = normalizeTrackingDraft(storedDraft)
  let startedAt = parseTrackingStart(storedStartedAt)

  if (!storedDraft) {
    const legacyDraft = readLegacyJson(trackingDraftKey)

    if (legacyDraft) {
      draft = normalizeTrackingDraft(legacyDraft)
      await setMetadata(trackingDraftKey, draft)
      localStorage.removeItem(trackingDraftKey)
    }
  }

  if (!storedStartedAt) {
    const legacyStartedAt = localStorage.getItem(trackingStorageKey)

    if (legacyStartedAt) {
      const parsedStartedAt = parseTrackingStart(legacyStartedAt)

      if (parsedStartedAt) {
        startedAt = parsedStartedAt
        await setMetadata(trackingStorageKey, legacyStartedAt)
      }

      localStorage.removeItem(trackingStorageKey)
    }
  }

  return { draft, startedAt }
}

export function normalizeTrackingDraft(value: unknown): TrackingDraft {
  const parsed = typeof value === 'object' && value ? (value as Partial<TrackingDraft>) : {}

  return {
    title: typeof parsed.title === 'string' ? parsed.title : defaultTrackingDraft.title,
    notes: typeof parsed.notes === 'string' ? parsed.notes : '',
    tagIds: Array.isArray(parsed.tagIds)
      ? parsed.tagIds.filter((id): id is string => typeof id === 'string')
      : [],
  }
}

function parseTrackingStart(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function readLegacyJson(key: string): unknown {
  const stored = localStorage.getItem(key)

  if (!stored) {
    return null
  }

  try {
    return JSON.parse(stored) as unknown
  } catch {
    return null
  }
}
