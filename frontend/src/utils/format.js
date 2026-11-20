export const dateKey = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
export const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
export const day = (str) => new Date(str.slice(0, 10) + 'T12:00:00')
export const formatDate = (
  str,
  options = { month: 'short', day: 'numeric', year: 'numeric' },
) => (str ? day(str).toLocaleDateString('en-US', options) : '—')
export const formatTime = (str) =>
  str
    ? new Date('2000-01-01T' + str).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : ''
export const stamp = (str) =>
  new Date(str).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  })
export const human = (str) =>
  String(str || '')
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase())
