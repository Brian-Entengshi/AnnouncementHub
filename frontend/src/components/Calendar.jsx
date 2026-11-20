import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, CalendarDays, List } from 'lucide-react'
import { useData } from '../hooks/useData'
import { useAuth } from '../context/auth'
import { Heading, State, Badge, dateKey, day, todayKey, formatDate, formatTime, Empty } from './Common'

function move(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next }
function monday(date) { return move(date, -((date.getDay() + 6) % 7)) }

export default function Calendar({ availability = false }) {
  const { user, manager } = useAuth(), [searchParams, setParams] = useSearchParams()
  const [cursor, setCursor] = useState(() => day(todayKey())), [mode, setMode] = useState('week'), [all, setAll] = useState(false)
  const venue = searchParams.get('venue') || ''
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
  const start = mode === 'month' ? monday(monthStart) : monday(cursor)
  const days = mode === 'month' ? Math.ceil((((monthStart.getDay()+6)%7) + new Date(cursor.getFullYear(),cursor.getMonth()+1,0).getDate())/7)*7 : 7
  const dates = Array.from({length: days}, (_,i) => dateKey(move(start,i)))
  const params = new URLSearchParams({ from: dates[0], to: dates.at(-1), ...(venue ? { venue } : {}) })
  const q = useData(availability ? 'availability/?' + params : 'events/?' + (manager && all ? 'manage=1&' : '') + params, !availability)
  const venues = useData(availability ? 'venues/' : null, true)
  function step(direction) { setCursor(mode === 'month' ? new Date(cursor.getFullYear(), cursor.getMonth()+direction, 1, 12) : move(cursor, 7*direction)) }
  return <><Heading kicker={availability ? 'Venue desk' : 'Organization'} title={availability ? 'Venue Availability' : 'Weekly Events'} description={availability ? 'Check bookings and closures before requesting a space.' : 'Explore the DLL Elite schedule, week by week.'}>
    {(availability ? user : manager) && <Link className="button primary" to={availability ? '/reservations/new' : '/weekly-events/new'}><Plus size={16}/>{availability ? 'Request venue' : 'New event'}</Link>}</Heading>
    <div className="panel calendar"><div className="calendar-tools"><div className="actions"><button aria-label="Previous period" onClick={() => step(-1)}><ChevronLeft size={16}/></button><button onClick={() => setCursor(day(todayKey()))}>Today</button><button aria-label="Next period" onClick={() => step(1)}><ChevronRight size={16}/></button></div>
    <b>{mode === 'month' ? cursor.toLocaleDateString('en-US',{month:'long',year:'numeric'}) : formatDate(dates[0],{month:'short',day:'numeric'})+' – '+formatDate(dates.at(-1))}</b>
    {availability ? <><select aria-label="Calendar view" value={mode} onChange={e=>setMode(e.target.value)}><option value="week">Week</option><option value="month">Month</option></select>
    <select aria-label="Filter venue" value={venue} onChange={e=>setParams(e.target.value ? {venue:e.target.value} : {})}><option value="">All venues</option>{venues.data?.map(v=><option key={v.id} value={v.id}>{v.name}{!v.available && ' · Unavailable'}</option>)}</select></> : manager && <label className="check"><input type="checkbox" checked={all} onChange={e=>setAll(e.target.checked)}/>Include drafts</label>}</div>
    {venues.error && <div className="error">{venues.error} <button onClick={venues.reload}>Retry</button></div>}
    <State query={q}>{data => {
      const rows = availability ? data.slots : data
      const notices = availability ? data.notices : []
      return <div className={'calendar-days ' + mode}>{dates.map(date => {
        const slot = rows.filter(r=>r.date === date), alerts = notices.filter(n=>n.starts_at.slice(0,10)<=date && n.ends_at.slice(0,10)>=date)
        return <section key={date} className={date === todayKey() ? 'today' : ''}><h3>{formatDate(date,{weekday:'short'})}<b>{formatDate(date,{month:'short',day:'numeric'})}</b></h3><div>{slot.map((r,i)=>{
          const info = <><strong>{r.title}</strong><small>{formatTime(r.start)} – {formatTime(r.end)} · {r.venue_name}</small><Badge value={r.published === false ? 'draft' : r.status}/></>
          return r.id ? <Link className="slot" key={r.id} to={'/' + (availability?'reservations':'weekly-events') + '/' + r.id}>{info}</Link> : <div className="slot" key={i}>{info}</div>
        })}{alerts.map(n=><Link key={'n'+n.id} className="slot closure" to={'/venue-notices/'+n.id}><strong>{n.title}</strong><small>{n.venue_name} · {n.blocks_bookings?'Closure':'Notice'}</small></Link>)}
        {!slot.length && !alerts.length && <small className="quiet">{mode==='week' ? 'No scheduled items' : '—'}</small>}</div></section>
      })}</div>
    }}</State></div>
    {availability && <div className="actions calendar-links"><Link className="button" to="/venues"><List size={16}/>Venue directory</Link><Link className="button" to="/venue-notices"><CalendarDays size={16}/>Venue notices</Link></div>}
    {!availability && manager && <EventDirectory/>}</>
}
function EventDirectory() {
  const q = useData('events/?manage=1',true)
  return <section className="panel detail"><h2>Event management</h2><State query={q}>{rows=>rows.length ? rows.map(r=><Link className="list-row" key={r.id} to={'/weekly-events/'+r.id}><span>{r.title}<small>{formatDate(r.date)}</small></span><Badge value={r.published?r.status:'draft'}/></Link>) : <Empty>No events recorded.</Empty>}</State></section>
}
