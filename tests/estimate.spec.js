import { test, expect } from '@playwright/test'
import { openSite } from './helpers.js'

async function createEstimate(page, tpl = 'M') {
  await page.locator('#es-new-name').fill('Clinic fit-out')
  await page.locator('#es-new-tpl').selectOption(tpl)
  await page.locator('#es-root [data-act="create"]').click()
  await expect(page.locator('#es-select')).toHaveValue(/.+/)
}
const item = (page, n, k) => page.locator('#es-root tr.es-item').nth(n).locator(`[data-k="${k}"]`)

test('manual BOQ prices items in the QS build-up', async ({ page }) => {
  const errors = await openSite(page)
  await createEstimate(page)
  await expect(page.locator('#es-root .boq-div')).toHaveCount(1)
  await expect(page.locator('#es-root .es-div input')).toHaveValue('MECHANICAL WORKS')
  // first item: 10 pcs at 100 material, labor blank → 30 % of material
  await item(page, 0, 'desc').fill('Split-type air-conditioner, inverter, 2.0 TR')
  await expect(item(page, 0, 'unit')).toHaveValue('set')                 // filled from the catalogue
  await item(page, 0, 'qty').fill('10')
  await item(page, 0, 'm').fill('100')
  const v = (k) => page.locator(`#es-root [data-v="${k}"]`)
  await expect(v('sum:tc')).toHaveText('1,300.00')
  await expect(v('sum:sp')).toHaveText('130.00')       // 10 %
  await expect(v('sum:ct')).toHaveText('42.90')        // 3 % of 1,430
  // VAT follows the code basis default (12 % PH, 0 % INTL)
  await page.locator('#es-tax').fill('12')
  await expect(v('sum:vat')).toHaveText('176.75')      // 12 % of 1,472.90
  await expect(v('sum:proj')).toHaveText('1,649.65')
  // a labor-only item adds labor but stays off the BOM
  await page.locator('#es-root [data-act="iadd"]').first().click()
  await expect(item(page, 1, 'desc')).toBeFocused()
  await item(page, 1, 'desc').fill('Testing and commissioning')
  await item(page, 1, 'kind').selectOption('l')
  await item(page, 1, 'qty').fill('1')
  await item(page, 1, 'l').fill('500')
  await expect(v('all:l')).toHaveText('800.00')
  await expect(page.locator('#es-root tr.es-item').nth(1).locator('.boq-no')).toHaveText('1.1.2')
  await page.locator('#es-root [data-estab="bom"]').click()
  await expect(page.locator('#es-root .es-bom tbody tr:not(.boq-div):not(.boq-grp)')).toHaveCount(1)
  await expect(page.locator('#es-root .es-bom')).toContainText('Split-type air-conditioner')
  await expect(page.locator('#es-root .es-bom')).not.toContainText('Testing and commissioning')
  expect(errors).toEqual([])
})

test('estimates persist, add divisions and export BOQ / BOM files', async ({ page, context }) => {
  await openSite(page)
  await createEstimate(page, 'mepfs')
  await expect(page.locator('#es-root .boq-div')).toHaveCount(4)
  await page.locator('#es-root [data-act="dadd"][data-k="G"]').click()
  await expect(page.locator('#es-root .boq-div')).toHaveCount(5)
  await expect(page.locator('#es-root .es-div input').last()).toHaveValue('GENERAL REQUIREMENTS')
  await item(page, 0, 'desc').fill('Panelboard, 3-phase, with main and branch breakers')
  await item(page, 0, 'qty').fill('2')
  await page.reload()
  await expect(item(page, 0, 'qty')).toHaveValue('2')
  await expect(page.locator('#es-root .boq-div')).toHaveCount(5)
  // PDF first: Edge opens its own downloads pop-up after a download, which would also count as a new page
  const [pdf] = await Promise.all([context.waitForEvent('page'), page.locator('#es-root [data-act="boqpdf"]').click()])
  await pdf.waitForLoadState('domcontentloaded')
  await expect(pdf.locator('h1.t')).toHaveText('BILL OF QUANTITIES')
  await expect(pdf.locator('table.q')).toContainText('Panelboard, 3-phase')
  await pdf.close()
  const [csv] = await Promise.all([page.waitForEvent('download'), page.locator('#es-root [data-act="boqcsv"]').click()])
  expect(csv.suggestedFilename()).toBe('Clinic-fit-out-BOQ.csv')
  await page.locator('#es-root [data-estab="bom"]').click()
  const [bom] = await Promise.all([page.waitForEvent('download'), page.locator('#es-root [data-act="bomcsv"]').click()])
  expect(bom.suggestedFilename()).toBe('Clinic-fit-out-BOM.csv')
})
