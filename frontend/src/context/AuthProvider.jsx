import { useEffect, useState } from 'react'
import { AuthContext } from './auth'
import { api } from '../services/api'
import { clearUserDrafts } from '../hooks/drafts'

export default function AuthProvider({ children }) {
  const [session, setSession] = useState({ loading: true })
  const refresh = () =>
    api('session/')
      .then(setSession)
      .catch((error) => setSession({ error: error.message }))
  useEffect(() => {
    refresh()
  }, [])
  async function logout() {
    const next = await api('logout/', { method: 'POST' })
    clearUserDrafts(session.user.id)
    setSession(next)
  }
  const user = session.user
  return (
    <AuthContext.Provider
      value={{
        ...session,
        setSession,
        refresh,
        logout,
        manager: ['officer', 'adviser'].includes(user?.role),
        adviser: user?.role === 'adviser',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
