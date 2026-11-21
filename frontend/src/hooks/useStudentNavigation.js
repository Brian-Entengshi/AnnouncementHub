import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

export const studentSections = [
  ['Home', 'home'],
  ['About', 'about'],
  ['Announcements', 'announcements'],
  ['Club Events', 'events'],
  ['Useful Links', 'useful-links'],
  ['Contacts', 'contacts'],
]

export function useStudentNavigation(header, main, footer) {
  const { hash, pathname, key } = useLocation()
  const navigationType = useNavigationType()
  const [active, setActive] = useState('home')
  const isLandingPage = pathname === '/student' || pathname === '/student/'

  useLayoutEffect(() => {
    const site = header.current?.parentElement
    if (!site) return
    const measure = () =>
      site.style.setProperty(
        '--public-header-height',
        header.current.offsetHeight + 'px',
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header.current)
    return () => observer.disconnect()
  }, [header])

  useEffect(() => {
    if (!isLandingPage) return

    const sections = studentSections
      .map(([, id]) => document.getElementById(id))
      .filter(Boolean)
    if (!sections.length) return

    let sectionObserver
    let activationOffset = 0
    let frame

    function update() {
      const { scrollHeight } = document.documentElement
      const scrollRange = scrollHeight - window.innerHeight
      if (scrollRange > 4 && scrollRange - window.scrollY <= 12) {
        setActive(sections.at(-1).id)
        return
      }
      const current = sections.findLast(
        (section) => section.getBoundingClientRect().top <= activationOffset,
      )
      setActive(current?.id || sections[0].id)
    }

    function onScroll() {
      if (frame !== undefined) return
      frame = window.requestAnimationFrame(() => {
        frame = undefined
        update()
      })
    }

    function observeSections() {
      sectionObserver?.disconnect()
      const height = window.innerHeight
      activationOffset = Math.min(
        height - 2,
        header.current.offsetHeight + Math.min(36, height * 0.07),
      )
      sectionObserver = new IntersectionObserver(update, {
        rootMargin:
          '-' +
          activationOffset +
          'px 0px -' +
          Math.max(0, height - activationOffset - 2) +
          'px 0px',
      })
      sections.forEach((section) => sectionObserver.observe(section))
      update()
    }

    const footerObserver = new IntersectionObserver(update, { threshold: 1 })
    footerObserver.observe(footer.current)
    const layoutObserver = new ResizeObserver(update)
    layoutObserver.observe(main.current)
    const headerObserver = new ResizeObserver(observeSections)
    headerObserver.observe(header.current)
    window.addEventListener('resize', observeSections)
    window.addEventListener('scroll', onScroll, { passive: true })
    observeSections()

    return () => {
      sectionObserver.disconnect()
      footerObserver.disconnect()
      layoutObserver.disconnect()
      headerObserver.disconnect()
      window.removeEventListener('resize', observeSections)
      window.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [footer, header, main, isLandingPage])

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    const section = document.getElementById(hash.slice(1))
    if (!section) return

    const animated =
      navigationType !== 'POP' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const started = performance.now()
    let previousTarget
    function align() {
      const top = section.getBoundingClientRect().top + window.scrollY
      const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || 0
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight
      const target = Math.max(0, Math.min(top - margin, maxScroll))
      if (previousTarget !== undefined && Math.abs(target - previousTarget) < 1)
        return
      previousTarget = target
      window.scrollTo({
        top: target,
        behavior:
          animated && performance.now() - started < 550 ? 'smooth' : 'instant',
      })
    }
    align()
    // A section can move while the earlier event and announcement cards load.
    const observer = new ResizeObserver(align)
    observer.observe(main.current)
    const inputEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown']
    function stopAligning(event) {
      if (
        event?.type === 'keydown' &&
        ![
          'ArrowDown',
          'ArrowUp',
          'PageDown',
          'PageUp',
          'Home',
          'End',
          ' ',
        ].includes(event.key)
      )
        return
      observer.disconnect()
      inputEvents.forEach((type) =>
        window.removeEventListener(type, stopAligning),
      )
    }
    inputEvents.forEach((type) =>
      window.addEventListener(type, stopAligning, { passive: true }),
    )
    return () => stopAligning()
  }, [hash, key, main, navigationType])

  return isLandingPage ? active : null
}
