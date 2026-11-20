import { useCallback, useEffect, useState } from 'react'
import { api, allPages } from '../services/api'

export function useData(path, collection = false) {
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState({})
  useEffect(() => {
    if (!path) return
    const controller = new AbortController()
    const request = collection
      ? allPages(path, controller.signal)
      : api(path, { signal: controller.signal })
    request
      .then((data) => {
        if (!controller.signal.aborted) setResult({ path, data, version })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ path, error: error.message, version })
      })
    return () => controller.abort()
  }, [path, version, collection])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return {
    ...(result.path === path && result.version === version ? result : {}),
    reload,
  }
}
