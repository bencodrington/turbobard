import { expect, test } from '@playwright/test'

test('selects Environment name text on pointer and keyboard focus', async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(
    browserName !== 'chromium',
    'Capture native selection evidence in Chromium',
  )

  await page.addInitScript(() => {
    Object.defineProperty(window, '__originalSelect', {
      value: HTMLInputElement.prototype.select,
    })
    HTMLInputElement.prototype.select = function () {}
  })
  await page.goto('/')
  await page
    .getByRole('button', { name: /^(Create Environment|Add environment)$/ })
    .click()
  const name = page.getByRole('textbox', { name: 'Environment name' })
  await name.click()
  await page.screenshot({
    path: testInfo.outputPath('input-focus-before.png'),
  })

  await page.evaluate(() => {
    HTMLInputElement.prototype.select = Object.getOwnPropertyDescriptor(
      window,
      '__originalSelect',
    )!.value
  })
  await name.evaluate((input: HTMLInputElement) => input.blur())
  await name.focus()

  await expect
    .poll(() =>
      name.evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
      ]),
    )
    .toEqual([0, 'New Environment'.length])
  await page.screenshot({ path: testInfo.outputPath('input-focus-after.png') })

  await name.click({ position: { x: 3, y: 12 } })
  await expect
    .poll(() =>
      name.evaluate(
        (input: HTMLInputElement) =>
          input.selectionStart === input.selectionEnd,
      ),
    )
    .toBe(true)

  await page
    .getByRole('button', { name: /select icon for new environment/i })
    .focus()
  await page.keyboard.press('Tab')
  await expect(name).toBeFocused()
  await expect
    .poll(() =>
      name.evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
      ]),
    )
    .toEqual([0, 'New Environment'.length])
})

test('supports keyboard selection of timing presets', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'environments',
      JSON.stringify({
        version: 1,
        environments: [
          {
            id: 'scene',
            name: 'Scene',
            sounds: [
              {
                id: 'owl',
                name: 'Owl',
                kind: 'one-shot',
                placement: 'ambiance',
                volume: 1,
                minIntervalSeconds: 5,
                maxIntervalSeconds: 10,
              },
            ],
          },
        ],
      }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit intervals for Owl' }).click()
  const cadence = page.getByRole('group', { name: 'Play every', exact: true })
  const first = cadence.getByRole('button').first()
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('aria-pressed', 'true')
  await expect(
    page.getByRole('dialog', { name: 'Adjust timing' }).getByRole('status'),
  ).toContainText('...every 0 to 3 seconds')
})
