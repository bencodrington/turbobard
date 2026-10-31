import { expect, test } from '@playwright/test'

for (const mobile of [false, true]) {
  test(`Environment details fade and slide in both directions${mobile ? ' @mobile' : ''}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: mobile ? 375 : 1280, height: 800 })
    await page.route(
      'https://us-central1-turbo-bard.cloudfunctions.net/**',
      (route) => route.fulfill({ contentType: 'application/json', body: '[]' }),
    )
    await page.goto('/')
    await page
      .getByRole('button', { name: /^(Create Environment|Add environment)$/ })
      .click()
    if (mobile)
      await page.getByRole('button', { name: 'Close Environment' }).click()
    await page.getByRole('button', { name: 'Edit environments' }).click()
    if (mobile)
      await page
        .getByRole('button', { name: 'Open New Environment', exact: true })
        .click()
    const editor = page.locator('.environment-editor')
    const tile = page.getByRole('button', {
      name: 'Open New Environment',
      exact: true,
    })
    await expect(editor).toHaveCSS('opacity', '1')
    const openWidth = (await editor.boundingBox())!.width
    // Freeze the transition as soon as React commits the close, so slower CI
    // workers cannot miss this short animation between test commands.
    await editor.evaluate((element) => {
      const workspace = element.parentElement!
      const observer = new MutationObserver(() => {
        if (workspace.classList.contains('editor-open')) return
        for (const animation of [
          ...workspace.getAnimations(),
          ...element.getAnimations(),
        ]) {
          animation.pause()
          animation.currentTime = 90
        }
        observer.disconnect()
      })
      observer.observe(workspace, {
        attributes: true,
        attributeFilter: ['class'],
      })
    })
    await page.getByRole('button', { name: 'Close Environment' }).click()
    await expect(tile).toBeFocused()
    await expect(editor).toHaveAttribute('inert', '')
    await expect(editor).toHaveAttribute('aria-hidden', 'true')
    // Pause halfway through the real CSS animation to verify an intermediate
    // rendered state, rather than merely asserting a transition declaration.
    const halfway = await editor.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        opacity: Number(style.opacity),
        x: new DOMMatrixReadOnly(style.transform).m41,
        width: element.getBoundingClientRect().width,
      }
    })
    expect(halfway.opacity).toBeGreaterThan(0)
    expect(halfway.opacity).toBeLessThan(1)
    expect(halfway.x).toBeGreaterThan(-8)
    expect(halfway.x).toBeLessThan(0)
    if (!mobile) {
      expect(halfway.width).toBeGreaterThan(0)
      expect(halfway.width).toBeLessThan(openWidth)
    }
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => animation.finish()),
    )
    await expect(editor).toBeHidden()
    if (!mobile) expect((await editor.boundingBox())!.width).toBeLessThan(1)
    await tile.press('Enter')
    await expect(editor).not.toHaveAttribute('inert', '')
    await expect(editor).toHaveCSS('opacity', '1')
    // Reversing an unfinished close must not leave the pane hidden or inert.
    await page.getByRole('button', { name: 'Close Environment' }).click()
    await tile.press('Enter')
    await expect(editor).toHaveCSS('opacity', '1')
    await expect(editor).toBeVisible()
    await expect(editor).not.toHaveAttribute('inert', '')

    if (mobile) {
      await page.getByRole('button', { name: 'Close Environment' }).click()
      await expect(editor).toBeHidden()
      await editor.evaluate((element) => {
        const workspace = element.parentElement!
        const observer = new MutationObserver(() => {
          if (!workspace.classList.contains('editor-open')) return
          for (const animation of element.getAnimations()) {
            animation.pause()
            animation.currentTime = 90
          }
          observer.disconnect()
        })
        observer.observe(workspace, {
          attributes: true,
          attributeFilter: ['class'],
        })
      })
      await tile.click()
      const name = page.getByRole('textbox', { name: 'Environment name' })
      const halfwayWidth = (await name.boundingBox())!.width
      await page.evaluate(() =>
        document.getAnimations().forEach((a) => a.finish()),
      )
      const finalWidth = (await name.boundingBox())!.width
      expect(halfwayWidth).toBeCloseTo(finalWidth, 0)
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Close Environment' }).click()
    await expect(editor).toBeHidden()
    expect(
      await editor.evaluate((element) => element.getAnimations().length),
    ).toBe(0)
    expect(
      await page
        .locator('.workspace-body')
        .evaluate((element) => element.getAnimations().length),
    ).toBe(0)
    await tile.press('Enter')
    await expect(editor).toHaveCSS('opacity', '1')
    expect(
      await editor.evaluate((element) => element.getAnimations().length),
    ).toBe(0)
  })
}
