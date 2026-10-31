import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`now-playing animation stays above screens and modals${mobile ? ' @mobile' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: mobile ? 375 : 1280, height: 800 })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/')
    await page
      .getByRole('button', { name: /^(Create Environment|Add environment)$/ })
      .click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()
    const border = page.locator('.now-playing-border')
    const assertAboveScreen = async () => {
      const onTop = await border.evaluate((element) => {
        const box = element.getBoundingClientRect()
        const hit = document.elementFromPoint(box.width / 2, box.y + 1)
        return hit === element || hit === element.parentElement
      })
      expect(onTop).toBe(true)
    }
    await assertAboveScreen()
    await page
      .getByRole('button', { name: 'Add sounds to environment', exact: true })
      .click()
    if (mobile) {
      await expect(page.locator('.catalog-panel')).toHaveCSS(
        'transform',
        'matrix(1, 0, 0, 1, 0, 0)',
      )
      await assertAboveScreen()
      await page.getByRole('button', { name: 'Close search' }).click()
      await page
        .getByRole('button', { name: 'Close Environment', exact: true })
        .click()
    }
    await page.getByRole('button', { name: 'About', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'About' })).toHaveCSS(
      'transform',
      'none',
    )
    await assertAboveScreen()
    await page.getByRole('button', { name: 'Close About' }).click()
    if (mobile) {
      await page.getByRole('button', { name: 'Edit environments' }).click()
      await page
        .getByRole('button', { name: 'Open New Environment', exact: true })
        .click()
    }
    await page
      .getByRole('button', { name: 'Select icon for New Environment' })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Select an icon' }),
    ).toHaveCSS('transform', 'none')
    await assertAboveScreen()
  })
}
