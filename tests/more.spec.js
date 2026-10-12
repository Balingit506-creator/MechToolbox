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
  await page.locator('#pj-r-h').fill('3')
  await page.locator('#pj-r-p').fill('6')
  await page.locator('#pj-form button[type="submit"]').click()
  await expect(page.locator('.pj-table tbody tr')).toHaveCount(1)
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

test('appliance energy cost — 122 W refrigerator, 24 h at 14 per kWh', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'ecost')
  await page.locator('#ec-rate').fill('14')
  await page.locator('#ec-cur').fill('₱')
  // keep one appliance: the refrigerator
  while (await page.locator('.ec-del').count() > 1) await page.locator('.ec-del').first().click()
  await page.locator('#ec-form select[data-k="app"]').selectOption('Refrigerator')
  await page.locator('#ec-form input[data-k="p"]').fill('122')
  await page.locator('#ec-form input[data-k="hrs"]').fill('24')
  const total = page.locator('#ec-tbl .ec-total')
  await expect(total).toContainText('2.93 kWh')
  await expect(total).toContainText('₱ 40.99')
  await expect(total).toContainText('₱ 1,229.76')
  await expect(total).toContainText('₱ 14,757.12')
  // another currency, and + units doubles it
  await page.locator('#ec-cur').fill('$')
  await page.locator('[data-ecact="plus"]').click()
  await expect(total).toContainText('$ 81.98')
  expect(errors).toEqual([])
})

test('appliance energy cost — inverter aircon uses 60 % of its rated input', async ({ page }) => {
  await openSite(page)
  await openCalc(page, 'ecost')
  await page.locator('#ec-rate').fill('10')
  while (await page.locator('.ec-del').count() > 1) await page.locator('.ec-del').first().click()
  await page.locator('#ec-form select[data-k="app"]').selectOption('Aircon')
  await page.locator('#ec-form input[data-k="p"]').fill('1000')
  await page.locator('#ec-form input[data-k="hrs"]').fill('10')
  await page.locator('#ec-form select[data-k="tech"]').selectOption('Non-inverter')
  await expect(page.locator('#ec-tbl .ec-total')).toContainText('10 kWh')
  await page.locator('#ec-form select[data-k="tech"]').selectOption('Inverter')
  await expect(page.locator('#ec-tbl .ec-total')).toContainText('6 kWh')
  await expect(page.locator('#ec-tbl')).toContainText('× 0.6 avg load')
})

test('duct sheet metal — 450 × 250 mm, 10 m, 15 %: 6 sheets of 4 × 8 ft', async ({ page }) => {
  await openSite(page)
  await openCalc(page, 'dsheet')
  expect(await row(page, 'Sheets needed')).toBe('6 sheets')
  expect(await row(page, 'Perimeter')).toBe('1.4 m')
  expect(await row(page, 'Sheet area, net')).toBe('14 m²')
  expect(await row(page, 'Sheet area with allowance')).toBe('16.1 m²')
  expect(await row(page, 'Thickness')).toBe('24 ga (0.70 mm)')
  expect(await row(page, 'Sheet layout')).toBe('two L-shaped pieces per section')
})

test('duct sheet metal — cost in any currency: 6 × 650 + 10 % accessories', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'dsheet')
  expect(await row(page, 'Estimated cost')).toBe('enter a price per sheet')
  await page.locator('#f-dsheet-cur').selectOption('₱')
  await page.locator('#f-dsheet-ps').fill('650')
  expect(await row(page, 'Sheets cost')).toBe('₱ 3,900.00')
  expect(await row(page, 'Estimated cost')).toBe('₱ 4,290.00')
  await page.locator('#f-dsheet-cur').selectOption('$')
  await page.locator('#f-dsheet-lab').fill('5')                 // 14 m² × 5
  expect(await row(page, 'Estimated cost')).toBe('$ 4,360.00')
  expect(errors).toEqual([])
})

