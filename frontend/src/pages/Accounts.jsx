import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserRoundPlus } from 'lucide-react'
import ResourcePage from '../components/ResourcePage'
import { Heading, State, Empty } from '../components/Common'
import AccountTable from '../components/AccountTable'
import ConfirmAction from '../components/ConfirmAction'
import PageControls from '../components/PageControls'
import AccountScroll from '../components/AccountScroll'
import FilterForm, { SearchField } from '../components/FilterForm'
import { catalog } from '../services/catalog'
import { api } from '../services/api'
import { useData } from '../hooks/useData'
import { usePageState } from '../hooks/usePageState'
import { usePageResults, useValidFilter } from '../hooks/usePageResults'
import { useAuth } from '../context/auth'

function AccountList() {
  const { adviser } = useAuth()
  const { params, setParams, scope, entryKey } = usePageState(['page'])
  const { query, page, setPage } = usePageResults(
    'accounts/?' + params,
    params,
    setParams,
  )
  const teams = useData('teams/?include_inactive=1', true)
  const team = useValidFilter(
    params,
    setParams,
    'team_id',
    teams.data,
    (item) => String(item.id),
  )
  const [target, setTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const verb = target?.is_active ? 'Deactivate' : 'Activate'

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
      if (page > 1 && params.has('status') && query.data?.results.length === 1)
        setPage(page - 1)
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
      <FilterForm
        key={entryKey}
        onApply={setParams}
        onClear={() => setParams({})}
      >
        <SearchField
          label="Search accounts"
          placeholder="Search name or username"
          value={params.get('search')}
        />
        {adviser && (
          <select
            name="role"
            aria-label="Account role"
            defaultValue={params.get('role') || ''}
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
          defaultValue={params.get('status') || ''}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          name="team_id"
          aria-label="Account team"
          key={teams.data ? 'ready' : 'loading'}
          defaultValue={team}
        >
          <option value="">All teams</option>
          {teams.data?.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name + (team.is_active ? '' : ' (inactive)')}
            </option>
          ))}
        </select>
      </FilterForm>
      {message && (
        <p role="status" className="success-notice">
          {message}
        </p>
      )}
      <section className="panel audit-panel">
        <State query={query}>
          {({ results, count, next, previous }) => (
            <>
              <AccountScroll scope={scope} resultKey={params.toString()}>
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
              </AccountScroll>
              <PageControls
                page={page}
                count={count}
                next={next}
                previous={previous}
                onPage={setPage}
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
