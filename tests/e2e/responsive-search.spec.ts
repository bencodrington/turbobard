import { expect, test } from '@playwright/test'

test('mobile welcome keeps the header logo and compact typography @mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.app-logo')).toBeVisible()
  await expect(page.locator('.welcome-logo')).toBeHidden()
  await expect(page.locator('.welcome-content')).toHaveCSS('font-size', '16px')
  await expect(page.locator('.welcome-heading')).toHaveCSS('font-size', '28px')
  await page.screenshot({ path: 'docs/evidence/compact-welcome.png' })
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  expect(
    await page.locator('.app-logo').evaluate((el) => el.getAnimations().length),
  ).toBe(0)
})

test('mobile search focuses immediately and leaves details stationary @mobile', async ({
  page,
}) => {
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  const editor = page.locator('.environment-editor')
  await expect(editor).toHaveCSS('opacity', '1')
  await page.evaluate(() => {
    document.addEventListener(
      'click',
      () => {
        document.documentElement.dataset.searchFocusedOnClick = String(
          document.activeElement?.id === 'catalog-search',
        )
      },
      { once: true },
    )
  })
  await page.getByRole('button', { name: 'Add sounds to environment' }).click()
  await expect(page.locator('html')).toHaveAttribute(
    'data-search-focused-on-click',
    'true',
  )
  const input = page.getByRole('textbox', { name: 'Search Sounds' })
  await expect(input).toBeFocused()
  await expect(input).toHaveAttribute('placeholder', 'Search for sounds')
  await expect(editor).toHaveCSS('display', 'flex')
  await expect(editor).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await expect(page.getByText('Search for sounds and packs.')).toHaveCount(0)
  await input.fill('unfindable')
  await expect(
    page.getByRole('heading', { name: 'No sounds found' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Close search' }).click()
  expect(await editor.evaluate((el) => el.getAnimations().length)).toBe(0)
  await expect(editor).toHaveCSS('opacity', '1')
  await page.getByRole('button', { name: 'Add sounds to environment' }).click()
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(editor).not.toHaveAttribute('inert', '')
})

for (const mobile of [false, true]) {
  test(`search skeleton and no-results guidance${mobile ? ' @mobile' : ''}`, async ({
    page,
  }, testInfo) => {
    let respond = () => {}
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      async (route) => {
        await new Promise<void>((resolve) => {
          respond = resolve
        })
        await route.fulfill({ contentType: 'application/json', body: '[]' })
      },
    )
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    await page
      .getByRole('button', { name: 'Add environment', exact: true })
      .click()
    if (mobile)
      await page
        .getByRole('button', { name: 'Add sounds to environment' })
        .click()
    const search = page.getByRole('region', { name: 'Search', exact: true })
    if (mobile) await expect(search.getByRole('textbox')).toBeFocused()
    await search.getByRole('textbox').fill('rain')
    await expect(search.locator('.catalog-skeleton-row')).toHaveCount(4)
    await expect(search.getByText('Loading Sounds…')).toHaveClass('sr-only')
    await page.screenshot({
      path: `docs/evidence/search-loading-${testInfo.project.name}.png`,
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(
      await search
        .locator('.catalog-skeleton')
        .evaluate((el) => el.getAnimations().length),
    ).toBe(0)
    respond()
    await expect(search.locator('.catalog-skeleton')).toHaveCount(0)
    await expect(search.getByText('Search for sounds and packs.')).toHaveCount(
      0,
    )
    await page.unrouteAll({ behavior: 'wait' })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    )
    await search.getByRole('textbox').fill('unfindable')
    await search.getByRole('button', { name: 'Music', exact: true }).click()
    await expect(
      search.getByRole('heading', { name: 'No sounds found' }),
    ).toBeVisible()
    await search.getByRole('button', { name: 'Search everything' }).click()
    await expect(
      search.getByRole('button', { name: 'Everything' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      search.getByRole('heading', { name: 'No sounds found' }),
    ).toBeVisible()
    await page.screenshot({
      path: `docs/evidence/search-empty-${testInfo.project.name}.png`,
    })
  })
}
