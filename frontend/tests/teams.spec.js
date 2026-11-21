import { expect, test } from '@playwright/test'

const core = [
  'Technical Team',
  'Documentation Team',
  'Editing Team',
  'Videographer Team',
]

async function signIn(page, name = 'test-adviser') {
  await page.getByLabel('Username', { exact: true }).fill(name)
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

function teamTab(page, name) {
  return page.getByRole('tab', { name, exact: true })
}

async function selectTeam(page, name) {
  await teamTab(page, name).click()
  await expect(teamTab(page, name)).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('tabpanel').getByRole('heading', { name, exact: true }),
  ).toBeVisible()
}

async function menu(page, name) {
  const drawer = page.getByRole('button', { name: 'Open menu' })
  if (await drawer.isVisible()) await drawer.click()
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name, exact: true })
    .click()
}

async function expectViewportFit(page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

test('authenticated team tabs, keyboard navigation, scrolling and page restoration', async ({
  page,
}) => {
  await page.goto('/login')
  await signIn(page)
  await menu(page, 'Organization Teams')
  const bar = page.getByRole('tablist', { name: 'Organization teams' })
  await expect(bar.getByRole('tab')).toHaveText(core)
  for (const name of core) await selectTeam(page, name)
  await teamTab(page, core[3]).focus()
  await page.keyboard.press('Home')
  const technical = teamTab(page, core[0])
  await expect(technical).toBeFocused()
  await expect(technical).toHaveAttribute('aria-selected', 'true')
  await expect(technical).toHaveCSS('background-color', 'rgb(26, 39, 47)')
  await page.keyboard.press('ArrowRight')
  await expect(teamTab(page, core[1])).toBeFocused()
  await expect(teamTab(page, core[1])).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByText('Directory member 00', { exact: true }),
  ).toHaveCount(0)
  await selectTeam(page, core[0])
  const roster = page.getByRole('table', { name: 'Team members' })
  const scroller = page.getByRole('region', { name: 'Scrollable team members' })
  const pager = page.getByRole('navigation', { name: 'Team member pages' })
  await expect(roster.getByRole('row')).toHaveCount(16)
  await expect(pager.getByRole('button', { name: 'Previous' })).toBeDisabled()
  const height = await scroller.evaluate((node) => node.clientHeight)
  await scroller.evaluate((node) => {
    node.scrollTop = 200
  })
  expect(await scroller.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  const headerOffset = await roster
    .getByRole('columnheader', { name: 'Member name' })
    .evaluate(
      (heading) =>
        heading.getBoundingClientRect().top -
        heading.closest('.account-scroll').getBoundingClientRect().top,
    )
  expect(Math.abs(headerOffset)).toBeLessThan(2)
  await pager.getByRole('button', { name: 'Next' }).click()
  await expect(pager.getByText(/Page 2/)).toBeVisible()
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(0)
  expect(await scroller.evaluate((node) => node.clientHeight)).toBe(height)
  await menu(page, 'Dashboard')
  await menu(page, 'Organization Teams')
  await expect(technical).toHaveAttribute('aria-selected', 'true')
  await expect(pager.getByText(/Page 2/)).toBeVisible()
  await page.reload()
  await expect(technical).toHaveAttribute('aria-selected', 'true')
  await expect(pager.getByText(/Page 2/)).toBeVisible()
  await selectTeam(page, core[1])
  await expect(pager.getByText(/Page 1/)).toBeVisible()
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(0)
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await selectTeam(page, core[3])
    await expectViewportFit(page)
    await expect(pager).toBeVisible()
    await selectTeam(page, core[0])
    await expect(roster.getByRole('row')).toHaveCount(16)
    expect(
      await scroller.evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true)
  }
})

test('Student Access keeps team pages and member APIs private', async ({
  page,
}) => {
  await page.goto('/organization-teams/1')
  await expect(page).toHaveURL(/\/login$/)
  await expect(
    page.getByRole('navigation', { name: 'Main navigation' }),
  ).toHaveCount(0)
  await expect(page.getByRole('table')).toHaveCount(0)
  for (const path of [
    '/api/teams/',
    '/api/teams/1/',
    '/api/teams/1/members/',
  ]) {
    expect((await page.request.get(path)).status()).toBe(403)
  }
})

