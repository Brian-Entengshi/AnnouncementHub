import { expect, test } from '@playwright/test'
import path from 'node:path'

async function login(page, name) {
  await page.goto('/login')
  await page.getByLabel('Username', { exact: true }).fill(name)
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.ELITE_BROWSER_TEST_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/dashboard$/)
}

const sectionIds = {
  Home: 'home',
  About: 'about',
  Announcements: 'announcements',
  'Club Events': 'events',
  'Useful Links': 'useful-links',
  Contacts: 'contacts',
}

async function expectActiveSection(page, name) {
  const active = page.locator('#public-navigation [aria-current="location"]')
  await expect(active).toHaveText([name])
}

async function scrollToSection(page, name) {
  await page.mouse.move(130, 300)
  const { position, target } = await page.evaluate((id) => {
    const section = document.getElementById(id)
    const sticky = document.querySelector('.public-header')
    const top = scrollY + section.getBoundingClientRect().top
    const sectionOffset = Math.max(0, top - sticky.offsetHeight + 24)
    return {
      position: scrollY,
      target: Math.min(
        sectionOffset,
        document.documentElement.scrollHeight - innerHeight,
      ),
    }
  }, sectionIds[name])
  await page.mouse.wheel(0, Math.round(target - position))
  await expect
    .poll(() => page.evaluate((y) => Math.abs(scrollY - y), target))
    .toBeLessThan(5)
  await expectActiveSection(page, name)
}

async function expectCenteredFooter(page) {
  const footer = page.getByRole('contentinfo')
  await expect(footer).toContainText(
    /DLL Elite\s*Student Club Events & Announcement Hub/,
  )
  await expect(footer.getByText(/Back to top/i)).toHaveCount(0)
  const offset = await footer.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    const boxes = []
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      boxes.push(...range.getClientRects())
    }
    const left = Math.min(...boxes.map((box) => box.left))
    const right = Math.max(...boxes.map((box) => box.right))
    return Math.abs(
      (left + right) / 2 - document.documentElement.clientWidth / 2,
    )
  })
  expect(offset).toBeLessThan(3)
}

test('Student Access uses a public navbar, published content and responsive section navigation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/student$/)
  await expect(page.locator('.sidebar')).toHaveCount(0)
  const nav = page.getByRole('navigation', { name: 'Public navigation' })
  await expect(nav.getByRole('link')).toHaveText([
    'Home',
    'About',
    'Announcements',
    'Club Events',
    'Useful Links',
    'Contacts',
  ])
  await expect(page.getByRole('link', { name: 'Member sign in' })).toBeVisible()
  for (const [label, heading] of [
    ['About', 'About DLL Elite'],
    ['Announcements', 'Announcements'],
    ['Club Events', 'Club Events'],
    ['Useful Links', 'Useful Links'],
    ['Contacts', 'Contacts'],
    ['Home', 'Club events and campus announcements'],
  ]) {
    await nav.getByRole('link', { name: label, exact: true }).click()
    await expect(
      page.getByRole('heading', { name: heading, exact: true }),
    ).toBeInViewport()
  }
  await page.getByRole('link', { name: 'Explore Club Events' }).click()
  const event = page.getByRole('link', {
    name: 'Leadership skills workshop',
    exact: true,
  })
  await expect(event).toBeVisible()
  await expect(
    page.getByText('Calendar cancelled session', { exact: true }),
  ).toHaveCount(0)
  await event.click()
  await expect(
    page.getByRole('heading', { name: 'Leadership skills workshop', level: 1 }),
  ).toBeVisible()
  const schedule = page.getByRole('list', { name: 'Event schedule' })
  await expect(schedule).toContainText('Audio-Visual Room (AVR)')
  await expect(schedule).toContainText('9:00 AM – 11:00 AM PHT')
  await expect(schedule).toContainText('Posted by DLL Elite')
  await expect(schedule.locator('time')).toHaveAttribute(
    'datetime',
    /^\d{4}-\d{2}-\d{2}$/,
  )
  await expect(
    page.getByText(/Practice facilitation and team decision-making/),
  ).toBeVisible()
  await nav.getByRole('link', { name: 'Announcements', exact: true }).click()
  const featured = page.locator('.public-announcement-featured')
  await expect(featured).toHaveCount(1)
  await expect(
    featured.getByRole('heading', { name: 'General assembly guidelines' }),
  ).toBeVisible()
  const regular = page.locator(
    '.public-announcement:not(.public-announcement-featured)',
  )
  await expect(
    regular.getByRole('heading', { name: 'Workshop materials available' }),
  ).toBeVisible()
  await expect(featured).toContainText('Organization')
  await expect(featured).toContainText('DLL Elite')
  await page.getByLabel('Search announcements').fill('assembly')
  await page.getByLabel('Announcement category').selectOption('Organization')
  await page.getByRole('button', { name: 'Apply filters' }).click()
  await expect(page.locator('.public-announcement')).toHaveCount(1)
  await page
    .getByRole('link', { name: 'General assembly guidelines', exact: true })
    .click()
  await expect(
    page.getByRole('heading', {
      name: 'General assembly guidelines',
      level: 1,
    }),
  ).toBeVisible()
  await expect(page.getByText(/Bring your student ID/)).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', {
      name: 'General assembly guidelines',
      level: 1,
    }),
  ).toBeVisible()
  await expectCenteredFooter(page)
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 850 })
    await page.getByRole('button', { name: 'Open public menu' }).click()
    await nav.getByRole('link', { name: 'Useful Links' }).click()
    await expect(
      page.getByRole('heading', { name: 'Useful Links' }),
    ).toBeInViewport()
    await expect(
      page.getByRole('button', { name: 'Open public menu' }),
    ).toHaveAttribute('aria-expanded', 'false')
    await expectActiveSection(page, 'Useful Links')
    await page.getByRole('button', { name: 'Open public menu' }).click()
    await nav.getByRole('link', { name: 'Contacts' }).click()
    await expect(
      page.getByRole('heading', { name: 'Contacts' }),
    ).toBeInViewport()
    await expect(
      page.getByRole('button', { name: 'Open public menu' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await expectActiveSection(page, 'Contacts')
    await expectCenteredFooter(page)
  }
})

