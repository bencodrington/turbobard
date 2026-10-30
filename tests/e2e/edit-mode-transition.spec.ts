import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`edit mode keeps its heading and control height stable${mobile ? ' @mobile' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: mobile ? 375 : 1280, height: 800 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const heading = page.getByRole('heading', {
      name: 'Environments',
      exact: true,
    })
    const edit = page.getByRole('button', { name: 'Edit environments' })
    const before = (await heading.boundingBox())!
    const wrench = (await edit.boundingBox())!
    expect(wrench.width).toBe(wrench.height)
    await edit.click()
    const done = (await page
      .getByRole('button', { name: 'Done' })
      .boundingBox())!
    expect(done.height).toBe(wrench.height)
    expect((await heading.boundingBox())!.y).toBe(before.y)
  })
}

test('mobile search slides up at a fixed width and respects reduced motion @mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Environment' }).click()
  const search = page.locator('.catalog-panel')
  await search.evaluate((element) => {
    const observer = new MutationObserver(() => {
      if (!element.classList.contains('mobile-search-open')) return
      for (const animation of element.getAnimations()) {
        animation.pause()
        animation.currentTime = 110
      }
      observer.disconnect()
    })
    observer.observe(element, { attributes: true, attributeFilter: ['class'] })
  })
  await page
    .getByRole('button', { name: 'Add sounds to environment', exact: true })
    .click()
  const halfway = await search.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      y: new DOMMatrixReadOnly(style.transform).m42,
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    }
  })
  expect(halfway.y).toBeGreaterThan(0)
  expect(halfway.y).toBeLessThan(halfway.height)
  expect(halfway.width).toBe(375)
  await page.evaluate(() =>
    document.getAnimations().forEach((animation) => animation.finish()),
  )
  await expect(search).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)')
  await page.getByRole('button', { name: 'Close search' }).click()
  await expect(search).toBeHidden()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page
    .getByRole('button', { name: 'Add sounds to environment', exact: true })
    .click()
  expect(
    await search.evaluate((element) => element.getAnimations().length),
  ).toBe(0)
})
