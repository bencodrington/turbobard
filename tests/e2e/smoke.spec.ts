import { expect, test, type Page } from '@playwright/test'

test('loads the Turbobard workspace', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Turbobard')
  await expect(page.getByRole('heading', { name: 'Turbobard' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'Ready for the first listening session.',
  )
})

async function stubCatalogAndAudio(page: Page) {
  await page.addInitScript(() => {
    const events: Array<{ type: string; source?: string }> = []
    class FakeAudio {
      currentTime = 0
      loop = false
      preload = ''
      volume = 1
      private listeners = new Map<string, Array<() => void>>()
      constructor(public src = '') {
        events.push({ type: 'construct', source: src })
      }
      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, [
          ...(this.listeners.get(type) ?? []),
          listener,
        ])
      }
      load() {
        events.push({ type: 'load', source: this.src })
      }
      play() {
        events.push({ type: 'play', source: this.src })
        return Promise.resolve()
      }
      pause() {
        events.push({ type: 'pause', source: this.src })
      }
      removeAttribute() {}
    }
    Object.defineProperty(window, 'Audio', { value: FakeAudio })
    Object.defineProperty(window, '__audioEvents', { value: events })
  })
  await page.route(
    'https://us-central1-turbo-bard.cloudfunctions.net/**',
    (route) => {
      const url = new URL(route.request().url())
      if (url.pathname.endsWith('/search_v3')) {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'heavy-rain', name: 'Heavy Rain', type: 'LOOP' },
          ]),
        })
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'heavy-rain',
          name: 'Heavy Rain',
          type: 'LOOP',
          fileName: 'heavy-rain',
        }),
      })
    },
  )
}

async function addAndPlayHeavyRain(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Environment' }).click()
  const environment = page.getByRole('listitem')
  await page.getByRole('textbox', { name: 'Search Sounds' }).fill('rain')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Heavy Rain').last()).toBeVisible()
  await environment.getByRole('button', { name: 'Play' }).click()

  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __audioEvents: Array<{ type: string; source?: string }>
          }
        ).__audioEvents.some(
          (event) =>
            event.type === 'play' && event.source?.endsWith('/heavy-rain.mp3'),
        ),
      ),
    )
    .toBe(true)
}

test('fades Heavy Rain out when it is removed from a playing Environment', async ({
  page,
}) => {
  await stubCatalogAndAudio(page)
  await addAndPlayHeavyRain(page)
  await page.getByRole('button', { name: 'Remove' }).click()

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __audioEvents: Array<{ type: string; source?: string }>
            }
          ).__audioEvents.some(
            (event) =>
              event.type === 'pause' &&
              event.source?.endsWith('/heavy-rain.mp3'),
          ),
        ),
      { timeout: 5_000 },
    )
    .toBe(true)
})

test('fades Heavy Rain out when its playing Environment is deleted', async ({
  page,
}) => {
  await stubCatalogAndAudio(page)
  await addAndPlayHeavyRain(page)
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText(/no Environments yet/i)).toBeVisible()
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __audioEvents: Array<{ type: string; source?: string }>
            }
          ).__audioEvents.some(
            (event) =>
              event.type === 'pause' &&
              event.source?.endsWith('/heavy-rain.mp3'),
          ),
        ),
      { timeout: 5_000 },
    )
    .toBe(true)
})

test('plays a sound added to an already-playing Environment', async ({
  page,
}) => {
  await stubCatalogAndAudio(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Environment' }).click()
  const environment = page.getByRole('listitem')
  await environment.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('textbox', { name: 'Search Sounds' }).fill('rain')
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByText('Heavy Rain').last()).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & {
            __audioEvents: Array<{ type: string; source?: string }>
          }
        ).__audioEvents.some(
          (event) =>
            event.type === 'play' && event.source?.endsWith('/heavy-rain.mp3'),
        ),
      ),
    )
    .toBe(true)
})
