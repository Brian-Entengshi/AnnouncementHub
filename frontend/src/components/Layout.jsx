import { startTransition, useEffect, useRef, useState } from 'react'
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import {
  LayoutDashboard,
  Megaphone,
  CalendarDays,
  Users,
  Link2,
  PanelsTopLeft,
  MapPin,
  CalendarCheck2,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Building2,
  ShieldCheck,
  History,
  KeyRound,
  Radio,
} from 'lucide-react'
import { useAuth } from '../context/auth'
import { useData } from '../hooks/useData'
import { formatDate, todayKey } from '../utils/format'

const main = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Announcements', '/announcements', Megaphone],
  ['Organization Activities', '/organization-activities', PanelsTopLeft],
  ['Weekly Events', '/weekly-events', CalendarDays],
  ['Organization Teams', '/organization-teams', Users],
  ['Useful Links', '/useful-links', Link2],
]
const venue = [
  ['Venue Availability', '/availability', CalendarCheck2],
  ['Venues', '/venues', Building2],
  ['Venue Notices', '/venue-notices', MapPin],
]
const admin = [['Account Management', '/accounts', ShieldCheck]]
const adviserNav = [
  ['Audit Logs', '/audit', History],
  ['Settings', '/settings', Settings],
]
function Group({ title, items }) {
  return (
    <div className="nav-group">
      <h2>{title}</h2>
      {items.map(([name, path, Icon]) => (
        <NavLink key={path} to={path}>
          <Icon size={18} />
          {name}
        </NavLink>
      ))}
    </div>
  )
}
export default function Layout() {
  const { user, manager, adviser, logout, setSession } = useAuth(),
    location = useLocation(),
    navigate = useNavigate()
  const [drawer, setDrawer] = useState(false),
    [error, setError] = useState(''),
    [offline, setOffline] = useState(!navigator.onLine)
  const q = useData(
    user && !user.must_change_password
      ? 'notifications/unread/?nav=' + encodeURIComponent(location.pathname)
      : null,
  )
  const { reload } = q
  useEffect(() => {
    window.addEventListener('elite:notifications', reload)
    return () => window.removeEventListener('elite:notifications', reload)
  }, [reload])
  const menuButton = useRef(null),
    side = useRef(null)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    if (!drawer) return
    const trigger = menuButton.current
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    side.current.querySelector('button').focus()
    function keyboard(e) {
      if (e.key === 'Escape') setDrawer(false)
      if (e.key === 'Tab') {
        const els = [...side.current.querySelectorAll('a,button')].filter(
          (el) => el.offsetParent !== null,
        )
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault()
          els.at(-1).focus()
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault()
          els[0].focus()
        }
      }
    }
    const resize = () => {
      if (window.innerWidth > 1024) setDrawer(false)
    }
    window.addEventListener('keydown', keyboard)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('keydown', keyboard)
      window.removeEventListener('resize', resize)
      document.body.style.overflow = original
      trigger?.focus()
    }
  }, [drawer])
  const page =
    [
      ...main,
      ...venue,
      ...admin,
      ...adviserNav,
      ['Notifications', '/notifications'],
      ['Sign in', '/login'],
      ['Password', '/password'],
    ].find(
      ([, url]) => location.pathname.split('/')[1] === url.slice(1),
    )?.[0] || 'Dashboard'
  async function leave() {
    try {
      const next = await logout()
      startTransition(() => {
        navigate('/student', { replace: true })
        setSession(next)
      })
      setDrawer(false)
    } catch (err) {
      setError(err.message)
    }
  }
  return (
    <div className="shell">
      <a href="#content" className="skip">
        Skip to content
      </a>
      {drawer && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        ref={side}
        className={'sidebar ' + (drawer ? 'open' : '')}
        onClick={(e) => {
          if (e.target.closest('a')) setDrawer(false)
        }}
      >
        <div className="brand">
          <img src="/brand/seal.png" alt="DLL Elite seal" />
          <div>
            <strong>DLL ELITE</strong>
            <span>Student Organization</span>
          </div>
          <button
            aria-label="Close menu"
            className="mobile close-menu"
            onClick={() => setDrawer(false)}
          >
            <X />
          </button>
        </div>
        <nav aria-label="Main navigation">
          <Group title="Organization" items={main} />
          <Group title="Venue desk" items={venue} />
          {manager && (
            <Group
              title="Administration"
              items={[...admin, ...(adviser ? adviserNav : [])]}
            />
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="identity">
            <span className="avatar">
              {(user.full_name || user.username).slice(0, 1)}
            </span>
            <div>
              <strong>{user.full_name || user.username}</strong>
              <small>{user.role + ' account'}</small>
            </div>
            {user && (
              <button onClick={leave} aria-label="Sign out">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            ref={menuButton}
            className="mobile icon"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
          >
            <Menu />
          </button>
          <div className="crumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{page}</b>
          </div>
          <div className="top-actions">
            <span className="header-date">
              <CalendarDays size={15} />
              {formatDate(todayKey(), {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>

            <Link
              className="icon notification"
              aria-label="Notifications"
              to="/notifications"
            >
              <Bell size={19} />
              {q.data?.unread > 0 && <i />}
            </Link>
            <Link className="icon" to="/password" aria-label="Change password">
              <KeyRound size={17} />
            </Link>
          </div>
        </header>
        <main
          id="content"
          className={
            location.pathname === '/dashboard' || location.pathname === '/'
              ? undefined
              : 'inner-page'
          }
        >
          {offline && (
            <p className="offline">
              <Radio size={16} />
              You are offline. Live records will return when you reconnect.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
