import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Megaphone, CalendarDays, Users, Link2, PanelsTopLeft, MapPin, CalendarCheck2, ClipboardList, Bell, Settings, LogIn, LogOut, Menu, X, ChevronRight, CircleHelp, BookOpen, Building2, PencilLine, ShieldCheck, History, KeyRound, Radio } from 'lucide-react'
import { useAuth } from '../context/auth'
import { useData } from '../hooks/useData'
import { State, formatDate, todayKey } from './Common'

const main = [['Dashboard','/dashboard',LayoutDashboard],['Announcements','/announcements',Megaphone],['Organization Activities','/organization-activities',PanelsTopLeft],['Weekly Events','/weekly-events',CalendarDays],['Organization Teams','/organization-teams',Users],['Useful Links','/useful-links',Link2]]
const venue = [['Venue Availability','/availability',CalendarCheck2],['Venues','/venues',Building2],['Venue Notices','/venue-notices',MapPin]]
const admin = [['Manage Announcements','/manage-announcements',PencilLine],['Account Management','/accounts',ShieldCheck]]
const adviserNav = [['Activity Records','/audit',History],['Settings','/settings',Settings]]
function Group({title, items}) {
  return <div className="nav-group"><h2>{title}</h2>{items.map(([name,path,Icon])=><NavLink key={path} to={path}><Icon size={18}/>{name}</NavLink>)}</div>
}
function Help({close}) {
  const q=useData('settings/'), ref=useRef(null)
  useEffect(()=>{ref.current.showModal()},[])
  return <dialog ref={ref} onClose={close} className="help-dialog"><button className="icon close" onClick={close} aria-label="Close help"><X/></button><BookOpen/><h2>Hub help</h2><p>Students can browse club updates and schedules. Ask your officer or adviser for a member account to request a venue.</p><State query={q}>{r=><>{r.contact_email && <p><a href={'mailto:'+r.contact_email}>{r.contact_email}</a></p>}{r.office_hours && <p>Office hours · {r.office_hours}</p>}</>}</State></dialog>
}
export default function Layout() {
  const { user, manager, adviser, logout }=useAuth(), location=useLocation(), navigate=useNavigate()
  const [drawer,setDrawer]=useState(false),[help,setHelp]=useState(false),[error,setError]=useState(''),[offline,setOffline]=useState(!navigator.onLine)
  const q=useData(user && !user.must_change_password ? 'dashboard/?nav='+encodeURIComponent(location.pathname) : null)
  const menuButton=useRef(null),side=useRef(null)
  useEffect(()=>{const update=()=>setOffline(!navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[])
  useEffect(()=>{if(!drawer)return;const original=document.body.style.overflow;document.body.style.overflow='hidden';side.current.querySelector('button').focus()
    function keyboard(e){if(e.key==='Escape')setDrawer(false);if(e.key==='Tab'){const els=[...side.current.querySelectorAll('a,button')].filter(el=>el.offsetParent!==null);if(e.shiftKey && document.activeElement===els[0]){e.preventDefault();els.at(-1).focus()}else if(!e.shiftKey && document.activeElement===els.at(-1)){e.preventDefault();els[0].focus()}}}
    const resize=()=>{if(window.innerWidth>1024)setDrawer(false)}
    window.addEventListener('keydown',keyboard);window.addEventListener('resize',resize);return()=>{window.removeEventListener('keydown',keyboard);window.removeEventListener('resize',resize);document.body.style.overflow=original;menuButton.current?.focus()}
  },[drawer])
  const venues=[...venue,...(user?[['Reservations','/reservations',ClipboardList]]:[])]
  const page=[...main,...venues,...admin,...adviserNav,['Notifications','/notifications'],['Sign in','/login'],['Password','/password']].find(([,url])=>location.pathname.split('/')[1]===url.slice(1))?.[0] || 'Dashboard'
  async function leave(){try{await logout();navigate('/dashboard');setDrawer(false)}catch(err){setError(err.message)}}
  return <div className="shell"><a href="#content" className="skip">Skip to content</a>{drawer && <button aria-label="Close navigation" className="scrim" onClick={()=>setDrawer(false)}/>}
    <aside ref={side} className={'sidebar '+(drawer?'open':'')} onClick={e=>{if(e.target.closest('a'))setDrawer(false)}}>
      <div className="brand"><img src="/brand/seal.png" alt="DLL Elite seal"/><div><strong>DLL ELITE</strong><span>Student Organization</span></div><button aria-label="Close menu" className="mobile close-menu" onClick={()=>setDrawer(false)}><X/></button></div>
      <nav aria-label="Main navigation"><Group title="Organization" items={main}/><Group title="Venue desk" items={venues}/>{manager && <Group title="Administration" items={[...admin,...(adviser?adviserNav:[])]}/>}</nav>
      <div className="sidebar-bottom"><button onClick={()=>{setDrawer(false);setHelp(true)}}><CircleHelp size={17}/>Hub help</button>
      <div className="identity"><span className="avatar">{user ? (user.full_name || user.username).slice(0,1) : <Users size={17}/>}</span><div><strong>{user?.full_name || user?.username || 'Public workspace'}</strong><small>{user ? user.role+' account' : 'Student access'}</small></div>{user && <button onClick={leave} aria-label="Sign out"><LogOut size={16}/></button>}</div></div></aside>
    <div className="workspace"><header className="topbar"><button ref={menuButton} className="mobile icon" onClick={()=>setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}><Menu/></button><div className="crumb"><span>Workspace</span><ChevronRight size={14}/><b>{page}</b></div><div className="top-actions"><span className="header-date"><CalendarDays size={15}/>{formatDate(todayKey(),{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</span>{user ? <><Link className="icon notification" aria-label="Notifications" to="/notifications"><Bell size={19}/>{q.data?.unread>0 && <i/>}</Link><Link className="icon" to="/password" aria-label="Change password"><KeyRound size={17}/></Link></> : <Link className="sign-in" to="/login"><LogIn size={15}/>Member sign in</Link>}</div></header>
    <main id="content">{offline && <p className="offline"><Radio size={16}/>You are offline. Live records will return when you reconnect.</p>}{error && <p className="error">{error}</p>}<Outlet/></main></div>{help && <Help close={()=>setHelp(false)}/>}</div>
}
