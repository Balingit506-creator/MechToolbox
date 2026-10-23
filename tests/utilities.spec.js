import { test, expect } from '@playwright/test'
import { openSite, setField, row, rows } from './helpers.js'

// Utilities open from their tiles on the Utilities view.
async function openUtil(page, id) {
  await page.locator(`#utilities [data-open="${id}"]`).click()
  await expect(page.locator('#modal')).toBeVisible()
}

test.describe('utilities — known values (SI)', () => {
  test.beforeEach(async ({ page }) => { await openSite(page, 'utilities') })

  test('the Utilities view lists 13 tools in three groups, then 6 games', async ({ page }) => {
    await expect(page.locator('#utilities .strip button')).toHaveCount(19)
    await expect(page.locator('#utilities .strip-games button')).toHaveCount(6)
    await expect(page.locator('#utilities .util-group')).toHaveText(['Converters & references', 'Data tables', 'Field calculations', 'Games — take a break'])
  })

  test('pipe data — 2 in Sch. 40 steel, then copper Type L', async ({ page }) => {
    await openUtil(page, 'pipedata')
    expect(await row(page, 'Inside diameter')).toBe('52.48 mm')
    expect(await row(page, 'Weight, empty')).toBe('5.44 kg/m')
    await setField(page, 'pipedata', 'mat', 'cul')
    expect(await row(page, 'Outside diameter')).toBe('53.98 mm') // 2⅛ in
    await setField(page, 'pipedata', 'mat', 'cuk')
    await setField(page, 'pipedata', 'dn', '100')
    expect(await row(page, 'Inside diameter')).toBe('97.98 mm') // 4 in Type K: 104.78 mm OD − 2 × 3.40 mm wall
  })

  test('wire gauge — 12 AWG, then 2.5 mm²', async ({ page }) => {
    await openUtil(page, 'awg')
    expect(await row(page, 'Conductor area')).toBe('3.309 mm²')
    expect(await row(page, 'Next IEC metric size')).toBe('4 mm²')
    await setField(page, 'awg', 'mode', 'mm')
    await setField(page, 'awg', 'mm', '2.5')
    expect(await row(page, 'Nearest AWG')).toBe('13 AWG')
  })

  test('Ohm\'s law — 3-phase 400 V, 100 A at 0.85; and current from 55 kW', async ({ page }) => {
    await openUtil(page, 'ohm')
    expect(await row(page, 'Apparent power')).toBe('69.282 kVA')
    expect(await row(page, 'Real power')).toBe('58.89 kW')
    await setField(page, 'ohm', 'mode', 'vp')
    expect(await row(page, 'Current')).toBe('93.39 A')
  })

  test('slope — 2 % over 10 m, and ¼ in per ft', async ({ page }) => {
    await openUtil(page, 'slope')
    expect(await row(page, 'Angle')).toBe('1.146°')
    expect(await row(page, 'Fall over the run')).toBe('200 mm')
    await setField(page, 'slope', 'ty', 'inft')
    expect(await row(page, 'Percent')).toBe('2.083 %')
  })

  test('offset — 300 mm at 45°', async ({ page }) => {
    await openUtil(page, 'offset')
    expect(await row(page, 'Travel (between bend centres)')).toBe('424.26 mm')
    expect(await row(page, 'Conduit shrink')).toBe('124.26 mm')
  })

  test('tank — horizontal cylinder 2 m × 5 m, half full', async ({ page }) => {
    await openUtil(page, 'tankvol')
    expect(await row(page, 'Volume at this level')).toBe('7.854 m³')
    expect(await row(page, 'Filled')).toBe('50 %')
    await setField(page, 'tankvol', 'lv', '3')
    await expect(page.locator('#r-err')).toContainText('above the top')
  })

  test('heat ↔ flow — 1,000 L/s of air at 10 K; water for 23.4 kW at 5.6 K', async ({ page }) => {
    await openUtil(page, 'heatflow')
    expect(await row(page, 'Heat')).toBe('12.07 kW')
    await setField(page, 'heatflow', 'med', 'water')
    await setField(page, 'heatflow', 'mode', 'f')
    await setField(page, 'heatflow', 'q', '23.4')
    await setField(page, 'heatflow', 'dt', '5.6')
    expect((await rows(page))[0].sub).toMatch(/^(0\.999|1(\.0+)?) L\/s/) // 23.4 kW ÷ (4.18 kW/(L/s·K) × 5.6 K)
  })

  test('properties — 20 °C at sea level and at 1,500 m', async ({ page }) => {
    await openUtil(page, 'props')
    expect(await row(page, 'Air density')).toBe('1.2041 kg/m³')
    expect(await row(page, 'Water density')).toBe('998.2 kg/m³')
    expect(await row(page, 'Water boils at')).toBe('100 °C')
    await setField(page, 'props', 'alt', '1500')
    expect(await row(page, 'Water boils at')).toBe('95 °C')
  })

  test('drawing scale — 100 mm at 1 : 50', async ({ page }) => {
    await openUtil(page, 'scale')
    expect(await row(page, 'Real length')).toBe('5 m')
    expect(await row(page, 'Drawing length for the real size')).toBe('100 mm')
  })
})

test('utilities work in imperial units too', async ({ page }) => {
  const errors = await openSite(page, 'utilities')
  await page.locator('.site-header button[data-sys="imp"]').click()
  await openUtil(page, 'pipedata')
  expect(await row(page, 'Inside diameter')).toBe('2.066 in')
  expect(await row(page, 'Weight, empty')).toBe('3.65 lb/ft')
  await page.evaluate(() => document.getElementById('modal').close())
  await openUtil(page, 'heatflow')
  expect((await rows(page))[0].sub).toContain('BTU/h')
  expect(errors).toEqual([])
})