test('insulation — 450 × 250 duct, 10 m, 25 mm: 1.6 m perimeter, 17.6 m², 1 roll, 4.4 L, 1 tape', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'insul')
  expect(await row(page, 'Rolls of insulation')).toBe('1')
  expect(await row(page, 'Outer perimeter')).toBe('1.6 m')
  expect(await row(page, 'Insulation area')).toBe('16 m²')
  expect(await row(page, 'With waste')).toBe('17.6 m²')
  expect(await row(page, 'Contact adhesive')).toBe('4.4 L')
  expect(await row(page, 'Foil tape (50 m rolls)')).toBe('1 roll(s)')
  await page.locator('#f-insul-pu').fill('2500')
  expect(await row(page, 'Estimated cost')).toBe('₱ 2,500.00')
  await page.locator('#f-insul-ty').selectOption('pipe')
  await expect(page.locator('#f-insul-od')).toBeVisible()
  expect(errors).toEqual([])
})

test('duct hangers — 450 × 250, 10 m at 2.4 m: 7 trapezes, 8 mm × 14 rods, 5 rod lengths', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'hanger')
  expect(await row(page, 'Trapeze hangers')).toBe('7')
  expect(await row(page, 'Load on each rod')).toBe('17 kg')
  expect(await row(page, 'Threaded rod size')).toBe('8 mm × 14 rods')
  expect(await row(page, 'Rod needed (3 m lengths)')).toBe('5 pcs')
  expect(await row(page, 'Trapeze angle bar')).toBe('25 × 25 × 3 mm, 0.7 m each')
  expect(await row(page, 'Angle bar needed (6 m lengths)')).toBe('1 pcs')
  expect(await row(page, 'Anchors')).toBe('14 pcs')
  expect(await row(page, 'Nuts and washers')).toBe('28 nuts / 28 washers')
  await page.locator('#f-hanger-pr').fill('150')
  expect(await row(page, 'Estimated cost')).toBe('₱ 750.00')
  expect(errors).toEqual([])
})

test('chilled water take-off — 100 TR, 10 °F, 50 m: pipe, lengths, insulation and hangers', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'chw')
  await page.locator('#f-chw-p').fill('351.7')        // 100 TR in kW
  await page.locator('#f-chw-dt').fill('5.56')        // 10 °F
  await page.locator('#f-chw-l').fill('50')
  expect(await row(page, 'Pipe, supply + return')).toBe('110 m')
  expect(await row(page, '6 m pipe lengths')).toBe('19 pcs')
  expect(await row(page, 'Chilled-water flow')).toBe('15.1 L/s')
  expect(await row(page, 'Hangers (max spacing)')).toMatch(/^\d+ \([\d.]+ m\)$/)
  expect(await row(page, 'Insulation area')).toMatch(/ m²$/)
  expect(await row(page, 'Estimated cost')).toBe('enter prices for pipe, insulation, hangers and labor')
  await page.locator('#f-chw-pp').fill('5000')                  // 19 lengths × 5,000 = 95,000 + 30 % fittings
  expect(await row(page, 'Estimated cost')).toBe('₱ 123,500.00')
  expect(errors).toEqual([])
})

test('chilled water insulation — 5 in, 50 m, supply + return: 55 tubes, 76.5 m², 19.1 L, 3 tapes, 24 saddles', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'chwins')
  expect(await row(page, 'Insulation tubes, 2 m each')).toBe('55')
  expect(await row(page, 'Thickness used')).toBe('40 mm')
  expect(await row(page, 'Insulated outer diameter')).toBe('221.3 mm')
  expect(await row(page, 'Pipe length, with waste')).toBe('110 m')
  expect(await row(page, 'Insulation surface area')).toBe('76.48 m²')
  expect(await row(page, 'Contact adhesive')).toBe('19.1 L')
  expect(await row(page, 'Joint tape (50 m rolls)')).toBe('3 roll(s)')
  expect(await row(page, 'Hanger saddles')).toBe('24 pcs')
  expect(await row(page, 'Cladding area')).toBe('Not needed')
  await page.locator('#f-chwins-pt').fill('300')
  expect(await row(page, 'Estimated cost')).toBe('₱ 16,500.00')
  expect(errors).toEqual([])
})

