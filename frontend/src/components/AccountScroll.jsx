import { useLayoutEffect, useRef } from 'react'
import { readPageState, writePageState } from '../hooks/usePageState'

export default function AccountScroll({
  scope,
  resultKey,
  label = 'Scrollable accounts',
  children,
}) {
  const ref = useRef(null)
  const storage = scope + ':scroll'
  useLayoutEffect(() => {
    const element = ref.current
    const saved = readPageState(storage)
    element.scrollTop = saved?.resultKey === resultKey ? saved.top : 0
    function remember() {
      writePageState(storage, { resultKey, top: element.scrollTop })
    }
    element.addEventListener('scroll', remember, { passive: true })
    return () => {
      remember()
      element.removeEventListener('scroll', remember)
    }
  }, [resultKey, storage])

  return (
    <div
      className="account-scroll"
      role="region"
      aria-label={label}
      ref={ref}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
