import { useState } from 'react'
import { ArrowUpRight, Link2 } from 'lucide-react'
import { useData } from '../hooks/useData'
import { usePageResults, useValidFilter } from '../hooks/usePageResults'
import { Empty, State } from './Common'
import PageControls from './PageControls'

function externalUrl(value) {
  try {
    const url = new URL(value)
    if (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      return url.href
  } catch {
    return null
  }
  return null
}

export default function PublicUsefulLinks() {
  const [params, setParams] = useState(() => new URLSearchParams())
  const categories = useData('links/categories/?public=1')
  const category = useValidFilter(
    params,
    setParams,
    'category',
    categories.data,
  )
  const publicParams = new URLSearchParams(params)
  publicParams.set('public', '1')
  const { page, setPage, query } = usePageResults(
    'links/?' + publicParams,
    params,
    setParams,
  )
  return (
    <section id="useful-links" className="public-section public-tinted">
      <div className="public-width">
        <div className="public-resources-heading">
          <div className="public-section-heading">
            <h2>Useful Links</h2>
            <p>Find campus and organization resources shared by DLL Elite.</p>
          </div>
          {categories.data?.length > 1 && (
            <label className="public-resource-filter">
              <span>Category</span>
              <select
                aria-label="Useful Links category"
                value={category}
                onChange={(event) => {
                  const value = event.target.value
                  setParams(
                    new URLSearchParams(value ? { category: value } : {}),
                  )
                }}
              >
                <option value="">All categories</option>
                {categories.data.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <State query={query}>
          {({ results, count, next, previous }) => (
            <>
              {results.length > 0 ? (
                <div className="public-resource-grid">
                  {results.map((item) => {
                    const url = externalUrl(item.url)
                    const content = (
                      <>
                        <div className="public-resource-meta">
                          <span className="public-contact-icon">
                            <Link2 size={18} aria-hidden="true" />
                          </span>
                          <span className="public-category">
                            {item.category}
                          </span>
                        </div>
                        <h3>{item.title}</h3>
                        {item.description && <p>{item.description}</p>}
                        <span className="public-resource-action">
                          {url ? (
                            <>
                              Visit resource{' '}
                              <ArrowUpRight size={16} aria-hidden="true" />
                            </>
                          ) : (
                            'Link unavailable'
                          )}
                        </span>
                      </>
                    )
                    return (
                      <article key={item.id} className="public-resource-card">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={'Visit resource: ' + item.title}
                          >
                            {content}
                          </a>
                        ) : (
                          <div>{content}</div>
                        )}
                      </article>
                    )
                  })}
                </div>
              ) : (
                <Empty>
                  No public resources are available
                  {category ? ' in this category' : ' yet'}.
                </Empty>
              )}
              {(next || previous) && (
                <PageControls
                  page={page}
                  count={count}
                  next={next}
                  previous={previous}
                  onPage={setPage}
                  resource="Useful link"
                />
              )}
            </>
          )}
        </State>
      </div>
    </section>
  )
}
