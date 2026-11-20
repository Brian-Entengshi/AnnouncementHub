import { expect, test } from '@playwright/test'
import { randomBytes } from 'node:crypto'

const copiedDatabase = process.env.ELITE_BROWSER_TEST_DB_COPY

test.skip(
  !copiedDatabase,
  'Requires a disposable copy of the local database and runtime test credentials.',
)

async function login(page, role) {
  const username = process.env['ELITE_LOCAL_' + role + '_USER']
  const password = process.env['ELITE_LOCAL_' + role + '_PASSWORD']
  if (!username || !password)
    throw new Error('Local test credentials were not supplied.')
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill(password)
  const response = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/login/') && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const result = await response
  expect(result.status()).toBe(200)
  const { user } = await result.json()
  expect(user.role).toBe(role === 'ADMIN' ? 'adviser' : 'officer')
  await expect(page).toHaveURL(/dashboard$/)
  return user
}

async function logout(page) {
  const response = page.waitForResponse(
    (res) =>
      res.url().endsWith('/api/logout/') && res.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await response).status()).toBe(200)
  await expect(page.getByRole('link', { name: 'Member sign in' })).toBeVisible()
}

test('the seeded working rosters and account directory paginate', async ({
  page,
}) => {
  await login(page, 'ADMIN')
  await page.goto('/accounts')
  await page.getByLabel('Search accounts').fill('demo_team_')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  const accounts = page.getByRole('table', { name: 'Accounts' })
  const accountPages = page.getByRole('navigation', { name: 'Account pages' })
  await expect(accounts.getByRole('row')).toHaveCount(16)
  await expect(accounts.getByText(/demo_team_/)).toHaveCount(15)
  await accountPages.getByRole('button', { name: 'Next' }).click()
  await expect(accountPages.getByText(/Page 2/)).toBeVisible()
  await expect(accounts.getByText(/demo_team_/)).toHaveCount(15)

  await page.goto('/organization-teams')
  const tabs = page.getByRole('tablist').getByRole('tab')
  await expect(tabs.first()).toBeVisible()
  const roster = page.getByRole('table', { name: 'Team members' })
  const teamPages = page.getByRole('navigation', { name: 'Team member pages' })
  for (const tab of await tabs.all()) {
    await tab.click()
    await expect(teamPages.getByText(/Page 1/)).toBeVisible()
    await expect(roster.getByRole('row')).toHaveCount(16)
    await expect(roster.getByText(/demo_team_/).first()).toBeVisible()
    await teamPages.getByRole('button', { name: 'Next' }).click()
    await expect(teamPages.getByText(/Page 2/)).toBeVisible()
    await expect(roster.getByRole('row').nth(1)).toBeVisible()
  }
  await logout(page)
})

