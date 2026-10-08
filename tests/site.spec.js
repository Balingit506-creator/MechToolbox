import { test, expect } from '@playwright/test'
import { openSite } from './helpers.js'

const visibleTitles = (page) => page.locator('#card-grid .card:visible h3').allTextContents()

test('loads with all 68 calculators and no script errors', async ({ page }) => {
  const errors = await openSite(page)
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})

test('category filters show the right calculators', async ({ page }) => {
  await openSite(page)
  const counts = { all: 68, M: 17, H: 6, V: 10, AC: 9, DD: 14, E: 5, P: 3, F: 4, S: 4 }
  for (const [f, n] of Object.entries(counts)) {
    await page.locator(`[data-filter="${f}"]`).click()
    await expect(page.locator('#card-grid .card:visible')).toHaveCount(n)
  }
})

test('compact view follows the selected category', async ({ page }) => {
  await openSite(page)
  await page.locator('.view-toggle button[data-view="compact"]').click()
  await page.locator('[data-filter="S"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(4)
  expect(await visibleTitles(page)).toEqual(['Sanitary Drain Capacity', 'Drainage Fixture Units', 'Septic Tank Sizing', 'Roof / Storm Drainage'])
  await page.locator('.view-toggle button[data-view="cards"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(4)
})

test('minimize all hides the list and a category brings it back', async ({ page }) => {
  await openSite(page)
  await page.locator('[data-filter="E"]').click()
  await page.locator('#min-all').click()
  await expect(page.locator('#card-grid')).toBeHidden()
  await expect(page.locator('#min-all-label')).toHaveText('Show all (5)')
  await page.locator('[data-filter="F"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(4)
})

test('search finds calculators by keyword', async ({ page }) => {
  await openSite(page)
  await page.locator('#calc-q').fill('septic')
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(1)
  await expect(page.locator('#card-grid .card:visible h3')).toHaveText('Septic Tank Sizing')
})
