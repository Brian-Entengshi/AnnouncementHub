import { BrowserRouter, Navigate, Route, Routes, Link, useLocation } from 'react-router-dom'
import AuthProvider from './context/AuthProvider'
import { useAuth } from './context/auth'
import Layout from './components/Layout'
import { catalog } from './services/catalog'
import Dashboard from './pages/Dashboard'
import Availability from './pages/Availability'
import Authentication from './pages/Authentication'
import Notifications from './pages/Notifications'
import Audit from './pages/Audit'
import Settings from './pages/Settings'
import Announcements from './pages/Announcements'
import ManageAnnouncements from './pages/ManageAnnouncements'
import Activities from './pages/Activities'
import WeeklyEvents from './pages/WeeklyEvents'
import Teams from './pages/Teams'
import UsefulLinks from './pages/UsefulLinks'
import Venues from './pages/Venues'
import VenueNotices from './pages/VenueNotices'
import Reservations from './pages/Reservations'
import Accounts from './pages/Accounts'

function Guard({ role, children }) {
  const auth = useAuth(), location = useLocation()
  if (auth.loading) return <div role="status" className="empty">Opening workspace…</div>
  if (auth.error) return <div className="error" role="alert">{auth.error} <button onClick={auth.refresh}>Retry connection</button></div>
  if (role && !auth.user) return <Navigate replace to="/login" state={{from:location.pathname + location.search}}/>
  if (auth.user?.must_change_password && location.pathname !== '/password') return <Navigate replace to="/password" state={{from:location.pathname}}/>
  if (role && role !== 'member' && !auth[role]) return <section className="panel detail"><h1>Access restricted</h1><p>Your account doesn’t have access to this page.</p><Link to="/dashboard">Return to dashboard</Link></section>
  return children
}
const pages = [[catalog.announcements,Announcements],[catalog.activities,Activities],[catalog.events,WeeklyEvents],[catalog.teams,Teams],[catalog.links,UsefulLinks],[catalog.venues,Venues],[catalog.notices,VenueNotices],[catalog.reservations,Reservations],[catalog.accounts,Accounts],[{...catalog.announcements,path:'manage-announcements'},ManageAnnouncements]]
function HubRoutes(){
  return <Routes><Route element={<Layout/>}>
    <Route index element={<Navigate replace to="/dashboard"/>}/><Route path="dashboard" element={<Guard><Dashboard/></Guard>}/>
    {pages.flatMap(([c,Page])=>['','/:id','/new','/:id/edit'].filter(s=>!(c.api==='reservations' && s.endsWith('edit'))).map(s=>{
      const role=c.path==='manage-announcements' || c.api==='accounts' ? 'manager' : c.api==='reservations' ? 'member' : s==='/new'||s.endsWith('edit')?'manager':null
      return <Route key={c.path+s} path={c.path+s} element={<Guard role={role}><Page key={c.path+s}/></Guard>}/>
    }))}
    {[[ 'availability',null,<Availability/> ],['login',null,<Authentication/>],['password','member',<Authentication password/>],['notifications','member',<Notifications/>],['settings','adviser',<Settings/>],['audit','adviser',<Audit/>]].map(([p,role,el])=><Route key={p} path={p} element={<Guard role={role}>{el}</Guard>}/>)}
    <Route path="*" element={<section className="panel detail"><h1>Page not found</h1><Link to="/dashboard">Open dashboard</Link></section>}/>
  </Route></Routes>
}
export default function App(){return <BrowserRouter><AuthProvider><HubRoutes/></AuthProvider></BrowserRouter>}
