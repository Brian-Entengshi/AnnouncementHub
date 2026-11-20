import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Eye, Pencil, Plus, Trash2, UserRoundMinus } from 'lucide-react'
import { useAuth } from '../context/auth'
import { useData } from '../hooks/useData'
import { usePageResults } from '../hooks/usePageResults'
import { usePageState } from '../hooks/usePageState'
import { api } from '../services/api'
import { catalog } from '../services/catalog'
import { formatDate } from '../utils/format'
import AccountScroll from '../components/AccountScroll'
import { Badge, Empty, Heading, State } from '../components/Common'
import ConfirmAction from '../components/ConfirmAction'
import PageControls from '../components/PageControls'
import ResourcePage from '../components/ResourcePage'

const config = catalog.teams
const path = '/' + config.path

function PublicTeams() {
  const { params, setParams } = usePageState(['page'])
  const { query, page, setPage } = usePageResults(
    'teams/?' + params,
    params,
    setParams,
  )
  return (
    <>
      <Heading
        kicker={config.group}
        title={config.name}
        description={config.description}
      />
      <State query={query}>
        {({ results, count, next, previous }) => (
          <>
            <div className="record-grid">
              {results.map((team) => (
                <article className="panel record-card" key={team.id}>
                  <h2>{team.name}</h2>
                  <p>{team.description}</p>
                </article>
              ))}
            </div>
            {count === 0 && <Empty>No teams are listed.</Empty>}
            {(next || previous) && (
              <PageControls
                {...{ page, count, next, previous }}
                onPage={setPage}
                resource="Team"
              />
            )}
          </>
        )}
      </State>
    </>
  )
}

function TeamTabs({ teams, selected, onSelect }) {
  const bar = useRef(null)
  useEffect(() => {
    const strip = bar.current
    function revealSelection() {
      const tab = strip.querySelector('[aria-selected="true"]')
      if (!tab) return
      const offset = tab.offsetLeft - strip.scrollLeft
      if (offset < 0) strip.scrollLeft += offset
      if (offset + tab.offsetWidth > strip.clientWidth)
        strip.scrollLeft += offset + tab.offsetWidth - strip.clientWidth
    }
    revealSelection()
    const observer = new ResizeObserver(revealSelection)
    observer.observe(strip)
    return () => observer.disconnect()
  }, [selected])

  function move(e, index) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1 }
    let next
    if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = teams.length - 1
    else if (e.key in offsets)
      next = (index + offsets[e.key] + teams.length) % teams.length
    else return
    e.preventDefault()
    bar.current.children[next].focus()
    onSelect(teams[next].id)
  }

  return (
    <div
      className="team-tabs"
      role="tablist"
      aria-label="Organization teams"
      ref={bar}
    >
      {teams.map((team, index) => (
        <button
          key={team.id}
          type="button"
          role="tab"
          id={'team-tab-' + team.id}
          aria-selected={team.id === selected}
          aria-controls="team-roster"
          tabIndex={team.id === selected ? 0 : -1}
          onClick={() => onSelect(team.id)}
          onKeyDown={(e) => move(e, index)}
        >
          {team.name}
        </button>
      ))}
    </div>
  )
}

