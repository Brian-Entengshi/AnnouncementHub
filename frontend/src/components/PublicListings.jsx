import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Megaphone,
  Pin,
  UserRound,
} from 'lucide-react'
import { useData } from '../hooks/useData'
import { formatDate } from '../utils/format'
import { Badge, Empty, State } from './Common'
import FilterForm, { SearchField } from './FilterForm'
import PageControls from './PageControls'
import PublicSchedule from './PublicSchedule'

export function PublicClubEvents() {
  const query = useData('events/?public=1&upcoming=1', true)
  return (
    <section id="events" className="public-section">
      <div className="public-width">
        <div className="public-section-heading">
          <h2>Club Events</h2>
          <p>Upcoming activities, times, and places.</p>
        </div>
        <State query={query}>
          {(events) =>
            events.length ? (
              <div className="public-event-grid">
                {events.map((event) => (
                  <article className="public-card public-event" key={event.id}>
                    {event.image && (
                      <img src={event.image} alt="" loading="lazy" />
                    )}
                    <div className="public-card-body">
                      <Badge value={event.status} />
                      <h3>
                        <Link to={'/student/events/' + event.id}>
                          {event.title}
                        </Link>
                      </h3>
                      <PublicSchedule event={event} />
                      <p className="public-summary">{event.description}</p>
                      <Link
                        className="public-text-link"
                        to={'/student/events/' + event.id}
                        aria-label={'View event details for ' + event.title}
                      >
                        Event details <ArrowRight size={16} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty>No upcoming Club Events have been published.</Empty>
            )
          }
        </State>
      </div>
    </section>
  )
}

function PublicAnnouncementCard({ item, featured = false }) {
  const path = '/student/announcements/' + item.id
  return (
    <article
      className={
        'public-card public-announcement' +
        (featured ? ' public-announcement-featured' : '')
      }
    >
      {item.image && (
        <div className="public-announcement-media">
          <img src={item.image} alt="" loading="lazy" />
        </div>
      )}
      {featured && !item.image && (
        <div className="public-announcement-emblem" aria-hidden="true">
          <Megaphone size={58} strokeWidth={1.25} />
        </div>
      )}
      <div className="public-card-body">
        <div className="public-announcement-tags">
          {featured && (
            <span className="public-pinned">
              <Pin size={14} aria-hidden="true" /> Pinned announcement
            </span>
          )}
          <span className="public-category">{item.category}</span>
        </div>
        <h3>
          <Link to={path}>{item.title}</Link>
        </h3>
        <div className="public-announcement-byline">
          <time dateTime={item.published_at}>
            <CalendarDays size={15} aria-hidden="true" />{' '}
            {formatDate(item.published_at)}
          </time>
          <span>
            <UserRound size={15} aria-hidden="true" /> {item.author_name}
          </span>
        </div>
        <p className="public-summary">{item.description}</p>
        <Link
          to={path}
          className="public-text-link"
          aria-label={'Read announcement: ' + item.title}
        >
          Read announcement <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

export function PublicAnnouncements({ highlightPinned }) {
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [formKey, setFormKey] = useState(0)
  const categories = useData('announcements/categories/?public=1')
  const params = new URLSearchParams({ ...filters, public: '1', page })
  const query = useData('announcements/?' + params)
  function apply(next) {
    setFilters(next)
    setPage(1)
  }
  return (
    <section
      id="announcements"
      className="public-section public-tinted public-announcements"
    >
      <div className="public-width">
        <div className="public-section-heading">
          <h2>Announcements</h2>
          <p>Latest updates from DLL Elite.</p>
        </div>
        <FilterForm
          key={formKey}
          onApply={apply}
          onClear={() => {
            apply({})
            setFormKey(formKey + 1)
          }}
        >
          <SearchField
            label="Search announcements"
            placeholder="Search announcements"
            value={filters.search}
          />
          <select
            name="category"
            aria-label="Announcement category"
            defaultValue={filters.category || ''}
          >
            <option value="">All categories</option>
            {categories.data?.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </FilterForm>
        <State query={query}>
          {({ results, count, next, previous }) => {
            if (!results.length)
              return <Empty>No announcements match these filters.</Empty>
            const featured =
              highlightPinned && page === 1
                ? results.find((item) => item.pinned)
                : null
            const remaining = results.filter((item) => item.id !== featured?.id)
            return (
              <>
                <div className="public-announcement-feed">
                  {featured && (
                    <PublicAnnouncementCard item={featured} featured />
                  )}
                  {remaining.length > 0 && (
                    <div className="public-announcement-list">
                      {remaining.map((item) => (
                        <PublicAnnouncementCard item={item} key={item.id} />
                      ))}
                    </div>
                  )}
                </div>
                {(next || previous) && (
                  <PageControls
                    {...{ page, count, next, previous }}
                    onPage={setPage}
                    resource="Announcement"
                  />
                )}
              </>
            )
          }}
        </State>
      </div>
    </section>
  )
}
