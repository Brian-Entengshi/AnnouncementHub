import { expect, test } from '@playwright/test'

async function signIn(page, username) {
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
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
  for (const width of [820, 390, 320]) {
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
    .selectOption({ label: 'Seminar Room' })
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
    page.getByText('Approved · ' + title, { exact: true }),
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
  await page
    .getByLabel('Initial or replacement password')
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD)
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(
    page.getByRole('heading', { name: 'New team member' }),
  ).toBeVisible()
  await page.getByLabel('Sign out').click()
  await page.goto('/reservations/new')
  await signIn(page, 'new-member')
  await expect(
    page.getByRole('heading', { name: 'Change password' }),
  ).toBeVisible()
  await page
    .getByLabel('Current password')
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD)
  await page
    .getByLabel('New password')
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD + '-changed')
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
