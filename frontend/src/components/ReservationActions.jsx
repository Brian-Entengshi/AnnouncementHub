import { useState } from 'react'
import { useAuth } from '../context/auth'
import { api } from '../services/api'
import { Badge } from './Common'
import { stamp } from '../utils/format'

export default function ReservationActions({ item, reload }) {
  const { adviser, manager, user } = useAuth()
  const [status, setStatus] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const allowed =
    item.status === 'pending'
      ? manager && (adviser || item.requester !== user.id)
        ? ['approved', 'rejected', 'cancelled']
        : ['cancelled']
      : item.status === 'approved'
        ? manager
          ? ['completed', 'cancelled']
          : ['cancelled']
        : []
  const labels = {
    approved: 'Approve',
    rejected: 'Reject',
    cancelled: 'Cancel booking',
    completed: 'Mark completed',
  }
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('reservations/' + item.id + '/transition/', {
        method: 'POST',
        body: { status, reason },
      })
      reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="panel detail">
      <h2>Reservation history</h2>
      {item.history.map((h, i) => (
        <div className="history" key={i}>
          <Badge value={h.status} />
          <span>
            {h.actor} · {stamp(h.at)}
            {h.reason && <p>{h.reason}</p>}
          </span>
        </div>
      ))}
      {allowed.length > 0 && (
        <form onSubmit={submit}>
          <div className="actions">
            {allowed.map((s) => (
              <button
                type="button"
                className={s === status ? 'primary' : ''}
                onClick={() => setStatus(s)}
                key={s}
              >
                {labels[s]}
              </button>
            ))}
          </div>
          {status && (
            <>
              <label>
                Decision note {status === 'rejected' && '*'}
                <textarea
                  required={status === 'rejected'}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button disabled={busy} className="primary">
                Confirm {labels[status].toLowerCase()}
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
