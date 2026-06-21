import type { SyncOutcome } from '../localData'

export function getReadableTextColor(color: string): string {
  const normalized = color.replace('#', '')

  if (normalized.length !== 6) {
    return '#ffffff'
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255

  return luminance > 0.66 ? '#1d2528' : '#ffffff'
}

export function formatPendingStatus(pendingCount: number): string {
  return pendingCount > 0 ? `離線：${pendingCount} 筆待同步。` : '已同步。'
}

export function formatSyncOutcome(outcome: SyncOutcome): string {
  if (outcome.status === 'offline') {
    return `離線：${outcome.pendingCount} 筆待同步。`
  }

  if (outcome.status === 'failed') {
    return `同步失敗：${outcome.failedCount} 筆失敗，${outcome.pendingCount} 筆待同步。`
  }

  return formatPendingStatus(outcome.pendingCount)
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '發生未知錯誤。'
}
