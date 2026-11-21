import { CalendarDays, Clock3, MapPin, UserRound } from 'lucide-react'
import { formatDate, formatTime } from '../utils/format'

export default function PublicSchedule({ event }) {
  return (
    <ul className="public-metadata" aria-label="Event schedule">
      <li>
        <CalendarDays size={16} aria-hidden="true" />{' '}
        <time dateTime={event.date}>
          {formatDate(event.date, {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </time>
      </li>
      <li>
        <Clock3 size={16} aria-hidden="true" /> {formatTime(event.start)} –{' '}
        {formatTime(event.end)} PHT
      </li>
      <li>
        <MapPin size={16} aria-hidden="true" /> {event.venue_name}
      </li>
      <li>
        <UserRound size={16} aria-hidden="true" /> Posted by {event.author_name}
      </li>
    </ul>
  )
}
