import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`create tile and footer follow the scroll position${mobile ? ' @mobile' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: mobile ? 375 : 1440, height: 700 })
    await page.addInitScript(() => {
      localStorage.setItem(
        'environments',
        JSON.stringify({
          version: 1,
          environments: Array.from({ length: 40 }, (_, index) => ({
            id: `scene-${index}`,
            name: `Scene ${index}`,
            sounds: [],
          })),
        }),
      )
    })
    await page.goto('/')
    const tile = page.locator('.environment-create-tile')
    const footer = page.locator('.environment-panel-footer')
    await expect(footer).toBeVisible()
    await expect(footer.locator('[data-icon="plus"]')).toBeVisible()
    await expect(tile).toHaveText('Create Environment')
    await expect(tile.locator('[data-icon="plus"]')).toBeVisible()
    await expect(
      page.getByRole('list').first().getByRole('listitem').last(),
    ).toContainText('Create Environment')
    await footer
      .getByRole('button', { name: 'Create Environment', exact: true })
      .click()
    await expect(
      page.getByRole('textbox', { name: 'Environment name' }),
    ).toHaveValue('New Environment')
    if (mobile)
      await page
        .getByRole('button', { name: 'Close Environment', exact: true })
        .click()
    await tile.scrollIntoViewIfNeeded()
    await expect(footer).toHaveCount(0)
    await tile.click()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('environments')!).environments.length,
      ),
    ).toBe(42)
    if (mobile)
      await page
        .getByRole('button', { name: 'Close Environment', exact: true })
        .click()
    await page.locator('.environment-panel').evaluate((element) => {
      element.scrollTop = 0
    })
    await expect(footer).toBeVisible()
    await page.screenshot({
      path: `docs/evidence/create-tile-${mobile ? 'mobile' : 'desktop'}.png`,
    })
  })
}

test('search header matches the input size and desktop has no redundant search action', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  const tile = page.locator('.environment-create-tile')
  await expect(tile).toBeInViewport()
  await expect(page.locator('.environment-panel-footer')).toHaveCount(0)
  const heading = page.locator('#catalog-heading')
  await expect(heading).toHaveText('Add sounds to New Environment')
  const typography = (element: Element) => {
    const style = getComputedStyle(element)
    return [style.fontFamily, style.fontWeight, style.color]
  }
  expect(await heading.evaluate(typography)).toEqual(
    await page.locator('#environments-heading').evaluate(typography),
  )
  const searchInput = page.getByRole('textbox', { name: 'Search Sounds' })
  const inputFontSize = await searchInput.evaluate(
    (element) => getComputedStyle(element).fontSize,
  )
  await expect(heading).toHaveCSS('font-size', inputFontSize)
  const addSounds = page.getByRole('button', {
    name: 'Add sounds to environment',
    exact: true,
  })
  await expect(addSounds).toBeHidden()
  await page.setViewportSize({ width: 375, height: 700 })
  await expect(addSounds).toBeVisible()
  await expect(
    addSounds.locator('[data-icon="magnifying-glass"]'),
  ).toBeVisible()
  await addSounds.click()
  await expect(heading).toHaveCSS('font-size', inputFontSize)
  await expect(
    page.getByRole('textbox', { name: 'Search Sounds' }),
  ).toBeInViewport()
})