test('Staff roster visibility follows current memberships and keeps paging private', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/login')
  await signIn(page)
  await expect(page).toHaveURL(/dashboard$/)
  const allTeams = (await (await page.request.get('/api/teams/')).json())
    .results
  const technical = allTeams.find(({ name }) => name === core[0])
  const documentation = allTeams.find(({ name }) => name === core[1])
  const editing = allTeams.find(({ name }) => name === core[2])
  const accounts = await (
    await page.request.get('/api/accounts/?search=test-staff')
  ).json()
  const staff = accounts.results.find(
    ({ username }) => username === 'test-staff',
  )
  const accountPath = '/api/accounts/' + staff.id + '/'
  const { csrf } = await (await page.request.get('/api/session/')).json()
  const headers = { 'X-CSRFToken': csrf }
  const assign = (teams) =>
    page.request.patch(accountPath, { headers, data: { teams } })
  const staffContext = await browser.newContext({ baseURL })
  const member = await staffContext.newPage()
  let temporaryTeamPath

  try {
    expect((await assign([technical.id, documentation.id])).ok()).toBe(true)
    await member.goto('/login')
    await signIn(member, 'test-staff')
    await menu(member, 'Organization Teams')
    const tabs = member
      .getByRole('tablist', { name: 'Organization teams' })
      .getByRole('tab')
    await expect(tabs).toHaveText([technical.name, documentation.name])
    await selectTeam(member, technical.name)
    const roster = member.getByRole('table', { name: 'Team members' })
    const pager = member.getByRole('navigation', { name: 'Team member pages' })
    await expect(roster.getByRole('row')).toHaveCount(16)
    for (const name of ['Username', 'Actions', 'Joined']) {
      await expect(roster.getByRole('columnheader', { name })).toHaveCount(0)
    }
    const rosterPath = '/api/teams/' + technical.id + '/members/'
    const rosterApi = await (await member.request.get(rosterPath)).json()
    expect(Object.keys(rosterApi.results[0]).sort()).toEqual([
      'full_name',
      'id',
      'position',
    ])
    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(pager.getByText(/Page 2/)).toBeVisible()
    await menu(member, 'Dashboard')
    await menu(member, 'Organization Teams')
    await expect(pager.getByText(/Page 2/)).toBeVisible()
    await selectTeam(member, documentation.name)
    await expect(pager.getByText(/Page 1/)).toBeVisible()

    const accessible = await (
      await member.request.get('/api/teams/?include_inactive=1')
    ).json()
    expect(accessible.results.map(({ id }) => id)).toEqual([
      technical.id,
      documentation.id,
    ])
    const unassigned = '/api/teams/' + editing.id + '/'
    expect((await member.request.get(unassigned)).status()).toBe(404)
    expect((await member.request.get(unassigned + 'members/')).status()).toBe(
      404,
    )
    expect((await member.request.get(accountPath)).status()).toBe(403)
    await member.goto('/organization-teams/' + editing.id)
    await expect(tabs).toHaveText([technical.name, documentation.name])
    await expect(
      member.getByRole('tabpanel').getByRole('heading', { name: editing.name }),
    ).toHaveCount(0)

    await selectTeam(member, documentation.name)
    expect((await assign([technical.id])).ok()).toBe(true)
    const formerlyAssigned = '/api/teams/' + documentation.id + '/'
    expect(
      (await member.request.get(formerlyAssigned + 'members/')).status(),
    ).toBe(404)
    await member.reload()
    await expect(tabs).toHaveText([technical.name])
    await expect(teamTab(member, technical.name)).toHaveAttribute(
      'aria-selected',
      'true',
    )

    const createTeam = await page.request.post('/api/teams/', {
      headers,
      data: {
        name: 'Campus Liaison Team',
        description: 'Coordinates club work with campus offices.',
      },
    })
    expect(createTeam.ok()).toBe(true)
    const temporaryTeam = await createTeam.json()
    temporaryTeamPath = '/api/teams/' + temporaryTeam.id + '/'
    const setTeamActive = (is_active) =>
      page.request.patch(temporaryTeamPath, { headers, data: { is_active } })
    const refreshOnFocus = () =>
      member.evaluate(() => window.dispatchEvent(new Event('focus')))

    expect((await assign([technical.id, temporaryTeam.id])).ok()).toBe(true)
    await refreshOnFocus()
    await expect(tabs).toHaveText([technical.name, temporaryTeam.name])
    await selectTeam(member, temporaryTeam.name)

    expect((await setTeamActive(false)).ok()).toBe(true)
    expect((await member.request.get(temporaryTeamPath)).status()).toBe(404)
    const temporaryRosterPath = temporaryTeamPath + 'members/'
    expect((await member.request.get(temporaryRosterPath)).status()).toBe(404)
    await refreshOnFocus()
    await expect(tabs).toHaveText([technical.name])
    await expect(teamTab(member, technical.name)).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(member).not.toHaveURL(/\?team=/)

    expect((await setTeamActive(true)).ok()).toBe(true)
    await refreshOnFocus()
    await expect(tabs).toHaveText([technical.name, temporaryTeam.name])
    await selectTeam(member, temporaryTeam.name)
    await expect(roster.getByRole('row')).toHaveCount(2)
  } finally {
    await staffContext.close()
    expect((await assign(staff.teams)).ok()).toBe(true)
    if (temporaryTeamPath) {
      expect(
        (await page.request.delete(temporaryTeamPath, { headers })).status(),
      ).toBe(204)
    }
  }
})

