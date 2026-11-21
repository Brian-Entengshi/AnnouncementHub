import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  List,
  Clock3,
  MapPin,
} from 'lucide-react'
import { useData } from '../hooks/useData'
import { usePageState } from '../hooks/usePageState'
import { useValidFilter } from '../hooks/usePageResults'
import FilterForm from './FilterForm'
import { useAuth } from '../context/auth'
import { Heading, State, Badge, Empty } from './Common'
import { dateKey, day, todayKey, formatDate, formatTime } from '../utils/format'
import { isActiveEvent } from '../utils/events'
import MonthlyEventCalendar from './MonthlyEventCalendar'

function move(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}
function monday(date) {
  return move(date, -((date.getDay() + 6) % 7))
}

export default function Calendar({ availability = false }) {
  const { manager } = useAuth()
  const {
    params: searchParams,
    setParams,
    entryKey,
  } = usePageState(['view', 'date', 'venue'])
  const selected = searchParams.get('date')
  const cursor =
    selected &&
    /^\d{4}-\d{2}-\d{2}$/.test(selected) &&
    dateKey(day(selected)) === selected
      ? day(selected)
      : day(todayKey())
  const mode = searchParams.get('view') === 'month' ? 'month' : 'week'
  const all = manager && searchParams.get('drafts') === '1'
  const eventsOnly = searchParams.get('dates') === 'events'
  const venues = useData(availability ? 'venues/' : null, true)
  const venue = useValidFilter(
    searchParams,
    setParams,
    'venue',
    venues.data,
    (item) => String(item.id),
  )
  const status = availability ? searchParams.get('status') || '' : ''
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
  const start = mode === 'month' ? monday(monthStart) : monday(cursor)
  const days =
    mode === 'month'
      ? Math.ceil(
          (((monthStart.getDay() + 6) % 7) +
            new Date(
              cursor.getFullYear(),
              cursor.getMonth() + 1,
              0,
            ).getDate()) /
            7,
        ) * 7
      : 7
  const dates = Array.from({ length: days }, (_, i) => dateKey(move(start, i)))
  const params = new URLSearchParams({
    from: dates[0],
    to: dates.at(-1),
    ...(venue ? { venue } : {}),
    ...(status ? { status } : {}),
  })
  const q = useData(
    availability
      ? 'availability/?' + params
      : 'events/?' + (manager && all ? 'manage=1&' : '') + params,
    !availability,
  )
  function updateFilter(name, value, options) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setParams(next, options)
  }
  function setCursor(date) {
    updateFilter('date', dateKey(date), { replace: true })
  }
  function applyAvailability(filters) {
    setParams({ view: mode, ...filters })
  }
  function step(direction) {
    if (mode === 'week') {
      setCursor(move(cursor, 7 * direction))
      return
    }
    const nextMonth = cursor.getMonth() + direction
    const year = cursor.getFullYear()
    const lastDay = new Date(year, nextMonth + 1, 0).getDate()
    setCursor(
      new Date(year, nextMonth, Math.min(cursor.getDate(), lastDay), 12),
    )
  }
  return (
    <>
      <Heading
        kicker={availability ? 'Venue desk' : 'Organization'}
        title={availability ? 'Venue Availability' : 'Weekly Events'}
        description={
          availability
            ? 'Browse published events and notices for active venues.'
            : 'Browse the schedule by week or select a date on the monthly calendar.'
        }
      >
        {manager && !availability && (
          <Link className="button primary" to="/weekly-events/new">
            <Plus size={16} /> New event
          </Link>
        )}
      </Heading>
      {!availability && (
        <div
          className="filter-switch"
          role="group"
          aria-label="Event calendar view"
        >
          <button
            type="button"
            aria-pressed={mode === 'week'}
            onClick={() => updateFilter('view', 'week')}
          >
            <List size={17} /> Weekly View
          </button>
          <button
            type="button"
            aria-pressed={mode === 'month'}
            onClick={() => updateFilter('view', 'month')}
          >
            <CalendarDays size={17} /> Monthly Calendar View
          </button>
        </div>
      )}
      <div className="panel calendar">
        <div className="calendar-tools">
          <div className="actions">
            <button
              aria-label={
                mode === 'month' && !availability
                  ? 'Previous month'
                  : 'Previous period'
              }
              onClick={() => step(-1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCursor(day(todayKey()))}>Today</button>
            <button
              aria-label={
                mode === 'month' && !availability ? 'Next month' : 'Next period'
              }
              onClick={() => step(1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <b>
            {mode === 'month'
              ? cursor.toLocaleDateString('en-US', {
                  month: 'long',
                  year: 'numeric',
                })
              : formatDate(dates[0], { month: 'short', day: 'numeric' }) +
                ' – ' +
                formatDate(dates.at(-1))}
          </b>
          {!availability && (
            <input
              aria-label="Go to date"
              type="date"
              value={dateKey(cursor)}
              onChange={(event) => {
                if (event.target.value) setCursor(day(event.target.value))
              }}
            />
          )}
          {availability ? (
            <select
              aria-label="Calendar view"
              value={mode}
              onChange={(event) => updateFilter('view', event.target.value)}
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          ) : (
            <>
              {mode === 'week' && (
                <select
                  aria-label="Show dates"
                  value={eventsOnly ? 'events' : 'all'}
                  onChange={(e) => updateFilter('dates', e.target.value)}
                >
                  <option value="all">All Dates</option>
                  <option value="events">Dates With Events Only</option>
                </select>
              )}
              {manager && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={all}
                    onChange={(e) =>
                      updateFilter('drafts', e.target.checked ? '1' : '')
                    }
                  />
                  Include drafts
                </label>
              )}
            </>
          )}
        </div>
        {venues.error && (
          <div className="error">
            {venues.error} <button onClick={venues.reload}>Retry</button>
          </div>
        )}
        {availability && (
          <FilterForm
            key={entryKey}
            onApply={applyAvailability}
            onClear={() => applyAvailability({})}
            label="Availability filters"
          >
            <select
              name="venue"
              aria-label="Filter venue"
              key={venues.data ? 'venue-ready' : 'venue-loading'}
              defaultValue={venue}
            >
              <option value="">All venues</option>
              {venues.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              aria-label="Schedule type"
              defaultValue={status}
            >
              <option value="">All schedule entries</option>
              <option value="events">Published events</option>
              <option value="notices">Venue notices</option>
            </select>
            <label className="filter-date">
              Go to date{' '}
              <input
                aria-label="Go to date"
                name="date"
                type="date"
                defaultValue={selected || ''}
              />
            </label>
          </FilterForm>
        )}
        <State query={q}>
          {(data) => {
            if (!availability && mode === 'month') {
              return (
                <MonthlyEventCalendar
                  dates={dates}
                  events={data}
                  selected={dateKey(cursor)}
                  onSelect={setCursor}
                />
              )
            }
            const rows = availability
              ? data.events
              : eventsOnly
                ? data.filter(isActiveEvent)
                : data
            const visibleDates =
              !availability && eventsOnly
                ? dates.filter((date) =>
                    rows.some((event) => event.date === date),
                  )
                : dates
            if (!visibleDates.length)
              return <Empty>No scheduled events this week.</Empty>
            const notices = availability ? data.notices : []
            if (availability && !rows.length && !notices.length)
              return (
                <Empty>No published events or notices in this period.</Empty>
              )
            return (
              <div className={'calendar-days ' + mode}>
                {visibleDates.map((date) => {
                  const slot = rows.filter((r) => r.date === date),
                    alerts = notices.filter(
                      (n) =>
                        n.starts_at.slice(0, 10) <= date &&
                        n.ends_at.slice(0, 10) >= date,
                    )
                  return (
                    <section
                      key={date}
                      className={date === todayKey() ? 'today' : ''}
                    >
                      <h3>
                        {formatDate(date, { weekday: 'short' })}
                        <b>
                          {formatDate(date, { month: 'short', day: 'numeric' })}
                        </b>
                      </h3>
                      <div>
                        {slot.map((r) => {
                          const info = (
                            <>
                              <strong>{r.title}</strong>
                              <small className="slot-info">
                                <span>
                                  <Clock3 size={14} /> {formatTime(r.start)} –{' '}
                                  {formatTime(r.end)}
                                </span>
                                <span>
                                  <MapPin size={14} /> {r.venue_name}
                                </span>
                              </small>
                              <Badge
                                value={
                                  r.retired_venue
                                    ? 'retired venue'
                                    : r.published === false
                                      ? 'draft'
                                      : r.status
                                }
                              />
                            </>
                          )
                          return (
                            <Link
                              className="slot"
                              key={r.id}
                              to={'/weekly-events/' + r.id}
                            >
                              {info}
                            </Link>
                          )
                        })}
                        {alerts.map((n) => (
                          <Link
                            key={'n' + n.id}
                            className="slot closure"
                            to={'/venue-notices/' + n.id}
                          >
                            <strong>{n.title}</strong>
                            <small>
                              {n.venue_name} · 'Notice' ·{' '}
                              {formatTime(n.starts_at.slice(11, 19))} –{' '}
                              {formatTime(n.ends_at.slice(11, 19))}
                            </small>
                          </Link>
                        ))}
                        {!slot.length && !alerts.length && (
                          <small className="quiet">
                            {mode === 'week' ? 'No scheduled items' : '—'}
                          </small>
                        )}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          }}
        </State>
      </div>
      {availability && (
        <div className="actions calendar-links">
          <Link className="button" to="/venues">
            <List size={16} />
            Venue directory
          </Link>
          <Link className="button" to="/venue-notices">
            <CalendarDays size={16} />
            Venue notices
          </Link>
        </div>
      )}
      {!availability && manager && <EventDirectory />}
    </>
  )
}
function EventDirectory() {
  const q = useData('events/?manage=1', true)
  return (
    <section className="panel detail">
      <h2>Event management</h2>
      <State query={q}>
        {(rows) =>
          rows.length ? (
            rows.map((r) => (
              <Link
                className="list-row event-management-row"
                key={r.id}
                to={'/weekly-events/' + r.id}
              >
                <span>
                  {r.title}
                  <small>{formatDate(r.date)}</small>
                </span>
                <span className="event-management-action">
                  <Badge
                    value={
                      r.retired_venue
                        ? 'retired venue'
                        : r.published
                          ? r.status
                          : 'draft'
                    }
                  />
                  <ChevronRight size={17} aria-hidden="true" />
                </span>
              </Link>
            ))
          ) : (
            <Empty>No events recorded.</Empty>
          )
        }
      </State>
    </section>
  )
}
