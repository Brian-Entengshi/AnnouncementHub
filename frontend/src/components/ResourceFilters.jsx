import FilterForm, { DateFilters, SearchField } from './FilterForm'
import { useData } from '../hooks/useData'
import { useValidFilter } from '../hooks/usePageResults'
import { human } from '../utils/format'

const statuses = {
  announcements: ['published', 'draft', 'archived'],
  activities: ['upcoming', 'ongoing', 'completed'],
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
  const category = useValidFilter(
    params,
    setParams,
    'category',
    categoryChoices.data,
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
      {kind === 'notices' && manager && (
        <select
          name="publication_status"
          aria-label="Filter by publication status"
          defaultValue={params.get('publication_status') || ''}
        >
          <option value="">All publication statuses</option>
          {['draft', 'published', 'archived'].map((status) => (
            <option key={status} value={status}>
              {human(status)}
            </option>
          ))}
        </select>
      )}
      {kind === 'links' && manager && (
        <select
          name="is_public"
          aria-label="Filter by link visibility"
          defaultValue={params.get('is_public') || ''}
        >
          <option value="">All visibility</option>
          <option value="true">Public</option>
          <option value="false">Members only</option>
        </select>
      )}
      {['announcements', 'activities', 'notices'].includes(kind) && (
        <DateFilters params={params} />
      )}
    </FilterForm>
  )
}
