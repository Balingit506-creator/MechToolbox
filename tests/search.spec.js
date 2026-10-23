import { test, expect } from '@playwright/test'
import { openSite } from './helpers.js'

test('Standards search filters the references, sources and regional codes', async ({ page }) => {
  const errors = await openSite(page, 'standards')
  const rows = page.locator('#std-groups tbody tr:visible')
  await page.locator('#std-q').fill('nfpa 13')
  await expect(page.locator('#std-count')).toContainText('match')
  expect(await rows.count()).toBeGreaterThan(0)
  for (const t of await rows.allTextContents()) expect(t.toLowerCase()).toContain('nfpa 13')
  await expect(page.locator('#std-groups .std-group[open]').first()).toBeVisible() // matching groups open by themselves
  await expect(page.locator('#std-groups mark.hl', { hasText: /^nfpa 13$/i }).first()).toBeVisible() // the phrase is highlighted as one
  // regional codes are searched too
  await page.locator('#std-q').fill('RA 9514')
  await expect(page.locator('#std-ph-list li li:visible').first()).toContainText('9514')
  // nothing found
  await page.locator('#std-q').fill('zzqqxx')
  await expect(page.locator('#std-empty')).toBeVisible()
  // Escape clears and restores the closed groups
  await page.locator('#std-q').press('Escape')
  await expect(page.locator('#std-q')).toHaveValue('')
  await expect(page.locator('#std-count')).toBeHidden()
  await expect(page.locator('#std-groups .std-group[open]')).toHaveCount(0)
  await expect(page.locator('#std-groups mark.hl')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Pitfall search highlights the words it found', async ({ page }) => {
  await openSite(page, 'pitfalls')
  await page.locator('#pf-q').fill('nitrogen')
  await expect(page.locator('#pf-nitrogen')).toBeVisible()
  await expect(page.locator('#pf-nitrogen h3 mark.hl')).toHaveText('nitrogen')
  await expect(page.locator('#pf-grid .pf-fig svg mark')).toHaveCount(0) // drawings are never touched
  await page.locator('#pf-q').press('Escape')
  await expect(page.locator('#pf-grid mark.hl')).toHaveCount(0)
})

test('"/" focuses the search of the view you are on', async ({ page }) => {
  await openSite(page, 'pitfalls')
  await page.keyboard.press('/')
  await expect(page.locator('#pf-q')).toBeFocused()
  await page.locator('.nav-desktop a[href="#standards"]').click()
  await page.keyboard.press('/')
  await expect(page.locator('#std-q')).toBeFocused()
  await page.locator('.nav-desktop a[href="#guide"]').click()
  await page.keyboard.press('/')
  await expect(page.locator('#calculators')).toBeVisible()
  await expect(page.locator('#calc-q')).toBeFocused()
})
