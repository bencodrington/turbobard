import { expect, test } from '@playwright/test'

test('playing tiles keep their layout while showing a tile-coloured frame and background equalizer', async ({
  page,
}) => {
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: /^(Create Environment|Add environment)$/ })
    .click()
  await page
    .getByRole('button', { name: 'Select icon for New Environment' })
    .click()
  await page.getByRole('button', { name: 'Select color #F87C7C' }).click()
  await page.getByRole('button', { name: 'Close icon picker' }).click()
  const tile = page.locator('.environment-tile:not(.environment-create-tile)')
  const stopped = (await tile.boundingBox())!
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  const playing = (await tile.boundingBox())!
  expect(playing.width).toBe(stopped.width)
  expect(playing.height).toBe(stopped.height)
  await expect(tile.locator('.tile-equalizer')).toHaveCSS(
    'position',
    'absolute',
  )
  await expect(tile.locator('.tile-equalizer')).toHaveCSS('opacity', '1')
  await expect(tile.locator('.tile-equalizer')).toHaveCSS('bottom', '2px')
  await expect(tile.locator('.tile-equalizer')).toHaveCSS('gap', '2px')
  await expect(tile.locator('.tile-equalizer i').first()).toHaveCSS(
    'border-radius',
    '0px',
  )
  await expect(tile.locator('.tile-equalizer i')).toHaveCount(14)
  await expect(tile.locator('.tile-equalizer i').first()).toHaveCSS(
    'background-color',
    'rgb(248, 124, 124)',
  )
  const frame = await tile.evaluate((element) => {
    const style = getComputedStyle(element, '::before')
    return {
      background: style.backgroundImage,
      animation: style.animationName,
      duration: style.animationDuration,
      width: style.paddingTop,
    }
  })
  expect(frame.animation).toBe('now-playing-spin')
  expect(frame.duration).toBe('6s')
  expect(frame.width).toBe('2px')
  expect(frame.background).toContain('rgb(248, 124, 124)')
  await expect(tile.locator('.tile-equalizer i').first()).toHaveCSS(
    'animation-duration',
    '2s',
  )
  // An already mounted bar may still use the pre-extraction class names
  // during a live update. Both versions must use the shared toggle styles.
  const toggle = page.locator('.now-playing-bar .combat-toggle')
  await toggle.evaluate((element) => {
    element.classList.replace('combat-toggle', 'now-playing-combat')
    element
      .querySelector('.combat-switch')!
      .classList.replace('combat-switch', 'now-playing-switch')
    element
      .querySelector('.combat-thumb')!
      .classList.replace('combat-thumb', 'now-playing-thumb')
  })
  const legacyToggle = page.locator('.now-playing-combat')
  await expect(legacyToggle.locator('input')).toHaveCSS('opacity', '0')
  await expect(legacyToggle.locator('.now-playing-switch')).toHaveCSS(
    'width',
    '35px',
  )
  await legacyToggle.getByRole('checkbox', { name: 'Combat' }).check()
  await expect(legacyToggle.locator('.now-playing-thumb')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 17.5, 0)',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await tile.evaluate(
      (element) => element.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(tile.locator('.tile-equalizer')).toHaveCount(0)
})

test('tile hover shows the current play, pause, or edit action', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  const tile = page.locator('.environment-tile:not(.environment-create-tile)')
  const icon = tile.locator('.environment-icon')
  const action = tile.locator('.environment-tile-action')
  await page.mouse.move(0, 0)
  await expect(icon).toBeVisible()
  await expect(action).toBeHidden()
  const bounds = (await tile.boundingBox())!
  await tile.hover()
  await expect(icon).toBeHidden()
  await expect(action.locator('[data-icon="play"]')).toBeVisible()
  await tile.click()
  await expect(action.locator('[data-icon="pause"]')).toBeVisible()
  await page.getByRole('button', { name: 'Edit environments' }).click()
  await tile.hover()
  await expect(action.locator('[data-icon="wrench"]')).toBeVisible()
  expect((await tile.boundingBox())!.height).toBe(bounds.height)
  await page.mouse.move(0, 0)
  await expect(icon).toBeVisible()
  await expect(action).toBeHidden()
})
