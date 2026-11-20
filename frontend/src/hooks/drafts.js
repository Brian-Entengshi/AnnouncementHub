const prefix = 'elite:draft:'
const lifetime = 7 * 24 * 60 * 60 * 1000

export function draftKey(user, path) { return prefix + user + ':' + path }
export function clearDraft(key) { try { sessionStorage.removeItem(key) } catch { /* storage unavailable */ } }
export function clearUserDrafts(user) {
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix + user + ':')) clearDraft(key) } catch { /* storage unavailable */ }
}
export function loadDraft(key) {
  try {
    const item = JSON.parse(sessionStorage.getItem(key))
    if (item?.at > Date.now() - lifetime) return item.values
    clearDraft(key)
  } catch { clearDraft(key) }
  return {}
}
export function saveDraft(key, values, fields) {
  const safe = Object.fromEntries(fields.filter(f => !['password', 'file'].includes(f.type)).map(f => [f.name, values[f.name]]))
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), values: safe })) } catch { /* storage unavailable */ }
}
