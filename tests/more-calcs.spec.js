import { test, expect } from '@playwright/test'
import { openSite, openCalc, setField, row } from './helpers.js'

test.describe('kitchen hood, cable tray, earth rod, feeder drop, STP, compressed air — known values (SI)', () => {
  test.beforeEach(async ({ page }) => { await openSite(page) })

  test('kitchen hood — 3 m wall canopy, medium duty: 300 CFM/ft (IMC 507.13)', async ({ page }) => {
    await openCalc(page, 'khood')
    expect(await row(page, 'Exhaust airflow')).toBe('5,017 m³/h') // 300 × 9.84 ft = 2,953 CFM
    expect(await row(page, 'Round grease duct')).toBe('Ø 486.4 mm')
    await setField(page, 'khood', 'duty', 'xheavy')
    await setField(page, 'khood', 'type', 'eyebrow')
    await expect(page.locator('#r-err')).toContainText('does not allow this hood type')
  })

  test('cable tray — ten 25 mm cables in a 300 mm tray', async ({ page }) => {
    await openCalc(page, 'tray')
    expect(await row(page, 'Allowable fill area')).toBe('9,032 mm²') // 14 in²
    expect(await row(page, 'Tray fill')).toBe('54 %')
    expect(await row(page, 'Narrowest tray that fits')).toBe('225 mm')
  })

  test('earth rod — 3 m × 16 mm rod in 100 Ω·m soil (Dwight)', async ({ page }) => {
    await openCalc(page, 'earthrod')
    expect(await row(page, 'Resistance, one rod')).toBe('33.5 Ω')
    expect(await row(page, 'Rods to reach 25 Ω')).toBe('2 rods')
    await setField(page, 'earthrod', 'n', '2')
    expect(await row(page, 'With 2 rods in a line')).toBe('19.4 Ω') // × 1.16 / 2
  })

  test('feeder voltage drop — three taps on 16 mm² copper, 230 V', async ({ page }) => {
    await openCalc(page, 'vdfeed')
    expect(await row(page, 'Current leaving the panel')).toBe('35 A')
    expect(await row(page, 'Load 1 at 20 m')).toBe('1.97 V · 0.86 %')
    expect(await row(page, 'Worst drop')).toBe('1.41 %')
  })

  test('STP — 500 people at 150 L/day', async ({ page }) => {
    await openCalc(page, 'stp')
    expect(await row(page, 'Average daily flow')).toBe('75 m³/day')
    expect(await row(page, 'BOD load')).toBe('27 kg/day')
    expect(await row(page, 'Aeration tank')).toBe('90 m³')
  })

  test('compressed air — 300 m³/h at 7 bar over 100 m', async ({ page }) => {
    await openCalc(page, 'cair')
    expect(await row(page, 'Required inside diameter')).toBe('45.77 mm')
    expect(await row(page, 'Suggested pipe')).toBe('DN 50 (2 in) Sch. 40 steel')
    expect(await row(page, 'Air velocity in the pipe')).toBe('4.87 m/s')
  })
})
