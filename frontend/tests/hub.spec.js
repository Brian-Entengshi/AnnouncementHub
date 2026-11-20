import { expect, test } from '@playwright/test'

async function signIn(
  page,
  username,
  password = process.env.ELITE_BROWSER_TEST_PASSWORD,
) {
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
test('public dashboard, deep routes, responsive navigation and calendar', async ({
  page,
}) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: 'Organization dashboard' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Leadership skills workshop/ }),
  ).toBeVisible()
  await expect(page.getByLabel('Open menu')).toBeHidden()
  await page.getByRole('link', { name: 'View weekly schedule' }).click()
  await expect(
    page.getByRole('heading', { name: 'Weekly Events' }),
  ).toBeVisible()
  await page.reload()
  await expect(page).toHaveURL(/weekly-events$/)
  await page.getByLabel('Next period').click()
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await page.getByLabel('Open menu').click()
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Venue Availability' })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Venue Availability' }),
    ).toBeVisible()
    await expect(page.getByRole('navigation')).toBeHidden()
    await page.getByLabel('Calendar view').selectOption('month')
    await expect(page.locator('.calendar-days.month')).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: 'Organization dashboard' }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy()
  }
  expect(errors).toEqual([])
})

test('protected deep link, per-user reservation draft, submission and approval', async ({
  page,
}) => {
  await page.goto('/reservations/new')
  await expect(page).toHaveURL(/login$/)
  await signIn(page, 'test-staff')
  await expect(page).toHaveURL(/reservations\/new$/)
  const title = 'Student planning session'
  await page.getByLabel('Event title').fill(title)
  await page.reload()
  await expect(page.getByLabel('Event title')).toHaveValue(title)
  await page.getByLabel('Description').fill('Plan the next campus workshop.')
  await page
    .getByLabel('Venue', { exact: false })
    .filter({ visible: true })
    .selectOption({ label: 'ComLab 2' })
  const date = new Date()
  date.setDate(date.getDate() + 14)
  await page
    .getByLabel('Reservation date')
    .fill(date.toISOString().slice(0, 10))
  await page.getByLabel('Start time').fill('09:00')
  await page.getByLabel('End time').fill('10:00')
  await page.getByLabel('Expected attendees').fill('12')
  await page.getByLabel('Person responsible').fill('Team lead')
  await page.getByLabel('Contact information').fill('Organization office')
  await page.getByRole('button', { name: 'Save reservation' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  const recordURL = page.url()
  await expect(
    page.getByRole('button', { name: 'Approve', exact: true }),
  ).toHaveCount(0)
  await page.goto('/reservations/new')
  await expect(page.getByLabel('Event title')).toHaveValue('')
  await page.getByLabel('Event title').fill('Unsaved private draft')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(recordURL)
  await signIn(page, 'test-adviser')
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm approve' }).click()
  await expect(
    page.locator('.detail').first().getByText('Approved', { exact: true }),
  ).toBeVisible()
  await page.goto('/reservations/new')
  await expect(page.getByLabel('Event title')).toHaveValue('')
  await page.goto('/audit')
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: title })
      .getByText('Approved', { exact: true }),
  ).toBeVisible()
})

test('service worker installs the shell and excludes private API data', async ({
  page,
  context,
}) => {
  await page.goto('/dashboard')
  await expect(
    page.getByRole('heading', { name: 'Organization dashboard' }),
  ).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true)
  const paths = await page.evaluate(async () => {
    const name = (await caches.keys()).find((k) =>
      k.startsWith('dll-elite-shell-'),
    )
    return (await (await caches.open(name)).keys()).map(
      (r) => new URL(r.url).pathname,
    )
  })
  expect(paths.some((p) => p.endsWith('.js'))).toBe(true)
  expect(paths.some((p) => p.startsWith('/api/'))).toBe(false)
  await context.setOffline(true)
  await page.goto('/weekly-events')
  await expect(page.getByText(/You are offline/)).toBeVisible()
})

