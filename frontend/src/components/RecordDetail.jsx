import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Archive, Pencil, Trash2, ExternalLink, Paperclip } from 'lucide-react'
import { useData } from '../hooks/useData'
import { useAuth } from '../context/auth'
import { api } from '../services/api'
import { Badge, Heading, State } from './Common'
import { formatDate, formatTime, human, stamp } from '../utils/format'
import ConfirmDelete from './ConfirmDelete'
import ConfirmAction from './ConfirmAction'

const metadata = [
  'category',
  'author_name',
  'published_at',
  'expires',
  'venue_name',
  'location',
  'capacity',
  'available',
  'archived',
  'date',
  'start',
  'end',
  'assigned_teams',
  'contact',
  'activity_name',
  'start_date',
  'end_date',
  'starts_at',
  'ends_at',
  'publication_status',
  'is_public',
  'username',
  'email',
  'role',
  'position',
  'is_active',
  'published',
]
function display(k, v) {
  if (k === 'is_public') return v ? 'Public' : 'Members only'
  if (k === 'assigned_teams')
    return v
      .map(({ name, is_active }) => name + (is_active ? '' : ' (inactive)'))
      .join(', ')
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (['start', 'end'].includes(k)) return formatTime(v)
  if (k.endsWith('_at')) return stamp(v)
  if (['date', 'expires', 'start_date', 'end_date'].includes(k))
    return formatDate(v)
  return v
}
export default function RecordDetail({ config: c, id }) {
  const { manager, adviser } = useAuth(),
    navigate = useNavigate()
  const { state } = useLocation()
  const q = useData(c.api + '/' + id + '/' + (manager ? '?manage=1' : ''))
  const [error, setError] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false)
  const path = '/' + c.path
  async function remove() {
    setBusy(true)
    setError('')
    try {
      const result =
        confirm === 'archive'
          ? await api(c.api + '/' + id + '/archive/', { method: 'POST' })
          : await api(c.api + '/' + id + '/?manage=1', { method: 'DELETE' })
      navigate(path, {
        state: {
          notice: result?.detail || c.singular + ' deleted successfully.',
        },
      })
    } catch (e) {
      setError(e.message)
      setConfirm('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <State query={q}>
      {(item) => (
        <>
          <Heading
            kicker={c.singular}
            title={item.title || item.name || item.full_name || item.username}
          >
            {manager && !(c.api === 'notices' && item.venue === null) && (
              <Link className="button" to={path + '/' + id + '/edit'}>
                <Pencil size={16} />
                Edit
              </Link>
            )}
          </Heading>
          {state?.notice && (
            <p className="success-notice" role="status">
              {state.notice}
            </p>
          )}
          <section className="panel detail">
            {(item.retired_venue ||
              (c.api === 'notices' && item.venue === null)) && (
              <p className="historical-note">
                Retired venue. The original venue name is preserved for this
                record.
              </p>
            )}
            {c.api === 'venues' && (
              <Badge
                value={
                  item.archived
                    ? 'archived'
                    : item.available
                      ? 'active'
                      : 'inactive'
                }
              />
            )}
            {item.status && <Badge value={item.status} />}{' '}
            {c.api === 'teams' && (
              <Link className="text-link" to={path}>
                Back to organization teams
              </Link>
            )}
            {item.image && (
              <img className="record-image" src={item.image} alt={item.title} />
            )}
            {item.description && (
              <p className="body-copy">{item.description}</p>
            )}
            <dl>
              {metadata
                .filter(
                  (k) =>
                    item[k] !== undefined &&
                    item[k] !== null &&
                    item[k] !== '' &&
                    (!Array.isArray(item[k]) || item[k].length > 0),
                )
                .map((k) => (
                  <div key={k}>
                    <dt>
                      {k === 'is_public'
                        ? 'Visibility'
                        : human(k.replace('_name', ''))}
                    </dt>
                    <dd>{display(k, item[k])}</dd>
                  </div>
                ))}
            </dl>
            {item.attachment && (
              <a className="button" href={item.attachment}>
                <Paperclip size={16} />
                Download attachment
              </a>
            )}
            {item.url && (
              <a
                className="button"
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
                Open resource
              </a>
            )}
            {c.api === 'venues' && (
              <div className="actions">
                <Link
                  className="button"
                  to={
                    '/venues?status=' +
                    (item.archived
                      ? 'archived'
                      : item.available
                        ? 'active'
                        : 'inactive')
                  }
                >
                  Back to venues
                </Link>
                {item.available && !item.archived && (
                  <Link
                    className="button"
                    to={'/availability?venue=' + item.id}
                  >
                    Check availability
                  </Link>
                )}
              </div>
            )}
            {manager &&
              (c.api !== 'venues' || adviser) &&
              c.api !== 'accounts' && (
                <div className="detail-footer">
                  {c.api === 'venues' && !item.archived && (
                    <button onClick={() => setConfirm('archive')}>
                      <Archive size={15} />
                      Archive venue
                    </button>
                  )}
                  <button
                    className="danger"
                    onClick={() => setConfirm('delete')}
                  >
                    <Trash2 size={15} />
                    Delete {c.singular.toLowerCase()}
                  </button>
                </div>
              )}
            {confirm === 'archive' && (
              <ConfirmAction
                title="Archive this venue?"
                label="Archive venue"
                busy={busy}
                cancel={() => setConfirm('')}
                confirm={remove}
              >
                Existing events and notices will be kept. The venue will leave
                the active schedule.
              </ConfirmAction>
            )}
            {confirm === 'delete' && (
              <ConfirmDelete
                name={c.singular.toLowerCase()}
                cancel={() => setConfirm('')}
                busy={busy}
                confirm={remove}
              />
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>
        </>
      )}
    </State>
  )
}
