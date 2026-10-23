import { test, expect } from '@playwright/test'
import { openSite, openCalc, setField, row, rows } from './helpers.js'

test.describe('plumbing calculators — known values (SI)', () => {
  test.beforeEach(async ({ page }) => { await openSite(page) })

  test('hot water recirculation — 120 m insulated loop, 5 K drop', async ({ page }) => {
    await openCalc(page, 'hwrec')
    expect(await row(page, 'Loop heat loss')).toBe('0.96 kW')
    expect(await row(page, 'Recirculation flow')).toBe('0.04666 L/s')
    expect(await row(page, 'Pump head')).toBe('45 kPa')
    expect(await row(page, 'Return pipe size')).toBe('½ in copper Type L')
    await setField(page, 'hwrec', 'dt', '8')
    expect(await row(page, 'Design check')).toBe('⚠ Warning') // returns at 52 °C
  })

  test('pressure zones — 30 floors at 3.2 m between 100 and 550 kPa', async ({ page }) => {
    await openCalc(page, 'przone')
    expect(await row(page, 'Floors per zone')).toBe('15')
    expect(await row(page, 'Pressure zones')).toBe('2')
    expect(await row(page, 'Pressure at the bottom of a full zone')).toBe('538.5 kPa')
  })

  test('water hammer — copper 1 in, 1.5 m/s stopped in 0.1 s', async ({ page }) => {
    await openCalc(page, 'hammer')
    expect(await row(page, 'Pressure wave speed')).toBe('1,260 m/s')
    expect(await row(page, 'Surge pressure rise')).toBe('900 kPa')
    expect(await row(page, 'Design check')).toBe('⚠ Warning')
    await setField(page, 'hammer', 't', '1')
    expect(await row(page, 'Design check')).toBe('✓ Pass')
  })

  test('plumbing hangers — 2 in copper, 40 m run and a 9 m riser', async ({ page }) => {
    await openCalc(page, 'plhang')
    expect(await row(page, 'Hangers')).toBe('17')
    expect(await row(page, 'Maximum spacing')).toBe('3.05 m')
    await setField(page, 'plhang', 'rh', '9')
    expect(await row(page, 'Riser clamps')).toBe('4 pcs')
    await setField(page, 'plhang', 'mat', 'ci')
    await setField(page, 'plhang', 'dn', '15')
    await expect(page.locator('#r-err')).toContainText('Cast-iron soil pipe starts at')
  })

  test('swimming pool — 25 × 12.5 × 1.4 m, 6 h turnover', async ({ page }) => {
    await openCalc(page, 'pool')
    expect(await row(page, 'Pool volume')).toBe('437.5 m³')
    expect(await row(page, 'Circulation flow')).toBe('20.25 L/s')
    expect(await row(page, 'Filter area')).toBe('1.987 m²')
  })
})

test.describe('fire protection calculators — known values (SI)', () => {
  test.beforeEach(async ({ page }) => { await openSite(page) })

  test('clean agent — FM-200 in a 90 m³ room at 7 %', async ({ page }) => {
    await openCalc(page, 'cleanagent')
    expect(await row(page, 'Agent quantity')).toBe('49.39 kg')
    await setField(page, 'cleanagent', 'c', '10')
    expect(await row(page, 'Design check')).toBe('⚠ Warning') // above the 9 % NOAEL
    await setField(page, 'cleanagent', 'ag', 'ig541')
    await setField(page, 'cleanagent', 'c', '0')
    expect(await row(page, 'Agent quantity')).toMatch(/ m³$/)
  })

  test('fire alarm battery — 0.85 A standby, 3.2 A alarm → 26 Ah', async ({ page }) => {
    await openCalc(page, 'fabatt')
    expect(await row(page, 'Battery capacity needed')).toBe('24.8 Ah')
    expect(await row(page, 'Battery to fit')).toBe('2 × 12 V, 26 Ah')
  })

  test('detectors — 20 × 12 m room: 4 smoke detectors; heat detectors shrink with ceiling height', async ({ page }) => {
    await openCalc(page, 'detect')
    expect(await row(page, 'Detectors needed')).toBe('4')
    await expect(page.locator('#calc-draw svg circle[r="3.5"]')).toHaveCount(4) // one dot per detector
    await setField(page, 'detect', 'ty', 'heat')
    await setField(page, 'detect', 'ch', '6')
    expect(await row(page, 'Design spacing S')).toBe('9.728 m') // 15.2 m × 64 %
  })

  test('egress — 800 m² of offices', async ({ page }) => {
    await openCalc(page, 'egress')
    expect(await row(page, 'Occupant load')).toBe('58 people')
    expect(await row(page, 'Exits required')).toBe('2')
    await setField(page, 'egress', 'occ', 'asmstand')
    expect(await row(page, 'Exits required')).toBe('4') // 1,723 people
  })

  test('sprinkler pipe hangers — 4 in steel main, 60 m, with seismic braces', async ({ page }) => {
    await openCalc(page, 'fphang')
    expect(await row(page, 'Hangers')).toBe('17')
    expect(await row(page, 'Threaded rod size')).toBe('10 mm × 17 rods') // NFPA 13: ⅜ in up to 4 in
    expect(await row(page, 'Hanger design load')).toBe('669 kg')
    await setField(page, 'fphang', 'seis', 'yes')
    expect(await row(page, 'Seismic sway braces')).toBe('6 lateral + 3 longitudinal')
    await setField(page, 'fphang', 'mat', 'cpvc')
    await expect(page.locator('#r-err')).toContainText('not used above 3"')
  })

  test('foam — 400 m² at 6.5 L/min·m² for 10 min plus hose streams', async ({ page }) => {
    await openCalc(page, 'foam')
    expect(await row(page, 'Foam solution flow')).toBe('2,600 L/min')
    expect(await row(page, 'Foam concentrate')).toBe('1,008 L')
    expect((await rows(page)).length).toBe(5)
  })
})
