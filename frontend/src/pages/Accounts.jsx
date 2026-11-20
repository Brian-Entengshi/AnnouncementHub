import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, UserRoundPlus } from 'lucide-react'
import ResourcePage from '../components/ResourcePage'
import { Heading, State, Empty } from '../components/Common'
import AccountTable from '../components/AccountTable'
import ConfirmAction from '../components/ConfirmAction'
import PageControls from '../components/PageControls'
import { catalog } from '../services/catalog'
import { api } from '../services/api'
import { useData } from '../hooks/useData'
import { useAuth } from '../context/auth'

function AccountList() {
  const { adviser } = useAuth()
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(
    ['search', 'role', 'status', 'team_id'].map((key) => [
      key,
      params.get(key) || '',
    ]),
  )
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const query = useData(
    'accounts/?' + new URLSearchParams({ ...filters, page }),
  )
  const teams = useData('teams/?core=1', true)
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const verb = target?.is_active ? 'Deactivate' : 'Activate'

  function changePage(next) {
    setParams({
      ...Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value),
      ),
      page: next,
    })
  }

  async function changeStatus() {
    setBusy(true)
    setError('')
    try {
      await api('accounts/' + target.id + '/', {
        method: 'PATCH',
        body: { is_active: !target.is_active },
      })
      setMessage(
        (target.full_name || target.username) +
          (target.is_active ? ' was deactivated.' : ' was activated.'),
      )
      setTarget(null)
      if (page > 1 && filters.status && query.data?.results.length === 1)
        changePage(page - 1)
      else query.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Heading
        kicker="Administration"
        title="Account Management"
        description="Find members, review team assignments, and manage account access."
      >
        <Link className="button primary" to="/accounts/new">
          <UserRoundPlus size={17} />
          New account
        </Link>
      </Heading>
      <form
        className="toolbar workspace-filters"
        key={JSON.stringify(filters)}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          setParams(
            Object.fromEntries(
              [...form]
                .map(([key, value]) => [key, value.trim()])
                .filter(([, value]) => value),
            ),
          )
        }}
      >
        <label className="search">
          <Search size={17} />
          <input
            name="search"
            aria-label="Search accounts"
            placeholder="Search name or username"
            defaultValue={filters.search}
          />
        </label>
        {adviser && (
          <select
            name="role"
            aria-label="Account role"
            defaultValue={filters.role}
          >
            <option value="">All roles</option>
            <option value="adviser">Admin / Adviser</option>
            <option value="officer">Organization Officer</option>
            <option value="staff">Organization Staff</option>
          </select>
        )}
        <select
          name="status"
          aria-label="Account status"
          defaultValue={filters.status}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          name="team_id"
          aria-label="Account team"
          defaultValue={filters.team_id}
        >
          <option value="">All teams</option>
          {teams.data?.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <button className="primary">Apply filters</button>
        {Object.values(filters).some(Boolean) && (
          <button type="button" onClick={() => setParams({})}>
            Clear
          </button>
        )}
      </form>
      {message && (
        <p role="status" className="success-notice">
          {message}
        </p>
      )}
      <section className="panel audit-panel">
        <State query={query}>
          {({ results, count, next, previous }) => (
            <>
              {results.length ? (
                <AccountTable
                  accounts={results}
                  onStatus={(account) => {
                    setError('')
                    setTarget(account)
                  }}
                />
              ) : (
                <Empty>No accounts match these filters.</Empty>
              )}
              <PageControls
                page={page}
                count={count}
                next={next}
                previous={previous}
                onPage={changePage}
                resource="Account"
              />
            </>
          )}
        </State>
      </section>
      {target && (
        <ConfirmAction
          title={verb + ' ' + (target.full_name || target.username) + '?'}
          label={verb + ' account'}
          busy={busy}
          error={error}
          cancel={() => setTarget(null)}
          confirm={changeStatus}
        >
          {target.is_active
            ? 'The account will lose access to the member workspace.'
            : 'The account will regain access to the member workspace.'}
        </ConfirmAction>
      )}
    </>
  )
}

export default function Accounts() {
  return <ResourcePage config={catalog.accounts} list={AccountList} />
}
