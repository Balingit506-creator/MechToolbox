import { test, expect } from '@playwright/test'
import { openSite, openCalc, show } from './helpers.js'

test('design pitfalls show a wrong and a right drawing for each mistake', async ({ page }) => {
  const errors = await openSite(page, 'pitfalls')
  await expect(page.locator('.nav-desktop a[href="#pitfalls"]')).toHaveAttribute('aria-current', 'page')
  const cards = page.locator('#pf-grid .pf-card')
  await expect(cards).toHaveCount(43)
  await expect(page.locator('#pf-grid .pf-bad svg')).toHaveCount(43)
  await expect(page.locator('#pf-grid .pf-good svg')).toHaveCount(43)
  const elbow = page.locator('#pf-ductelbow')
  await expect(elbow.locator('h3')).toHaveText('Branch duct cut into an elbow')
  await expect(elbow).toContainText('hard to seal, so it leaks')
  await expect(elbow.locator('.pf-bad .pf-ring-bad')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('every drawing label stays inside its 240 × 150 canvas', async ({ page }) => {
  await openSite(page, 'pitfalls')
  const outside = await page.locator('#pf-grid .pf-fig svg').evaluateAll((svgs) => svgs.flatMap((svg) => [...svg.querySelectorAll('text')].map((t) => {
    const b = t.getBBox()
    return b.x < -0.5 || b.y < -0.5 || b.x + b.width > 240.5 || b.y + b.height > 150.5 ? svg.closest('.pf-card').id + ': ' + t.textContent : null
  }).filter(Boolean)))
  expect(outside).toEqual([])
})

test('pitfalls filter by discipline and search', async ({ page }) => {
  await openSite(page, 'pitfalls')
  await page.locator('#pf-filters [data-pf="F"]').click()
  await expect(page.locator('#pf-grid .pf-card:visible')).toHaveCount(8)
  await page.locator('#pf-q').fill('sprinkler')
  await expect(page.locator('#pf-count')).toHaveText(/ of 43 pitfalls for “sprinkler”/)
  await page.locator('#pf-q').fill('nothing-matches-this')
  await expect(page.locator('#pf-empty')).toBeVisible()
  await page.locator('#pf-q').fill('')
  await page.locator('#pf-filters [data-pf="all"]').click()
  await expect(page.locator('#pf-grid .pf-card:visible')).toHaveCount(43)
  await expect(page.locator('#pf-count')).toHaveText('43 pitfalls')
})

test('a pitfall opens the related calculator', async ({ page }) => {
  await openSite(page, 'pitfalls')
  await page.locator('#pf-oiltrap [data-open="refpipe"]').click()
  await expect(page.locator('#m-title')).toHaveText('Refrigerant Pipe Sizing')
})

test('a calculator links to its pitfalls, and the link jumps to the drawing', async ({ page }) => {
  await openSite(page)
  await openCalc(page, 'ductd')
  await expect(page.locator('#m-pf .m-pf-chip').first()).toHaveText('⚠ Avoid: Branch duct cut into an elbow')
  await page.locator('#m-pf [data-pitfall="ductelbow"]').click()
  await expect(page.locator('#modal')).toBeHidden()
  await expect(page.locator('#pitfalls')).toBeVisible()
  await expect(page.locator('#pf-ductelbow')).toBeInViewport()
  // calculators without a related pitfall show no links
  await show(page, 'calculators')
  await openCalc(page, 'payback')
  await expect(page.locator('#m-pf')).toBeHidden()
})
