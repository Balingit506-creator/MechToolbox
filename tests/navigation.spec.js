import { test, expect } from '@playwright/test'
import { SITE, openSite, closeCalc } from './helpers.js'

const VIEWS = ['top', 'calculators', 'guide', 'projects', 'estimate', 'utilities', 'standards', 'about']
const visibleViews = (page) => page.evaluate((ids) => ids.filter((id) => !document.getElementById(id).hidden), VIEWS)

test('one view at a time: header links switch views and Back returns', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(SITE)
  expect(await visibleViews(page)).toEqual(['top'])
  await page.locator('.nav-desktop a[href="#projects"]').click()
  expect(await visibleViews(page)).toEqual(['projects'])
  await expect(page.locator('.nav-desktop a[href="#projects"]')).toHaveAttribute('aria-current', 'page')
  await page.locator('.nav-desktop a[href="#standards"]').click()
  expect(await visibleViews(page)).toEqual(['standards'])
  await page.goBack()
  await expect(page.locator('#projects')).toBeVisible()
  await page.locator('.logo').first().click()
  expect(await visibleViews(page)).toEqual(['top'])
  expect(errors).toEqual([])
})

test('"/" jumps to the calculator search from any view', async ({ page }) => {
  await openSite(page, 'about')
  await page.keyboard.press('/')
  await expect(page.locator('#calculators')).toBeVisible()
  await expect(page.locator('#calc-q')).toBeFocused()
})

test('home tiles open the calculators filtered to that category', async ({ page }) => {
  await openSite(page, 'top')
  await expect(page.locator('#hq-grid .hq-tile')).toHaveCount(10)
  await page.locator('#hq-grid [data-goto-filter="R"]').click()
  await expect(page.locator('#calculators')).toBeVisible()
  await expect(page.locator('[data-filter="R"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(10)
})

test('recently used calculators are listed and survive a reload', async ({ page }) => {
  await openSite(page)
  await expect(page.locator('#side-recent')).toBeHidden()
  for (const id of ['freeze', 'evap']) {
    await page.locator(`#card-grid [data-open="${id}"]`).click()
    await closeCalc(page)
  }
  await expect(page.locator('#side-recent-list .recent-chip')).toHaveText(['Evaporator & Condensing Unit Selection', 'Product Freezing Load & Time'])
  await page.reload()
  await page.locator('#side-recent-list [data-recent="freeze"]').click()
  await expect(page.locator('#m-title')).toHaveText('Product Freezing Load & Time')
})

test('on a wide screen the result sits beside the inputs', async ({ page }) => {
  await openSite(page)
  await page.locator('#card-grid [data-open="coldroom"]').click()
  const inBox = await page.locator('.calc-in').boundingBox(), outBox = await page.locator('.calc-out').boundingBox()
  expect(outBox.x).toBeGreaterThan(inBox.x + inBox.width - 1)
  await expect(page.locator('#r-rows > div').first()).toBeInViewport()
})

test('calculators default to the compact list, and Cards is remembered', async ({ page }) => {
  await openSite(page)
  await expect(page.locator('#card-grid')).toHaveClass(/compact/)
  await page.locator('.view-toggle button[data-view="cards"]').click()
  await page.reload()
  await expect(page.locator('#card-grid')).not.toHaveClass(/compact/)
})
