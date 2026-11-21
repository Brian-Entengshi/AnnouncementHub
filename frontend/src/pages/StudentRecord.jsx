import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Paperclip, UserRound } from 'lucide-react'
import { Badge, State } from '../components/Common'
import PublicSchedule from '../components/PublicSchedule'
import { useData } from '../hooks/useData'
import { formatDate, stamp } from '../utils/format'

function EventNotices({ event }) {
  const query = useData(
    event.venue
      ? 'notices/?' +
          new URLSearchParams({
            public: '1',
            venue_id: event.venue,
            from: event.date,
            to: event.date,
          })
      : null,
  )
  const notices = query.data?.results
  if (!notices?.length) return null
  return (
    <section className="public-record-notices">
      <h2>Venue notices for this date</h2>
      {notices.map((notice) => (
        <article key={notice.id}>
          <h3>{notice.title}</h3>
          <p>
            {stamp(notice.starts_at)} – {stamp(notice.ends_at)}
          </p>
          <p>{notice.description}</p>
        </article>
      ))}
    </section>
  )
}

export default function StudentRecord({ event = false }) {
  const { id } = useParams()
  const section = event ? 'events' : 'announcements'
  const query = useData(section + '/' + id + '/?public=1')
  return (
    <section className="public-width public-record">
      <Link className="public-text-link" to={'/student#' + section}>
        <ArrowLeft size={16} /> {event ? 'Club Events' : 'Announcements'}
      </Link>
      {query.status === 404 ? (
        <h1>{event ? 'Event' : 'Announcement'} unavailable</h1>
      ) : (
        <State query={query}>
          {(item) => (
            <article>
              {event ? (
                <Badge value={item.status} />
              ) : (
                <span className="public-category">{item.category}</span>
              )}
              <h1>{item.title}</h1>
              {event ? (
                <PublicSchedule event={item} />
              ) : (
                <div className="public-announcement-byline">
                  <time dateTime={item.published_at}>
                    <CalendarDays size={15} aria-hidden="true" />{' '}
                    {formatDate(item.published_at)}
                  </time>
                  <span>
                    <UserRound size={15} aria-hidden="true" /> Posted by{' '}
                    {item.author_name}
                  </span>
                </div>
              )}
              {item.image && (
                <img className="public-record-image" src={item.image} alt="" />
              )}
              {event && <h2>About this event</h2>}
              <p className="public-record-copy">{item.description}</p>
              {item.attachment && (
                <a className="public-text-link" href={item.attachment}>
                  <Paperclip size={16} /> Download attachment
                </a>
              )}
              {event && <EventNotices event={item} />}
            </article>
          )}
        </State>
      )}
    </section>
  )
}
