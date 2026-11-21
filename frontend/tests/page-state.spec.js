import { expect, test } from '@playwright/test'

async function login(page, username = 'test-adviser') {
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/dashboard$/)
}

async function menu(page, name) {
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name, exact: true })
    .click()
}

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
const apply = (page) =>
  page.getByRole('button', { name: 'Apply filters' }).click()
const clear = (page) =>
  page.getByRole('button', { name: 'Clear', exact: true }).click()

const lists = [
  {
    page: 'Announcements',
    search: 'assembly',
    facet: 'category',
    filter: 'Organization',
    match: 'General assembly guidelines',
    extra: 'Open call for student creatives',
  },
  {
    page: 'Organization Activities',
    search: 'leadership',
    facet: 'status',
    filter: 'ongoing',
    match: 'Student leadership development',
    extra: 'Campus stories project',
  },
  {
    page: 'Useful Links',
    search: 'Scholar',
    facet: 'category',
    filter: 'Research',
    match: 'Google Scholar',
    extra: 'Campus library guide',
  },
]
for (const scenario of lists) {
  test(
    scenario.page + ' applies, remembers and clears server-side filters',
    async ({ page }) => {
      await login(page)
      await menu(page, scenario.page)
      const search = page.getByLabel('Search records', { exact: true })
      const facet = page.getByLabel('Filter by ' + scenario.facet, {
        exact: true,
      })
      const cards = page.locator('.record-grid article')
      await expect(
        page.getByRole('link', { name: scenario.extra, exact: true }),
      ).toBeVisible()
      await search.fill(scenario.search)
      await facet.selectOption(scenario.filter)
      if (scenario.venue)
        await page
          .getByLabel('Filter by venue')
          .selectOption({ label: scenario.venue })
      if (scenario.page === 'Organization Activities')
        await page.getByLabel('From', { exact: true }).fill(today())
      await expect(
        page.getByRole('link', { name: scenario.extra, exact: true }),
      ).toBeVisible()
      await apply(page)
      await expect(cards).toHaveCount(1)
      await expect(
        cards.getByRole('link', { name: scenario.match, exact: true }),
      ).toBeVisible()
      await menu(page, 'Dashboard')
      await menu(page, scenario.page)
      await expect(cards).toHaveCount(1)
      await page.reload()
      await expect(search).toHaveValue(scenario.search)
      await expect(facet).toHaveValue(scenario.filter)
      await expect(cards).toHaveCount(1)
      await clear(page)
      await expect(search).toHaveValue('')
      await expect(facet).toHaveValue('')
      await expect(
        page.getByRole('link', { name: scenario.extra, exact: true }),
      ).toBeVisible()
      await menu(page, 'Dashboard')
      await menu(page, scenario.page)
      await page.reload()
      await expect(search).toHaveValue('')
      await expect(facet).toHaveValue('')
      await expect(
        page.getByRole('link', { name: scenario.extra, exact: true }),
      ).toBeVisible()
    },
  )
}

test('account filters, page and internal scroll restore without leaking to another account', async ({
  page,
}) => {
  await login(page)
  await menu(page, 'Account Management')
  const table = page.getByRole('table', { name: 'Accounts' })
  const scroller = page.getByRole('region', { name: 'Scrollable accounts' })
  const search = page.getByLabel('Search accounts')
  await search.fill('Directory')
  await page.getByLabel('Account role').selectOption('staff')
  await page.getByLabel('Account status').selectOption('active')
  await apply(page)
  await expect(table.getByRole('row')).toHaveCount(16)
  await expect(page.getByText('Page 1 · 21 records')).toBeVisible()
  const height = await scroller.evaluate((el) => el.clientHeight)
  expect(await scroller.evaluate((el) => el.scrollHeight)).toBeGreaterThan(
    height,
  )
  await scroller.evaluate((el) => {
    el.scrollTop = 160
    el.dispatchEvent(new Event('scroll'))
  })
  expect(
    await table
      .getByRole('columnheader')
      .first()
      .evaluate((el) =>
        Math.abs(
          el.getBoundingClientRect().top -
            el.closest('.account-scroll').getBoundingClientRect().top,
        ),
      ),
  ).toBeLessThan(2)
  await menu(page, 'Dashboard')
  await menu(page, 'Account Management')
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBe(160)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Page 2 · 21 records')).toBeVisible()
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0)
  expect(await scroller.evaluate((el) => el.clientHeight)).toBe(height)
  await page.goBack()
  await expect(page.getByText('Page 1 · 21 records')).toBeVisible()
  await page.goForward()
  await expect(page.getByText('Page 2 · 21 records')).toBeVisible()
  await menu(page, 'Dashboard')
  await menu(page, 'Account Management')
  await page.reload()
  await expect(page.getByText('Page 2 · 21 records')).toBeVisible()
  await expect(search).toHaveValue('Directory')
  expect(page.url()).not.toContain('Directory')
  await clear(page)
  await expect(search).toHaveValue('')
  await expect(page.getByText(/Page 1 · /)).toBeVisible()
  await page.reload()
  await expect(search).toHaveValue('')
  await search.fill('Directory')
  await apply(page)
  await expect(page.getByText('Page 1 · 21 records')).toBeVisible()
  await page.goto('/accounts?page=999')
  await expect(page.getByText('Page 1 · 21 records')).toBeVisible()
  await page.setViewportSize({ width: 390, height: 850 })
  expect(
    await scroller.evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/student$/)
  await login(page, 'test-officer')
  await menu(page, 'Account Management')
  await expect(search).toHaveValue('')
  await expect(page.getByLabel('Account status')).toHaveValue('')
  await expect(page.getByText(/Page 1 · /)).toBeVisible()
})

