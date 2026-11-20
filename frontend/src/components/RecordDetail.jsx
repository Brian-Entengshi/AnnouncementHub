import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, ExternalLink, Paperclip } from 'lucide-react'
import { useData } from '../hooks/useData'
import { useAuth } from '../context/auth'
import { api } from '../services/api'
import { managePath } from '../services/catalog'
import { Badge, Heading, State, formatDate, formatTime, human, stamp } from './Common'
import ReservationActions from './ReservationActions'

const metadata = ['category','author_name','published_at','expires','venue_name','location','capacity','available','date','start','end','attendees','requester_name','team_name','responsible','contact','notes','activity_name','start_date','end_date','starts_at','ends_at','blocks_bookings','username','email','role','position','is_active','published']
function display(k, v) {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (['start','end'].includes(k)) return formatTime(v)
  if (k.endsWith('_at')) return stamp(v)
  if (['date','expires','start_date','end_date'].includes(k)) return formatDate(v)
  return v
}
export default function RecordDetail({ config: c, id, managed }) {
  const { manager } = useAuth(), navigate = useNavigate()
  const q = useData(c.api + '/' + id + '/' + (managed || (manager && c.api !== 'announcements') ? '?manage=1' : ''))
  const [error, setError] = useState(''), [confirm, setConfirm] = useState(false)
  const path = '/' + managePath(c)
  async function remove() {
    try { await api(c.api + '/' + id + '/?manage=1', { method: 'DELETE' }); navigate(path) } catch (e) { setError(e.message); setConfirm(false) }
  }
  return <State query={q}>{item => <><Heading kicker={c.singular} title={item.title || item.name || item.full_name || item.username}>
    {manager && c.api !== 'reservations' && <Link className="button" to={path + '/' + id + '/edit'}><Pencil size={16}/>Edit</Link>}</Heading>
    <section className="panel detail">{item.status && <Badge value={item.status}/>} {item.image && <img className="record-image" src={item.image} alt={item.title}/>}
    {item.description && <p className="body-copy">{item.description}</p>}
    <dl>{metadata.filter(k => item[k] !== undefined && item[k] !== null && item[k] !== '').map(k => <div key={k}><dt>{human(k.replace('_name',''))}</dt><dd>{display(k,item[k])}</dd></div>)}</dl>
    {item.attachment && <a className="button" href={item.attachment}><Paperclip size={16}/>Download attachment</a>}
    {item.url && <a className="button" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/>Open resource</a>}
    {item.members && <><h2>Team members</h2>{item.members.length ? item.members.map((m,i) => <p key={i}>{m.name} · {m.position || 'Staff member'}</p>) : <p>No active members assigned.</p>}{manager && <Link to="/accounts">Manage assignments</Link>}</>}
    {c.api === 'venues' && <Link className="button" to={'/availability?venue=' + item.id}>Check availability</Link>}
    {manager && c.api === 'events' && <Link className="button" to={'/reservations/' + item.reservation}>View booking</Link>}
    {manager && !['reservations','accounts'].includes(c.api) && <div className="detail-footer"><button className="danger" onClick={() => setConfirm(true)}><Trash2 size={15}/>Delete {c.singular.toLowerCase()}</button></div>}
    {confirm && <dialog open role="alertdialog"><h3>Delete this {c.singular.toLowerCase()}?</h3><p>This will remove the record permanently.</p><div className="actions"><button onClick={() => setConfirm(false)}>Keep record</button><button className="danger" onClick={remove}>Confirm deletion</button></div></dialog>}
    {error && <p className="error" role="alert">{error}</p>}</section>
    {c.api === 'reservations' && <ReservationActions item={item} reload={q.reload}/>}</>}</State>
}
