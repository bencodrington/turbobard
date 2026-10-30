import { expect, test } from '@playwright/test'

test('serves the legacy installed-app identity and browser icons', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    'content',
    '#121212',
  )
  const manifestUrl = await page
    .locator('link[rel="manifest"]')
    .getAttribute('href')
  const response = await page.request.get(manifestUrl!)
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain('manifest+json')
  const manifest = await response.json()
  expect(manifest).toMatchObject({
    name: 'TurboBard',
    short_name: 'TurboBard',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0078ce',
    background_color: '#121212',
  })
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    '192x192',
    '512x512',
  ])

  // Decode the served images so an SPA fallback or corrupt copy cannot pass.
  const icons = await page
    .locator('link[rel="icon"][type="image/png"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) =>
      links.map((link) => ({
        src: link.getAttribute('href')!,
        sizes: link.getAttribute('sizes')!,
      })),
    )
  for (const icon of [...manifest.icons, ...icons]) {
    const dimensions = await page.evaluate(async (src: string) => {
      const image = new Image()
      image.src = src
      await image.decode()
      return `${image.naturalWidth}x${image.naturalHeight}`
    }, icon.src)
    expect(dimensions).toBe(icon.sizes)
  }

  const favicon = await page.request.get('/favicon.ico')
  expect(favicon.ok()).toBeTruthy()
  expect([...(await favicon.body()).subarray(0, 4)]).toEqual([0, 0, 1, 0])
  const pinnedIcon = page.locator('link[rel="mask-icon"]')
  await expect(pinnedIcon).toHaveAttribute('color', '#0078ce')
  const pinnedResponse = await page.request.get(
    (await pinnedIcon.getAttribute('href'))!,
  )
  expect(pinnedResponse.headers()['content-type']).toContain('image/svg+xml')
  const tiles = await page.request.get('/browserconfig.xml')
  expect(await tiles.text()).toContain('/mstile-150x150.png')
  const tileIcon = await page.request.get('/mstile-150x150.png')
  expect(tileIcon.headers()['content-type']).toContain('image/png')
})