test('Student Access tracks visible sections while scrolling in both directions', async ({
  page,
}) => {
  await page.goto('/student#announcements')
  await expect(
    page.locator('#announcements .public-announcement').first(),
  ).toBeVisible()
  await expectActiveSection(page, 'Announcements')
  await page.reload()
  const announcementsHeading = page.locator('#announcements h2')
  await expect(announcementsHeading).toBeInViewport()
  await expectActiveSection(page, 'Announcements')
  await expect
    .poll(() =>
      announcementsHeading.evaluate((heading) => {
        const header = document.querySelector('.public-header')
        return (
          heading.getBoundingClientRect().top >=
          header.getBoundingClientRect().bottom
        )
      }),
    )
    .toBe(true)

  const nav = page.getByRole('navigation', { name: 'Public navigation' })
  const homeLink = nav.getByRole('link', { name: 'Home', exact: true })
  await homeLink.click()
  await expectActiveSection(page, 'Home')
  const aboutLink = nav.getByRole('link', { name: 'About', exact: true })
  await aboutLink.focus()
  await page.keyboard.press('Enter')
  await expectActiveSection(page, 'About')
  await page.goBack()
  await expect(page).toHaveURL(/student#home$/)
  await expectActiveSection(page, 'Home')
  await page.goForward()
  await expect(page).toHaveURL(/student#about$/)
  await expectActiveSection(page, 'About')

  await homeLink.click()
  await expectActiveSection(page, 'Home')
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0)
  for (const section of [
    'About',
    'Announcements',
    'Club Events',
    'Useful Links',
    'Contacts',
    'Useful Links',
    'Club Events',
    'Announcements',
    'About',
    'Home',
  ]) {
    await scrollToSection(page, section)
  }

  await page.setViewportSize({ width: 390, height: 850 })
  await page.getByRole('button', { name: 'Open public menu' }).click()
  await nav.getByRole('link', { name: 'Contacts', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Open public menu' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await expectActiveSection(page, 'Contacts')
  await scrollToSection(page, 'Useful Links')
  await scrollToSection(page, 'Club Events')
  await scrollToSection(page, 'Announcements')
  await scrollToSection(page, 'About')
  await scrollToSection(page, 'Announcements')
  await page.getByRole('button', { name: 'Open public menu' }).click()
  const announcementsLink = nav.getByRole('link', {
    name: 'Announcements',
    exact: true,
  })
  await expect(announcementsLink).toHaveAttribute('aria-current', 'location')
  await announcementsLink.focus()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('button', { name: 'Open public menu' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await page.goto('/student/#about')
  await expectActiveSection(page, 'About')
})

test('adviser publishes, updates and deletes a Student Access resource from Useful Links', async ({
  page,
  browser,
  baseURL,
  request,
}) => {
  const title = 'Resource publication verification'
  const revisedTitle = 'Resource publication verification revised'
  const category = 'Student study resources'
  const initialUrl = 'https://example.org/study-guide'
  const revisedUrl = 'https://example.org/updated-study-guide'
  const studentContext = await browser.newContext({ baseURL })
  const student = await studentContext.newPage()
  const resource = (title) =>
    student.locator('.public-resource-card').filter({
      has: student.getByRole('heading', { name: title, exact: true }),
    })

  try {
    await student.goto('/student#useful-links')
    await expect(resource('Campus library guide')).toBeVisible()
    await expect(
      student.getByRole('navigation', { name: 'Main navigation' }),
    ).toHaveCount(0)
    await login(page, 'test-adviser')
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Useful Links' })
      .click()
    await page.getByRole('link', { name: 'New link' }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Web address').fill(initialUrl)
    await page.getByLabel('Category').fill(category)
    await page
      .getByLabel('Description')
      .fill('A subject guide offered to students.')
    await expect(page.getByLabel('Show on Student Access')).not.toBeChecked()
    await page.getByRole('button', { name: 'Save link' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    const id = page.url().split('/').at(-1)
    const detail = '/api/links/' + id + '/'

    await student.reload()
    await expect(resource('Campus library guide')).toBeVisible()
    await expect(resource(title)).toHaveCount(0)
    expect((await request.get(detail)).status()).toBe(404)
    expect((await page.request.get(detail + '?public=1')).status()).toBe(404)
    const privateCategories = await (
      await request.get('/api/links/categories/')
    ).json()
    expect(privateCategories).not.toContain(category)

    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Show on Student Access').check()
    await page.getByRole('button', { name: 'Save link' }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    await student.reload()
    await expect(resource(title)).toContainText(
      'A subject guide offered to students.',
    )
    await expect(resource(title)).toContainText(category)
    const publicResult = await request.get(detail)
    expect(publicResult.ok()).toBe(true)
    expect(await publicResult.json()).toEqual({
      id: Number(id),
      title,
      category,
      url: initialUrl,
      description: 'A subject guide offered to students.',
    })
    expect(
      (
        await request.patch(detail, { data: { title: 'Anonymous edit' } })
      ).status(),
    ).toBe(403)

    await page.getByRole('link', { name: 'Edit', exact: true }).click()
    await page.getByLabel('Title').fill(revisedTitle)
    await page.getByLabel('Web address').fill(revisedUrl)
    await page.getByRole('button', { name: 'Save link' }).click()
    await expect(
      page.getByRole('heading', { name: revisedTitle }),
    ).toBeVisible()
    await student.reload()
    const outbound = resource(revisedTitle).getByRole('link', {
      name: 'Visit resource: ' + revisedTitle,
    })
    await expect(outbound).toHaveAttribute('href', revisedUrl)
    await expect(outbound).toHaveAttribute('target', '_blank')
    await expect(outbound).toHaveAttribute('rel', /\bnoopener\b/)
    await expect(outbound).toHaveAttribute('rel', /\bnoreferrer\b/)
    await studentContext.route(revisedUrl, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<title>Updated public resource</title>',
      }),
    )
    const [popup] = await Promise.all([
      studentContext.waitForEvent('page'),
      outbound.click(),
    ])
    await expect(popup).toHaveURL(revisedUrl)
    await expect(popup).toHaveTitle('Updated public resource')
    await popup.close()

    await page.getByRole('button', { name: 'Delete link' }).click()
    await page.getByRole('button', { name: 'Confirm deletion' }).click()
    await expect(
      page.getByRole('heading', { name: 'Useful Links' }),
    ).toBeVisible()
    await student.reload()
    await expect(resource('Campus library guide')).toBeVisible()
    await expect(resource(revisedTitle)).toHaveCount(0)
    expect((await request.get(detail)).status()).toBe(404)
  } finally {
    await studentContext.close()
  }
})

test('advisers preview and publish landing content that survives a public refresh', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const publicContext = await browser.newContext({ baseURL })
  const publicPage = await publicContext.newPage()
  const landingPath = '/api/organization/'
  const initial = await (await request.get(landingPath)).json()
  await login(page, 'test-adviser')
  await page.goto('/settings')
  await expect(
    page.getByRole('heading', { name: 'Landing Page Management' }),
  ).toBeVisible()
  const tab = (name) => page.getByRole('tab', { name, exact: true })
  async function publish() {
    const saved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/settings/' &&
        response.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save and publish' }).click()
    expect((await saved).status()).toBe(200)
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Changes published to Student Access.' }),
    ).toBeVisible()
  }

  try {
    await tab('Home').click()
    await page
      .getByLabel('Hero heading')
      .fill('Welcome to the DLL Elite campus')
    await page.getByLabel('Primary action text').fill('Meet the organization')
    await page.getByLabel('Primary action destination').selectOption('about')
    await page
      .getByLabel('Hero image', { exact: true })
      .setInputFiles(path.resolve('public/brand/seal.png'))
    await page
      .getByLabel('Hero image description')
      .fill('DLL Elite campus illustration')
    await expect(
      page.getByRole('heading', { name: 'Draft preview' }),
    ).toBeVisible()
    await expect(
      page.getByText('Welcome to the DLL Elite campus', { exact: true }),
    ).toBeVisible()
    expect((await (await request.get(landingPath)).json()).hero_heading).toBe(
      initial.hero_heading,
    )
    await publish()

    await tab('About').click()
    await page.getByLabel('About heading').fill('Get to know DLL Elite')
    await page
      .getByLabel('Organization introduction')
      .fill('Students organize workshops and campus projects together.')
    await page
      .getByLabel('Mission', { exact: true })
      .fill('Support student participation in club projects.')
    await page.getByLabel('Vision', { exact: true }).fill('')
    await publish()

    await tab('Contacts').click()
    await page.getByLabel('Contact email').fill('campus@example.test')
    await page.getByLabel('Public phone number').fill('+1 (202) 555-0100')
    await page.getByLabel('Office location').fill('Student Services desk')
    await page.getByLabel('Facebook URL').fill('https://example.test/dll-elite')
    await publish()

    await tab('Announcements').click()
    await page.getByLabel('Highlight pinned announcement').uncheck()
    await page.getByLabel('Announcements per page').fill('1')
    await publish()

    await publicPage.goto('/student')
    await publicPage.reload()
    await expect(
      publicPage.getByRole('heading', {
        name: 'Welcome to the DLL Elite campus',
      }),
    ).toBeVisible()
    const hero = publicPage.getByRole('img', {
      name: 'DLL Elite campus illustration',
    })
    await expect(hero).toBeVisible()
    const heroUrl = await hero.getAttribute('src')
    const heroResponse = await request.get(heroUrl)
    expect(heroResponse.status()).toBe(200)
    expect(heroResponse.headers()['content-type']).toContain('image/png')
    const aboutAction = publicPage.getByRole('link', {
      name: 'Meet the organization',
    })
    await expect(aboutAction).toHaveAttribute('href', '/student#about')
    await aboutAction.click()
    const about = publicPage.locator('#about')
    await expect(
      about.getByRole('heading', { name: 'Get to know DLL Elite' }),
    ).toBeInViewport()
    await expect(about).toContainText(
      'Students organize workshops and campus projects together.',
    )
    await expect(about).toContainText(
      'Support student participation in club projects.',
    )
    await expect(about.getByRole('heading', { name: 'Vision' })).toHaveCount(0)

    const contacts = publicPage.locator('#contacts')
    await expect(
      contacts.getByRole('link', { name: /campus@example\.test/ }),
    ).toHaveAttribute('href', 'mailto:campus@example.test')
    await expect(contacts.locator('a[href^="tel:"]')).toHaveAttribute(
      'href',
      'tel:+12025550100',
    )
    await expect(
      contacts.getByRole('link', { name: /Facebook/i }),
    ).toHaveAttribute('href', 'https://example.test/dll-elite')
    await expect(contacts).toContainText('Student Services desk')
    await expect(
      contacts.getByRole('link', { name: /Instagram/i }),
    ).toHaveCount(0)
    for (const width of [1440, 768, 390, 320]) {
      await publicPage.setViewportSize({ width, height: 850 })
      await expect(
        contacts.getByRole('heading', { name: 'Contacts' }),
      ).toBeVisible()
      expect(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true)
      await expectCenteredFooter(publicPage)
    }

    const announcements = publicPage.locator('#announcements')
    await expect(announcements.locator('.public-announcement')).toHaveCount(1)
    await expect(
      announcements.locator('.public-announcement-featured'),
    ).toHaveCount(0)
    await announcements.getByRole('button', { name: 'Next' }).click()
    await expect(announcements).toContainText(/Page 2/)
    await expect(announcements.locator('.public-announcement')).toHaveCount(1)

    const published = await (await request.get(landingPath)).json()
    expect(published).toMatchObject({
      hero_heading: 'Welcome to the DLL Elite campus',
      about_heading: 'Get to know DLL Elite',
      contact_email: 'campus@example.test',
      highlight_pinned: false,
      announcement_page_size: 1,
    })
    await page.reload()
    await tab('Home').click()
    await expect(page.getByLabel('Hero heading')).toHaveValue(
      'Welcome to the DLL Elite campus',
    )
  } finally {
    await publicContext.close()
    const { csrf } = await (await page.request.get('/api/session/')).json()
    const changedFields = [
      'hero_heading',
      'hero_cta_label',
      'hero_cta_section',
      'hero_image_alt',
      'about_heading',
      'about_intro',
      'about_mission',
      'about_vision',
      'contact_email',
      'contact_phone',
      'office_location',
      'facebook_url',
      'highlight_pinned',
      'announcement_page_size',
    ]
    const original = Object.fromEntries(
      changedFields.map((field) => [field, initial[field]]),
    )
    const restored = await page.request.patch('/api/settings/', {
      headers: { 'X-CSRFToken': csrf },
      data: { ...original, remove_hero_image: true },
    })
    expect(restored.status()).toBe(200)
  }
})

test('Student Access omits drafts and expired posts from featured announcements', async ({
  page,
  request,
}) => {
  await login(page, 'test-adviser')
  const { csrf } = await (await page.request.get('/api/session/')).json()
  const headers = { 'X-CSRFToken': csrf }
  const records = []
  try {
    for (const [title, status, expires] of [
      ['Unpublished pinned notice', 'draft', null],
      ['Expired pinned notice', 'published', '2000-01-01'],
    ]) {
      const created = await page.request.post('/api/announcements/', {
        headers,
        data: {
          title,
          description: 'A post outside the public publication window.',
          category: 'Organization',
          status,
          pinned: true,
          expires,
        },
      })
      expect(created.status()).toBe(201)
      const { id } = await created.json()
      records.push(id)
      expect(
        (await request.get('/api/announcements/' + id + '/?public=1')).status(),
      ).toBe(404)
      const search = new URLSearchParams({ public: '1', search: title })
      expect(
        (await (await request.get('/api/announcements/?' + search)).json())
          .results,
      ).toEqual([])
    }
    await page.goto('/student#announcements')
    await expect(page.locator('.public-announcement-featured')).toHaveCount(1)
    await expect(page.locator('.public-announcement-featured')).toContainText(
      'General assembly guidelines',
    )
    await expect(
      page.getByText('Unpublished pinned notice', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByText('Expired pinned notice', { exact: true }),
    ).toHaveCount(0)
  } finally {
    for (const id of records) {
      expect(
        (
          await page.request.delete('/api/announcements/' + id + '/?manage=1', {
            headers,
          })
        ).status(),
      ).toBe(204)
    }
  }
})

test('only advisers can update landing page content', async ({
  page,
  request,
}) => {
  const data = { hero_heading: 'Unauthorized heading' }
  const before = await (await request.get('/api/organization/')).json()
  expect((await request.patch('/api/organization/', { data })).status()).toBe(
    405,
  )
  expect((await request.get('/api/settings/')).status()).toBe(403)
  expect((await request.patch('/api/settings/', { data })).status()).toBe(403)
  for (const role of ['officer', 'staff']) {
    await login(page, 'test-' + role)
    const { csrf, user } = await (
      await page.request.get('/api/session/')
    ).json()
    expect(user.role).toBe(role)
    await page.goto('/settings')
    await expect(
      page.getByRole('heading', { name: 'Access restricted' }),
    ).toBeVisible()
    expect((await page.request.get('/api/settings/')).status()).toBe(403)
    expect(
      (
        await page.request.patch('/api/settings/', {
          headers: { 'X-CSRFToken': csrf },
          data,
        })
      ).status(),
    ).toBe(403)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/student$/)
  }
  expect(await (await request.get('/api/organization/')).json()).toEqual(before)
})

test('officers publish events and venue notices for public reading and Venue Availability', async ({
  page,
  request,
}) => {
  await login(page, 'test-officer')
  await page.goto('/weekly-events/new')
  const date = (
    await (
      await request.get('/api/events/?search=Leadership+skills+workshop')
    ).json()
  ).results[0].date
  await page.getByLabel('Title').fill('Evening club briefing')
  await page
    .getByLabel('Description')
    .fill('Meet the organizers and discuss this term’s program.')
  await page
    .getByRole('combobox', { name: /^Venue/ })
    .selectOption({ label: 'ComLab 3' })
  await page.getByLabel('Event date').fill(date)
  await page.getByLabel('Start time (Manila)').fill('16:00')
  await page.getByLabel('End time (Manila)').fill('17:00')
  await page.getByRole('button', { name: 'Save event' }).click()
  await expect(
    page.getByRole('heading', { name: 'Evening club briefing' }),
  ).toBeVisible()
  const id = page.url().split('/').at(-1)
  expect((await request.get('/api/events/' + id + '/?manage=1')).status()).toBe(
    404,
  )
  await page.getByRole('link', { name: 'Edit', exact: true }).click()
  await page.getByLabel('Publish event').check()
  await page.getByRole('button', { name: 'Save event' }).click()
  await expect(
    page.getByRole('heading', { name: 'Evening club briefing' }),
  ).toBeVisible()
  const event = await (await request.get('/api/events/' + id + '/')).json()
  expect(event.author_name).toBe('Organization Officer')
  expect(event).not.toHaveProperty('author')
  expect(event).not.toHaveProperty('activity')
  expect(
    (
      await request.patch('/api/events/' + id + '/', {
        data: { title: 'private' },
      })
    ).status(),
  ).toBe(403)

  await page.goto('/venue-notices/new')
  await page.getByLabel('Title').fill('Evening briefing entrance')
  await page
    .getByLabel('Description')
    .fill('Use the east entrance for the briefing.')
  await page
    .getByRole('combobox', { name: /^Venue/ })
    .selectOption({ label: 'ComLab 3' })
  await page.getByLabel('Starts (Manila time)').fill(date + 'T15:45')
  await page.getByLabel('Ends (Manila time)').fill(date + 'T17:00')
  await page.getByLabel('Publication status').selectOption('published')
  await page.getByRole('button', { name: 'Save notice' }).click()
  await expect(
    page.getByRole('heading', { name: 'Evening briefing entrance' }),
  ).toBeVisible()
  await page.goto('/availability?date=' + date + '&venue=' + event.venue)
  await expect(
    page.getByRole('link', { name: /Evening club briefing/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: /Evening briefing entrance/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/student$/)
  await page.goto('/student/events/' + id)
  await expect(
    page.getByRole('heading', { name: 'Venue notices for this date' }),
  ).toBeVisible()
  await expect(
    page.getByText('Use the east entrance for the briefing.'),
  ).toBeVisible()
  for (const endpoint of [
    'dashboard',
    'teams',
    'venues',
    'venue-options',
    'activities',
    'availability',
    'accounts',
    'audit',
  ]) {
    expect((await request.get('/api/' + endpoint + '/')).status()).toBe(403)
  }
})
