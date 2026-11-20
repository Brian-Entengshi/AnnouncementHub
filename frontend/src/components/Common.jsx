import { CalendarX2, LoaderCircle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { human } from '../utils/format'

export function Badge({ value }) {
  return (
    <span
      className={'badge ' + String(value).toLowerCase().replaceAll(' ', '-')}
    >
      {human(value)}
    </span>
  )
}
export function Empty({ children }) {
  return (
    <div className="empty">
      <CalendarX2 size={21} />
      <span>{children || 'No records to display.'}</span>
    </div>
  )
}
export function State({ query, children }) {
  if (query.error)
    return (
      <div role="alert" className="error">
        {query.error}{' '}
        <button onClick={query.reload}>
          <RefreshCw size={15} />
          Retry
        </button>
      </div>
    )
  if (query.data === undefined)
    return (
      <div role="status" className="empty">
        <LoaderCircle className="spin" size={20} />
        Loading…
      </div>
    )
  return children(query.data)
}
export function Heading({ kicker, title, description, children }) {
  return (
    <header className="page-heading">
      <div>
        <small className="eyebrow">{kicker}</small>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  )
}
export function Panel({
  title,
  to,
  action = 'View all',
  icon: Icon,
  children,
}) {
  return (
    <section className="panel">
      <header>
        <h2>
          {Icon && <Icon size={18} />} {title}
        </h2>
        {to && (
          <Link className="text-link" to={to}>
            {action}
          </Link>
        )}
      </header>
      {children}
    </section>
  )
}
