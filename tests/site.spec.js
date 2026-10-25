import { test, expect } from '@playwright/test'
import { openSite } from './helpers.js'

const visibleTitles = (page) => page.locator('#card-grid .card:visible h3').allTextContents()

test('loads with all 131 calculators and no script errors', async ({ page }) => {
  const errors = await openSite(page)
  await page.waitForTimeout(500)
  expect(errors).toEqual([])
})

test('category filters show the right calculators', async ({ page }) => {
  await openSite(page)
  const counts = { all: 131, M: 17, H: 7, V: 14, AC: 18, R: 10, DD: 18, E: 20, P: 13, F: 15, S: 7 }
  for (const [f, n] of Object.entries(counts)) {
    await page.locator(`[data-filter="${f}"]`).click()
    await expect(page.locator('#card-grid .card:visible')).toHaveCount(n)
  }
})

test('compact view follows the selected category', async ({ page }) => {
  await openSite(page)
  await page.locator('.view-toggle button[data-view="compact"]').click()
  await page.locator('[data-filter="S"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(7)
  expect(await visibleTitles(page)).toEqual(['Sanitary Drain Capacity', 'Drainage Fixture Units', 'Septic Tank Sizing', 'Sewage Treatment Plant (STP) Sizing', 'Grease Interceptor Sizing', 'Rainwater Harvesting Tank', 'Roof / Storm Drainage'])
  await page.locator('.view-toggle button[data-view="cards"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(7)
})

test('minimize all hides the list and a category brings it back', async ({ page }) => {
  await openSite(page)
  await page.locator('[data-filter="E"]').click()
  await page.locator('#min-all').click()
  await expect(page.locator('#card-grid')).toBeHidden()
  await expect(page.locator('#min-all-label')).toHaveText('Show all (20)')
  await page.locator('[data-filter="F"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(15)
})

test('search finds calculators by keyword', async ({ page }) => {
  await openSite(page)
  await page.locator('#calc-q').fill('septic')
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(1)
  await expect(page.locator('#card-grid .card:visible h3')).toHaveText('Septic Tank Sizing')
})

test('donate opens a choice of amounts that go to PayPal', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const errors = await openSite(page)
  const links = page.locator('a.donate')
  await expect(links).toHaveCount(3) // header, phone menu, footer
  for (const a of await links.all()) {
    await expect(a).toHaveAttribute('href', 'https://paypal.me/JuarenBalingit')
    await expect(a).toHaveAttribute('target', '_blank')
  }
  await page.locator('a.donate-head').click()
  await expect(page.locator('#dn')).toBeVisible()
  const amounts = page.locator('#dn .dn-amt')
  await expect(amounts).toHaveText(['☕ $3', '$5', '$10', '$25'])
  await expect(amounts.first()).toHaveAttribute('href', 'https://paypal.me/JuarenBalingit/3USD')
  await page.locator('#dn [data-cur="PHP"]').click()
  await expect(amounts.nth(2)).toHaveAttribute('href', 'https://paypal.me/JuarenBalingit/500PHP')
  await expect(page.locator('#dn-own')).toHaveAttribute('href', 'https://paypal.me/JuarenBalingit')
  await page.keyboard.press('Escape')
  await expect(page.locator('#dn')).toBeHidden()
  expect(errors).toEqual([])
})
