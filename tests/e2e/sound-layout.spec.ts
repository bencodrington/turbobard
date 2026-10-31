import { expect, test } from '@playwright/test'

test('keeps sound entries and their controls inside the editor', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'scene',
            name: 'Scene',
            volume: 1,
            sounds: [
              {
                id: 'loop',
                name: 'An exceptionally long ambient sound name '.repeat(5),
                kind: 'loop',
                placement: 'ambiance',
                volume: 1,
              },
              {
                id: 'shot',
                name: 'UnbrokenSoundName'.repeat(15),
                kind: 'one-shot',
                placement: 'combat',
                volume: 0.5,
                minIntervalSeconds: 5,
                maxIntervalSeconds: 30,
              },
            ],
          },
        ],
      }),
    )
  })

  for (const width of [900, 1024, 1440, 768, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    if (width < 900) {
      await page.getByRole('button', { name: 'Edit environments' }).click()
      await page
        .getByRole('button', { name: 'Open Scene', exact: true })
        .click()
    }
    const editor = page.getByRole('region', { name: 'Scene', exact: true })
    await expect(editor).toBeVisible()
    const overflow = await editor.locator('.sound-row').evaluateAll((rows) =>
      rows.flatMap((row) => {
        const parent = row.parentElement!.getBoundingClientRect()
        return [row, ...row.querySelectorAll('*')]
          .filter((element) => {
            const rect = element.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) return false
            return rect.left < parent.left - 1 || rect.right > parent.right + 1
          })
          .map((element) => element.tagName)
      }),
    )
    expect(overflow, `overflow at ${width}px`).toEqual([])
  }
})

