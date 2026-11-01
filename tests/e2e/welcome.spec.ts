import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`welcome creates a persistent environment and returns after deletion${mobile ? ' @mobile' : ''}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: mobile ? 375 : 1280, height: 667 })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/')
    const welcome = page.getByRole('region', { name: /Music and effects/ })
    await expect(welcome).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Edit environments' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Search', exact: true }),
    ).toHaveCount(0)
    await expect(
      welcome.getByRole('link', { name: 'Donations welcome' }),
    ).toHaveAttribute('href', 'https://ko-fi.com/projectbench')
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: `docs/evidence/welcome-${testInfo.project.name}.png`,
      scale: 'css',
    })
    await welcome.getByRole('button', { name: 'Add environment' }).click()
    await expect(welcome).toHaveCount(0)
    await expect(
      page.getByRole('textbox', { name: 'Environment name' }),
    ).toBeVisible()
    await page
      .getByRole('textbox', { name: 'Environment name' })
      .fill('First adventure')
    await page.reload()
    await expect(welcome).toHaveCount(0)
    await page.getByRole('button', { name: 'Edit environments' }).click()
    await page.getByRole('button', { name: 'Delete First adventure' }).click()
    await expect(welcome).toBeVisible()
    await page.reload()
    await expect(welcome).toBeVisible()
    await welcome.getByRole('button', { name: 'Add environment' }).click()
    await expect(
      page.getByRole('textbox', { name: 'Environment name' }),
    ).toBeVisible()
  })
}

test('welcome scrolls to a keyboard accessible action on short screens @mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 400 })
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'About' })).toBeFocused()
  await page.keyboard.press('Tab')
  // Link tab stops depend on the platform's keyboard navigation settings.
  const donation = page.getByRole('link', { name: 'Donations welcome' })
  if (
    await donation.evaluate((element) => element === document.activeElement)
  ) {
    await page.keyboard.press('Tab')
  }
  const create = page.getByRole('button', { name: 'Add environment' })
  await expect(create).toBeFocused()
  await expect(create).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  )
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('textbox', { name: 'Environment name' }),
  ).toBeVisible()
})

test('welcome logo travels into the header and respects reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  const welcomeLogo = page.locator('.welcome-logo')
  const origin = (await welcomeLogo.boundingBox())!
  expect(origin.width).toBe(360)
  expect(origin.x + origin.width / 2).toBeCloseTo(720, 0)
  const headerLogo = page.locator('.app-logo')
  await headerLogo.evaluate((element: HTMLImageElement) => {
    const animate = element.animate.bind(element)
    element.animate = (...args: Parameters<typeof element.animate>) => {
      const animation = animate(...args)
      animation.pause()
      return animation
    }
  })
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  const start = (await headerLogo.boundingBox())!
  expect(start.x).toBeCloseTo(origin.x, 0)
  expect(start.y).toBeCloseTo(origin.y, 0)
  expect(start.width).toBeCloseTo(origin.width, 0)
  await headerLogo.evaluate((element) => {
    element.getAnimations()[0].currentTime = 300
  })
  const halfway = (await headerLogo.boundingBox())!
  expect(halfway.width).toBeLessThan(start.width)
  expect(halfway.width).toBeGreaterThan(125)
  await headerLogo.evaluate((element) => element.getAnimations()[0].finish())
  const end = (await headerLogo.boundingBox())!
  expect(end.width).toBeLessThan(130)
  expect(end.x).toBeLessThan(20)
  expect(end.y).toBeLessThan(20)

  await page.evaluate(() => localStorage.clear())
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  expect(
    await headerLogo.evaluate((element) => element.getAnimations().length),
  ).toBe(0)
})

test('desktop columns grow with the viewport and have separate borders', async ({
  page,
}) => {
  // Measure the final responsive layout, rather than an in-flight resize.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  const widths: Array<{ environments: number; search: number }> = []
  for (const width of [900, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    const environments = page.locator('.environment-panel')
    const editor = page.locator('.environment-editor')
    const search = page.locator('.catalog-panel')
    await expect(editor).toHaveCSS('opacity', '1')
    const panels = [environments, editor, search]
    const boxes = []
    for (const panel of panels) {
      await expect(panel).toHaveCSS('border-top-width', '1px')
      await expect(panel).toHaveCSS('border-right-width', '1px')
      await expect(panel).toHaveCSS('border-bottom-width', '1px')
      await expect(panel).toHaveCSS('border-left-width', '1px')
      boxes.push((await panel.boundingBox())!)
    }
    expect(boxes[1].x - boxes[0].x - boxes[0].width).toBeGreaterThanOrEqual(10)
    expect(boxes[2].x - boxes[1].x - boxes[1].width).toBeGreaterThanOrEqual(10)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
    widths.push({ environments: boxes[0].width, search: boxes[2].width })
    if (width === 1920)
      await page.screenshot({
        path: 'docs/evidence/responsive-columns-1920.png',
      })
  }
  expect(widths[1].environments).toBeGreaterThan(widths[0].environments)
  expect(widths[2].environments).toBeGreaterThan(widths[1].environments)
  expect(widths[1].search).toBeGreaterThan(450)
  expect(widths[2].search).toBeGreaterThan(widths[1].search)
})
