import FilterForm, { DateFilters, SearchField } from './FilterForm'
import { useData } from '../hooks/useData'
import { useValidFilter } from '../hooks/usePageResults'
import { human } from '../utils/format'

const statuses = {
  announcements: ['published', 'draft', 'archived'],
  activities: ['upcoming', 'ongoing', 'completed'],
  reservations: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
  notices: ['current', 'upcoming', 'expired'],
}

export default function ResourceFilters({
  config,
  manager,
  params,
  setParams,
  entryKey,
}) {
  const kind = config.api
  const categoryEnabled = ['announcements', 'links'].includes(kind)
  const categoryChoices = useData(
    categoryEnabled
      ? kind +
          '/categories/' +
          (manager && kind === 'announcements' ? '?manage=1' : '')
      : null,
  )
  const venueChoices = useData(
    kind === 'reservations' ? 'venues/?bookable=1' : null,
    true,
  )
  const teams = useData(
    kind === 'reservations' && manager ? 'teams/?include_inactive=1' : null,
    true,
  )
  const category = useValidFilter(
    params,
    setParams,
    'category',
    categoryChoices.data,
  )
  const venue = useValidFilter(
    params,
    setParams,
    'venue_id',
    venueChoices.data,
    (item) => String(item.id),
  )
  const team = useValidFilter(
    params,
    setParams,
    'team_id',
    teams.data,
    (item) => String(item.id),
  )
  const statusChoices =
    kind === 'announcements' && !manager ? [] : statuses[kind] || []
  const status = params.get('status') || ''
  const retained = kind === 'venues' && manager && status ? { status } : {}
  function apply(filters) {
    setParams({ ...filters, ...retained })
  }

  return (
    <FilterForm key={entryKey} onApply={apply} onClear={() => apply({})}>
      <SearchField
        label="Search records"
        placeholder={'Search ' + config.name.toLowerCase() + '…'}
        value={params.get('search')}
      />
      {categoryEnabled && (
        <select
          key={categoryChoices.data ? 'category-ready' : 'category-loading'}
          name="category"
          aria-label="Filter by category"
          defaultValue={category}
        >
          <option value="">All categories</option>
          {categoryChoices.data?.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      )}
      {statusChoices.length > 0 && (
        <select
          name="status"
          aria-label="Filter by status"
          defaultValue={status}
        >
          <option value="">All statuses</option>
          {statusChoices
            .filter((item) => item !== 'expired' || manager)
            .map((item) => (
              <option key={item} value={item}>
                {human(item)}
              </option>
            ))}
        </select>
      )}
      {kind === 'reservations' && (
        <select
          key={venueChoices.data ? 'venue-ready' : 'venue-loading'}
          name="venue_id"
          aria-label="Filter by venue"
          defaultValue={venue}
        >
          <option value="">All venues</option>
          {venueChoices.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      )}
      {kind === 'reservations' && manager && (
        <>
          <select
            key={teams.data ? 'team-ready' : 'team-loading'}
            name="team_id"
            aria-label="Filter by team"
            defaultValue={team}
          >
            <option value="">All teams</option>
            {teams.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name + (item.is_active ? '' : ' (inactive)')}
              </option>
            ))}
          </select>
          <label className="check">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={params.get('mine') === '1'}
            />
            My requests
          </label>
        </>
      )}
      {['announcements', 'activities', 'reservations'].includes(kind) && (
        <DateFilters params={params} />
      )}
    </FilterForm>
  )
}
