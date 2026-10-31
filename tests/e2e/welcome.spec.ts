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
