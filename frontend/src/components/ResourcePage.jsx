import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Plus, ExternalLink, Pin, MapPin, FileText } from 'lucide-react'
import { useAuth } from '../context/auth'
import { usePageState } from '../hooks/usePageState'
import { usePageResults } from '../hooks/usePageResults'
import ResourceFilters from './ResourceFilters'
import PageControls from './PageControls'
import { Heading, State, Empty, Badge } from './Common'
import { formatDate, human } from '../utils/format'
import RecordDetail from './RecordDetail'
import RecordForm from './RecordForm'
export function ResourceList({ config: c }) {
  const { manager, adviser } = useAuth()
  const location = useLocation()
  const [notice] = useState(location.state?.notice)
  const { params, setParams, entryKey } = usePageState(
    c.api === 'venues' ? ['status', 'page'] : ['page'],
  )
  const venueStatus = params.get('status') || 'active'
  const showVenueFilters = c.api === 'venues' && manager
  const path = '/' + c.path
  const apiParams = new URLSearchParams(params)
  if (manager) apiParams.set('manage', '1')
  const { query, page, setPage } = usePageResults(
    c.api + '/?' + apiParams,
    params,
    setParams,
  )
  function selectVenueStatus(status) {
    const next = new URLSearchParams(params)
    next.set('status', status)
    next.delete('page')
    setParams(next)
  }
  const canAdd = manager && (c.api !== 'venues' || adviser)
  const createLabel =
    {
      announcements: 'Create Announcement',
      venues: 'Add Venue',
    }[c.api] || 'New ' + c.singular.toLowerCase()
  return (
    <>
      <Heading kicker={c.group} title={c.name} description={c.description}>
        {canAdd && (
          <Link className="button primary" to={path + '/new'}>
            <Plus size={17} />
            {createLabel}
          </Link>
        )}
      </Heading>
      {showVenueFilters && (
        <div className="filter-switch" role="group" aria-label="Venue status">
          {['active', 'inactive', 'archived'].map((status) => (
            <button
              type="button"
              key={status}
              aria-pressed={venueStatus === status}
              onClick={() => selectVenueStatus(status)}
            >
              {human(status)} venues
            </button>
          ))}
        </div>
      )}
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <ResourceFilters
        config={c}
        manager={manager}
        params={params}
        setParams={setParams}
        entryKey={entryKey}
      />
      <State query={query}>
        {({ results, count, next, previous }) => (
          <>
            {' '}
            <div className={'record-grid records-' + c.api}>
              {results.map((r) => (
                <article
                  className={
                    'panel record-card' + (r.pinned ? ' is-pinned' : '')
                  }
                  key={r.id}
                >
                  {r.image && (
                    <img className="card-image" src={r.image} alt="" />
                  )}
                  <div className="card-meta">
                    {r.pinned ? (
                      <Pin size={16} />
                    ) : c.api === 'venues' ? (
                      <MapPin size={18} />
                    ) : (
                      <FileText size={16} />
                    )}
                    <span>{r.category || r.role || c.singular}</span>
                    {c.api === 'links' && manager && (
                      <Badge value={r.is_public ? 'public' : 'members only'} />
                    )}
                    {r.pinned && <span className="featured-label">Pinned</span>}
                    {r.status && <Badge value={r.status} />}
                    {c.api === 'venues' && (
                      <Badge
                        value={
                          r.archived
                            ? 'archived'
                            : r.available
                              ? 'active'
                              : 'inactive'
                        }
                      />
                    )}
                  </div>
                  <h2>
                    <Link to={path + '/' + r.id}>
                      {r.title || r.name || r.full_name || r.username}
                    </Link>
                  </h2>
                  <p>{r.description || r.position || r.location}</p>
                  <div className="record-foot">
                    {r.date || r.start_date || r.published_at || r.starts_at
                      ? [
                          formatDate(
                            r.date ||
                              r.start_date ||
                              r.published_at ||
                              r.starts_at,
                          ),
                          (r.end_date || r.ends_at) &&
                            formatDate(r.end_date || r.ends_at),
                          r.venue_name,
                          r.author_name,
                        ]
                          .filter(Boolean)
                          .join(' · ')
                      : r.capacity
                        ? r.capacity + ' seats'
                        : r.team_name || ''}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer">
                        Open link <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!results.length && <Empty>No matching records.</Empty>}
            <PageControls
              page={page}
              count={count}
              next={next}
              previous={previous}
              onPage={setPage}
              resource={c.singular}
            />
          </>
        )}
      </State>
    </>
  )
}
export default function ResourcePage({ config, list: List = ResourceList }) {
  const { id } = useParams(),
    { pathname } = useLocation()
  if (pathname.endsWith('/new') || pathname.endsWith('/edit'))
    return <RecordForm config={config} id={id} />
  if (id) return <RecordDetail key={id} config={config} id={id} />
  return <List config={config} />
}