test('adviser provisions a member and first sign-in returns to the requested page', async ({
  page,
}) => {
  await page.goto('/accounts/new')
  await signIn(page, 'test-adviser')
  await page.getByLabel('Full name').fill('New team member')
  await page.getByLabel('Username').fill('new-member')
  await page
    .getByLabel('Assigned team')
    .selectOption({ label: 'Documentation Team' })
  await togglePassword(page, 'Initial or replacement password', '123')
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(
    page.getByRole('heading', { name: 'New team member' }),
  ).toBeVisible()
  await page.getByLabel('Sign out').click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/reservations/new')
  await signIn(page, 'new-member', '123')
  await expect(
    page.getByRole('heading', { name: 'Change password' }),
  ).toBeVisible()
  await togglePassword(page, 'Current password', '123')
  await togglePassword(
    page,
    'New password',
    process.env.ELITE_BROWSER_TEST_PASSWORD + '-changed',
  )
  await togglePassword(
    page,
    'Confirm password',
    process.env.ELITE_BROWSER_TEST_PASSWORD + '-changed',
  )
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(
    page.getByRole('heading', { name: 'New reservation' }),
  ).toBeVisible()
  await page.goto('/accounts')
  await expect(
    page.getByRole('heading', { name: 'Access restricted' }),
  ).toBeVisible()
})

test('announcement draft survives refresh, publishes, and can be archived and deleted', async ({
  page,
}) => {
  await page.goto('/manage-announcements/new')
  await signIn(page, 'test-adviser')
  const title = 'Student office hours'
  await page.getByLabel('Title').fill(title)
  await page
    .getByLabel('Description')
    .fill('Visit the organization office after class.')
  await page.reload()
  await expect(page.getByLabel('Title')).toHaveValue(title)
  await page.getByLabel('Category').fill('Member services')
  await page.getByLabel('Status').selectOption('published')
  await page.getByRole('button', { name: 'Save announcement' }).click()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Status').selectOption('archived')
  await page.getByRole('button', { name: 'Save announcement' }).click()
  await expect(page.locator('.detail .badge')).toHaveText('Archived')
  await page.getByRole('button', { name: 'Delete announcement' }).click()
  await page.getByRole('button', { name: 'Keep record' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete announcement' }).click()
  await page.getByRole('button', { name: 'Confirm deletion' }).click()
  await expect(
    page.getByRole('heading', { name: 'Manage Announcements' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: title })).toHaveCount(0)
})

async function togglePassword(page, label, value) {
  const field = page.getByLabel(label, { exact: true })
  await field.fill(value)
  await expect(field).toHaveAttribute('type', 'password')
  await page
    .getByRole('button', { name: 'Show ' + label.toLowerCase(), exact: true })
    .click()
  await expect(field).toHaveAttribute('type', 'text')
  await expect(field).toHaveValue(value)
  await page
    .getByRole('button', { name: 'Hide ' + label.toLowerCase(), exact: true })
    .click()
  await expect(field).toHaveAttribute('type', 'password')
  await expect(field).toHaveValue(value)
}

async function assertFits(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy()
}

test('venue creation is adviser-only and new venues appear in the reservation form', async ({
  page,
}) => {
  await page.goto('/venues/new')
  await signIn(page, 'test-officer')
  await expect(
    page.getByRole('heading', { name: 'Access restricted' }),
  ).toBeVisible()
  await page.goto('/venues')
  await expect(page.getByRole('link', { name: 'Add Venue' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/login')
  await signIn(page, 'test-adviser')
  await page.goto('/venues')
  await page.getByRole('link', { name: 'Add Venue' }).click()
  await page.getByLabel('Venue name').fill('New campus hall')
  await page.getByLabel('Location').fill('East wing')
  await page.getByLabel('Capacity').fill('40')
  await page.getByRole('button', { name: 'Save venue' }).click()
  await expect(
    page.getByRole('heading', { name: 'New campus hall' }),
  ).toBeVisible()
  await page.goto('/reservations/new')
  const venue = page
    .getByLabel('Venue', { exact: false })
    .filter({ visible: true })
  await venue.selectOption({ label: 'New campus hall' })
  await expect(
    venue.locator('option', {
      hasText: /College Auditorium|Innovation Lab|Media Studio|Seminar Room/,
    }),
  ).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 780 })
  await assertFits(page)
})

test('password eye controls, account role fields and paginated audit logs fit narrow screens', async ({
  page,
}) => {
  await page.goto('/login')
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await expect(
      page.getByRole('heading', { name: 'Member sign in' }),
    ).toBeVisible()
    await assertFits(page)
  }
  await togglePassword(
    page,
    'Password',
    process.env.ELITE_BROWSER_TEST_PASSWORD,
  )
  await signIn(page, 'test-adviser')
  await page.goto('/accounts/new')
  const role = page.getByLabel('Organization role')
  await role.selectOption('officer')
  await expect(page.getByLabel('Assigned team')).toHaveCount(0)
  await expect(page.getByLabel('Position')).toBeVisible()
  await role.selectOption('staff')
  await expect(page.getByLabel('Assigned team')).toHaveAttribute('required', '')
  await expect(page.getByLabel('Assigned team').locator('option')).toHaveCount(
    5,
  )
  await assertFits(page)
  await page.goto('/audit')
  await page.getByLabel('Search audit logs').fill('Login')
  await page.getByLabel('Filter by role').selectOption('adviser')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.getByRole('row')).toHaveCount(21)
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/Page 2 · /)).toBeVisible()
  await expect(page.getByLabel('Search audit logs')).toHaveValue('Login')
  await expect(page.getByLabel('Filter by role')).toHaveValue('adviser')
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await assertFits(page)
  }
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText(/Page 1 · /)).toBeVisible()
})

