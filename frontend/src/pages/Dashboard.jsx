import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CalendarCheck2,
  Clock3,
  Megaphone,
  MapPin,
  Users,
  Pin,
  Activity,
  ChevronRight,
  ShieldCheck,
  ClipboardList,
  BookOpen,
} from 'lucide-react'
import { useData } from '../hooks/useData'
import { Badge, State, Empty, Panel } from '../components/Common'
import { formatDate, formatTime } from '../utils/format'

function Metric({ icon: Icon, number, label, foot, color, to }) {
  return (
    <Link to={to} className="metric">
      <div className={'metric-icon ' + color}>
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{number}</strong>
      <small>{foot}</small>
    </Link>
  )
}
function EventRow({ event }) {
  return (
    <Link className="event-row" to={'/weekly-events/' + event.id}>
      <div className="date-tile">
        <small>{formatDate(event.date, { month: 'short' })}</small>
        <b>{event.date.slice(-2)}</b>
      </div>
      <div className="row-body">
        <h3>{event.title}</h3>
        <div className="metadata">
          <span>
            <Clock3 />
            {formatTime(event.start)}
          </span>
          <span>
            <MapPin />
            {event.venue_name}
          </span>
        </div>
      </div>
      <ChevronRight className="end-chevron" size={16} />
    </Link>
  )
}
export default function Dashboard() {
  const q = useData('dashboard/')
  return (
    <State query={q}>
      {(data) => (
        <>
          <section className="hero">
            <div className="hero-copy">
              <span className="hero-label">
                <ShieldCheck size={15} />
                DLL ELITE STUDENT HUB
              </span>
              <h1>Organization dashboard</h1>
              <p>
                Your overview of club events, announcements and campus spaces.
              </p>
              <Link to="/weekly-events" className="hero-cta">
                <CalendarDays size={16} />
                View weekly schedule
              </Link>
            </div>
            <img src="/brand/campus.png" alt="" className="campus-art" />
          </section>
          <div className="section-title">
            <h2>At a glance</h2>
            <small>Organization overview</small>
          </div>
          <div className="metrics">
            <Metric
              icon={CalendarDays}
              color="lime"
              number={data.counts.events}
              label="Upcoming events"
              foot="In the next 7 days"
              to="/weekly-events"
            />
            <Metric
              icon={Megaphone}
              color="blue"
              number={data.counts.announcements}
              label="Announcements"
              foot="Published updates"
              to="/announcements"
            />
            <Metric
              icon={MapPin}
              color="peach"
              number={data.counts.venues}
              label="Available venues"
              foot="Open for reservations"
              to="/venues"
            />
            {data.counts.pending === null ? (
              <Metric
                icon={Users}
                color="purple"
                number={data.counts.teams}
                label="Organization teams"
                foot="Across DLL Elite"
                to="/organization-teams"
              />
            ) : (
              <Metric
                icon={ClipboardList}
                color="purple"
                number={data.counts.pending}
                label="Pending requests"
                foot="Awaiting a decision"
                to="/reservations"
              />
            )}
          </div>
          <div className="dashboard-grid">
            <Panel
              title="Upcoming events"
              to="/weekly-events"
              action="View schedule"
              icon={CalendarDays}
            >
              {data.events.length ? (
                data.events.map((e) => <EventRow key={e.id} event={e} />)
              ) : (
                <Empty>No upcoming events.</Empty>
              )}
            </Panel>
            <Panel title="Announcements" to="/announcements" icon={Megaphone}>
              {data.announcements.length ? (
                data.announcements.map((a) => (
                  <Link
                    className="news-row"
                    to={'/announcements/' + a.id}
                    key={a.id}
                  >
                    <div className="news-meta">
                      {a.pinned ? (
                        <span className="pin">
                          <Pin size={12} />
                          Pinned
                        </span>
                      ) : (
                        <span>{a.category}</span>
                      )}
                      <small>
                        {formatDate(a.published_at, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </small>
                    </div>
                    <h3>{a.title}</h3>
                  </Link>
                ))
              ) : (
                <Empty>No published announcements.</Empty>
              )}
            </Panel>
            <Panel title="Venue notices" to="/venue-notices" icon={MapPin}>
              {data.notices.length ? (
                data.notices.map((n) => (
                  <Link
                    className="notice-row"
                    key={n.id}
                    to={'/venue-notices/' + n.id}
                  >
                    <div className="mini-icon peach">
                      <CalendarCheck2 size={18} />
                    </div>
                    <div>
                      <small>
                        {n.venue_name} · {formatDate(n.starts_at)}
                      </small>
                      <h3>{n.title}</h3>
                    </div>
                  </Link>
                ))
              ) : (
                <Empty>No current or upcoming notices.</Empty>
              )}
              <Link className="panel-foot" to="/availability">
                Check venue availability <ChevronRight size={14} />
              </Link>
            </Panel>
            <Panel
              title="Organization activities"
              to="/organization-activities"
              icon={Activity}
            >
              {data.activities.length ? (
                data.activities.map((a) => (
                  <Link
                    className="activity-row"
                    to={'/organization-activities/' + a.id}
                    key={a.id}
                  >
                    <BookOpen size={16} />
                    <span>{a.title}</span>
                    <Badge value={a.status} />
                  </Link>
                ))
              ) : (
                <Empty>No current or upcoming activities.</Empty>
              )}
            </Panel>
          </div>
        </>
      )}
    </State>
  )
}
