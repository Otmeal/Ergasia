import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WorkBlock } from '../../types'
import { durationMinutes, formatMinutes } from '../../utils/dateTime'

type StatsPreset = 'day' | 'week' | 'month' | 'custom'

type StatsRange = {
  fromInput: string
  toInput: string
}

type TagStat = {
  id: string | null
  name: string
  color: string | null
  minutes: number
}

type DayPoint = {
  key: string
  minutes: number
}

const UNTAGGED_KEY = '__untagged__'

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

function toDateInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10)
}

function fromDateInput(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function dayLabel(key: string): string {
  const [, month, day] = key.split('-')
  return `${Number(month)}/${Number(day)}`
}

function presetRange(preset: Exclude<StatsPreset, 'custom'>): StatsRange {
  const now = new Date()

  if (preset === 'day') {
    const from = startOfDay(now)
    return { fromInput: toDateInput(from), toInput: toDateInput(from) }
  }

  if (preset === 'week') {
    const from = startOfWeek(now)
    const to = new Date(from)
    to.setDate(to.getDate() + 6)
    return { fromInput: toDateInput(from), toInput: toDateInput(to) }
  }

  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return { fromInput: toDateInput(from), toInput: toDateInput(to) }
}

function buildStats(workBlocks: WorkBlock[], range: StatsRange) {
  const fromDate = fromDateInput(range.fromInput)
  const toEnd = fromDateInput(range.toInput)
  toEnd.setDate(toEnd.getDate() + 1)
  const from = fromDate.getTime()
  const to = toEnd.getTime()

  const stats = new Map<string, TagStat>()
  const dailyMap = new Map<string, number>()
  let totalMinutes = 0

  for (const block of workBlocks) {
    const startedDate = new Date(block.startedAt)
    const started = startedDate.getTime()
    if (Number.isNaN(started) || started < from || started >= to) {
      continue
    }

    const minutes = durationMinutes(block.startedAt, block.endedAt)
    totalMinutes += minutes

    const dayKey = toDateInput(startedDate)
    dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + minutes)

    const buckets =
      block.tags.length > 0
        ? block.tags.map((tag) => ({ key: tag.id, id: tag.id, name: tag.name, color: tag.color }))
        : [{ key: UNTAGGED_KEY, id: null, name: '未分類', color: null }]

    for (const bucket of buckets) {
      let stat = stats.get(bucket.key)
      if (!stat) {
        stat = { id: bucket.id, name: bucket.name, color: bucket.color, minutes: 0 }
        stats.set(bucket.key, stat)
      }
      stat.minutes += minutes
    }
  }

  const rows = [...stats.values()].sort((a, b) => b.minutes - a.minutes)
  const maxMinutes = rows.reduce((max, row) => Math.max(max, row.minutes), 0)

  const days: DayPoint[] = []
  for (const cursor = new Date(fromDate); cursor.getTime() < to; cursor.setDate(cursor.getDate() + 1)) {
    const key = toDateInput(cursor)
    days.push({ key, minutes: dailyMap.get(key) ?? 0 })
  }

  return { rows, totalMinutes, maxMinutes, days }
}

type DailyChartProps = {
  days: DayPoint[]
}

function compactMinutes(minutes: number): string {
  if (minutes >= 60) {
    const hours = minutes / 60
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
  }
  return `${minutes}m`
}

function DailyChart({ days }: DailyChartProps) {
  const data = days.map((day) => ({ ...day, label: dayLabel(day.key) }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          minTickGap={16}
        />
        <YAxis
          width={44}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
          tickFormatter={compactMinutes}
        />
        <Tooltip
          cursor={{ stroke: 'var(--border)' }}
          formatter={(value) => [formatMinutes(Number(value) || 0), '時數']}
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
          }}
          labelStyle={{ color: 'var(--text-strong)' }}
        />
        <Line
          type="monotone"
          dataKey="minutes"
          name="時數"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: 'var(--accent)' }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

type StatisticsPageProps = {
  workBlocks: WorkBlock[]
}

const PRESETS: Array<{ value: Exclude<StatsPreset, 'custom'>; label: string }> = [
  { value: 'day', label: '當日' },
  { value: 'week', label: '當週' },
  { value: 'month', label: '當月' },
]

export function StatisticsPage({ workBlocks }: StatisticsPageProps) {
  const [preset, setPreset] = useState<StatsPreset>('month')
  const [range, setRange] = useState<StatsRange>(() => presetRange('month'))

  const { rows, totalMinutes, maxMinutes, days } = useMemo(
    () => buildStats(workBlocks, range),
    [workBlocks, range],
  )

  function selectPreset(next: Exclude<StatsPreset, 'custom'>) {
    setPreset(next)
    setRange(presetRange(next))
  }

  function editFrom(value: string) {
    setPreset('custom')
    setRange((current) => ({ ...current, fromInput: value }))
  }

  function editTo(value: string) {
    setPreset('custom')
    setRange((current) => ({ ...current, toInput: value }))
  }

  const invalidRange = range.fromInput > range.toInput

  return (
    <div className="stats-wrap">
      <div className="stats-controls">
        <div className="stats-presets" role="group" aria-label="統計範圍">
          {PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`icon-button ${preset === value ? 'active' : ''}`}
              onClick={() => selectPreset(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="stats-range">
          <label>
            <span>起</span>
            <input
              type="date"
              value={range.fromInput}
              max={range.toInput}
              onChange={(event) => editFrom(event.target.value)}
            />
          </label>
          <span className="stats-range-sep">—</span>
          <label>
            <span>迄</span>
            <input
              type="date"
              value={range.toInput}
              min={range.fromInput}
              onChange={(event) => editTo(event.target.value)}
            />
          </label>
        </div>
      </div>

      <p className="stats-total">
        總時數 <span>{formatMinutes(totalMinutes)}</span>
      </p>

      {invalidRange ? (
        <p className="empty-state">起始日期不可晚於結束日期。</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">此期間尚無時間區塊。</p>
      ) : (
        <>
          {days.length >= 2 ? (
            <div className="stats-chart">
              <h3 className="stats-chart-title">每日時數</h3>
              <DailyChart days={days} />
            </div>
          ) : null}

          <table className="stats-table">
            <thead>
              <tr>
                <th>標籤</th>
                <th>占比</th>
                <th>時數</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ratio = totalMinutes > 0 ? row.minutes / totalMinutes : 0
                const barWidth = maxMinutes > 0 ? (row.minutes / maxMinutes) * 100 : 0
                const color = row.color ?? 'var(--muted)'

                return (
                  <tr key={row.id ?? UNTAGGED_KEY}>
                    <td>
                      <span className="tag-pill" style={{ borderColor: color }}>
                        <span className="color-dot" style={{ backgroundColor: color }} />
                        {row.name}
                      </span>
                    </td>
                    <td className="stats-bar-cell">
                      <span className="stats-bar-track">
                        <span
                          className="stats-bar-fill"
                          style={{ width: `${barWidth}%`, backgroundColor: color }}
                        />
                      </span>
                      <span className="stats-bar-percent">{Math.round(ratio * 100)}%</span>
                    </td>
                    <td>{formatMinutes(row.minutes)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
