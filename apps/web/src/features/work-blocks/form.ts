import type { WorkBlock, WorkBlockPayload } from '../../types'
import { addMinutes, roundToNextQuarter, toDateTimeLocal } from '../../utils/dateTime'
import type { BlockForm } from './types'

export function createEmptyBlockForm(start?: Date, end?: Date): BlockForm {
  const startedAt = start ?? roundToNextQuarter(new Date())
  const endedAt = end && end > startedAt ? end : addMinutes(startedAt, 30)

  return {
    title: '',
    notes: '',
    startedAt: toDateTimeLocal(startedAt),
    endedAt: toDateTimeLocal(endedAt),
    tagIds: [],
  }
}

export function blockToForm(block: WorkBlock): BlockForm {
  return {
    title: block.title,
    notes: block.notes ?? '',
    startedAt: toDateTimeLocal(new Date(block.startedAt)),
    endedAt: toDateTimeLocal(new Date(block.endedAt)),
    tagIds: block.tags.map((tag) => tag.id),
  }
}

export function formToPayload(form: BlockForm): WorkBlockPayload {
  const title = form.title.trim()
  const startedAt = new Date(form.startedAt)
  const endedAt = new Date(form.endedAt)

  if (!title) {
    throw new Error('標題不可為空。')
  }

  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    throw new Error('時間格式不正確。')
  }

  if (endedAt <= startedAt) {
    throw new Error('結束時間須晚於開始時間。')
  }

  return {
    title,
    notes: form.notes,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    tagIds: form.tagIds,
  }
}
