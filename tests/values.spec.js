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
