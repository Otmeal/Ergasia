import type { EventInput } from '@fullcalendar/core'
import type { Tag, WorkBlock } from '../../types'
import { getReadableTextColor } from '../../utils/presentation'
import { trackingEventId } from './useWorkBlockEditor'

const defaultColor = '#2f9e8f'
const untaggedColor = '#9aa3a8'

export function createCalendarEvents(
  workBlocks: WorkBlock[],
  trackingStartedAt: Date | null,
  nowTick: number,
  trackingTagIds: string[],
  trackingTitle: string,
  tags: Tag[],
): EventInput[] {
  const events: EventInput[] = workBlocks.map((block) => {
    const color = block.tags[0]?.color ?? untaggedColor

    return {
      id: block.id,
      title: block.title,
      start: block.startedAt,
      end: block.endedAt,
      backgroundColor: color,
      borderColor: color,
      textColor: getReadableTextColor(color),
      extendedProps: { tagNames: block.tags.map((tag) => tag.name).join(' · ') },
    }
  })

  if (trackingStartedAt) {
    const trackingColor = tags.find((tag) => trackingTagIds.includes(tag.id))?.color
    events.push({
      id: trackingEventId,
      title: trackingTitle.trim() || '追蹤中…',
      start: trackingStartedAt.toISOString(),
      end: new Date(Math.max(nowTick, trackingStartedAt.getTime() + 1000)).toISOString(),
      borderColor: trackingColor ?? defaultColor,
      classNames: ['tracking-event'],
      editable: false,
    })
  }

  return events
}
