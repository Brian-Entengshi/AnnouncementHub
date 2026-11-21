import { useCallback, useEffect, useRef, useState } from 'react'
import { AuthContext } from './auth'
import { api } from '../services/api'
import { clearUserDrafts } from '../hooks/drafts'

export default function AuthProvider({ children }) {
  const [session, updateSession] = useState({ loading: true })
  const pending = useRef(null)
  const setSession = useCallback((next) => {
    pending.current?.abort()
    updateSession(next)
  }, [])
  const refresh = useCallback(({ background = false } = {}) => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    return api('session/', { signal: controller.signal })
      .then((next) => {
        if (!controller.signal.aborted) updateSession(next)
      })
      .catch((error) => {
        if (!background && !controller.signal.aborted)
          updateSession({ error: error.message })
      })
      .finally(() => {
        if (pending.current === controller) pending.current = null
      })
  }, [])
  useEffect(() => {
    refresh()
    return () => pending.current?.abort()
  }, [refresh])
  const userId = session.user?.id
  useEffect(() => {
    if (!userId) return
    function revalidate() {
      if (document.visibilityState === 'visible') refresh({ background: true })
    }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => {
      window.removeEventListener('focus', revalidate)
      document.removeEventListener('visibilitychange', revalidate)
    }
  }, [userId, refresh])
  async function logout() {
    pending.current?.abort()
    const next = await api('logout/', { method: 'POST' })
    clearUserDrafts(session.user.id)
    return next
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