test('lighting power density — 12 × 36 W over 100 m² open office: 4.32 W/m² vs 6.57 allowed', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'lpd')
  expect(await row(page, 'Lighting power density')).toBe('4.32 W/m²')
  expect(await row(page, 'Allowed LPD')).toBe('6.57 W/m²')
  expect(await row(page, 'Design check')).toBe('✓ Pass')
  await page.locator('#f-lpd-w1').fill('80')                    // 960 W → 9.6 W/m²
  expect(await row(page, 'Design check')).toBe('⚠ Warning')
  await page.locator('#f-lpd-lim').fill('10')                   // custom code limit
  expect(await row(page, 'Design check')).toBe('✓ Pass')
  expect(errors).toEqual([])
})

test('chilled water hangers — 5 in, 50 m, shared trapeze: matches the reference take-off', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'chhang')
  expect(await row(page, 'Trapeze supports')).toBe('15')
  expect(await row(page, 'Maximum spacing')).toBe('4.3 m')
  expect(await row(page, 'Filled pipe weight')).toBe('36.2 kg/m')
  expect(await row(page, 'Load on each rod')).toBe('234 kg')
  expect(await row(page, 'Threaded rod size')).toBe('16 mm × 30 rods')
  expect(await row(page, 'Rod needed (3 m lengths)')).toBe('10 pcs')
  expect(await row(page, 'Trapeze angle bar')).toBe('65 × 65 × 6 mm, 0.7106 m × 2 bar(s) of 6 m')
  expect(await row(page, 'Insulation saddles')).toBe('30 pcs')
  expect(await row(page, 'Nuts and washers')).toBe('60 nuts / 60 washers')
  await expect(page.locator('#m-body svg').first()).toBeVisible()            // live drawing
  expect(errors).toEqual([])
})

test('refrigeration — superheat / subcooling pass, R410A pressures, cooling tower flow', async ({ page }) => {
  const errors = await openSite(page)
  await openCalc(page, 'shsc')
  expect(await row(page, 'Superheat')).toBe('5.1 K')
  expect(await row(page, 'Subcooling')).toBe('4.6 K')
  expect(await row(page, 'Design check')).toBe('✓ Pass')
  await page.locator('#f-shsc-ts').fill('20')                          // starved evaporator
  expect(await row(page, 'Design check')).toBe('⚠ Warning')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'refcycle')
  expect(await row(page, 'Evaporating pressure')).toBe('9.33 bar abs')
  await page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'coldroom')
  expect(await row(page, 'Equipment capacity')).toMatch(/ kW$/)
  expect(errors).toEqual([])
})

test('HVAC set — expansion tank, condensate, PMV, ERV, car park, stair pressurization, leakage', async ({ page }) => {
  const errors = await openSite(page)
  const close = () => page.evaluate(() => document.getElementById('modal').close())
  await openCalc(page, 'expt')
  expect(await row(page, 'Expansion tank (total)')).toBe('35 L')
  expect(await row(page, 'Acceptance factor')).toBe('0.323')
  await close(); await openCalc(page, 'cond')
  expect(await row(page, 'Condensate')).toBe('12.9 L/h')
  expect(await row(page, 'Drain pipe size')).toBe('20 mm')
  await close(); await openCalc(page, 'pmv')
  expect(await row(page, 'PMV')).toBe('-0.42')
  expect(await row(page, 'Design check')).toBe('✓ Pass')
  await page.locator('#f-pmv-ta').fill('28')                    // warm room: air and radiant
  await page.locator('#f-pmv-tr').fill('28')
  expect(await row(page, 'Design check')).toBe('⚠ Warning')
  await close(); await openCalc(page, 'erv')
  await page.locator('#f-erv-cost').fill('500000')
  expect(await row(page, 'Simple payback')).toBe('2 years')
  await close(); await openCalc(page, 'carpark')
  expect(await row(page, 'Normal exhaust')).toBe('45,000 m³/h')
  await close(); await openCalc(page, 'stairp')
  expect(await row(page, 'Door-opening force')).toBe('97 N')
  await close(); await openCalc(page, 'leak')
  await page.locator('#f-leak-m').fill('300')                   // above the 172.6 m³/h allowed
  expect(await row(page, 'Design check')).toBe('⚠ Warning')
  expect(errors).toEqual([])
})