test('weekly event filter groups active events and follows week navigation', async ({
  page,
  request,
}) => {
  const response = await request.get('/api/events/?search="Calendar workshop"')
  const { results } = await response.json()
  expect(results).toHaveLength(1)
  await page.goto('/weekly-events')
  await page.getByLabel('Go to date').fill(results[0].date)
  const days = page.locator('.calendar-days > section')
  await expect(days).toHaveCount(7)
  await expect(
    page.getByText('Calendar cancelled session', { exact: true }),
  ).toBeVisible()
  await page.getByLabel('Show dates').selectOption('events')
  await expect(days).toHaveCount(1)
  await expect(days.getByText('Calendar workshop')).toBeVisible()
  await expect(days.getByText('Calendar orientation')).toBeVisible()
  await expect(
    page.getByText('Calendar cancelled session', { exact: true }),
  ).toHaveCount(0)
  await page.getByLabel('Next period').click()
  await expect(page.getByText('No scheduled events this week.')).toBeVisible()
  await page.getByLabel('Previous period').click()
  await expect(days).toHaveCount(1)
  await page.getByLabel('Show dates').selectOption('all')
  await expect(days).toHaveCount(7)
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await assertFits(page)
  }
})

test('accounts table paginates filtered server results and preserves filters', async ({
  page,
}) => {
  await page.goto('/accounts')
  await signIn(page, 'test-adviser')
  await page.getByLabel('Search accounts').fill('Directory')
  await page.getByLabel('Account role').selectOption('staff')
  await page.getByLabel('Account status').selectOption('active')
  await page
    .getByLabel('Account team')
    .selectOption({ label: 'Technical Team' })
  await page.getByRole('button', { name: 'Apply filters' }).click()
  const table = page.getByRole('table', { name: 'Accounts' })
  await expect(table.getByRole('row')).toHaveCount(21)
  await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await expect(page.getByText('Page 1 · 21 records')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Page 2 · 21 records')).toBeVisible()
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  await expect(page.getByLabel('Search accounts')).toHaveValue('Directory')
  await expect(page.getByLabel('Account role')).toHaveValue('staff')
  await expect(page.getByLabel('Account status')).toHaveValue('active')
  await expect(table.getByText('Technical Team', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByText('Page 1 · 21 records')).toBeVisible()
})

test('student help is available to visitors only', async ({ page }) => {
  await page.goto('/announcements')
  await page.getByRole('button', { name: 'Hub help' }).click()
  const help = page.getByRole('dialog')
  await expect(help).toContainText(
    'Students can browse club updates and schedules.',
  )
  await help.getByLabel('Close help').click()
  await page.goto('/login')
  await signIn(page, 'test-officer')
  await expect(page.getByRole('button', { name: 'Hub help' })).toHaveCount(0)
  expect((await page.request.get('/api/help/')).status()).toBe(403)
  await page.goto('/audit')
  await expect(
    page.getByRole('heading', { name: 'Access restricted' }),
  ).toBeVisible()
})

test('restyled member pages and tables fit the four target widths', async ({
  page,
}) => {
  test.setTimeout(90000)
  await page.goto('/login')
  await signIn(page, 'test-adviser')
  const pageErrors = []
  const httpErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400)
      httpErrors.push(response.url())
  })
  for (const [route, heading] of [
    ['announcements', 'Announcements'],
    ['manage-announcements', 'Manage Announcements'],
    ['organization-activities', 'Organization Activities'],
    ['weekly-events', 'Weekly Events'],
    ['organization-teams', 'Organization Teams'],
    ['useful-links', 'Useful Links'],
    ['venues', 'Venues'],
    ['venue-notices', 'Venue Notices'],
    ['availability', 'Venue Availability'],
    ['reservations', 'Reservations'],
    ['reservations/new', 'New reservation'],
    ['accounts', 'Account Management'],
    ['accounts/new', 'New account'],
    ['audit', 'Audit Logs'],
    ['notifications', 'Notifications'],
    ['settings', 'Organization settings'],
    ['password', 'Change password'],
  ]) {
    await page.goto('/' + route)
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeVisible()
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 850 })
      await assertFits(page)
      if (width === 1440)
        await expect(page.getByLabel('Open menu')).toBeHidden()
      else await expect(page.getByLabel('Open menu')).toBeVisible()
    }
  }
  expect(pageErrors).toEqual([])
  expect(httpErrors).toEqual([])
})

