import { expect, test, type Page } from '@playwright/test'

test('loads the Turbobard workspace', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Turbobard')
  await expect(page.getByRole('heading', { name: 'Turbobard' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Environments' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible()
})

test('closes the About modal when its backdrop is clicked', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'About' }).click()

  const modal = page.getByRole('dialog', { name: 'About' })
  const backdrop = page.locator('.modal-backdrop')
  await modal.getByRole('heading', { name: 'About' }).click()
  await expect(modal).toBeVisible()

  await backdrop.click({ position: { x: 10, y: 10 } })
  await expect(modal).toBeHidden()
})

test('creates an Environment without the Search panel intercepting the action', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Create Environment' }).click()

  await expect(
    page.getByRole('region', { name: 'New Environment' }),
  ).toBeVisible()
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
  const environment = page.getByRole('region', { name: 'New Environment' })
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

test('does not let a stopped fade pause Heavy Rain after it starts again', async ({
  page,
}) => {
  await stubCatalogAndAudio(page)
  await addAndPlayHeavyRain(page)
  const environment = page.getByRole('region', { name: 'New Environment' })

  await environment.getByRole('button', { name: 'Stop' }).click()
  await environment.getByRole('button', { name: 'Play' }).click()
  await page.waitForTimeout(2_100)

  expect(
    await page.evaluate(() =>
      (
        window as typeof window & {
          __audioEvents: Array<{ type: string; source?: string }>
        }
      ).__audioEvents.some(
        (event) =>
          event.type === 'pause' && event.source?.endsWith('/heavy-rain.mp3'),
      ),
    ),
  ).toBe(false)
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
  const environment = page.getByRole('region', { name: 'New Environment' })
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

type AudioEvent = { type: string; source?: string }

async function stubCatalogWithCombat(page: Page) {
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
        const query = (url.searchParams.get('searchText') ?? '').toLowerCase()
        const all = [
          { id: 'heavy-rain', name: 'Heavy Rain', type: 'LOOP' },
          { id: 'battle-drums', name: 'Battle Drums', type: 'LOOP' },
        ]
        const results = query
          ? all.filter((s) => s.name.toLowerCase().includes(query))
          : all
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(results),
        })
      }
      const trackId = url.searchParams.get('trackId') ?? ''
      if (trackId === 'battle-drums') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'battle-drums',
            name: 'Battle Drums',
            type: 'LOOP',
            fileName: 'battle-drums',
          }),
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

test('toggling Combat mode fades ordinary music and starts combat music', async ({
  page,
}) => {
  await stubCatalogWithCombat(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Environment' }).click()
  const environment = page.getByRole('region', { name: 'New Environment' })

  // Add Heavy Rain as ambiance (search by exact name so only one result shows)
  await page.getByRole('textbox', { name: 'Search Sounds' }).fill('heavy rain')
  await expect(page.getByRole('button', { name: 'Add' }).first()).toBeEnabled()
  await page.getByRole('button', { name: 'Add' }).first().click()
  await expect(page.getByText('Heavy Rain').last()).toBeVisible()

  // Add Battle Drums and set it to combat placement
  await page
    .getByRole('textbox', { name: 'Search Sounds' })
    .fill('battle drums')
  await expect(page.getByRole('button', { name: 'Add' }).first()).toBeEnabled()
  await page.getByRole('button', { name: 'Add' }).first().click()
  await expect(page.getByText('Battle Drums').last()).toBeVisible()
  await page
    .getByRole('combobox', { name: /placement for battle drums/i })
    .selectOption('combat')

  // Play the environment
  await environment.getByRole('button', { name: 'Play' }).click()

  // Verify Heavy Rain started
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { __audioEvents: Array<AudioEvent> }
        ).__audioEvents.some(
          (e) => e.type === 'play' && e.source?.endsWith('/heavy-rain.mp3'),
        ),
      ),
    )
    .toBe(true)

  // Toggle Combat mode on
  await environment.getByRole('button', { name: /combat/i }).click()

  // Heavy Rain should be paused (faded out)
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as typeof window & { __audioEvents: Array<AudioEvent> }
          ).__audioEvents.some(
            (e) => e.type === 'pause' && e.source?.endsWith('/heavy-rain.mp3'),
          ),
        ),
      { timeout: 5_000 },
    )
    .toBe(true)

  // Battle Drums should now be playing
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as typeof window & { __audioEvents: Array<AudioEvent> }
          ).__audioEvents.some(
            (e) => e.type === 'play' && e.source?.endsWith('/battle-drums.mp3'),
          ),
        ),
      { timeout: 5_000 },
    )
    .toBe(true)
})

test('searches, selects, and persists an Environment icon and color', async ({
  page,
}) => {
  await page.route('https://api.fontawesome.com', (route) => {
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          search: [
            {
              id: 'fire',
              familyStylesByLicense: {
                free: [{ style: 'solid' }],
              },
            },
            {
              id: 'campfire',
              familyStylesByLicense: {
                free: [{ style: 'solid' }],
              },
            },
          ],
        },
      }),
    })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Create Environment' }).click()

  const iconTrigger = page.getByRole('button', {
    name: /select icon for new environment/i,
  })
  await iconTrigger.click()
  await expect(iconTrigger.locator('.environment-icon')).toBeVisible()

  await expect(
    page.getByRole('heading', { name: 'Select an icon' }),
  ).toBeVisible()

  const modal = page.getByRole('dialog')
  const backdrop = page.locator('.modal-backdrop')
  await modal.getByRole('heading', { name: 'Select an icon' }).click()
  await expect(modal).toBeVisible()
  await backdrop.click({ position: { x: 10, y: 10 } })
  await expect(modal).toBeHidden()

  await iconTrigger.click()
  await expect(modal).toBeVisible()

  const iconSearch = page.getByRole('textbox', { name: 'Search icons' })
  await iconSearch.fill('fire')

  const fireButton = page.getByRole('button', { name: 'fire', exact: true })
  await expect(fireButton).toBeVisible()
  await expect(fireButton.locator('.environment-icon')).toBeVisible()
  await expect(
    page
      .getByRole('button', { name: 'campfire', exact: true })
      .locator('.environment-icon'),
  ).toBeVisible()
  await fireButton.click()
  await expect(fireButton).toHaveAttribute('aria-pressed', 'true')

  const colorButton = page.getByRole('button', { name: 'Select color #F87C7C' })
  await colorButton.click()
  await expect(colorButton).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Close icon picker' }).click()

  await expect(iconTrigger).toHaveAttribute('data-icon', 'fire')
  await expect(iconTrigger).toHaveAttribute('data-color', '#F87C7C')

  await page.reload()

  const reloadedIconTrigger = page.getByRole('button', {
    name: /select icon for new environment/i,
  })
  await expect(reloadedIconTrigger).toHaveAttribute('data-icon', 'fire')
  await expect(reloadedIconTrigger).toHaveAttribute('data-color', '#F87C7C')
})

test('closes the icon picker with Escape @mobile', async ({ page }) => {
  await page.goto('/')
  const tap = async (locator: ReturnType<typeof page.getByRole>) => {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    await page.touchscreen.tap(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2,
    )
  }
  await tap(page.getByRole('button', { name: 'Create Environment' }))
  await tap(
    page.getByRole('button', { name: /select icon for new environment/i }),
  )

  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('textbox', { name: 'Search icons' }).press('Escape')

  await expect(page.getByRole('dialog')).toBeHidden()
})