test('existing adviser and officer complete the audit, venue, and account workflows on a copy', async ({
  page,
}) => {
  test.setTimeout(90000)
  const tag =
    process.env.ELITE_LOCAL_REGRESSION_TAG || randomBytes(4).toString('hex')
  const venueName = 'QA facility ' + tag
  const staffName = 'QA staff ' + tag
  const blockedVenue = 'Blocked facility ' + tag
  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Hub help' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Close help' }).click()

  const admin = await login(page, 'ADMIN')
  await expect(page.getByRole('button', { name: 'Hub help' })).toHaveCount(0)
  expect((await page.request.get('/api/help/')).status()).toBe(403)
  await page.goto('/venues/new')
  await page.getByLabel('Venue name').fill(venueName)
  await page.getByLabel('Location').fill('Campus east entrance')
  await page.getByLabel('Capacity').fill('30')
  await page.getByRole('button', { name: 'Save venue' }).click()
  await expect(page.getByRole('heading', { name: venueName })).toBeVisible()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Location').fill('Campus west entrance')
  await page.getByRole('button', { name: 'Save venue' }).click()
  await expect(
    page.getByText('Campus west entrance', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Delete venue' }).click()
  await page.getByRole('button', { name: 'Confirm deletion' }).click()
  await expect(page.getByText('Venue deleted successfully.')).toBeVisible()

  for (const status of ['Active', 'Inactive', 'Archived']) {
    await page
      .getByRole('button', { name: status + ' venues', exact: true })
      .click()
    const filters = await (
      await page.request.get('/api/venues/?status=' + status.toLowerCase())
    ).json()
    expect(
      filters.results.some(({ name }) =>
        [
          'Seminar Room',
          'Media Studio',
          'Innovation Lab',
          'College Auditorium',
        ].includes(name),
      ),
    ).toBe(false)
    await expect(
      page.getByRole('link', {
        name: /^(Seminar Room|Media Studio|Innovation Lab|College Auditorium)$/,
      }),
    ).toHaveCount(0)
  }

  const venueList = await (
    await page.request.get('/api/venues/?search=ComLab+1')
  ).json()
  const activeVenue = venueList.results.find((item) => item.name === 'ComLab 1')
  expect(activeVenue).toBeDefined()
  await page.goto('/venues/' + activeVenue.id)
  await page.getByRole('button', { name: 'Delete venue' }).click()
  await page.getByRole('button', { name: 'Confirm deletion' }).click()
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
    ),
  ).toBeVisible()

  await page.goto('/accounts')
  await page.getByLabel('Search accounts').fill(admin.username)
  await page.getByLabel('Account role').selectOption('adviser')
  await page.getByLabel('Account status').selectOption('active')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(
    page.getByRole('row').filter({ hasText: admin.username }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'New account' }).click()
  await page.getByLabel('Full name').fill('QA officer ' + tag)
  await page.getByLabel('Username').fill('qa-officer-' + tag)
  await page.getByLabel('Organization role').selectOption('officer')
  await expect(page.getByRole('group', { name: 'Assigned teams' })).toHaveCount(
    0,
  )
  await page
    .getByLabel('Initial or replacement password', { exact: true })
    .fill(randomBytes(16).toString('hex'))
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(
    page.getByRole('heading', { name: 'QA officer ' + tag }),
  ).toBeVisible()
  await logout(page)

  const officer = await login(page, 'OFFICER')
  expect(officer.teams).toEqual([])
  await expect(page.getByRole('button', { name: 'Hub help' })).toHaveCount(0)
  const { csrf } = await (await page.request.get('/api/session/')).json()
  const headers = { 'X-CSRFToken': csrf }
  expect((await page.request.get('/api/audit/')).status()).toBe(403)
  expect((await page.request.get('/api/help/')).status()).toBe(403)
  expect(
    (
      await page.request.post('/api/venues/', {
        headers,
        data: { name: blockedVenue, location: 'Campus', capacity: 5 },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await page.request.post('/api/accounts/', {
        headers,
        data: {
          username: 'blocked-' + tag,
          full_name: 'Blocked Officer',
          role: 'officer',
          password: randomBytes(16).toString('hex'),
        },
      })
    ).status(),
  ).toBe(400)
  await page.goto('/accounts/new')
  await page.getByLabel('Full name').fill(staffName)
  await page.getByLabel('Username').fill('qa-staff-' + tag)
  await page.getByRole('checkbox', { name: 'Documentation Team' }).check()
  await page
    .getByLabel('Initial or replacement password', { exact: true })
    .fill(randomBytes(16).toString('hex'))
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByRole('heading', { name: staffName })).toBeVisible()
  await page.goto('/accounts')
  await page.getByLabel('Search accounts').fill(staffName)
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await page.getByRole('button', { name: 'Deactivate ' + staffName }).click()
  await page.getByRole('button', { name: 'Deactivate account' }).click()
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: staffName })
      .getByText('Inactive', { exact: true }),
  ).toBeVisible()
  await logout(page)

  await login(page, 'ADMIN')
  await page.goto('/audit')
  for (const [username, role] of [
    [admin.username, 'adviser'],
    [officer.username, 'officer'],
  ]) {
    await page.getByLabel('Search audit logs').fill(username)
    await page.getByLabel('Filter by role').selectOption(role)
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: 'Signed in successfully.' })
        .first(),
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: 'Signed out.' }).first(),
    ).toBeVisible()
    if (role === 'officer')
      await expect(
        page
          .getByRole('row')
          .filter({ hasText: staffName })
          .filter({ hasText: 'Created' }),
      ).toBeVisible()
    else
      await expect(
        page
          .getByRole('row')
          .filter({ hasText: 'QA officer ' + tag })
          .getByText('Created', { exact: true }),
      ).toBeVisible()
  }
  await page.getByLabel('Search audit logs').fill(venueName)
  await page.getByLabel('Filter by role').selectOption('adviser')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  for (const action of ['Created', 'Updated', 'Deleted']) {
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: venueName })
        .getByText(action, { exact: true }),
    ).toBeVisible()
  }

  await page.goto('/organization-activities')
  await expect(
    page.getByRole('link', { name: 'DLL Elite member orientation' }),
  ).toBeVisible()
  const events = await (
    await page.request.get('/api/events/?search="Campus organization briefing"')
  ).json()
  expect(events.results).toHaveLength(1)
  await page.goto('/weekly-events')
  await page.getByLabel('Go to date').fill(events.results[0].date)
  await expect(
    page
      .locator('.calendar-days')
      .getByText('Campus organization briefing', { exact: true }),
  ).toBeVisible()
  await logout(page)
})
