import { useData } from '../hooks/useData'
import { usePageState } from '../hooks/usePageState'
import { usePageResults, useValidFilter } from '../hooks/usePageResults'
import { State, Empty, Heading } from '../components/Common'
import { human, stamp } from '../utils/format'
import PageControls from '../components/PageControls'
import FilterForm, { DateFilters, SearchField } from '../components/FilterForm'

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
  const { params, setParams, entryKey } = usePageState(['page'])
  const { query, page, setPage } = usePageResults(
    'audit/?' + params,
    params,
    setParams,
  )
  const actions = useData('audit/actions/')
  const action = useValidFilter(params, setParams, 'action', actions.data)

  return (
    <>
      <Heading
        kicker="Administration"
        title="Audit Logs"
        description="Sign-ins and changes to organization records."
      />
      <FilterForm
        key={entryKey}
        onApply={setParams}
        onClear={() => setParams({})}
      >
        <SearchField
          label="Search audit logs"
          placeholder="Search user, action or record"
          value={params.get('search')}
        />
        <select
          name="role"
          aria-label="Filter by role"
          defaultValue={params.get('role') || ''}
        >
          <option value="">All roles</option>
          <option value="adviser">Adviser</option>
          <option value="officer">Officer</option>
          <option value="staff">Staff</option>
        </select>
        <select
          name="action"
          aria-label="Filter by action"
          key={actions.data ? 'ready' : 'loading'}
          defaultValue={action}
        >
          <option value="">All actions</option>
          {actions.data?.map((name) => (
            <option key={name} value={name}>
              {human(name.toLowerCase())}
            </option>
          ))}
        </select>
        <DateFilters params={params} />
      </FilterForm>
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
