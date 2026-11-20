import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellDot, Bell } from 'lucide-react'
import { api } from '../services/api'
import { useData } from '../hooks/useData'
import { State, Empty, Heading } from '../components/Common'
import { stamp } from '../utils/format'

export default function Notifications() {
  const q = useData('notifications/', true),
    [error, setError] = useState('')
  async function mark(path) {
    setError('')
    try {
      await api('notifications/' + path + '/', { method: 'POST' })
      q.reload()
      window.dispatchEvent(new Event('elite:notifications'))
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <>
      <Heading kicker="Member workspace" title="Notifications">
        <button onClick={() => mark('read_all')}>Mark all as read</button>
      </Heading>
      {error && <p className="error">{error}</p>}
      <section
        className="panel notification-list"
        aria-label="Notification center"
      >
        <State query={q}>
          {(rows) =>
            rows.length ? (
              rows.map((r) => (
                <article
                  className={
                    'notification-entry ' + (r.read ? 'seen' : 'unread')
                  }
                  key={r.id}
                >
                  {r.read ? (
                    <Bell size={18} aria-hidden="true" />
                  ) : (
                    <BellDot size={18} aria-hidden="true" />
                  )}
                  <div>
                    <Link to={r.link}>{r.message}</Link>
                    <small>
                      {stamp(r.created_at)} · {r.read ? 'Read' : 'Unread'}
                    </small>
                  </div>
                  {!r.read && (
                    <button onClick={() => mark(r.id + '/read')}>
                      Mark read
                    </button>
                  )}
                </article>
              ))
            ) : (
              <Empty>No notifications yet.</Empty>
            )
          }
        </State>
      </section>
    </>
  )
}
