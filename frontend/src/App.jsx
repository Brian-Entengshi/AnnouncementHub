import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
} from 'react-router-dom'
import { useEffect } from 'react'
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
import Activities from './pages/Activities'
import WeeklyEvents from './pages/WeeklyEvents'
import Teams from './pages/Teams'
import UsefulLinks from './pages/UsefulLinks'
import Venues from './pages/Venues'
import VenueNotices from './pages/VenueNotices'
import Accounts from './pages/Accounts'
import StudentLayout from './components/StudentLayout'
import StudentHome from './pages/StudentHome'
import StudentRecord from './pages/StudentRecord'

function SessionReady({ children }) {
  const { loading, error, refresh } = useAuth()
  if (loading)
    return (
      <div role="status" className="empty">
        Opening workspace…
      </div>
    )
  if (error)
    return (
      <div className="error" role="alert">
        {error} <button onClick={refresh}>Retry connection</button>
      </div>
    )
  return children
}

function MemberLayout() {
  const { user, refresh } = useAuth()
  const location = useLocation()
  const userId = user?.id
  useEffect(() => {
    if (userId) refresh({ background: true })
  }, [userId, location.pathname, refresh])
  const from =
    location.pathname + (location.state?.hubView ? '' : location.search)
  let destination
  if (!user) {
    const match = /^\/(announcements|weekly-events)(?:\/(\d+))?\/?$/.exec(
      location.pathname,
    )
    if (match) {
      const section = match[1] === 'announcements' ? 'announcements' : 'events'
      destination = match[2]
        ? '/student/' + section + '/' + match[2]
        : '/student#' + section
    } else {
      destination = '/login'
    }
  } else if (user.must_change_password && location.pathname !== '/password') {
    destination = '/password'
  }
  return (
    <SessionReady>
      {destination ? (
        <Navigate replace to={destination} state={{ from }} />
      ) : (
        <Layout />
      )}
    </SessionReady>
  )
}

function RoleGate({ role, children }) {
  const auth = useAuth()
  if (role && !auth[role]) {
    return (
      <section className="panel detail">
        <h1>Access restricted</h1>
        <p>Your account doesn’t have access to this page.</p>
        <Link to="/dashboard">Return to dashboard</Link>
      </section>
    )
  }
  return children
}

const pages = [
  [catalog.announcements, Announcements],
  [catalog.activities, Activities],
  [catalog.events, WeeklyEvents],
  [catalog.teams, Teams],
  [catalog.links, UsefulLinks],
  [catalog.venues, Venues],
  [catalog.notices, VenueNotices],
  [catalog.accounts, Accounts],
]

function LegacyAnnouncementRoute() {
  const { pathname, search } = useLocation()
  return (
    <Navigate
      replace
      to={
        '/announcements' +
        pathname.slice('/manage-announcements'.length) +
        search
      }
    />
  )
}

function StartPage() {
  const { user, loading } = useAuth()
  if (loading) return <SessionReady />
  return <Navigate replace to={user ? '/dashboard' : '/student'} />
}

function HubRoutes() {
  return (
    <Routes>
      <Route index element={<StartPage />} />
      <Route
        path="manage-announcements/*"
        element={<LegacyAnnouncementRoute />}
      />
      <Route element={<StudentLayout />}>
        <Route path="student" element={<StudentHome />} />
        <Route path="student/events/:id" element={<StudentRecord event />} />
        <Route path="student/announcements/:id" element={<StudentRecord />} />
        <Route
          path="login"
          element={
            <SessionReady>
              <Authentication />
            </SessionReady>
          }
        />
        <Route
          path="*"
          element={
            <section className="public-width public-record">
              <h1>Page unavailable</h1>
              <Link to="/student">Return to Student Access</Link>
            </section>
          }
        />
      </Route>
      <Route element={<MemberLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        {pages.flatMap(([c, Page]) =>
          ['', '/:id', '/new', '/:id/edit'].map((suffix) => {
            const role =
              c.api === 'venues'
                ? 'adviser'
                : c.api === 'accounts'
                  ? 'manager'
                  : c.api === 'teams' && suffix === '/new'
                    ? 'adviser'
                    : suffix === '/new' || suffix.endsWith('edit')
                      ? 'manager'
                      : null
            return (
              <Route
                key={c.path + suffix}
                path={c.path + suffix}
                element={
                  <RoleGate role={role}>
                    <Page key={c.path + suffix} />
                  </RoleGate>
                }
              />
            )
          }),
        )}
        <Route path="availability" element={<Availability />} />
        <Route path="password" element={<Authentication password />} />
        <Route path="notifications" element={<Notifications />} />
        <Route
          path="settings"
          element={
            <RoleGate role="adviser">
              <Settings />
            </RoleGate>
          }
        />
        <Route
          path="audit"
          element={
            <RoleGate role="adviser">
              <Audit />
            </RoleGate>
          }
        />
      </Route>
    </Routes>
  )
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HubRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
