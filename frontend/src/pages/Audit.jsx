import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useData } from '../hooks/useData'
import { State, Empty, Heading } from '../components/Common'
import { human, stamp } from '../utils/format'
import PageControls from '../components/PageControls'

const headings = [
  'User',
  'Role',
  'Action',
  'Description',
  'Affected record',
  'Date and time',
]

function AuditTable({ records }) {
  return (
    <table className="audit-table" aria-label="Audit log entries">
      <thead>
        <tr>
          {headings.map((name) => (
            <th key={name} scope="col">
              {name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {records.map((record) => {
          const values = [
            record.actor || 'Anonymous',
            record.actor_role ? human(record.actor_role) : '—',
            <span
              key="action"
              className={
                'audit-action ' +
                (record.action === 'FAILED_LOGIN'
                  ? 'failed-action'
                  : record.resource === 'authentication'
                    ? 'auth-action'
                    : '')
              }
            >
              {record.resource === 'authentication'
                ? human(record.action.toLowerCase())
                : record.action}
            </span>,
            record.description ||
              human(
                record.action +
                  ' ' +
                  record.resource +
                  ' “' +
                  record.label +
                  '”.',
              ),
            record.label || '—',
            stamp(record.at),
          ]
          return (
            <tr key={record.id}>
              {values.map((value, i) => (
                <td key={headings[i]} data-label={headings[i]}>
                  {value}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function Audit() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1)
  const search = params.get('search') || ''
  const role = params.get('role') || ''
  const query = useData('audit/?' + new URLSearchParams({ page, search, role }))

  function setPage(next) {
    setParams({ ...(search && { search }), ...(role && { role }), page: next })
  }

  return (
    <>
      <Heading
        kicker="Administration"
        title="Audit Logs"
        description="Sign-ins, reservation decisions and changes to organization records."
      />
      <form
        className="toolbar audit-filters"
        key={search + ':' + role}
        onSubmit={(e) => {
          e.preventDefault()
          const fields = new FormData(e.currentTarget)
          const term = fields.get('search').trim()
          const actorRole = fields.get('role')
          setParams({
            ...(term && { search: term }),
            ...(actorRole && { role: actorRole }),
          })
        }}
      >
        <label className="search">
          <Search size={17} aria-hidden="true" />
          <input
            name="search"
            aria-label="Search audit logs"
            placeholder="Search user, action or record"
            defaultValue={search}
          />
        </label>
        <select name="role" aria-label="Filter by role" defaultValue={role}>
          <option value="">All roles</option>
          <option value="adviser">Adviser</option>
          <option value="officer">Officer</option>
          <option value="staff">Staff</option>
        </select>
        <button className="primary">Apply filters</button>
        {(search || role) && (
          <button type="button" onClick={() => setParams({})}>
            Clear
          </button>
        )}
      </form>
      <section className="panel audit-panel">
        <State query={query}>
          {({ results, count, next, previous }) => (
            <>
              {results.length ? (
                <AuditTable records={results} />
              ) : (
                <Empty>No matching audit logs.</Empty>
              )}
              <PageControls
                page={page}
                count={count}
                next={next}
                previous={previous}
                onPage={setPage}
                resource="Audit log"
              />
            </>
          )}
        </State>
      </section>
    </>
  )
}