test('adviser creates a dynamic team and manages multiple Staff assignments on mobile', async ({
  page,
}) => {
  const extra = 'Creatives and Outreach Team'
  const name = 'Cross-team Coordinator'
  await page.goto('/login')
  await signIn(page)
  await menu(page, 'Organization Teams')
  await page.getByRole('link', { name: 'New team' }).click()
  await page.getByLabel('Team name').fill(extra)
  await page
    .getByLabel('Description')
    .fill('Plans campus campaigns and supports student events.')
  await page.getByRole('button', { name: 'Save team' }).click()
  await expect(teamTab(page, extra)).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByText('No staff members are assigned to this team.'),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Edit team' }).click()
  const description = 'Plans campaigns and documents outreach events.'
  await page.getByLabel('Description').fill(description)
  await page.getByRole('button', { name: 'Save team' }).click()
  await expect(page.getByRole('tabpanel').getByText(description)).toBeVisible()

  await menu(page, 'Account Management')
  await page.getByRole('link', { name: 'New account' }).click()
  await page.setViewportSize({ width: 390, height: 850 })
  const assigned = page.getByRole('group', { name: 'Assigned teams' })
  const checkbox = (name) =>
    assigned.getByRole('checkbox', { name, exact: true })
  await expect(checkbox(extra)).toBeVisible()
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Username').fill('cross-team-coordinator')
  await page
    .getByLabel('Initial or replacement password', { exact: true })
    .fill('Team-test-temp')
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Choose at least one assigned team.',
  )
  const original = [core[0], core[1], core[3]]
  for (const team of original) await checkbox(team).check()
  await expectViewportFit(page)
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(
    page.getByText(original.join(', '), { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText(original.join(', '), { exact: true }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 960 })
  await menu(page, 'Account Management')
  await page.getByLabel('Search accounts').fill(name)
  await page.getByRole('button', { name: 'Apply filters' }).click()
  const row = page.getByRole('row').filter({ hasText: name })
  await expect(row.getByText(original.join(', '))).toBeVisible()
  await menu(page, 'Organization Teams')
  const membership = page.getByRole('row').filter({ hasText: name })
  for (const team of original) {
    await selectTeam(page, team)
    await expect(membership).toBeVisible()
  }
  await membership.getByRole('link', { name: 'Edit ' + name }).click()
  for (const team of original) await expect(checkbox(team)).toBeChecked()
  await checkbox(extra).check()
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(
    page.getByText([...original, extra].join(', '), { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await checkbox(core[3]).uncheck()
  await page.getByRole('button', { name: 'Save account' }).click()
  await expect(
    page.getByText([core[0], core[1], extra].join(', '), { exact: true }),
  ).toBeVisible()

  await menu(page, 'Organization Teams')
  await selectTeam(page, core[3])
  await expect(membership).toHaveCount(0)
  await selectTeam(page, core[0])
  await membership
    .getByRole('button', { name: 'Remove ' + name + ' from team' })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remove membership' })
    .click()
  await expect(membership).toHaveCount(0)
  for (const team of [core[1], extra]) {
    await selectTeam(page, team)
    await expect(membership.getByText('Active', { exact: true })).toBeVisible()
  }
  await page.setViewportSize({ width: 390, height: 850 })
  await expect(teamTab(page, extra)).toBeInViewport()
  await expectViewportFit(page)
  const teamId = new URL(page.url()).searchParams.get('team')
  const { csrf } = await (await page.request.get('/api/session/')).json()
  const result = await page.request.patch('/api/teams/' + teamId + '/', {
    data: { is_active: false },
    headers: { 'X-CSRFToken': csrf },
  })
  expect(result.ok()).toBe(true)
  await page.reload()
  await expect(teamTab(page, core[0])).toHaveAttribute('aria-selected', 'true')
  await expect(teamTab(page, extra)).toHaveCount(0)
  await page.getByText('Inactive teams', { exact: true }).click()
  await expect(page.getByRole('link', { name: extra })).toBeVisible()
})
