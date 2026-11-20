const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
let csrf = ''

function errorText(data) {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(errorText).join(' ')
  return Object.entries(data || {}).map(([field, value]) =>
    (['detail', 'non_field_errors'].includes(field) ? '' : field.replaceAll('_', ' ') + ' — ') + errorText(value)).join(' ')
}

export async function api(path, options = {}) {
  const { method = 'GET', body, signal } = options
  const form = body instanceof FormData
  const response = await fetch(base + '/' + path, {
    method, credentials: 'include', signal, cache: 'no-store',
    headers: { Accept: 'application/json', ...(form ? {} : { 'Content-Type': 'application/json' }), 'X-CSRFToken': csrf },
    ...(body === undefined ? {} : { body: form ? body : JSON.stringify(body) }),
  }).catch(error => {
    if (error.name === 'AbortError') throw error
    throw new Error('Cannot reach the hub. Check your connection and try again.')
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(errorText(data) || 'The server could not complete this request (' + response.status + ').')
  if (data?.csrf) csrf = data.csrf
  return data
}

export async function allPages(path, signal) {
  const items = []
  const [route, search] = path.split('?')
  const params = new URLSearchParams(search)
  for (let page = 1; ; page++) {
    params.set('page', page)
    const data = await api(route + '?' + params, { signal })
    items.push(...data.results)
    if (!data.next) return items
  }
}
