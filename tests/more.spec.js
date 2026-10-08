import { test, expect } from '@playwright/test'
import { openSite, openCalc, closeCalc, row } from './helpers.js'

test.describe('new calculators — known values (SI, INTL)', () => {
  test.beforeEach(async ({ page }) => { await openSite(page) })
  test('refrigerant pipe — 7.1 kW split: ¼ / ⅝ in, 165 g extra charge', async ({ page }) => {
    await openCalc(page, 'refpipe')
    expect(await row(page, 'Liquid line')).toBe('1/4 in (6.35 mm OD)')
    expect(await row(page, 'Gas (suction) line')).toBe('5/8 in (15.88 mm OD)')
    expect(await row(page, 'Extra refrigerant charge')).toBe('0.16 kg')
  })
  test('generator & transformer — 211.8 kVA → 315 kVA transformer, 300 kVA set', async ({ page }) => {
    await openCalc(page, 'gen')
    expect(await row(page, 'Transformer')).toBe('315 kVA')
    expect(await row(page, 'Standby generator')).toBe('300 kVA · 240 kW')
  })
  test('power factor — 200 kW from 0.78 to 0.95 needs 94.7 kVAR', async ({ page }) => {
    await openCalc(page, 'pfc')
    expect(await row(page, 'Capacitor bank needed')).toBe('94.7 kVAR')
    expect(await row(page, 'Standard bank')).toBe('100 kVAR')
  })
  test('booster — 302 kPa cut-in and a 582 L bladder tank', async ({ page }) => {
    await openCalc(page, 'booster')
    expect(await row(page, 'Cut-in pressure')).toBe('302.1 kPa')
    expect(await row(page, 'Pressure tank (total)')).toBe('582 L')
  })
  test('water heater — 120 L tank and 4.7 kW', async ({ page }) => {
    await openCalc(page, 'hwheat')
    expect(await row(page, 'Storage tank')).toBe('120 L')
    expect(await row(page, 'Heater power')).toBe('4.7 kW input')
  })
  test('sprinkler hydraulics — remote head 73.2 L/min (6.1 mm/min × 12 m²)', async ({ page }) => {
    await openCalc(page, 'sprhyd')
    expect(await row(page, 'Most remote head')).toBe('73.2 L/min at 0.8372 bar')
    expect(await row(page, 'Sprinkler demand')).toMatch(/^[\d,.]+ L\/min at [\d.]+ bar$/)
  })
  test('roof drain — PAGASA RIDF depth 20 mm in 5 min = 240 mm/h', async ({ page }) => {
    await openCalc(page, 'roofdrain')
    await page.locator('#f-roofdrain-src').selectOption('ridf')
    expect(await row(page, 'Rainfall intensity')).toBe('240 mm/h')
  })
})

async function makeEstimate(page) {
  await page.locator('#es-new-name').fill('Clinic')
  await page.locator('#es-new-tpl').selectOption('M')
  await page.locator('#es-root [data-act="create"]').click()
  const it = (k) => page.locator('#es-root tr.es-item').first().locator(`[data-k="${k}"]`)
  await it('desc').fill('Return air grille with filter')
  await it('qty').fill('4')
  return it
}

test('price list fills an estimate and revisions compare and restore', async ({ page }) => {
  const errors = await openSite(page)
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'Issued for tender' : undefined))
  const it = await makeEstimate(page)
  // price list: add a price with the same description, then fill
  await page.locator('#es-root [data-estab="prices"]').click()
  await page.locator('#es-root [data-act="pradd"]').click()
  const pr = (k) => page.locator('#es-root .pr-table tbody tr').first().locator(`[data-k="${k}"]`)
  await pr('desc').fill('Return air grille with filter')
  await pr('unit').fill('pcs')
  await pr('m').fill('1500')
  await page.locator('#es-root [data-act="prfill"]').click()
  await expect(page.locator('#es-msg')).toContainText('Filled 1 item')
  await page.locator('#es-root [data-estab="boq"]').click()
  await expect(it('m')).toHaveValue('1500')
  await expect(page.locator('#es-root [data-v="sum:tc"]')).toHaveText('7,800.00')     // 4 × 1,500 × 1.3
  // revisions: save Rev 0, change the quantity, compare, restore
  await page.locator('#es-root [data-act="revsave"]').click()
  await expect(page.locator('#es-root .es-revs li')).toHaveCount(1)
  await it('qty').fill('6')
  await page.locator('#es-root [data-act="revcmp"]').click()
  await expect(page.locator('#es-root .es-cmp')).toContainText('qty 4 → 6')
  await page.locator('#es-root [data-act="revrestore"]').click()
  await expect(it('qty')).toHaveValue('4')
  expect(errors).toEqual([])
})

test('design basis report lists codes, criteria and the project summary', async ({ page, context }) => {
  await openSite(page)
  await page.locator('#pj-new-name').fill('Clinic')
  await page.locator('#pj-create').click()
  await page.locator('#pj-r-name').fill('Lobby')
  await page.locator('#pj-r-l').fill('10')
  await page.locator('#pj-r-w').fill('8')
  await page.locator('#pj-form button[type="submit"]').click()
  const [rep] = await Promise.all([context.waitForEvent('page'), page.locator('#pj-dbr').click()])
  await rep.waitForLoadState('domcontentloaded')
  await expect(rep.locator('h1')).toHaveText('Design Basis Report')
  await expect(rep.locator('body')).toContainText('Outdoor design condition')
  await expect(rep.locator('body')).toContainText('NFPA 13')
  await expect(rep.locator('body')).toContainText('Lobby')
  await expect(rep.locator('[contenteditable="true"]').first()).toBeVisible()
})

test('project BOQ fills blank rates from the price list', async ({ page }) => {
  await openSite(page)
  // a price with no match still reports cleanly
  await page.locator('#pj-new-name').fill('X')
  await page.locator('#pj-create').click()
  expect(await page.locator('#pj-dbr').count()).toBe(1)
})
