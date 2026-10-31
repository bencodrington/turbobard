import { expect, test } from '@playwright/test'

test('hexagonal playback button follows hover, playback, and reduced-motion states', async ({
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

  const play = page.getByRole('button', { name: 'Play', exact: true })
  await page.mouse.move(0, 0)
  await expect(play).toHaveCSS('color', 'rgb(167, 167, 167)')
  await play.hover()
  await expect(play).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(play).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await play.click()

  const stop = page.getByRole('button', { name: 'Stop', exact: true })
  const hexagon = stop.locator('.playback-button-hexagon path')
  await expect(hexagon).toHaveCSS('animation-duration', '5s')
  expect(
    await hexagon.evaluate((element) => element.getAnimations().length),
  ).toBe(1)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(hexagon).toHaveCSS('animation-name', 'none')
  await expect(hexagon).toHaveCSS('transition-duration', '0s')

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(
    await hexagon.evaluate((element) => element.getAnimations().length),
  ).toBe(1)
  await stop.click()
  await expect(play).toBeVisible()
  await expect(play.locator('.playback-button-hexagon path')).toHaveCSS(
    'animation-name',
    'none',
  )
})
