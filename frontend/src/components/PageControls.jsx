import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PageControls({
  page,
  count,
  next,
  previous,
  onPage,
  resource,
}) {
  return (
    <nav className="audit-pagination" aria-label={resource + ' pages'}>
      <button disabled={!previous} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={17} />
        Previous
      </button>
      <span aria-live="polite">
        Page {page} · {count} {count === 1 ? 'record' : 'records'}
      </span>
      <button disabled={!next} onClick={() => onPage(page + 1)}>
        Next
        <ChevronRight size={17} />
      </button>
    </nav>
  )
}
