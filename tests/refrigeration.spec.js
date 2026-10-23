import { test, expect } from '@playwright/test'
import { openSite, openCalc, setField, row, rows, suggestions, setSystem } from './helpers.js'

test.describe('refrigeration calculators — known values (SI, INTL)', () => {
  test.beforeEach(async ({ page }) => { await openSite(page) })

  test('refrigerant P–T chart — R410A at 5 °C ≈ 8.3 bar gauge, and back again', async ({ page }) => {
    await openCalc(page, 'refpt')
    expect(await row(page, 'Saturation pressure (gauge)')).toBe('831.5 kPa')
    expect(await row(page, 'Safety class / GWP')).toBe('A1 · GWP 2088')
    await setField(page, 'refpt', 'mode', 'p')
    await setField(page, 'refpt', 'p', '831.5')
    expect(await row(page, 'Saturation temperature')).toMatch(/^5(\.0)? °C$/)
    await setField(page, 'refpt', 're', 'r134a')
    await setField(page, 'refpt', 'mode', 't')
    await setField(page, 'refpt', 't', '0')
    expect(await row(page, 'Saturation pressure (gauge)')).toBe('191.7 kPa') // 2.93 bar abs at 0 °C
    await expect(page.locator('#calc-draw svg')).toBeVisible()
  })

  test('product freezing — 1 t of lean beef, 80 mm cartons in a −35 °C blast freezer', async ({ page }) => {
    await openCalc(page, 'freeze')
    expect(await row(page, 'Average refrigeration load')).toBe('7.937 kW')
    expect(await row(page, 'Estimated freezing time')).toBe('8.9 h')
    expect(await row(page, 'Freezing (latent)')).toBe('68.7 kWh')
    expect(await row(page, 'Design check')).toBe('✓ Pass')
    // a thicker product in still air will not freeze in the batch time
    await setField(page, 'freeze', 'air', '6')
    await setField(page, 'freeze', 'd', '200')
    expect(await row(page, 'Design check')).toBe('⚠ Warning')
    // the final temperature must be below the freezing point
    await setField(page, 'freeze', 'to', '0')
    await expect(page.locator('#r-err')).toContainText('below the freezing point')
  })

  test('evaporator & condensing unit — 10 kW cooler at 2 °C / 90 % RH, then a freezer', async ({ page }) => {
    await openCalc(page, 'evap')
    expect(await row(page, 'Design TD')).toBe('6.1 K')
    expect(await row(page, 'Evaporating temperature (coil)')).toBe('-4.1 °C')
    expect(await row(page, 'Condensing unit capacity')).toBe('10 kW')
    expect(await row(page, 'Defrost')).toContain('Off-cycle')
    await setField(page, 'evap', 'tr', '-25')
    expect(await row(page, 'Design TD')).toBe('5.6 K')
    expect(await row(page, 'Defrost')).toContain('Electric or hot-gas')
    expect((await suggestions(page)).join(' ')).toContain('drain line')
  })

  test('refrigerant charge safety — R32 passes, the same charge of R290 does not', async ({ page }) => {
    await openCalc(page, 'refsafe')
    expect(await row(page, 'Max charge — flammability')).toBe('3.848 kg')
    expect(await row(page, 'Design check')).toBe('✓ Pass')
    await setField(page, 'refsafe', 're', 'r290')
    expect(await row(page, 'Design check')).toBe('✕ Fail')
    // non-flammable refrigerants are checked against the RCL only
    await setField(page, 'refsafe', 're', 'r410a')
    expect((await rows(page)).map((r) => r.label)).not.toContain('Max charge — flammability')
  })

  test('ice thermal storage — load levelling halves the chiller, full storage needs a bigger one', async ({ page }) => {
    await openCalc(page, 'icestore')
    expect(await row(page, 'Chiller size (nominal)')).toBe('424.2 kW')
    expect(await row(page, 'Storage capacity')).toBe('2,758 kWh')
    expect(await row(page, 'Ice to build')).toBe('29.7 t')
    await setField(page, 'icestore', 'st', 'full')
    expect(await row(page, 'Design check')).toBe('⚠ Warning')
    await setField(page, 'icestore', 'ch', '16')
    await expect(page.locator('#r-err')).toContainText('cannot be more than 24')
  })

  test('refrigerant pipe supports — ⅞ + ⅜ in line set on shared trapezes, then a single line', async ({ page }) => {
    await openCalc(page, 'rfhang')
    expect(await row(page, 'Trapeze supports')).toBe('35') // 30 m at 1.22 m + 10 % + 6 at bends
    expect(await row(page, 'Maximum spacing')).toBe('1.219 m')
    expect(await row(page, 'Threaded rod size')).toBe('10 mm × 70 rods')
    await expect(page.locator('#calc-draw svg')).toBeVisible()
    await setField(page, 'rfhang', 'liq', 'none')
    expect(await row(page, 'Hangers')).toBe('26') // ⅞ in alone: 1.83 m spacing
  })

  test('mass inputs follow the unit system', async ({ page }) => {
    await setSystem(page, 'imp')
    await openCalc(page, 'refsafe')
    await expect(page.locator('#f-refsafe-m-u')).toHaveValue('lb')
    expect(await row(page, 'Max charge for this room (RCL)')).toMatch(/ lb$/)
  })
})

test('the Refrigeration category lists the ten refrigeration tools', async ({ page }) => {
  await openSite(page)
  await page.locator('[data-filter="R"]').click()
  await expect(page.locator('#card-grid .card:visible')).toHaveCount(10)
  await page.locator('#calc-q').fill('freezer')
  await expect(page.locator('#card-grid .card:visible h3').first()).toHaveText(/Freez|Cold Room|Evaporator/)
})
