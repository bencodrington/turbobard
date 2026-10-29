import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`search adds and removes packs with presets and previews individual sounds${mobile ? ' @mobile' : ''}`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 375, height: 667 })
    await page.addInitScript(() => {
      const events: string[] = []
      Object.defineProperty(window, '__previewEvents', { value: events })
      class FakeAudio {
        volume = 1
        currentTime = 0
        loop = false
        constructor(public src = '') {}
        addEventListener() {}
        load() {}
        removeAttribute() {}
        play() {
          events.push(`play:${this.src}`)
          return Promise.resolve()
        }
        pause() {
          events.push(`pause:${this.src}`)
        }
      }
      Object.defineProperty(window, 'Audio', { value: FakeAudio })
    })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => {
        const url = new URL(route.request().url())
        const music = {
          id: 'music',
          name: 'Swamp Music',
          tags: ['music', 'swamp'],
          type: 'LOOP',
          fileName: 'swamp-music',
        }
        const frogs = {
          id: 'frogs',
          name: 'Mangrove',
          tags: ['dusk', 'insects', 'birds', 'tropical', 'swamp'],
          type: 'ONESHOT',
          samples: ['frog'],
        }
        const pack = {
          id: 'pack',
          name: 'Swamp Travel',
          tags: ['pack'],
          type: 'PACK',
          tracks: [
            { id: 'music', volume: 0.3 },
            {
              id: 'frogs',
              volume: 0.6,
              oneShotConfig: { minSecondsBetween: 5, maxSecondsBetween: 12 },
            },
          ],
        }
        const result = url.pathname.endsWith('/search_v3')
          ? url.searchParams.get('searchResultType') === 'EVERYTHING'
            ? [pack, frogs, music]
            : [music]
          : url.searchParams.get('trackId') === 'music'
            ? music
            : frogs
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify(result),
        })
      },
    )
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Environment' }).click()
    await page
      .getByRole('textbox', { name: 'Environment name' })
      .fill('Swamp Journey')
    if (mobile)
      await page
        .getByRole('button', { name: 'Add sounds to environment' })
        .click()
    const search = page.getByRole('region', { name: 'Search', exact: true })
    await expect(search.getByRole('heading')).toHaveText(
      'Adding to Swamp Journey',
    )
    await search.getByRole('textbox', { name: 'Search Sounds' }).fill('swamp')
    await expect(
      search.getByText('Contains 2 sounds, including music.'),
    ).toBeVisible()
    await expect(
      search.getByRole('list', { name: 'Tags for Mangrove' }),
    ).toContainText('tropical')
    await expect(
      search.getByRole('button', { name: 'Preview Swamp Travel' }),
    ).toHaveCount(0)
    // Use real pointer hit testing: the title, tags, icon and row padding must
    // activate the same native button as the plus/minus affordance.
    const clickCenter = async (target: ReturnType<typeof search.locator>) => {
      const box = await target.boundingBox()
      expect(box).not.toBeNull()
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    }
    const frogsRow = search.locator('article').filter({ hasText: 'Mangrove' })
    await clickCenter(frogsRow.locator('strong'))
    await page.screenshot({ path: testInfo.outputPath('row-title-click.png') })
    await expect(
      search.getByRole('button', { name: 'Remove Mangrove from environment' }),
    ).toBeVisible()
    await clickCenter(frogsRow.getByText('tropical', { exact: true }))
    await expect(
      search.getByRole('button', { name: 'Add Mangrove to environment' }),
    ).toBeVisible()
    await clickCenter(frogsRow.getByRole('img', { name: 'Ambiance' }))
    await expect(
      search.getByRole('button', { name: 'Remove Mangrove from environment' }),
    ).toBeVisible()
    const rowBox = await frogsRow.boundingBox()
    await page.mouse.click(rowBox!.x + 3, rowBox!.y + rowBox!.height - 3)
    await expect(
      search.getByRole('button', { name: 'Add Mangrove to environment' }),
    ).toBeVisible()
    const packRow = search
      .locator('article')
      .filter({ hasText: 'Swamp Travel' })
    await clickCenter(packRow.getByText('Contains 2 sounds, including music.'))
    await expect(
      search.getByRole('button', {
        name: 'Remove Swamp Travel from environment',
      }),
    ).toBeVisible()
    const packToggle = search.getByRole('button', {
      name: 'Remove Swamp Travel from environment',
    })
    await packToggle.focus()
    await page.keyboard.press('Space')
    await expect(
      search.getByRole('button', { name: 'Add Swamp Travel to environment' }),
    ).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(
      search.getByRole('button', {
        name: 'Remove Swamp Travel from environment',
      }),
    ).toBeVisible()
    await clickCenter(packRow.locator('strong'))
    await expect(
      search.getByRole('button', { name: 'Add Swamp Travel to environment' }),
    ).toBeVisible()
    const combat = search.getByRole('checkbox', { name: 'Add to combat' })
    await combat.check()
    await search
      .getByRole('button', { name: 'Add Swamp Travel to environment' })
      .click()
    await expect(
      search.getByRole('button', {
        name: 'Remove Swamp Travel from environment',
      }),
    ).toBeVisible()
    const storedSounds = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('environments')!).environments[0]
          .sounds,
    )
    expect(storedSounds).toMatchObject([
      { id: 'music', volume: 0.3, placement: 'combat' },
      {
        id: 'frogs',
        volume: 0.6,
        placement: 'combat',
        minIntervalSeconds: 5,
        maxIntervalSeconds: 12,
      },
    ])
    await search
      .getByRole('button', { name: 'Remove Mangrove from environment' })
      .click()
    await expect(
      search.getByRole('button', { name: 'Add Swamp Travel to environment' }),
    ).toBeVisible()
    await search
      .getByRole('button', { name: 'Add Swamp Travel to environment' })
      .click()
    await search.getByRole('button', { name: 'Preview Mangrove' }).click()
    await search.getByRole('button', { name: 'Preview Swamp Music' }).click()
    await expect(
      search.getByRole('button', {
        name: 'Remove Swamp Travel from environment',
      }),
    ).toBeVisible()
    const events = await page.evaluate(
      () =>
        (window as typeof window & { __previewEvents: string[] })
          .__previewEvents,
    )
    expect(events.map((event) => event.split(':')[0])).toEqual([
      'play',
      'pause',
      'play',
    ])
    await search
      .getByRole('button', { name: 'Stop preview of Swamp Music' })
      .click()
    await search
      .getByRole('button', { name: 'Remove Swamp Travel from environment' })
      .click()
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('environments')!).environments[0]
            .sounds,
      ),
    ).toEqual([])

    await page.screenshot({ path: testInfo.outputPath('search-results.png') })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(mobile ? 375 : 1280)
    if (mobile) {
      await search.getByRole('button', { name: 'Preview Mangrove' }).click()
      await search.getByRole('button', { name: 'Close search' }).click()
      await page
        .getByRole('button', { name: 'Add sounds to environment' })
        .click()
      await expect(combat).not.toBeChecked()
      await expect(
        search.getByRole('button', { name: 'Preview Mangrove' }),
      ).toBeVisible()
      const finalEvents = await page.evaluate(
        () =>
          (window as typeof window & { __previewEvents: string[] })
            .__previewEvents,
      )
      expect(finalEvents.at(-1)).toContain('pause:')
    }
    await search.getByRole('button', { name: 'Music', exact: true }).click()
    await expect(search.getByText('Swamp Travel')).toHaveCount(0)
  })
}
