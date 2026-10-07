import { test, expect } from '@playwright/test'
import { openSite, openCalc, closeCalc, setField, row, suggestions, setCode } from './helpers.js'

test.beforeEach(async ({ page }) => { await openSite(page) })

test('Philippines — 230 V, PEC breaker ratings and PH wire sizes', async ({ page }) => {
  await setCode(page, 'ph')
  await openCalc(page, 'elec')
  await expect(page.locator('#f-elec-v')).toHaveValue('230')
  const s = await suggestions(page)
  expect(s[0]).toContain('175 A')
  expect(s.join(' ')).toContain('2.0, 3.5, 5.5, 8.0')
  await expect(page.locator('#m-body .ref-ph')).toContainText('Philippines:')
})

test('Australia — breaker sized Ib ≤ In ≤ Iz', async ({ page }) => {
  await setCode(page, 'au')
  await openCalc(page, 'elec')
  await expect(page.locator('#f-elec-v')).toHaveValue('400')
  expect((await suggestions(page))[0]).toContain('an 80 A 3-pole circuit breaker')
  await expect(page.locator('#m-body .ref-ph')).toContainText('AS/NZS 3000')
})

test('United States — 480 V, NEC 240.6 breaker and Table 310.16 conductor', async ({ page }) => {
  await setCode(page, 'us')
  await openCalc(page, 'elec')
  await expect(page.locator('#f-elec-v')).toHaveValue('480')
  const s = (await suggestions(page)).join(' ')
  expect(s).toContain('an 80 A 3-pole breaker')
  expect(s).toContain('4 AWG copper')
})

test('code-specific natural ventilation rules', async ({ page }) => {
  for (const [code, text] of [['ph', '10 %'], ['au', '5 %'], ['us', '4 %']]) {
    await setCode(page, code)
    await openCalc(page, 'oa')
    expect((await suggestions(page)).join(' ')).toContain('at least ' + text + ' of the floor area')
    await closeCalc(page)
  }
})

test('unit picker converts and round-trips exactly (kW → TR → kW)', async ({ page }) => {
  await openCalc(page, 'fuel')
  const before = await row(page, 'Fuel use per day')
  await page.locator('#f-fuel-load-u').selectOption('TR')
  await expect(page.locator('#f-fuel-load')).toHaveValue('14.2173')
  expect(await row(page, 'Fuel use per day')).toBe(before)
  await page.locator('#f-fuel-load-u').selectOption('kW')
  await expect(page.locator('#f-fuel-load')).toHaveValue('50')
})

test('SI offers metric units only, IMP imperial only', async ({ page }) => {
  await openCalc(page, 'rect')
  expect(await page.locator('#f-rect-a-u option').allTextContents()).toEqual(['mm', 'cm', 'm'])
  await closeCalc(page)
  await page.locator('.site-header button[data-sys="imp"]').click()
  await openCalc(page, 'rect')
  expect(await page.locator('#f-rect-a-u option').allTextContents()).toEqual(['in', 'ft'])
})

test('Equal friction suggestion explains a noise upsize', async ({ page }) => {
  await openCalc(page, 'eqf')
  await setField(page, 'eqf', 'loc', 'occupied')
  await setField(page, 'eqf', 'nc', '25')
  expect((await suggestions(page)).join(' ')).toContain('rectangular size was increased')
})
