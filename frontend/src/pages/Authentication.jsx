import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole, LogIn } from 'lucide-react'
import { useAuth } from '../context/auth'
import { api } from '../services/api'
import PasswordInput from '../components/PasswordInput'

export default function Authentication({ password = false }) {
  const { user, setSession } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const destination = location.state?.from || '/dashboard'

  if (!password && user) {
    return (
      <Navigate
        replace
        to={user.must_change_password ? '/password' : destination}
        state={location.state}
      />
    )
  }

  async function submit(e) {
    e.preventDefault()
    setError('')
    const form = Object.fromEntries(new FormData(e.currentTarget))
    if (password && form.new_password !== form.confirm_password) {
      setError('New passwords do not match.')
      return
    }
    delete form.confirm_password
    setBusy(true)
    try {
      const next = await api(password ? 'password/' : 'login/', {
        method: 'POST',
        body: form,
      })
      setSession(next)
      navigate(next.user.must_change_password ? '/password' : destination, {
        replace: true,
        state: location.state,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel auth-card" aria-labelledby="auth-heading">
      <header>
        <img
          src="/brand/seal.png"
          alt="DLL Elite seal"
          width="60"
          height="60"
        />
        <div>
          <small className="eyebrow">DLL Elite</small>
          <h1 id="auth-heading">
            {password ? 'Change password' : 'Member sign in'}
          </h1>
        </div>
      </header>
      <div className="auth-body">
        <p className="quiet">
          {password
            ? user.must_change_password
              ? 'Choose a permanent password to access the member workspace.'
              : 'Update the password for your organization account.'
            : 'Use the account issued by your adviser or officer.'}
        </p>
        <form className="form auth-form" onSubmit={submit}>
          {password ? (
            <label>
              Current password
              <PasswordInput
                label="Current password"
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
            <PasswordInput
              label={password ? 'New password' : 'Password'}
              name={password ? 'new_password' : 'password'}
              autoComplete={password ? 'new-password' : 'current-password'}
              required
            />
          </label>
          {password && (
            <label>
              Confirm password
              <PasswordInput
                label="Confirm password"
                name="confirm_password"
                autoComplete="new-password"
                required
              />
            </label>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            {password ? <LockKeyhole size={17} /> : <LogIn size={17} />}
            {busy ? 'Please wait…' : password ? 'Save password' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  )
}
