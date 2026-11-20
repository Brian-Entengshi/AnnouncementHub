import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Plus, Search, ExternalLink, Pin, Users, MapPin, FileText } from 'lucide-react'
import { useAuth } from '../context/auth'
import { useData } from '../hooks/useData'
import { Heading, State, Empty, Badge, formatDate, human } from './Common'
import RecordDetail from './RecordDetail'
import RecordForm from './RecordForm'
import { managePath } from '../services/catalog'

export function ResourceList({ config: c, managed }) {
  const { user, manager } = useAuth()
  const [search, setSearch] = useState(''), [filter, setFilter] = useState(''), [mine, setMine] = useState(false)
  const path = '/' + (managed ? managePath(c) : c.path)
  const q = useData(c.api + '/?' + new URLSearchParams({ ...(managed || (manager && c.api !== 'announcements') ? { manage: '1' } : {}), ...(mine ? { mine: '1' } : {}) }), true)
  const canAdd = (manager || (user && c.api === 'reservations')) && (c.api !== 'announcements' || managed)
  return <><Heading kicker={c.group} title={managed ? 'Manage Announcements' : c.name} description={c.description}>
    {canAdd && <Link className="button primary" to={path + '/new'}><Plus size={17}/>New {c.singular.toLowerCase()}</Link>}
    </Heading><State query={q}>{rows => {
    const facet = ['announcements','links'].includes(c.api) && !managed ? 'category' : c.api === 'accounts' ? 'role' : 'status'
    const choices = [...new Set(rows.map(r => r[facet]).filter(Boolean))]
    const visible = rows.filter(r => (!filter || r[facet] === filter) && [r.title,r.name,r.description,r.full_name,r.username,r.location,r.venue_name,r.category].join(' ').toLowerCase().includes(search.toLowerCase()))
    return <><div className="toolbar"><label className="search"><Search size={17}/><input aria-label="Search records" placeholder={'Search ' + c.name.toLowerCase() + '…'} value={search} onChange={e => setSearch(e.target.value)}/></label>
    {choices.length > 0 && <select aria-label={'Filter by ' + facet} value={filter} onChange={e => setFilter(e.target.value)}><option value="">All {facet === 'category' ? 'categories' : facet === 'status' ? 'statuses' : 'roles'}</option>{choices.map(v => <option key={v} value={v}>{human(v)}</option>)}</select>}
    {c.api === 'reservations' && manager && <label className="check"><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)}/>My requests</label>}</div>
    <div className="record-grid">{visible.map(r => <article className="panel record-card" key={r.id}>
    {r.image && <img className="card-image" src={r.image} alt=""/>}
    <div className="card-meta">{r.pinned ? <Pin size={16}/> : c.api === 'teams' ? <Users size={18}/> : c.api === 'venues' ? <MapPin size={18}/> : <FileText size={16}/>}
    <span>{r.category || r.role || c.singular}</span>{r.status && <Badge value={r.status}/>}</div>
    <h2><Link to={path + '/' + r.id}>{r.title || r.name || r.full_name || r.username}</Link></h2><p>{r.description || r.position || r.location}</p>
    <div className="record-foot">{r.date || r.start_date || r.published_at ? formatDate(r.date || r.start_date || r.published_at) : r.members ? r.members.length + ' active members' : r.capacity ? r.capacity + ' seats · ' + (r.available ? 'Available' : 'Unavailable') : r.team_name || ''}
    {r.url && <a href={r.url} target="_blank" rel="noreferrer">Open link <ExternalLink size={14}/></a>}</div></article>)}</div>{!visible.length && <Empty>No matching records.</Empty>}</>
    }}</State></>
}
export default function ResourcePage({ config, managed = false, list: List = ResourceList }) {
  const { id } = useParams(), { pathname } = useLocation()
  if (pathname.endsWith('/new') || pathname.endsWith('/edit')) return <RecordForm config={config} id={id}/>
  if (id) return <RecordDetail key={id} config={config} id={id} managed={managed}/>
  return <List config={config} managed={managed}/>
}
