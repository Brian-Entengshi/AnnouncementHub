import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Clock3, MapPin } from 'lucide-react'
import { Badge, Empty } from './Common'
import { day, formatDate, formatTime, todayKey } from '../utils/format'
import { isActiveEvent } from '../utils/events'

const calendarWeekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fullDate = {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
}

export default function MonthlyEventCalendar({
  dates,
  events,
  selected,
  onSelect,
}) {
  const month = selected.slice(0, 7)
  const today = todayKey()
  const eventsByDay = events.reduce((days, event) => {
    const entries = (days[event.date] ||= [])
    entries.push(event)
    return days
  }, {})
  const selectedEvents = eventsByDay[selected] || []

  return (
    <div className="month-schedule">
      <section
        className="month-calendar"
        aria-label={
          formatDate(selected, { month: 'long', year: 'numeric' }) + ' calendar'
        }
      >
        <div className="month-grid">
          {calendarWeekdays.map((name) => (
            <span className="month-weekday" key={name}>
              {name}
            </span>
          ))}
          {dates.map((date) => {
            if (!date.startsWith(month))
              return (
                <span className="month-pad" key={date} aria-hidden="true" />
              )
            const activeCount = (eventsByDay[date] || []).filter(
              isActiveEvent,
            ).length
            return (
              <button
                key={date}
                type="button"
                className={'month-date' + (activeCount ? ' has-events' : '')}
                data-date={date}
                onClick={() => onSelect(day(date))}
                aria-current={date === today ? 'date' : undefined}
                aria-pressed={date === selected}
                aria-label={
                  formatDate(date, fullDate) +
                  (activeCount
                    ? ', ' +
                      activeCount +
                      ' scheduled ' +
                      (activeCount === 1 ? 'event' : 'events')
                    : '')
                }
              >
                <span className="month-day-number">
                  {Number(date.slice(-2))}
                </span>
                {activeCount > 0 && (
                  <span className="month-event-count" aria-hidden="true">
                    {activeCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="month-legend">
          <i aria-hidden="true" /> Scheduled events
        </p>
      </section>
      <section className="month-agenda" aria-label="Selected date events">
        <h2 aria-live="polite">
          <CalendarDays size={18} />
          {formatDate(selected, fullDate)}
        </h2>
        {selectedEvents.length ? (
          selectedEvents.map((event) => (
            <article className="month-event" key={event.id}>
              <div className="month-event-title">
                <h3>
                  <Link to={'/weekly-events/' + event.id}>
                    {event.title}
                    <ChevronRight size={15} aria-hidden="true" />
                  </Link>
                </h3>
                <Badge
                  value={
                    event.retired_venue
                      ? 'retired venue'
                      : event.published
                        ? event.status
                        : 'draft'
                  }
                />
              </div>
              <div className="slot-info">
                <span>
                  <Clock3 size={14} /> {formatTime(event.start)} –{' '}
                  {formatTime(event.end)}
                </span>
                {event.venue_name && (
                  <span>
                    <MapPin size={14} /> {event.venue_name}
                  </span>
                )}
              </div>
              {event.description && <p>{event.description}</p>}
              {event.activity_name && (
                <small>Activity · {event.activity_name}</small>
              )}
            </article>
          ))
        ) : (
          <Empty>No events scheduled for this date.</Empty>
        )}
      </section>
    </div>
  )
}
