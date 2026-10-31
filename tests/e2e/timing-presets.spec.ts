import { expect, test } from '@playwright/test'

test('preserves legacy timing until edited and retains clamped presets after reload', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('environments')) return
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'forest',
            name: 'Forest',
            volume: 1,
            sounds: [
              {
                id: 'owl',
                name: 'Owl',
                kind: 'one-shot',
                placement: 'ambiance',
                volume: 1,
                minIntervalSeconds: 5,
                maxIntervalSeconds: 12,
              },
            ],
          },
        ],
      }),
    )
  })
  await page.goto('/')
  const before = await page.evaluate(() => localStorage.getItem('environments'))
  const edit = page.getByRole('button', { name: 'Edit intervals for Owl' })
  await edit.click()
  const modal = page.getByRole('dialog', { name: 'Adjust timing' })
  const cadence = modal.getByRole('group', { name: 'Play every', exact: true })
  const variation = modal.getByRole('group', {
    name: 'Give or take',
    exact: true,
  })
  await expect(modal).toContainText('Control how often Owl plays')
  await expect(modal.getByRole('status')).toContainText(
    '...every 5 to 12 seconds',
  )
  await expect(modal.locator('[aria-pressed="true"]')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('environments'))).toBe(
    before,
  )
  await variation.getByRole('button', { name: /^4\s*s$/ }).click()
  await expect(
    cadence.getByRole('button', { name: /^10\s*s$/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(modal.getByRole('status')).toContainText(
    '...every 6 to 14 seconds',
  )
  await cadence.getByRole('button', { name: /^4\s*s$/ }).click()
  await variation.getByRole('button', { name: /^8\s*s$/ }).click()
  await expect(modal.getByRole('status')).toContainText(
    '...every 0 to 12 seconds',
  )
  await page.reload()
  await edit.click()
  await expect(
    cadence.getByRole('button', { name: /^4\s*s$/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(
    variation.getByRole('button', { name: /^8\s*s$/ }),
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(modal.getByRole('status')).toContainText(
    '...every 0 to 12 seconds',
  )
  for (const width of [1280, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const overflow = await modal.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return Array.from(element.querySelectorAll('button')).some((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left < bounds.left || rect.right > bounds.right
      })
    })
    expect(overflow).toBe(false)
    await modal.screenshot({ path: `docs/evidence/adjust-timing-${width}.png` })
  }
  await variation.getByRole('button', { name: /^0\s*s$/ }).click()
  await expect(modal.getByRole('status')).toContainText('...every 4 seconds')
})
