export function isActiveEvent(event) {
  return (
    event.published &&
    !event.retired_venue &&
    ['scheduled', 'ongoing'].includes(event.status)
  )
}