test('notification read state persists after reload', async ({ page }) => {
  await page.goto('/login')
  await signIn(page, 'test-adviser')
  const { csrf } = await (await page.request.get('/api/session/')).json()
  const title = 'Notification persistence check'
  const announcement = await page.request.post('/api/announcements/', {
    headers: { 'X-CSRFToken': csrf },
    data: {
      title,
      description: 'Verification notice',
      category: 'Test',
      status: 'published',
    },
  })
  expect(announcement.status()).toBe(201)
  await page.goto('/notifications')
  const entry = page.getByRole('article').filter({ hasText: title })
  await expect(entry.getByText(/Unread$/)).toBeVisible()
  await entry.getByRole('button', { name: 'Mark read' }).click()
  await expect(entry.getByText(/· Read$/)).toBeVisible()
  await page.reload()
  await expect(entry.getByText(/· Read$/)).toBeVisible()
  await expect(entry.getByRole('button', { name: 'Mark read' })).toHaveCount(0)
})

test('temporary passwords work in both account forms and permanent changes still validate', async ({
  page,
  request,
}) => {
  await page.goto('/accounts/new')
  await signIn(page, 'test-adviser')
  async function verifyTemporaryPassword(username, password) {
    const { csrf } = await (await request.get('/api/session/')).json()
    const loggedIn = await request.post('/api/login/', {
      headers: { 'X-CSRFToken': csrf },
      data: { username, password },
    })
    expect(loggedIn.status()).toBe(200)
    const session = await loggedIn.json()
    expect(session.user.must_change_password).toBe(true)
    expect(
      (
        await request.post('/api/logout/', {
          headers: { 'X-CSRFToken': session.csrf },
        })
      ).status(),
    ).toBe(200)
  }

  for (const [username, role, initial] of [
    ['short-staff', 'staff', '123'],
    ['short-officer', 'officer', '123'],
    ['single-letter-staff', 'staff', 'a'],
  ]) {
    await page.goto('/accounts/new')
    const name = 'QA ' + username
    await page.getByLabel('Full name').fill(name)
    await page.getByLabel('Username').fill(username)
    await page.getByLabel('Organization role').selectOption(role)
    if (role === 'staff')
      await page
        .getByLabel('Assigned team')
        .selectOption({ label: 'Technical Team' })
    await page
      .getByLabel('Initial or replacement password', { exact: true })
      .fill(initial)
    await page.getByRole('button', { name: 'Save account' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await verifyTemporaryPassword(username, initial)
    if (username === 'single-letter-staff') continue

    for (const replacement of ['a', '123', 'abc', 'elite123']) {
      await page.getByRole('link', { name: 'Edit', exact: true }).click()
      const replacementField = page.getByLabel(
        'Initial or replacement password',
        { exact: true },
      )
      await expect(replacementField).toHaveValue('')
      await replacementField.fill(replacement)
      await page.getByRole('button', { name: 'Save account' }).click()
      await expect(page.getByRole('heading', { name })).toBeVisible()
      await verifyTemporaryPassword(username, replacement)
    }
    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Position').fill('Committee member')
    await expect(
      page.getByLabel('Initial or replacement password', { exact: true }),
    ).toHaveValue('')
    await page.getByRole('button', { name: 'Save account' }).click()
    await expect(
      page.getByText('Committee member', { exact: true }),
    ).toBeVisible()
    await verifyTemporaryPassword(username, 'elite123')
  }

  await page.getByLabel('Sign out').click()
  await expect(page).toHaveURL(/dashboard$/)
  await page.goto('/login')
  await signIn(page, 'short-staff', 'elite123')
  await expect(
    page.getByRole('heading', { name: 'Change password' }),
  ).toBeVisible()
  await page.getByLabel('Current password', { exact: true }).fill('elite123')
  await page.getByLabel('New password', { exact: true }).fill('1234')
  await page.getByLabel('Confirm password', { exact: true }).fill('1234')
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByRole('alert')).toContainText(/too short/)
  const strong = process.env.ELITE_BROWSER_TEST_PASSWORD + '-permanent'
  await page.getByLabel('New password', { exact: true }).fill(strong)
  await page.getByLabel('Confirm password', { exact: true }).fill(strong)
  await page.getByRole('button', { name: 'Save password' }).click()
  await expect(page).toHaveURL(/dashboard$/)
})

test('venue status filters follow the API and inactive venues cannot be booked', async ({
  page,
}) => {
  await page.goto('/venues/new')
  await signIn(page, 'test-adviser')
  async function createVenue(name) {
    await page.goto('/venues/new')
    await page.getByLabel('Venue name').fill(name)
    await page.getByLabel('Location').fill('Campus')
    await page.getByLabel('Capacity').fill('40')
    await page.getByRole('button', { name: 'Save venue' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
    return Number(page.url().split('/').at(-1))
  }
  await createVenue('Unused deletion venue')
  await page.getByRole('button', { name: 'Delete venue' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm deletion' })
    .click()
  await expect(
    page.getByText('Venue deleted successfully.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Unused deletion venue' }),
  ).toHaveCount(0)

  const name = 'Status workflow venue'
  const id = await createVenue(name)
  const detail = '/venues/' + id
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Accept reservations').uncheck()
  await page.getByRole('button', { name: 'Save venue' }).click()
  await expect(page.getByText('Inactive', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Back to venues' }).click()
  await expect(
    page.getByRole('button', { name: 'Inactive venues' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name })).toBeVisible()
  await page.getByRole('button', { name: 'Active venues', exact: true }).click()
  await expect(page.getByRole('link', { name: 'ComLab 1' })).toBeVisible()
  await expect(page.getByRole('link', { name })).toHaveCount(0)
  await page.goto('/reservations/new')
  const venue = page.getByLabel('Venue').filter({ visible: true })
  await expect(venue.getByRole('option', { name: 'ComLab 1' })).toBeAttached()
  await expect(venue.getByRole('option', { name })).toHaveCount(0)

  const { csrf } = await (await page.request.get('/api/session/')).json()
  const headers = { 'X-CSRFToken': csrf }
  const day = new Date()
  day.setDate(day.getDate() + 10)
  const payload = {
    venue: id,
    date: day.toISOString().slice(0, 10),
    start: '09:00',
    end: '10:00',
    attendees: 4,
    title: 'Status workflow booking',
    description: 'Booking status test',
    responsible: 'Member',
    contact: 'Office',
  }
  expect(
    (
      await page.request.post('/api/reservations/', { headers, data: payload })
    ).status(),
  ).toBe(400)

  await page.goto(detail + '/edit')
  await page.getByLabel('Accept reservations').check()
  await page.getByRole('button', { name: 'Save venue' }).click()
  await page.getByRole('link', { name: 'Back to venues' }).click()
  await expect(
    page.getByRole('button', { name: 'Active venues', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('link', { name })).toBeVisible()
  await page.goto('/reservations/new')
  await venue.selectOption({ label: name })
  const created = await page.request.post('/api/reservations/', {
    headers,
    data: payload,
  })
  expect(created.status()).toBe(201)
  const booking = await created.json()

  await page.goto(detail)
  await page.getByRole('button', { name: 'Delete venue' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Confirm deletion' })
    .click()
  await expect(page.getByRole('alert')).toContainText(
    'Archive it to preserve those records.',
  )
  await page.getByRole('button', { name: 'Archive venue' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Archive venue' })
    .click()
  await expect(
    page.getByText(
      'Venue archived. Existing reservations and notices were kept.',
      { exact: true },
    ),
  ).toBeVisible()
  const preserved = await page.request.get(
    '/api/reservations/' + booking.id + '/',
  )
  expect((await preserved.json()).venue_name).toBe(name)
})

test('monthly calendar highlights active dates, preserves selection, and reflects event updates', async ({
  page,
  request,
}) => {
  await page.goto('/login')
  await signIn(page, 'test-adviser')
  await page.goto('/weekly-events')
  const payload = await (
    await request.get('/api/events/?search="Calendar workshop"')
  ).json()
  const event = payload.results[0]
  const day = event.date
  const nextDate = new Date(day + 'T12:00:00Z')
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)
  const nextDay = nextDate.toISOString().slice(0, 10)
  await page.getByLabel('Go to date').fill(day)
  await expect(page.locator('.calendar-days > section')).toHaveCount(7)
  await page.getByRole('button', { name: 'Monthly Calendar View' }).click()
  const selectedDay = page.locator('.month-date[data-date="' + day + '"]')
  await expect(selectedDay).toHaveClass(/has-events/)
  await expect(selectedDay).toHaveAttribute('aria-pressed', 'true')
  await expect(selectedDay).toHaveAccessibleName(/2 scheduled events/)
  const agenda = page.getByRole('region', { name: 'Selected date events' })
  await expect(
    agenda.getByRole('link', { name: 'Calendar workshop' }),
  ).toBeVisible()
  await expect(
    agenda.getByRole('link', { name: 'Calendar orientation' }),
  ).toBeVisible()
  await expect(agenda.getByText('ComLab 3').first()).toBeVisible()
  const cancelledDay = page.locator('.month-date[data-date="' + nextDay + '"]')
  if (await cancelledDay.count()) {
    await expect(cancelledDay).not.toHaveClass(/has-events/)
    await cancelledDay.click()
    await expect(agenda.getByText('Cancelled', { exact: true })).toBeVisible()
  }
  const monthEvents = await (
    await request.get(
      '/api/events/?from=' +
        day.slice(0, 7) +
        '-01&to=' +
        day.slice(0, 7) +
        '-' +
        new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0).getDate(),
    )
  ).json()
  const monthDates = await page
    .locator('.month-date')
    .evaluateAll((items) => items.map((item) => item.dataset.date))
  const emptyKey = monthDates.find(
    (date) => !monthEvents.results.some((item) => item.date === date),
  )
  const emptyDate = page.locator('.month-date[data-date="' + emptyKey + '"]')
  await emptyDate.click()
  await expect(
    agenda.getByText('No events scheduled for this date.'),
  ).toBeVisible()
  await selectedDay.click()
  const monthlyUrl = page.url()
  await page.getByRole('button', { name: 'Next month' }).click()
  await expect(selectedDay).toHaveCount(0)
  await page.getByRole('button', { name: 'Previous month' }).click()
  await expect(selectedDay).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await expect(
    page.locator('.month-date[aria-current="date"]'),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.goto(monthlyUrl)
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await expect(selectedDay).toBeVisible()
    await assertFits(page)
  }
  await page.setViewportSize({ width: 1440, height: 850 })
  const managementLink = page
    .locator('.event-management-row')
    .filter({ hasText: 'Calendar workshop' })
  const baseBackground = await managementLink.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  await managementLink.hover()
  await expect
    .poll(() =>
      managementLink.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(baseBackground)
  await page.keyboard.press('Tab')
  await managementLink.focus()
  await expect(managementLink).toBeFocused()
  expect(
    await managementLink.evaluate(
      (element) => getComputedStyle(element).outlineStyle,
    ),
  ).not.toBe('none')

  await agenda.getByRole('link', { name: 'Calendar workshop' }).click()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page
    .getByLabel('Title', { exact: false })
    .fill('Calendar workshop revised')
  await page.getByRole('button', { name: 'Save event' }).click()
  await expect(
    page.getByRole('heading', { name: 'Calendar workshop revised' }),
  ).toBeVisible()
  await page.goto(monthlyUrl)
  await expect(
    agenda.getByRole('link', { name: 'Calendar workshop revised' }),
  ).toBeVisible()

  const { csrf } = await (await page.request.get('/api/session/')).json()
  const headers = { 'X-CSRFToken': csrf }
  const orientation = await (
    await request.get('/api/events/?search="Calendar orientation"')
  ).json()
  for (const booking of [
    event.reservation,
    orientation.results[0].reservation,
  ]) {
    expect(
      (
        await page.request.post(
          '/api/reservations/' + booking + '/transition/',
          { headers, data: { status: 'cancelled' } },
        )
      ).status(),
    ).toBe(200)
  }
  await page.reload()
  await expect(selectedDay).not.toHaveClass(/has-events/)
  await expect(agenda.getByText('Cancelled', { exact: true })).toHaveCount(2)
  expect(
    (
      await page.request.delete('/api/events/' + event.id + '/?manage=1', {
        headers,
      })
    ).status(),
  ).toBe(204)
  await page.reload()
  await expect(
    agenda.getByRole('link', { name: 'Calendar workshop revised' }),
  ).toHaveCount(0)
  await expect(agenda.getByText('Cancelled', { exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Weekly View' }).click()
  await expect(page.getByLabel('Go to date')).toHaveValue(day)
  await expect(page.locator('.calendar-days > section')).toHaveCount(7)
  await page.getByLabel('Show dates').selectOption('events')
  await expect(page.getByText('No scheduled events this week.')).toBeVisible()
})
