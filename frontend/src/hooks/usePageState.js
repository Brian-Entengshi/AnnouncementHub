import { useCallback, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

export function readPageState(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key))
  } catch {
    return null
  }
}

export function writePageState(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Storage can be unavailable. */
  }
}

const noUrlFields = []

function getUrl(params, fields) {
  const search = new URLSearchParams()
  for (const field of fields.split(',')) {
    if (params.has(field)) search.set(field, params.get(field))
  }
  return search.size ? '?' + search.toString() : ''
}

/** Keep a history snapshot for Back/Forward and a latest snapshot for menu links. */
export function usePageState(urlFields = noUrlFields) {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const scope =
    'elite:page:' + (user?.id ?? 'student') + ':' + location.pathname
  const entry = location.state?.hubView
  const ownEntry = entry?.scope === scope
  const saved = ownEntry ? entry.values : readPageState(scope)
  const params = new URLSearchParams(typeof saved === 'string' ? saved : '')
  const fields = urlFields.join(',')
  if (!entry) {
    const explicit = new URLSearchParams(location.search)
    for (const field of urlFields) {
      if (explicit.has(field)) params.set(field, explicit.get(field))
    }
  }
  const values = params.toString()
  const search = getUrl(params, fields)
  const pathname = location.pathname

  useEffect(() => {
    writePageState(scope, values)
    if (!ownEntry) {
      navigate(
        { pathname, search },
        { replace: true, state: { hubView: { scope, values } } },
      )
    }
  }, [navigate, ownEntry, pathname, scope, search, values, location.key])

  const setParams = useCallback(
    (next, { replace = false } = {}) => {
      const updated = new URLSearchParams(next)
      const text = updated.toString()
      writePageState(scope, text)
      navigate(
        { pathname, search: getUrl(updated, fields) },
        { replace, state: { hubView: { scope, values: text } } },
      )
    },
    [fields, navigate, pathname, scope],
  )
  return { params, setParams, scope, entryKey: location.key }
}
