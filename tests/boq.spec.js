import { test, expect } from '@playwright/test'
import { openSite, closeCalc, setCode } from './helpers.js'

// One room taken to the duct step, with 20 m supply and 10 m return duct runs.
async function roomToDuct(page) {
  await page.locator('#pj-new-name').fill('Office L3')
  await page.locator('#pj-create').click()
  await page.locator('#pj-r-name').fill('Open office')
  await page.locator('#pj-r-l').fill('12.5')
  await page.locator('#pj-r-w').fill('8')
  await page.locator('#pj-r-p').fill('10')
  await page.locator('#pj-r-ds').fill('20')
  await page.locator('#pj-r-dr').fill('10')
  await page.locator('#pj-form button[type="submit"]').click()
  for (let i = 0; i < 4; i++) { // cooling load, outdoor air, diffusers, duct
    await page.locator('.pj-next').click()
    await page.locator('#pj-save').click()
    await closeCalc(page)
  }
  await expect(page.locator('.pj-dims')).toContainText('duct 30 m')
}

const item = (page, no) => page.locator('#pj-boq tbody tr', { has: page.locator('td.boq-no', { hasText: new RegExp('^' + no.replace('.', '\\.') + '$') }) })

test('BOQ takes off equipment, diffusers, ductwork and insulation from the rooms', async ({ page }) => {
  const errors = await openSite(page)
  await roomToDuct(page)
  await page.locator('#pj-boq-btn').click()
  await expect(page.locator('#pj-boq')).toBeVisible()
  await expect(item(page, 'A.1')).toContainText('air-conditioning unit')
  await expect(item(page, 'B.1')).toContainText('4-way square ceiling diffuser')
  await expect(item(page, 'B.1').locator('td').nth(2)).toHaveText('12')
  // 500 × 300 mm duct: perimeter 1.6 m × 30 m × 1.20 allowance = 57.6 m², 24 ga
  const duct = page.locator('#pj-boq tbody tr', { hasText: 'galvanised-steel duct' })
  await expect(duct).toContainText('24 ga (0.70 mm)')
  await expect(duct.locator('td').nth(2)).toHaveText('57.6')
  await expect(duct.locator('td').nth(3)).toHaveText('m²')
  // insulation on the 20 m supply run only: 1.6 × 20 × 1.2 = 38.4 m²
  await expect(page.locator('#pj-boq tbody tr', { hasText: 'Duct insulation' }).locator('td').nth(2)).toHaveText('38.4')
  expect(errors).toEqual([])
})

test('unit rates price the BOQ with contingency and VAT, and are remembered', async ({ page }) => {
  await openSite(page)
  await setCode(page, 'ph')
  await roomToDuct(page)
  await page.locator('#pj-boq-btn').click()
  await expect(page.locator('#boq-cur')).toHaveValue('₱')
  await expect(page.locator('#boq-tax')).toHaveValue('12')
  await item(page, 'B.1').locator('input[data-rate]').fill('1500')
  await expect(page.locator('[data-amt="B.1"]')).toHaveText('₱ 18,000.00')
  await expect(page.locator('[data-tot="net"]')).toHaveText('₱ 18,000.00')
  await expect(page.locator('[data-tot="tax"]')).toHaveText('₱ 2,160.00')
  await expect(page.locator('[data-tot="total"]')).toHaveText('₱ 20,160.00')
  await page.reload()
  await page.locator('#pj-boq-btn').click()
  await expect(item(page, 'B.1').locator('input[data-rate]')).toHaveValue('1500')
})

test('BOQ and BOM export to Excel CSV, and the BOQ prints', async ({ page, context }) => {
  await openSite(page)
  await roomToDuct(page)
  await page.locator('#pj-boq-btn').click()
  const [boq] = await Promise.all([page.waitForEvent('download'), page.locator('#boq-csv').click()])
  expect(boq.suggestedFilename()).toBe('Office-L3-BOQ.csv')
  const boqText = (await (await boq.createReadStream()).toArray()).join('')
  expect(boqText).toContain('Grand total')
  const [bom] = await Promise.all([page.waitForEvent('download'), page.locator('#bom-csv').click()])
  expect(bom.suggestedFilename()).toBe('Office-L3-BOM.csv')
  const bomText = (await (await bom.createReadStream()).toArray()).join('')
  expect(bomText).toContain('Item,Description,Qty,Unit,Rooms,Notes')
  expect(bomText).not.toContain('Grand total')
  const [pdf] = await Promise.all([context.waitForEvent('page'), page.locator('#boq-pdf').click()])
  await pdf.waitForLoadState('domcontentloaded')
  await expect(pdf).toHaveTitle(/MTB-\d{8}-BOQ-OFFICEL3/)
  await expect(pdf.locator('table.boq')).toContainText('Grand total')
})
