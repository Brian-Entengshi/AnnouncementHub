import { useRef, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useAuth } from '../context/auth'
import {
  studentSections,
  useStudentNavigation,
} from '../hooks/useStudentNavigation'

export default function StudentLayout() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const header = useRef(null)
  const main = useRef(null)
  const footer = useRef(null)
  const menuButton = useRef(null)
  const active = useStudentNavigation(header, main, footer)
  return (
    <div className="public-site">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <header className="public-header" ref={header}>
        <div className="public-width public-header-inner">
          <Link
            className="public-brand"
            to="/student#home"
            onClick={() => setOpen(false)}
          >
            <img src="/brand/seal.png" alt="" width="42" height="42" />
            <span>
              <strong>DLL Elite</strong>
              <small>Student Organization</small>
            </span>
          </Link>
          <button
            ref={menuButton}
            className="public-menu"
            type="button"
            aria-label={open ? 'Close public menu' : 'Open public menu'}
            aria-controls="public-navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
          <nav
            id="public-navigation"
            aria-label="Public navigation"
            className={open ? 'open' : ''}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false)
                menuButton.current?.focus()
              }
            }}
          >
            {studentSections.map(([name, id]) => (
              <Link
                key={id}
                to={'/student#' + id}
                onClick={() => setOpen(false)}
                aria-current={active === id ? 'location' : undefined}
              >
                {name}
              </Link>
            ))}
          </nav>
          <Link className="public-member" to={user ? '/dashboard' : '/login'}>
            {user ? 'Member workspace' : 'Member sign in'}{' '}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </header>
      <main id="content" ref={main}>
        <Outlet />
      </main>
      <footer className="public-footer" ref={footer}>
        <p className="public-width">
          <strong>DLL Elite</strong>{' '}
          <span>Student Club Events &amp; Announcement Hub</span>
        </p>
      </footer>
    </div>
  )
}
