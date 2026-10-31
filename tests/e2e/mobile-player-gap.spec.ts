import { expect, test } from '@playwright/test'

for (const width of [375, 480, 768]) {
  test(`mobile Add sounds footer has a gap above the now-playing bar at ${width}px @mobile`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 700 })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/')
    await page
      .getByRole('button', { name: /^(Create Environment|Add environment)$/ })
      .click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    const editor = page.locator('.environment-editor')
    const addSounds = page.getByRole('button', {
      name: 'Add sounds to environment',
      exact: true,
    })
    const bar = page.getByRole('region', { name: 'Now playing' })
    await expect(editor).toBeVisible()
    await expect(addSounds).toBeVisible()
    await expect(bar).toBeVisible()

    if (width === 375) {
      await page.screenshot({ path: testInfo.outputPath('after.png') })
    }
    const addSoundsBox = await addSounds.boundingBox()
    const barBox = await bar.boundingBox()
    expect(
      barBox!.y - (addSoundsBox!.y + addSoundsBox!.height),
    ).toBeGreaterThanOrEqual(9)
  })
}