test('edits sound options through menus and modals', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'scene',
            name: 'Scene',
            volume: 1,
            sounds: [
              {
                id: 'owl',
                name: 'Owl',
                kind: 'one-shot',
                placement: 'ambiance',
                volume: 0.5,
                minIntervalSeconds: 5,
                maxIntervalSeconds: 30,
                attributionUrls: ['https://example.com/owl-recording'],
                source: {
                  author: 'Field recordings',
                  urls: ['https://example.com/owl.mp3'],
                },
              },
            ],
          },
        ],
      }),
    )
  })
  await page.goto('/')
  const options = page.getByRole('button', { name: 'Sound options for Owl' })
  await expect(
    page.getByRole('button', { name: 'Remove', exact: true }),
  ).toBeHidden()
  await expect(
    page.getByRole('combobox', { name: 'Placement for Owl' }),
  ).toHaveCount(0)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  const row = page.locator('.sound-row')
  await expect(row).toHaveCSS('border-top-width', '0px')
  await expect(row).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const slider = page.getByRole('slider', { name: 'Volume for Owl' })
  expect((await slider.boundingBox())!.width).toBeLessThanOrEqual(256)
  await options.click()
  await page.keyboard.press('Escape')
  await expect(options).toBeFocused()
  await expect(options).toHaveAttribute('aria-expanded', 'false')
  await options.click()
  await page.getByRole('button', { name: 'Audio source', exact: true }).click()
  const source = page.getByRole('dialog', { name: 'Audio source' })
  await expect(source.getByText('Author: Field recordings')).toBeVisible()
  await expect(source.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com/owl-recording',
  )
  await expect(
    source.getByRole('button', { name: 'Done', exact: true }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(options).toBeFocused()
  const edit = page.getByRole('button', { name: 'Edit intervals for Owl' })
  await edit.click()
  const cadence = page.getByRole('group', { name: 'Play every', exact: true })
  const variation = page.getByRole('group', {
    name: 'Give or take',
    exact: true,
  })
  await expect(cadence.getByRole('button').first()).toBeFocused()
  await cadence.getByRole('button', { name: /^4\s*s$/ }).click()
  await variation.getByRole('button', { name: /^8\s*s$/ }).click()
  await expect(
    page.getByRole('dialog', { name: 'Adjust timing' }).getByRole('status'),
  ).toHaveText('...every 0 to 12 seconds.')
  await variation.getByRole('button').last().focus()
  await page.keyboard.press('Tab')
  await expect(
    page.getByRole('button', { name: 'Close intervals' }),
  ).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  await edit.click()
  await expect(
    cadence.getByRole('button', { name: /^4\s*s$/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    variation.getByRole('button', { name: /^8\s*s$/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await options.click()
  await page
    .getByRole('button', { name: 'Move to combat', exact: true })
    .click()
  await options.click()
  await expect(
    page.getByRole('button', { name: 'Move to non-combat', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Move to non-combat', exact: true })
    .click()
  await options.click()
  await page.getByRole('button', { name: 'Remove', exact: true }).click()
  await expect(row).toHaveCount(0)
})

test('preserves original catalog attribution through adding and reloading a sound', async ({
  page,
}) => {
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => {
      const track = {
        id: 'rain',
        name: 'Rain',
        type: 'LOOP',
        fileName: 'rain-audio',
        source: {
          author: 'Recordist',
          urls: ['https://example.com/original-recording'],
        },
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(
          new URL(route.request().url()).pathname.endsWith('/search_v3')
            ? [track]
            : track,
        ),
      })
    },
  )
  await page.goto('/')
  await page
    .getByRole('button', { name: 'Add environment', exact: true })
    .click()
  await page.getByRole('textbox', { name: 'Search Sounds' }).fill('rain')
  await page.getByRole('button', { name: 'Add Rain to environment' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Sound options for Rain' }).click()
  const sourceOption = page.getByRole('button', {
    name: 'Audio source',
    exact: true,
  })
  await expect(sourceOption).toHaveCSS('transition-duration', '0s')
  const normal = await sourceOption.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  await sourceOption.hover()
  expect(
    await sourceOption.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe(normal)
  await sourceOption.click()
  const dialog = page.getByRole('dialog', { name: 'Audio source' })
  await expect(dialog.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com/original-recording',
  )
  await expect(dialog).not.toContainText('rain-audio.mp3')
})

test('long desktop columns scroll independently', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 })
  await page.addInitScript(() => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: Array.from({ length: 60 }, (_, index) => ({
          id: `scene-${index}`,
          name: `Scene ${index}`,
          sounds:
            index === 0
              ? Array.from({ length: 40 }, (_, i) => ({
                  id: `sound-${i}`,
                  name: `Sound ${i}`,
                  kind: 'loop',
                  placement: 'ambiance',
                  volume: 1,
                }))
              : [],
        })),
      }),
    )
  })
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => {
      const url = new URL(route.request().url())
      const result = url.pathname.endsWith('/search_v3')
        ? Array.from({ length: 40 }, (_, i) => ({
            id: `result-${i}`,
            name: `Result ${i}`,
            type: 'LOOP',
          }))
        : {
            id: url.searchParams.get('trackId'),
            name: `Result ${url.searchParams.get('trackId')}`,
            type: 'LOOP',
            fileName: 'result',
          }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(result),
      })
    },
  )
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Search Sounds' }).fill('results')
  await expect(page.locator('.catalog-item')).toHaveCount(40)
  const panels = ['.environment-panel', '.environment-editor', '.catalog-panel']
  for (const selector of panels) {
    const metrics = await page.locator(selector).evaluate((element) => ({
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }))
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.height)
    const otherSelectors = panels.filter((other) => other !== selector)
    const before = await Promise.all(
      otherSelectors.map((other) =>
        page.locator(other).evaluate((element) => element.scrollTop),
      ),
    )
    await page.locator(selector).hover()
    await page.mouse.wheel(0, 300)
    await expect
      .poll(() =>
        page.locator(selector).evaluate((element) => element.scrollTop),
      )
      .toBeGreaterThan(0)
    const after = await Promise.all(
      otherSelectors.map((other) =>
        page.locator(other).evaluate((element) => element.scrollTop),
      ),
    )
    expect(after).toEqual(before)
  }
  expect(
    await page
      .locator('.workspace-body')
      .evaluate((element) => element.scrollTop),
  ).toBe(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    700,
  )
  await page.screenshot({
    path: 'docs/evidence/independent-column-scrolling.png',
  })
})