test('a deleted category clears only the stale selection', async ({ page }) => {
  await login(page)
  const { csrf } = await (await page.request.get('/api/session/')).json()
  const headers = { 'X-CSRFToken': csrf }
  const created = await page.request.post('/api/links/', {
    headers,
    data: {
      title: 'Temporary reference guide',
      category: 'Temporary category',
      description: 'Filter recovery check',
      url: 'https://example.org/',
    },
  })
  expect(created.status()).toBe(201)
  const record = await created.json()
  await menu(page, 'Useful Links')
  await page.getByLabel('Search records').fill('guide')
  await page.getByLabel('Filter by category').selectOption('Temporary category')
  await apply(page)
  await expect(page.getByRole('link', { name: record.title })).toBeVisible()
  await menu(page, 'Dashboard')
  expect(
    (
      await page.request.delete('/api/links/' + record.id + '/', { headers })
    ).status(),
  ).toBe(204)
  await menu(page, 'Useful Links')
  await expect(page.getByLabel('Filter by category')).toHaveValue('')
  await expect(page.getByLabel('Search records')).toHaveValue('guide')
  await expect(
    page.getByRole('link', { name: 'Campus library guide' }),
  ).toBeVisible()
})

test('audit filters and pagination survive navigation, then Clear stays cleared', async ({
  page,
}) => {
  await login(page)
  await menu(page, 'Audit Logs')
  await page.getByLabel('Filter by role').selectOption('adviser')
  await page.getByLabel('Filter by action').selectOption('LOGIN')
  await page.getByLabel('From', { exact: true }).fill(today())
  await apply(page)
  const table = page.getByRole('table', { name: 'Audit log entries' })
  await expect(table.getByRole('row')).toHaveCount(21)
  await expect(table.getByText('Sign in', { exact: true })).toHaveCount(0)
  await expect(table.getByText('Login', { exact: true })).toHaveCount(20)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/Page 2 · /)).toBeVisible()
  await menu(page, 'Dashboard')
  await menu(page, 'Audit Logs')
  await page.reload()
  await expect(page.getByText(/Page 2 · /)).toBeVisible()
  await expect(page.getByLabel('Filter by action')).toHaveValue('LOGIN')
  await clear(page)
  await expect(page.getByText(/Page 1 · /)).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Filter by action')).toHaveValue('')
  await expect(page.getByLabel('From', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Filter by role')).toHaveValue('')
})

test('weekly month, date and filter are restored after using the sidebar and refresh', async ({
  page,
}) => {
  await login(page)
  await menu(page, 'Weekly Events')
  await page.getByLabel('Show dates').selectOption('events')
  const monthMode = page.getByRole('button', { name: 'Monthly Calendar View' })
  await monthMode.click()
  await page.getByRole('button', { name: 'Next month' }).click()
  const date = new URL(page.url()).searchParams.get('date')
  await menu(page, 'Organization Teams')
  await menu(page, 'Weekly Events')
  await expect(monthMode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Go to date')).toHaveValue(date)
  await page.reload()
  await expect(monthMode).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Go to date')).toHaveValue(date)
  await page.getByRole('button', { name: 'Weekly View', exact: true }).click()
  await expect(page.getByLabel('Show dates')).toHaveValue('events')
})

test('availability remembers applied venue, date, status and month view, and drops retired selections', async ({
  page,
}) => {
  await login(page)
  await menu(page, 'Venue Availability')
  await page.getByLabel('Calendar view').selectOption('month')
  const venue = page.getByLabel('Filter venue', { exact: true })
  const status = page.getByLabel('Schedule type')
  const date = page.getByLabel('Go to date')
  await expect(
    page.getByRole('link', { name: /Keep the east walkway clear/ }).first(),
  ).toBeVisible()
  await venue.selectOption({ label: 'Audio-Visual Room (AVR)' })
  await status.selectOption('notices')
  await date.fill(today())
  await apply(page)
  await expect(
    page
      .getByRole('link', { name: /AVR equipment checkout guidelines/ })
      .first(),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Keep the east walkway clear/ }),
  ).toHaveCount(0)
  await menu(page, 'Dashboard')
  await menu(page, 'Venue Availability')
  await page.reload()
  await expect(page.getByLabel('Calendar view')).toHaveValue('month')
  await expect(venue.locator('option:checked')).toHaveText(
    'Audio-Visual Room (AVR)',
  )
  await expect(status).toHaveValue('notices')
  await expect(date).toHaveValue(today())
  await clear(page)
  await page.reload()
  await expect(venue).toHaveValue('')
  await expect(status).toHaveValue('')
  await expect(date).toHaveValue('')
  await expect(
    page.getByRole('link', { name: /Keep the east walkway clear/ }).first(),
  ).toBeVisible()
  await page.goto('/availability?venue=999999&view=month&date=' + today())
  await expect
    .poll(() => new URL(page.url()).searchParams.get('venue'))
    .toBe(null)
  await expect(page.getByLabel('Calendar view')).toHaveValue('month')
  await expect(date).toHaveValue(today())
})

test('seeded venue notices appear and historical notices stay restricted to managers', async ({
  page,
}) => {
  const response = await page.request.get('/api/notices/')
  const titles = (await response.json()).results.map((item) => item.title)
  expect(titles).toContain('AVR equipment checkout guidelines')
  expect(titles).toContain('ComLab 5 network maintenance')
  expect(titles).not.toContain('ComLab 3 workstation cleaning completed')
  await login(page)
  await menu(page, 'Venue Notices')
  await page.getByLabel('Filter by status').selectOption('expired')
  await apply(page)
  await expect(
    page.getByRole('link', { name: 'ComLab 3 workstation cleaning completed' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'AVR equipment checkout guidelines' }),
  ).toHaveCount(0)
})
