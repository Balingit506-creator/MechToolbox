import { test, expect } from '@playwright/test'
import { openSite, openCalc, closeCalc, setField, row, rows, suggestions, setSystem, setCode } from './helpers.js'

// Known results for the chilled-water, pump, cable, lighting and water-supply calculators (default inputs).
test.describe('known values', () => {
  test.beforeEach(async ({ page }) => { await openSite(page) })

  test('chilled water — 10 TR at 5.6 K → 1.5 L/s → 50 mm Sch. 40', async ({ page }) => {
    await openCalc(page, 'chw')
    expect(await row(page, 'Chilled-water flow')).toBe('1.499 L/s')
    expect(await row(page, 'Pipe size')).toBe('50mmØ')
    expect(await row(page, 'Friction rate')).toBe('119.6 Pa/m')
    expect((await rows(page)).find((r) => r.label === 'One size smaller').sub).toContain('409.5 Pa/m') // 40 mm fails the 400 Pa/m target
  })

  test('chilled water — copper and a tighter friction limit pick a larger pipe', async ({ page }) => {
    await openCalc(page, 'chw')
    await setField(page, 'chw', 'mat', 'cu')
    await setField(page, 'chw', 'fr', '100')
    expect(await row(page, 'Pipe size')).toBe('65mmØ')
  })

  test('pump — (40 + 60 + 30 + 15 kPa) × 1.10 = 159.5 kPa, 0.55 kW motor', async ({ page }) => {
    await openCalc(page, 'pump')
    expect(await row(page, 'Pump head')).toBe('159.5 kPa')
    expect(await row(page, 'Motor size')).toBe('0.55 kW')
  })

  test('cable — 40 A continuous → 50 A → 10 mm² (INTL) / 8 AWG (US) / 75 °C limit', async ({ page }) => {
    await openCalc(page, 'cable')
    expect(await row(page, 'Design current')).toBe('50 A')
    expect(await row(page, 'Cable size')).toBe('10 mm² Cu')
    await closeCalc(page)
    await setSystem(page, 'imp')
    await setCode(page, 'us')
    await openCalc(page, 'cable')
    expect(await row(page, 'Cable size')).toBe('8 AWG Cu')
  })

  test('cable — grouping derate and voltage drop upsize', async ({ page }) => {
    await openCalc(page, 'cable')
    await setField(page, 'cable', 'ccc', '6')     // 80 % grouping factor
    expect(await row(page, 'Derating')).toBe('× 0.77')
    await setField(page, 'cable', 'l', '200')     // long run → voltage drop governs
    expect((await rows(page)).find((r) => r.label === 'Cable size').sub).toContain('upsized for voltage drop')
  })

  test('lighting — 100 m² at 500 lx with 4,000 lm panels → 24 luminaires', async ({ page }) => {
    await openCalc(page, 'light')
    expect(await row(page, 'Luminaires')).toBe('24')
    expect(await row(page, 'Average illuminance')).toBe('519.3 lx')
  })

  test('water supply — 42.3 WSFU → 26.9 gpm → PPR ⌀50 mm', async ({ page }) => {
    await openCalc(page, 'wsfu')
    expect(await row(page, 'Water supply fixture units')).toBe('42.3 WSFU')
    expect(await row(page, 'Peak demand')).toBe('1.699 L/s')
    expect(await row(page, 'Main size')).toBe('PPR ⌀50 mm')
    await setField(page, 'wsfu', 'fv', 'valve')    // flush valves use the higher curve
    expect(Number((await row(page, 'Peak demand')).replace(/[^\d.]/g, ''))).toBeGreaterThan(2)
  })

  test('chilled water suggests insulation and the pump step', async ({ page }) => {
    await openCalc(page, 'chw')
    const s = (await suggestions(page)).join(' ')
    expect(s).toContain('Use 50mmØ (Black steel, Sch. 40)')
    expect(s).toContain('Size the pump')
  })
})

// Project links and BOQ items.
test('room data flows cooling load → chilled water → pump, and into the BOQ', async ({ page }) => {
  const errors = await openSite(page)
  await page.locator('#pj-new-name').fill('Office L3')
  await page.locator('#pj-create').click()
  await page.locator('#pj-r-name').fill('Open office')
  await page.locator('#pj-r-l').fill('12.5')
  await page.locator('#pj-r-w').fill('8')
  await page.locator('#pj-r-h').fill('3')
  await page.locator('#pj-r-p').fill('10')
  await page.locator('#pj-form button[type="submit"]').click()
  await page.locator('.pj-next').click()              // cooling load
  await page.locator('#pj-save').click()
  await closeCalc(page)
  const open = async (id) => { await page.evaluate((x) => document.querySelector('#card-grid [data-open="' + x + '"]').click(), id) }
  // chilled water takes the room's cooling load
  await open('chw')
  await page.locator('#pj-use').click()
  expect(Number(await page.locator('#f-chw-p').inputValue())).toBeCloseTo(13.17, 1)
  await page.locator('#pj-save').click()
  await closeCalc(page)
  // the pump takes the chilled-water flow and loop pressure drop
  await open('pump')
  await page.locator('#pj-use').click()
  expect(Number(await page.locator('#f-pump-q').inputValue())).toBeGreaterThan(0.4)
  expect(Number(await page.locator('#f-pump-hp').inputValue())).toBeGreaterThan(0)
  await page.locator('#pj-save').click()
  await closeCalc(page)
  // lighting takes the room size; ceiling 3 m → 2.2 m above the work plane
  await open('light')
  await page.locator('#pj-use').click()
  await expect(page.locator('#f-light-l')).toHaveValue('12.5')
  await expect(page.locator('#f-light-hm')).toHaveValue('2.2')
  await page.locator('#pj-save').click()
  await closeCalc(page)
  for (const id of ['cable', 'wsfu']) { await open(id); await page.locator('#pj-save').click(); await closeCalc(page) }

  await page.locator('#pj-boq-btn').click()
  const boq = page.locator('#pj-boq tbody')
  await expect(page.locator('#pj-boq .boq-grp', { hasText: 'Chilled Water Piping and Pumps' })).toHaveCount(1)
  await expect(boq.locator('tr', { hasText: 'B.I. seamless pipe, Sch. 40 (supply + return)' })).toHaveCount(1)
  await expect(boq.locator('tr', { hasText: 'fire-rated Styropor insulation' })).toHaveCount(1)
  await expect(boq.locator('tr', { hasText: 'Chilled-water pump set' })).toHaveCount(1)
  await expect(page.locator('#pj-boq .boq-grp', { hasText: 'Lighting Fixtures' })).toHaveCount(1)
  await expect(boq.locator('tr', { hasText: 'LED luminaire, recessed, 4,000 lm' }).locator('td').nth(2)).toHaveText('24')
  await expect(boq.locator('tr', { hasText: 'THHN/THWN-2 wire, 10 mm²' })).toHaveCount(1)
  await expect(boq.locator('tr', { hasText: 'cold-water main, PPR pipe, PN20' })).toHaveCount(1)
  expect(errors).toEqual([])
})
