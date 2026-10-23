import { expect, test } from '@playwright/test'

test('loads the Turbobard workspace', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Turbobard')
  await expect(page.getByRole('heading', { name: 'Turbobard' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'Ready for the first listening session.',
  )
})
