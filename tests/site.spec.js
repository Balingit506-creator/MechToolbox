import { test, expect } from '@playwright/test'
import { openSite } from './helpers.js'

const visibleTitles = (page) => page.locator('#card-grid .card:visible h3').allTextContents()

test('loads with all 108 calculators and no script errors', async ({ page }) => {
  const errors = await openSite(page)
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})

test('category filters show the right calculators', async ({ page }) => {
  await openSite(page)
  const counts = { all: 108, M: 17, H: 7, V: 13, AC: 19, DD: 18, E: 17, P: 7, F: 9, S: 6 }
  for (const [f, n] of Object.entries(counts)) {
    await page.locator(`[data-filter="${f}"]`).click()
    await expect(page.locator('#card-grid .card:visible')).toHaveCount(n)
  }
})

test('compact view follows the selected category', async ({ page }) => {
  await openSite(page)
  await page.locator('.view-toggle button[data-view="compact"]').click()
  await page.locator('[data-filter="S"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(6)
  expect(await visibleTitles(page)).toEqual(['Sanitary Drain Capacity', 'Drainage Fixture Units', 'Septic Tank Sizing', 'Grease Interceptor Sizing', 'Rainwater Harvesting Tank', 'Roof / Storm Drainage'])
  await page.locator('.view-toggle button[data-view="cards"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(6)
})

test('minimize all hides the list and a category brings it back', async ({ page }) => {
  await openSite(page)
  await page.locator('[data-filter="E"]').click()
  await page.locator('#min-all').click()
  await expect(page.locator('#card-grid')).toBeHidden()
  await expect(page.locator('#min-all-label')).toHaveText('Show all (17)')
  await page.locator('[data-filter="F"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(9)
})

test('search finds calculators by keyword', async ({ page }) => {
  await openSite(page)
  await page.locator('#calc-q').fill('septic')
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(1)
  await expect(page.locator('#card-grid .card:visible h3')).toHaveText('Septic Tank Sizing')
})
