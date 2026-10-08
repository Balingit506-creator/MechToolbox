import { test, expect } from '@playwright/test'
import { openSite, openCalc, setField, row, rows, suggestions, setSystem } from './helpers.js'

// Known results with default inputs (SI unless stated). If one of these changes, a formula or table changed.
test.beforeEach(async ({ page }) => { await openSite(page) })

test('HVAC BTU — rule-of-thumb load', async ({ page }) => {
  await openCalc(page, 'btu')
  expect(await row(page, 'Cooling load')).toBe('8,991 BTU/h')
})

test('Air changes — 6 ACH', async ({ page }) => {
  await openCalc(page, 'ach')
  expect(await row(page, 'Air changes')).toBe('6 ACH')
})

test('Equal friction — 1,700 m³/h at 1 Pa/m', async ({ page }) => {
  await openCalc(page, 'eqf')
  expect(await row(page, 'Standard round')).toBe('⌀ 350 mm')
  expect(await row(page, 'Rectangular')).toBe('350 × 250 mm')
})

test('Equal friction — ASHRAE noise limit upsizes rectangular duct (occupied, NC 25)', async ({ page }) => {
  await openCalc(page, 'eqf')
  await setField(page, 'eqf', 'loc', 'occupied')
  await setField(page, 'eqf', 'nc', '25')
  expect(await row(page, 'Rectangular')).toBe('400 × 250 mm')
  expect(await row(page, 'Max velocity — rectangular')).toBe('4.83 m/s')
})

test('Equal friction — ACCA return trunk 700 fpm (IMP)', async ({ page }) => {
  await setSystem(page, 'imp')
  await openCalc(page, 'eqf')
  await setField(page, 'eqf', 'std', 'acca')
  await setField(page, 'eqf', 'air', 'ret')
  await setField(page, 'eqf', 'q', 1000)
  await setField(page, 'eqf', 'fr', 0.08)
  expect(await row(page, 'Standard round')).toBe('⌀ 18 in')
  expect(await row(page, 'Rectangular')).toBe('22 × 10 in')
  expect(await row(page, 'Max velocity — round')).toBe('700 fpm')
})

test('Number of diffusers — 12 in a 4 × 3 grid', async ({ page }) => {
  await openCalc(page, 'ndiff')
  const r = (await rows(page)).find((x) => x.label === 'Diffusers')
  expect(r.text).toBe('12')
  expect(r.sub).toContain('4 × 3 grid')
  expect((await suggestions(page))[0]).toContain('⌀ 200 mm necks')
})

test('Supply diffuser and return grille sizes', async ({ page }) => {
  await openCalc(page, 'sdiff')
  expect(await row(page, 'Neck size')).toBe('⌀ 200 mm')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'rgrille')
  expect(await row(page, 'Grille size')).toBe('450 × 450 mm')
})

test('Electrical load — 74.7 A at 400 V', async ({ page }) => {
  await openCalc(page, 'elec')
  expect(await row(page, 'Current (3-phase)')).toBe('74.7 A')
})

test('Voltage drop — 2.6 %', async ({ page }) => {
  await openCalc(page, 'vdrop')
  expect((await rows(page)).map((r) => r.text)).toContain('2.6 %')
})

test('Sprinkler demand and fire pump rating', async ({ page }) => {
  await openCalc(page, 'sprinkler')
  expect(await row(page, 'Total with hose')).toBe('1,047 L/min')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'firepump')
  expect(await row(page, 'Next standard rating')).toBe('500 gpm')
})

test('design checks flip between Pass and Warning at their limits', async ({ page }) => {
  const check = async () => (await rows(page)).find((r) => r.label === 'Design check')
  await openCalc(page, 'ach')
  expect((await check()).text).toBe('✓ Pass')
  await setField(page, 'ach', 'ach', '20')                  // above 15 ACH
  expect((await check()).text).toBe('⚠ Warning')
  expect((await check()).sub).toContain('draughts')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'sprinkler')
  expect((await check()).text).toBe('✓ Pass')
  await setField(page, 'sprinkler', 'cov', '25')            // above 20.9 m² per head
  expect((await check()).text).toBe('⚠ Warning')
  expect((await check()).sub).toContain('NFPA 13 maximum')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'duct')
  await setField(page, 'duct', 'v', '10')                   // above 8 m/s
  expect((await check()).text).toBe('⚠ Warning')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'xfer')                               // 56 mm undercut by default
  expect((await check()).text).toBe('⚠ Warning')
})

test('Psychrometric chart — room 24 °C / 50 % and a 6.2 TR coil (ASHRAE values)', async ({ page }) => {
  await openCalc(page, 'psy')
  // 24 °C, 50 % RH: W 9.28 g/kg, h 47.8 kJ/kg, WB 17.1 °C, DP 12.9 °C (ASHRAE Fundamentals Ch. 1)
  await expect(page.locator('#psy-rows tr').nth(1)).toContainText('9.28 g/kg')
  await expect(page.locator('#psy-rows tr').nth(1)).toContainText('47.8 kJ/kg')
  await expect(page.locator('#psy-rows tr').nth(1)).toContainText('17.1 °C')
  expect(await row(page, 'Coil load')).toBe('21.75 kW · 6.18 TR')
  expect(await row(page, 'Condensate')).toBe('8.7 L/h')
  // dragging-free check of an input: warmer off-coil air lowers the coil load
  await page.locator('#psy-saDb').fill('15')
  expect(await row(page, 'Coil load')).not.toBe('21.75 kW · 6.18 TR')
  await page.locator('#psy-saDb').fill('30')
  await expect(page.locator('#r-err')).toContainText('below the mixed-air temperature')
})

test('Panel load schedule — balances phases, sizes the main breaker and adds one circuit at a time', async ({ page }) => {
  await openCalc(page, 'pls')
  // default panel (INTL): 400/230 V 3φ 4W, 10.52 kVA connected, demand + 25 % of the 2.2 kVA ACU
  expect(await row(page, 'Connected load')).toBe('10.52 kVA')
  expect(await row(page, 'Demand load')).toBe('11.07 kVA')
  expect(await row(page, 'Main breaker')).toMatch(/^\d+ AT, 3P$/)
  expect(await row(page, 'Design check')).toBe('✓ Pass')                 // unbalance ≤ 10 %
  const n = await page.locator('#pl-tbl tbody tr').count()
  await page.locator('[data-act="padd"]').click()
  await expect(page.locator('#pl-tbl tbody tr')).toHaveCount(n + 1)
  // pin the water heater to A-B: the schedule keeps it there
  const heater = page.locator('#pl-tbl tbody tr', { hasText: '3,000' })
  await heater.locator('select[data-k="ph"]').selectOption('AB')
  await expect(page.locator('#pl-tbl tbody tr', { hasText: '3,000' }).locator('select[data-k="ph"]')).toHaveValue('AB')
})
