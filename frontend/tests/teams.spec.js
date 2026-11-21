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
