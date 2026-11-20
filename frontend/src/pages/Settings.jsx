import { useState } from 'react'
import { useData } from '../hooks/useData'
import { api } from '../services/api'
import { Heading, State } from '../components/Common'
export default function Settings() {
  const q = useData('settings/'),
    [feedback, setFeedback] = useState(null)
  async function save(e) {
    e.preventDefault()
    setFeedback(null)
    try {
      await api('settings/', {
        method: 'PATCH',
        body: Object.fromEntries(new FormData(e.target)),
      })
      setFeedback({ message: 'Organization settings saved.' })
      q.reload()
    } catch (err) {
      setFeedback({ message: err.message, error: true })
    }
  }
  return (
    <>
      <Heading
        kicker="Administration"
        title="Organization settings"
        description="Update the contact details shown in Student Access Hub Help."
      />
      <State query={q}>
        {(r) => (
          <form className="panel form" onSubmit={save}>
            <label>
              Contact email
              <input
                type="email"
                name="contact_email"
                defaultValue={r.contact_email}
              />
            </label>
            <label>
              Office hours
              <input name="office_hours" defaultValue={r.office_hours} />
            </label>
            <button className="primary">Save settings</button>
          </form>
        )}
      </State>
      {feedback && (
        <p
          role={feedback.error ? 'alert' : 'status'}
          className={feedback.error ? 'error' : 'settings-feedback'}
        >
          {feedback.message}
        </p>
      )}
    </>
  )
}
