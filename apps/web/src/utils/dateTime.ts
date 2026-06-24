export function toDateTimeLocal(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

export function roundToNextQuarter(date: Date): Date {
  const next = new Date(date)
  next.setSeconds(0, 0)
  const minutes = next.getMinutes()
  const roundedMinutes = Math.ceil(minutes / 15) * 15

  if (roundedMinutes === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0)
  } else {
    next.setMinutes(roundedMinutes)
  }

  return next
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => value.toString().padStart(2, '0')

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function parseElapsed(value: string): number | null {
  const parts = value.trim().split(':')

  if (parts.length === 0 || parts.length > 3) {
    return null
  }

  const numbers = parts.map((part) => Number(part))

  if (numbers.some((part) => !Number.isFinite(part) || part < 0)) {
    return null
  }

  let hours = 0
  let minutes = 0
  let seconds = 0

  if (numbers.length === 3) {
    ;[hours, minutes, seconds] = numbers
  } else if (numbers.length === 2) {
    ;[minutes, seconds] = numbers
  } else {
    ;[seconds] = numbers
  }

  return (hours * 3600 + minutes * 60 + seconds) * 1000
}

export function formatRange(start: string, end: string): string {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const day = new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  }).format(startDate)
  const time = new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return `${day} ${time.format(startDate)}-${time.format(endDate)}`
}

export function durationMinutes(start: string, end: string): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000))
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (hours === 0) {
    return `${rest} 分`
  }

  if (rest === 0) {
    return `${hours} 小時`
  }

  return `${hours} 小時 ${rest} 分`
}

export function formatDuration(start: string, end: string): string {
  return formatMinutes(durationMinutes(start, end))
}

export type ListPeriod = 'day' | 'week'

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date)
  const weekday = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - weekday)
  return next
}

export function periodStart(iso: string, period: ListPeriod): Date {
  const date = new Date(iso)
  return period === 'week' ? startOfWeek(date) : startOfDay(date)
}

export function periodKey(iso: string, period: ListPeriod): string {
  const start = periodStart(iso, period)
  return `${period}:${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`
}

export function formatPeriodLabel(iso: string, period: ListPeriod): string {
  const start = periodStart(iso, period)
  const date = new Intl.DateTimeFormat('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  })

  if (period === 'week') {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    return `${date.format(start)} - ${date.format(end)}`
  }

  const weekday = new Intl.DateTimeFormat('zh-TW', { weekday: 'short' }).format(start)
  return `${date.format(start)}（${weekday}）`
}

export function formatTotalDuration(
  blocks: Array<{ startedAt: string; endedAt: string }>,
): string {
  const minutes = blocks.reduce((total, block) => total + durationMinutes(block.startedAt, block.endedAt), 0)
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return `合計 ${hours} 小時 ${rest} 分`
}
