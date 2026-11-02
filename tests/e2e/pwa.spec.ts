import { expect, test } from '@playwright/test'

test('serves the installed-app identity and browser icons', async ({
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

test('home screen icons show the current logo on the app background', async ({
  page,
}) => {
  await page.goto('/')
  const manifest = await page.request
    .get('/site.webmanifest')
    .then((r) => r.json())
  const touchIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute('href')
  const iconUrls = [
    touchIcon!,
    '/apple-touch-icon.png',
    ...manifest.icons.map((icon: { src: string }) => icon.src),
  ]

  for (const src of iconUrls) {
    const pixels = await page.evaluate(async (url: string) => {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let blue = 0
      let yellow = 0
      for (let index = 0; index < data.length; index += 4) {
        if (
          data[index] === 0 &&
          data[index + 1] === 120 &&
          data[index + 2] === 206 &&
          data[index + 3] === 255
        )
          blue++
        if (
          data[index] === 255 &&
          data[index + 1] === 218 &&
          data[index + 2] === 34 &&
          data[index + 3] === 255
        )
          yellow++
      }
      return { corner: [...data.slice(0, 4)], blue, yellow }
    }, src)
    expect(pixels.corner, src).toEqual([18, 18, 18, 255])
    expect(pixels.blue, src).toBeGreaterThan(0)
    expect(pixels.yellow, src).toBeGreaterThan(0)
  }
})
