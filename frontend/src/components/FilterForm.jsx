import { Filter, RotateCcw, Search } from 'lucide-react'

export default function FilterForm({
  children,
  onApply,
  onClear,
  label = 'Filters',
}) {
  function apply(event) {
    event.preventDefault()
    const values = [...new FormData(event.currentTarget)]
      .map(([name, value]) => [name, value.trim()])
      .filter(([, value]) => value !== '')
    onApply(Object.fromEntries(values))
  }

  return (
    <form
      className="toolbar workspace-filters"
      aria-label={label}
      onSubmit={apply}
    >
      {children}
      <div className="filter-actions">
        <button className="primary">
          <Filter size={15} aria-hidden="true" />
          Apply filters
        </button>
        <button type="button" onClick={onClear}>
          <RotateCcw size={15} aria-hidden="true" />
          Clear
        </button>
      </div>
    </form>
  )
}

export function SearchField({ label, value, placeholder }) {
  return (
    <label className="search">
      <Search size={17} aria-hidden="true" />
      <input
        name="search"
        aria-label={label}
        placeholder={placeholder}
        defaultValue={value || ''}
      />
    </label>
  )
}

export function DateFilters({ params }) {
  return (
    <>
      <label className="filter-date">
        From{' '}
        <input
          type="date"
          name="from"
          defaultValue={params.get('from') || ''}
        />
      </label>
      <label className="filter-date">
        To <input type="date" name="to" defaultValue={params.get('to') || ''} />
      </label>
    </>
  )
}
