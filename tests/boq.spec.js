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

const row = (page, no) => page.locator('#pj-boq tbody tr', { has: page.locator('td.boq-no', { hasText: new RegExp('^' + no.replace(/\./g, '\\.') + '$') }) })
const cell = (page, key) => page.locator(`[data-v="${key}"]`)

test('BOQ follows the QS format and takes off equipment, diffusers, ductwork and insulation', async ({ page }) => {
  const errors = await openSite(page)
  await roomToDuct(page)
  await page.locator('#pj-boq-btn').click()
  await expect(page.locator('#pj-boq .boq-div')).toContainText('IVMECHANICAL WORKS')
  await expect(page.locator('#pj-boq .boq-grp')).toHaveText(['4.1Air-Conditioning Equipment', '4.2Air Distribution', '4.3Ductwork', '4.4Insulation and Flexible Duct', '4.5Controls, Drains and Testing', '4.6Others to complete'])
  await expect(row(page, '4.1.1')).toContainText('air-conditioning unit')
  await expect(row(page, '4.2.1')).toContainText('4-way square ceiling diffuser')
  await expect(row(page, '4.2.1').locator('td').nth(2)).toHaveText('12')
  // 500 × 300 mm duct: perimeter 1.6 m × 30 m × 1.20 allowance = 57.6 sq.m of 24 ga, sheet weight in the remarks
  await expect(row(page, '4.3.1')).toContainText('24 ga (0.70 mm)')
  await expect(row(page, '4.3.1').locator('td').nth(2)).toHaveText('57.6')
  await expect(row(page, '4.3.1').locator('td').nth(3)).toHaveText('sq.m')
  await expect(row(page, '4.3.1').locator('.boq-rem')).toContainText('kg sheet')
  // insulation on the 20 m supply run only: 1.6 × 20 × 1.2 = 38.4 sq.m
  await expect(row(page, '4.4.1').locator('td').nth(2)).toHaveText('38.4')
  await expect(row(page, '4.6.1')).toContainText('Hangers and supports')
  await expect(row(page, '4.6.2')).toContainText('Consumables')
  expect(errors).toEqual([])
})

test('material + labor pricing with supervision & profit, contingencies, VAT and cost per sq.m', async ({ page }) => {
  await openSite(page)
  await setCode(page, 'ph')
  await roomToDuct(page)
  await page.locator('#pj-boq-btn').click()
  await expect(page.locator('#boq-cur')).toHaveValue('₱')
  await row(page, '4.2.1').locator('input[data-kind="m"]').fill('1500')
  // labor defaults to 30 % of material
  await expect(row(page, '4.2.1').locator('input[data-kind="l"]')).toHaveAttribute('placeholder', '450.00')
  await expect(cell(page, '4.2.1:uu')).toHaveText('1,950.00')
  await expect(cell(page, '4.2.1:tm')).toHaveText('18,000.00')
  await expect(cell(page, '4.2.1:tl')).toHaveText('5,400.00')
  await expect(cell(page, '4.2.1:tt')).toHaveText('23,400.00')
  await expect(cell(page, '4.2:t')).toHaveText('23,400.00')
  await expect(cell(page, 'sum:tc')).toHaveText('23,400.00')
  await expect(cell(page, 'sum:sp')).toHaveText('2,340.00')    // 10 % of total cost
  await expect(cell(page, 'sum:ct')).toHaveText('772.20')      // 3 % of total + S&P
  await expect(cell(page, 'sum:vat')).toHaveText('3,181.46')   // 12 % of total + S&P + contingencies
  await expect(cell(page, 'sum:proj')).toHaveText('29,693.66')
  await expect(cell(page, 'sum:psm')).toHaveText('296.94')     // per 100 sq.m
  // a typed labor rate overrides the percentage
  await row(page, '4.2.1').locator('input[data-kind="l"]').fill('300')
  await expect(cell(page, '4.2.1:uu')).toHaveText('1,800.00')
  await expect(cell(page, '4.2.1:tt')).toHaveText('21,600.00')
  await page.reload()
  await page.locator('#pj-boq-btn').click()
  await expect(row(page, '4.2.1').locator('input[data-kind="m"]')).toHaveValue('1500')
  await expect(row(page, '4.2.1').locator('input[data-kind="l"]')).toHaveValue('300')
})

test('BOQ and BOM export to Excel CSV, and the BOQ prints in the QS layout', async ({ page, context }) => {
  await openSite(page)
  await roomToDuct(page)
  await page.locator('#pj-boq-btn').click()
  await page.locator('#boq-owner').fill('TCKI')
  await page.locator('#boq-owner').blur()
  const [boq] = await Promise.all([page.waitForEvent('download'), page.locator('#boq-csv').click()])
  expect(boq.suggestedFilename()).toBe('Office-L3-BOQ.csv')
  const boqText = (await (await boq.createReadStream()).toArray()).join('')
  expect(boqText).toContain('ITEM NO.,SCOPE OF WORK / ITEM DESCRIPTION,QTY,UOM,UNIT COST - MATERIAL,UNIT COST - LABOR,UNIT COST - TOTAL,TOTAL MATERIAL COST,TOTAL LABOR COST,TOTAL MATERIAL & LABOR COST,REMARKS')
  expect(boqText).toContain('Owner,TCKI')
  expect(boqText).toContain('PROJECT COST (LABOR, LIGHT EQUIPMENT AND POWER TOOLS)')
  const [bom] = await Promise.all([page.waitForEvent('download'), page.locator('#bom-csv').click()])
  expect(bom.suggestedFilename()).toBe('Office-L3-BOM.csv')
  const bomText = (await (await bom.createReadStream()).toArray()).join('')
  expect(bomText).toContain('BILL OF MATERIALS')
  expect(bomText).toContain('(weight)')
  expect(bomText).not.toContain('PROJECT COST')
  const [pdf] = await Promise.all([context.waitForEvent('page'), page.locator('#boq-pdf').click()])
  await pdf.waitForLoadState('domcontentloaded')
  await expect(pdf).toHaveTitle(/MTB-\d{8}-BOQ-OFFICEL3/)
  await expect(pdf.locator('h1.t')).toHaveText('BILL OF QUANTITIES')
  await expect(pdf.locator('.hdr')).toContainText('Owner: TCKI')
  await expect(pdf.locator('table.q tr.div')).toContainText('MECHANICAL WORKS')
  await expect(pdf.locator('table.q tr.sum')).toHaveCount(6)
  await expect(pdf.locator('.sigs')).toContainText('Counter Checked by:')
})
