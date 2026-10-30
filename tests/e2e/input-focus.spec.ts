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
  await page.getByRole('button', { name: 'Create Environment' }).click()
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

test('replaces numeric text on focus where number selection is supported', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Chromium supports selection on number inputs',
  )

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
  const minimum = page.getByRole('spinbutton', {
    name: 'Minimum interval for Owl',
  })

  await minimum.focus()
  await page.keyboard.type('8')

  await expect(minimum).toHaveValue('8')
})
