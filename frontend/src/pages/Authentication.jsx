import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole } from 'lucide-react'
import { useAuth } from '../context/auth'
import { api } from '../services/api'
import { Heading } from '../components/Common'

export default function Authentication({ password = false }) {
  const { user, setSession } = useAuth(),
    location = useLocation(),
    navigate = useNavigate()
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  if (!password && user)
    return (
      <Navigate
        replace
        to={
          user.must_change_password
            ? '/password'
            : location.state?.from || '/dashboard'
        }
        state={location.state}
      />
    )
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const form = Object.fromEntries(new FormData(e.target))
    try {
      const next = await api(password ? 'password/' : 'login/', {
        method: 'POST',
        body: form,
      })
      setSession(next)
      navigate(
        next.user.must_change_password
          ? '/password'
          : location.state?.from || '/dashboard',
        { replace: true, state: location.state },
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Heading
        kicker="Member access"
        title={password ? 'Change password' : 'Member sign in'}
        description={
          password
            ? 'Choose a password for your organization account.'
            : 'Use the account issued by your adviser or officer.'
        }
      />
      <form className="panel form auth-form" onSubmit={submit}>
        <LockKeyhole size={23} />
        {password ? (
          <label>
            Current password
            <input
              type="password"
              name="current_password"
              autoComplete="current-password"
              required
            />
          </label>
        ) : (
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
        )}
        <label>
          {password ? 'New password' : 'Password'}
          <input
            type="password"
            name={password ? 'new_password' : 'password'}
            autoComplete={password ? 'new-password' : 'current-password'}
            required
          />
        </label>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <button className="primary" disabled={busy}>
          {busy ? 'Please wait…' : password ? 'Save password' : 'Sign in'}
        </button>
      </form>
    </>
  )
}
