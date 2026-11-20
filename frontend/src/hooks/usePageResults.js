import { useCallback, useEffect } from 'react'
import { useData } from './useData'

export function usePageResults(endpoint, params, setParams) {
  const rawPage = params.get('page')
  const page =
    /^[1-9]\d*$/.test(rawPage || '') && Number.isSafeInteger(Number(rawPage))
      ? Number(rawPage)
      : 1
  const filters = params.toString()
  const query = useData(endpoint)

  const setPage = useCallback(
    (next, options) => {
      const updated = new URLSearchParams(filters)
      if (next > 1) updated.set('page', next)
      else updated.delete('page')
      setParams(updated, options)
    },
    [filters, setParams],
  )

  useEffect(() => {
    if (
      (rawPage && rawPage !== String(page)) ||
      (query.status === 404 && page > 1)
    ) {
      setPage(1, { replace: true })
    }
  }, [query.status, rawPage, page, setPage])

  return { query, page, setPage }
}

/** Drop a deleted/retired reference only after its current option list has loaded. */
export function useValidFilter(
  params,
  setParams,
  name,
  options,
  getValue = String,
) {
  const value = params.get(name)
  const valid =
    !value || !options || options.some((option) => getValue(option) === value)
  useEffect(() => {
    if (!valid) {
      const next = new URLSearchParams(params)
      next.delete(name)
      next.delete('page')
      setParams(next, { replace: true })
    }
  }, [name, params, setParams, valid])
  return valid ? value || '' : ''
}
