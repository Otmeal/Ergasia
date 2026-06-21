import FullCalendar from '@fullcalendar/react'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import zhTwLocale from '@fullcalendar/core/locales/zh-tw'
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput, EventMountArg } from '@fullcalendar/core'

type CalendarPageProps = {
  events: EventInput[]
  onSelect: (selection: DateSelectArg) => void
  onEventDrop: (eventDrop: EventDropArg) => void
  onEventResize: (eventResize: EventResizeDoneArg) => void
  onEventClick: (eventClick: EventClickArg) => void
  onEventDidMount: (info: EventMountArg) => void
}

export function CalendarPage({
  events,
  onSelect,
  onEventDrop,
  onEventResize,
  onEventClick,
  onEventDidMount,
}: CalendarPageProps) {
  return (
    <div className="calendar-wrap">
      <FullCalendar
        allDaySlot={false}
        buttonText={{ today: '今天', week: '週', day: '日' }}
        editable
        eventClick={onEventClick}
        eventDidMount={onEventDidMount}
        eventDrop={onEventDrop}
        eventResize={onEventResize}
        events={events}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay',
        }}
        height="100%"
        initialView="timeGridWeek"
        locale={zhTwLocale}
        nowIndicator
        plugins={[timeGridPlugin, interactionPlugin]}
        select={onSelect}
        selectable
        selectMirror
        slotDuration="00:05:00"
        snapDuration="00:01:00"
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotMaxTime="22:00:00"
        slotMinTime="06:00:00"
      />
    </div>
  )
}
