import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api'
import { useData } from '../hooks/useData'
import { State, Empty, Heading, stamp } from '../components/Common'

export default function Notifications() {
  const q=useData('notifications/',true), [error,setError]=useState('')
  async function mark(path) { try { await api('notifications/'+path+'/',{method:'POST'});q.reload() } catch(e){setError(e.message)} }
  return <><Heading kicker="Member workspace" title="Notifications"><button onClick={()=>mark('read_all')}>Mark all as read</button></Heading>{error && <p className="error">{error}</p>}<section className="panel detail"><State query={q}>{rows=>rows.length ? rows.map(r=><article className="list-row" key={r.id}><div><Link to={r.link}>{r.message}</Link><small>{stamp(r.created_at)} · {r.read?'Read':'Unread'}</small></div>{!r.read && <button onClick={()=>mark(r.id+'/read')}>Mark read</button>}</article>) : <Empty>No notifications yet.</Empty>}</State></section></>
}
