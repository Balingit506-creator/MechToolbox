import { test, expect } from '@playwright/test'
import { openSite, closeCalc } from './helpers.js'

// Save a calculator's result (default inputs) to the active room through the project bar.
async function saveToRoom(page, id) {
  await page.evaluate((x) => document.querySelector('#card-grid [data-open="' + x + '"]').click(), id)
  await page.locator('#pj-save').click()
  await expect(page.locator('#pj-msg')).toHaveText('✓ Saved to Open office')
  await closeCalc(page)
}

const row = (page, no) => page.locator('#pj-boq tbody tr', { has: page.locator('td.boq-no', { hasText: new RegExp('^' + no.replace(/\./g, '\\.') + '$') }) })
const qty = (page, no) => row(page, no).locator('td').nth(2)

test('BOQ builds Electrical, Plumbing & Sanitary and Fire Protection divisions from saved results', async ({ page }) => {
  const errors = await openSite(page)
  await page.locator('#pj-new-name').fill('Office L3')
  await page.locator('#pj-create').click()
  await page.locator('#pj-r-name').fill('Open office')
  await page.locator('#pj-r-l').fill('12.5')
  await page.locator('#pj-r-w').fill('8')
  await page.locator('#pj-r-p').fill('10')
  await page.locator('#pj-form button[type="submit"]').click()
  for (const id of ['elec', 'vdrop', 'pipe', 'dfu', 'sprinkler', 'hazen', 'firepump']) await saveToRoom(page, id)
  await page.locator('#pj-boq-btn').click()

  await expect(page.locator('#pj-boq .boq-div')).toHaveText(['IIELECTRICAL WORKS', 'IIIPLUMBING AND SANITARY WORKS', 'VFIRE PROTECTION WORKS'])

  // II Electrical — 74.7 A × 125 % → 100 AT; 50 m run × 1.1 × 4 conductors = 220 m of 6 mm²
  await expect(row(page, '2.1.1')).toContainText('Main circuit breaker, 3-pole, 100 AT')
  await expect(row(page, '2.1.2')).toContainText('Panelboard')
  await expect(row(page, '2.2.1')).toContainText('THHN/THWN-2 wire, 6 mm²')
  await expect(qty(page, '2.2.1')).toHaveText('220')
  await expect(qty(page, '2.2.2')).toHaveText('55')   // grounding conductor
  await expect(row(page, '2.3.1')).toContainText('Conduit')

  // III Plumbing & Sanitary — 30 m × 1.1 / 6 m = 6 lengths of 50mmØ; fixtures from the DFU calculator
  await expect(row(page, '3.1.1')).toContainText('50mmØ x 6m, water supply pipe')
  await expect(qty(page, '3.1.1')).toHaveText('6')
  await expect(row(page, '3.1.1').locator('td').nth(3)).toHaveText('length')
  await expect(row(page, '3.2.1')).toContainText('Water closet')
  await expect(qty(page, '3.2.1')).toHaveText('4')
  await expect(row(page, '3.2.2')).toContainText('Urinal')
  await expect(qty(page, '3.2.3')).toHaveText('4')       // lavatories
  await expect(row(page, '3.3.1')).toContainText('building drain')

  // V Fire — 100 m² / 12 m² per head = 9 heads; 62.7 mm ID × 30 m → 6 lengths of 65mmØ B.I. Sch. 40
  await expect(row(page, '5.1.1')).toContainText('Sprinkler head, pendent, K80')
  await expect(qty(page, '5.1.1')).toHaveText('9')
  await expect(page.locator('#pj-boq tbody tr', { hasText: '65mmØ x 6m, B.I. seamless pipe, Sch. 40' }).locator('td').nth(2)).toHaveText('6')
  await expect(page.locator('#pj-boq tbody tr', { hasText: 'Fire pump set, 500 gpm' })).toHaveCount(1)
  await expect(page.locator('#pj-boq tbody tr', { hasText: 'Jockey pump set' })).toHaveCount(1)
  await expect(page.locator('#pj-boq tbody tr', { hasText: 'Fire water storage tank' })).toHaveCount(1)

  // every division closes with hangers & supports and consumables, then its own total
  await expect(page.locator('#pj-boq tbody tr', { hasText: 'Hangers and supports' })).toHaveCount(3)
  await expect(page.locator('#pj-boq .boq-divt')).toHaveText([/Total Cost II - Electrical Works:/, /Total Cost III - Plumbing and Sanitary Works:/, /Total Cost V - Fire Protection Works:/])
  expect(errors).toEqual([])
})

test('division totals roll up into one project cost', async ({ page }) => {
  await openSite(page)
  await page.locator('#pj-new-name').fill('Office L3')
  await page.locator('#pj-create').click()
  await page.locator('#pj-r-name').fill('Open office')
  await page.locator('#pj-r-l').fill('10')
  await page.locator('#pj-r-w').fill('10')
  await page.locator('#pj-r-p').fill('10')
  await page.locator('#pj-form button[type="submit"]').click()
  await saveToRoom(page, 'dfu')
  await saveToRoom(page, 'sprinkler')
  await page.locator('#pj-boq-btn').click()
  await row(page, '3.1.1').locator('input[data-kind="m"]').fill('10000')   // 4 water closets × 10,000 → 52,000 with 30 % labor
  await row(page, '5.1.1').locator('input[data-kind="m"]').fill('1000')    // 9 heads × 1,000 → 11,700
  await expect(page.locator('[data-v="d3:t"]')).toHaveText('52,000.00')
  await expect(page.locator('[data-v="d5:t"]')).toHaveText('11,700.00')
  await expect(page.locator('[data-v="sum:tc"]')).toHaveText('63,700.00')
  await expect(page.locator('[data-v="sum:sp"]')).toHaveText('6,370.00')
})
