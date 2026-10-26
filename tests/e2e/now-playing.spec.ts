import { expect, test } from '@playwright/test'

for (const width of [375, 480, 900]) {
  test(`now-playing bar reserves space and follows responsive layout at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 700 })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Environment' }).click()
    await page.getByRole('button', { name: 'Play', exact: true }).click()

    const bar = page.getByRole('region', { name: 'Now playing' })
    await expect(bar).toBeVisible()
    const box = await bar.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBe(width < 480 ? width : Math.min(480, width - 24))
    expect(box!.x).toBe(width < 480 ? 0 : (width - box!.width) / 2)
    expect(box!.y + box!.height).toBe(700 - (width < 480 ? 0 : 12))

    const editor = page.getByRole('region', { name: 'New Environment' })
    if (width < 900) {
      const editorBox = await editor.boundingBox()
      expect(editorBox!.y + editorBox!.height).toBeLessThanOrEqual(box!.y)
      await page
        .getByRole('button', { name: 'Search Sounds', exact: true })
        .click()
      const searchBox = await page
        .getByRole('region', { name: 'Search' })
        .boundingBox()
      expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(box!.y)
      await expect(
        bar.getByRole('button', { name: 'Stop playback' }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Close search' }).click()
    }
    // Overflowing content must scroll within its reserved area, not move the bar.
    await editor.evaluate((element) => {
      const content = document.createElement('div')
      content.style.height = '2000px'
      element.append(content)
    })
    if (width < 900) {
      const overflowingEditor = await editor.boundingBox()
      expect(
        overflowingEditor!.y + overflowingEditor!.height,
      ).toBeLessThanOrEqual(box!.y)
      await editor.evaluate((element) =>
        element.scrollTo(0, element.scrollHeight),
      )
    }
    await expect.poll(async () => (await bar.boundingBox())!.y).toBe(box!.y)
    await bar.getByRole('checkbox', { name: 'Combat' }).focus()
    await page.keyboard.press('Space')
    await expect(bar.getByRole('checkbox', { name: 'Combat' })).toBeChecked()
    await page.screenshot({
      path: testInfo.outputPath('playing.png'),
    })
    await bar.getByRole('button', { name: 'Stop playback' }).click()
    await expect(bar.getByRole('checkbox', { name: 'Combat' })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath('stopped.png') })
  })
}

test('opens the mobile editor and search after scrolling a long Environment list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 })
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
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit environments' }).click()
  await page.getByRole('button', { name: 'Open Scene 39', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Environment name' }),
  ).toBeInViewport()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const bar = page.getByRole('region', { name: 'Now playing' })
  await expect(bar).toBeInViewport()
  await page.getByRole('button', { name: 'Search Sounds', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Search Sounds' }),
  ).toBeInViewport()
  await page.getByRole('button', { name: 'Close search' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Environment name' }),
  ).toBeInViewport()
})
