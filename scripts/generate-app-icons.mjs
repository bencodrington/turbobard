import { readFile, writeFile } from 'node:fs/promises'
import { URL } from 'node:url'
import { chromium } from '@playwright/test'

const logo = await readFile(
  new URL('../src/assets/logo.svg', import.meta.url),
  'utf8',
)
const mark = logo.match(/<path\b[^>]*\/>/g)?.slice(0, 2)
if (mark?.length !== 2) throw new Error('Expected two logo mark paths')

const browser = await chromium.launch()
try {
  for (const [filename, size] of [
    ['apple-touch-icon.png', 180],
    ['apple-touch-icon-180x180.png', 180],
    ['android-chrome-192x192.png', 192],
    ['android-chrome-512x512.png', 512],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    })
    await page.setContent(`
      <style>html, body { margin: 0; }</style>
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#121212" />
        <g transform="translate(19 19) scale(1.55)">${mark.join('')}</g>
      </svg>
    `)
    const png = await page.locator('svg').screenshot()
    await writeFile(new URL(`../public/${filename}`, import.meta.url), png)
    await page.close()
  }
} finally {
  await browser.close()
}
