import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`icon picker keeps its height across search states${mobile ? ' @mobile' : ''}`, async ({
    page,
  }) => {
    // A short viewport also exercises the dialog's internal scrolling.
    await page.setViewportSize(
      mobile ? { width: 375, height: 360 } : { width: 1280, height: 800 },
    )
    let finishSearch: (() => Promise<void>) | undefined
    await page.route('https://api.fontawesome.com', async (route) => {
      const query = route.request().postData() ?? ''
      const respond = async () => {
        if (query.includes('error')) {
          await route.fulfill({ status: 503 })
          return
        }
        const ids = query.includes('empty') ? [] : ['fire']
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              search: ids.map((id) => ({
                id,
                familyStylesByLicense: { free: [{ style: 'solid' }] },
              })),
            },
          }),
        })
      }
      finishSearch = respond
    })
    await page.goto('/')
    await page
      .getByRole('button', { name: /^(Create Environment|Add environment)$/ })
      .click()
    await page
      .getByRole('button', { name: /select icon for new environment/i })
      .click()
    const dialog = page.getByRole('dialog', { name: 'Select an icon' })
    await expect(dialog).toHaveCSS('transform', 'none')
    await expect(
      dialog.getByRole('group', { name: 'Available icons' }),
    ).toBeVisible()
    const initial = (await dialog.boundingBox())!
    expect(initial.y).toBeGreaterThanOrEqual(0)
    expect(initial.y + initial.height).toBeLessThanOrEqual(
      page.viewportSize()!.height,
    )
    const assertStable = async () => {
      const bounds = (await dialog.boundingBox())!
      expect(bounds.height).toBeCloseTo(initial.height, 0)
      expect(bounds.y).toBeCloseTo(initial.y, 0)
    }
    const search = dialog.getByRole('textbox', { name: 'Search icons' })
    for (const query of ['few', 'empty', 'error']) {
      finishSearch = undefined
      await search.fill(query)
      await expect(dialog.getByRole('status')).toHaveText('Loading icons…')
      await expect(dialog.locator('.icon-skeleton')).toHaveCount(36)
      await expect(dialog.locator('.icon-skeleton').first()).toBeVisible()
      await assertStable()
      await expect.poll(() => Boolean(finishSearch)).toBe(true)
      await finishSearch!()
      if (query === 'few') {
        await expect(
          dialog.getByRole('button', { name: 'fire', exact: true }),
        ).toBeVisible()
      } else if (query === 'empty') {
        await expect(
          dialog.getByText('No icons found for "empty".'),
        ).toBeVisible()
      } else {
        await expect(dialog.getByRole('alert')).toBeVisible()
      }
      await assertStable()
    }
    await search.fill('')
    const icons = dialog.getByRole('group', { name: 'Available icons' })
    await expect(icons).toBeVisible()
    await assertStable()
    await dialog
      .getByRole('button', { name: 'sack-dollar', exact: true })
      .click()
    await expect(
      dialog.getByRole('button', { name: 'sack-dollar', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true')
    await expect(
      dialog.getByRole('button', { name: 'sack-dollar', exact: true }),
    ).toHaveCSS('border-color', 'rgb(255, 255, 255)')
    const color = dialog.getByRole('button', { name: 'Select color #9CC870' })
    const target = (await color.boundingBox())!
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    // The padded area outside the visible swatch must also select its color.
    await color.click({ position: { x: 22, y: 2 } })
    await expect(
      dialog.getByRole('button', { name: 'Select color #9CC870' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
}
