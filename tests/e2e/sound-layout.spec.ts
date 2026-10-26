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
