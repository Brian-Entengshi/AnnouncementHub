import { CalendarX2, LoaderCircle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'

export const dateKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
export const day = str => new Date(str.slice(0, 10) + 'T12:00:00')
export const formatDate = (str, options = { month: 'short', day: 'numeric', year: 'numeric' }) => str ? day(str).toLocaleDateString('en-US', options) : '—'
export const formatTime = str => str ? new Date('2000-01-01T' + str).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
export const stamp = str => new Date(str).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' })
export const human = str => String(str || '').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase())
export function Badge({ value }) { return <span className={'badge ' + String(value).toLowerCase().replaceAll(' ', '-')}>{human(value)}</span> }
export function Empty({ children }) { return <div className="empty"><CalendarX2 size={21}/><span>{children || 'No records to display.'}</span></div> }
export function State({ query, children }) {
  if (query.error) return <div role="alert" className="error">{query.error} <button onClick={query.reload}><RefreshCw size={15}/>Retry</button></div>
  if (query.data === undefined) return <div role="status" className="empty"><LoaderCircle className="spin" size={20}/>Loading…</div>
  return children(query.data)
}
export function Heading({ kicker, title, description, children }) { return <header className="page-heading"><div><small className="eyebrow">{kicker}</small><h1>{title}</h1>{description && <p>{description}</p>}</div>{children}</header> }
export function Panel({ title, to, action = 'View all', icon: Icon, children }) { return <section className="panel"><header><h2>{Icon && <Icon size={18}/>} {title}</h2>{to && <Link className="text-link" to={to}>{action}</Link>}</header>{children}</section> }