function MemberTable({ members, manager, onRemove }) {
  const headings = [
    'Member name',
    'Username',
    'Position',
    'Account status',
    'Joined',
  ]
  if (manager) headings.push('Actions')
  return (
    <table className="audit-table account-table" aria-label="Team members">
      <thead>
        <tr>
          {headings.map((label) => (
            <th key={label} scope="col">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {members.map((member) => {
          const name = member.full_name || member.username
          const account = '/accounts/' + member.id
          const cells = [
            manager ? (
              <Link key="name" className="account-name" to={account}>
                {name}
              </Link>
            ) : (
              name
            ),
            member.username,
            member.position || 'Staff member',
            <Badge
              key="status"
              value={member.is_active ? 'active' : 'inactive'}
            />,
            formatDate(member.date_joined),
          ]
          if (manager)
            cells.push(
              <div key="actions" className="table-actions">
                <Link
                  to={account}
                  aria-label={'View ' + name}
                  title="View account"
                >
                  <Eye size={16} />
                </Link>
                <Link
                  to={account + '/edit'}
                  aria-label={'Edit ' + name}
                  title="Edit account"
                >
                  <Pencil size={16} />
                </Link>
                <button
                  type="button"
                  aria-label={'Remove ' + name + ' from team'}
                  title="Remove from team"
                  onClick={() => onRemove(member)}
                >
                  <UserRoundMinus size={16} />
                </button>
              </div>,
            )
          return (
            <tr key={member.id}>
              {cells.map((cell, index) => (
                <td key={headings[index]} data-label={headings[index]}>
                  {cell}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function TeamRoster({ team, manager, params, setParams, scope, onDelete }) {
  const endpoint = 'teams/' + team.id + '/'
  const { query, page, setPage } = usePageResults(
    endpoint + 'members/?page=' + (params.get('page') || 1),
    params,
    setParams,
  )
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const member = confirm?.member
  const count = query.data?.count ?? team.member_count

  async function remove() {
    setBusy(true)
    setError('')
    try {
      await api(member ? endpoint + 'members/' + member.id + '/' : endpoint, {
        method: 'DELETE',
      })
      setConfirm(null)
      if (!member) onDelete()
      else if (page > 1 && query.data?.results.length === 1) setPage(page - 1)
      else query.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      id="team-roster"
      role="tabpanel"
      aria-labelledby={'team-tab-' + team.id}
      tabIndex={0}
    >
      <div className="panel team-summary">
        <div>
          <h2>{team.name}</h2>
          <p>{team.description}</p>
          <strong>
            {count} {count === 1 ? 'assigned member' : 'assigned members'}
          </strong>
        </div>
        {manager && (
          <div className="actions">
            <Link className="button" to={path + '/' + team.id + '/edit'}>
              <Pencil size={16} /> Edit team
            </Link>
            <Link className="button" to="/accounts">
              Manage assignments
            </Link>
            {!team.is_core && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setError('')
                  setConfirm({})
                }}
              >
                <Trash2 size={16} /> Delete team
              </button>
            )}
          </div>
        )}
      </div>
      <section className="panel audit-panel" aria-label="Member roster">
        <State query={query}>
          {({ results, count, next, previous }) => (
            <>
              <AccountScroll
                scope={scope}
                resultKey={team.id + ':' + page}
                label="Scrollable team members"
              >
                {results.length ? (
                  <MemberTable
                    members={results}
                    manager={manager}
                    onRemove={(member) => {
                      setError('')
                      setConfirm({ member })
                    }}
                  />
                ) : (
                  <Empty>No staff members are assigned to this team.</Empty>
                )}
              </AccountScroll>
              <PageControls
                {...{ page, count, next, previous }}
                onPage={setPage}
                resource="Team member"
              />
            </>
          )}
        </State>
      </section>
      {confirm && (
        <ConfirmAction
          title={
            member
              ? 'Remove ' +
                (member.full_name || member.username) +
                ' from ' +
                team.name +
                '?'
              : 'Delete ' + team.name + '?'
          }
          label={member ? 'Remove membership' : 'Delete team'}
          busy={busy}
          error={error}
          cancel={() => setConfirm(null)}
          confirm={remove}
        >
          {member
            ? 'Only this team assignment will be removed.'
            : 'Teams linked to accounts or reservations must be made inactive to preserve those records.'}
        </ConfirmAction>
      )}
    </section>
  )
}

function InactiveTeams() {
  const [open, setOpen] = useState(false)
  const query = useData(open ? 'teams/?inactive=1' : null, true)
  return (
    <details
      className="inactive-teams"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Inactive teams</summary>
      {open && (
        <State query={query}>
          {(teams) =>
            teams.length ? (
              <ul>
                {teams.map((team) => (
                  <li key={team.id}>
                    <Link to={path + '/' + team.id + '?settings=1'}>
                      {team.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>No inactive teams.</Empty>
            )
          }
        </State>
      )}
    </details>
  )
}

function MemberTeams() {
  const { adviser, manager } = useAuth()
  const { params, setParams, scope } = usePageState(['team', 'page'])
  const teams = useData('teams/', true)
  const requested = params.get('team')
  const selected = teams.data?.find((team) => String(team.id) === requested)
  const team = selected || teams.data?.[0]
  useEffect(() => {
    if (requested && teams.data && !selected) setParams({}, { replace: true })
  }, [requested, selected, setParams, teams.data])

  return (
    <>
      <Heading
        kicker={config.group}
        title={config.name}
        description={config.description}
      >
        {adviser && (
          <Link className="button primary" to={path + '/new'}>
            <Plus size={17} /> New team
          </Link>
        )}
      </Heading>
      <State query={teams}>
        {(items) =>
          team ? (
            <>
              <TeamTabs
                teams={items}
                selected={team.id}
                onSelect={(id) => {
                  if (id !== team.id) setParams({ team: id })
                }}
              />
              <TeamRoster
                key={team.id}
                team={team}
                manager={manager}
                params={requested && !selected ? new URLSearchParams() : params}
                setParams={setParams}
                scope={scope}
                onDelete={() => {
                  setParams({}, { replace: true })
                  teams.reload()
                }}
              />
            </>
          ) : (
            <Empty>No active teams.</Empty>
          )
        }
      </State>
      {manager && <InactiveTeams />}
    </>
  )
}

export default function Teams() {
  const { user, manager } = useAuth()
  const { id } = useParams()
  const { pathname, search } = useLocation()
  if (!user) return id ? <Navigate replace to={path} /> : <PublicTeams />
  if (
    pathname.endsWith('/new') ||
    pathname.endsWith('/edit') ||
    (manager && id && new URLSearchParams(search).has('settings'))
  )
    return <ResourcePage config={config} />
  if (id) return <Navigate replace to={path + '?team=' + id + '&page=1'} />
  return <MemberTeams key={user.id} />
}
