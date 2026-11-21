export function isActiveEvent(event) {
  return event.published && ['scheduled', 'ongoing'].includes(event.status)
}
