import { test, expect } from '@playwright/test'
import { openSite, setCode } from './helpers.js'

// Fill in the report form for the open calculator and return the report tab.
async function makeReport(page, context, details = {}) {
  await page.locator('#pdf-btn').click()
  await expect(page.locator('#report-panel')).toBeVisible()
  for (const [k, v] of Object.entries(details)) await page.locator('#rp-' + k).fill(v)
  const [report] = await Promise.all([context.waitForEvent('page'), page.locator('#rp-go').click()])
  await report.waitForLoadState('domcontentloaded')
  return report
}

test('calculation report contains project details, results, drawing and suggestions', async ({ page, context }) => {
  await openSite(page)
  await page.evaluate(() => document.querySelector('#card-grid [data-open="eqf"]').click())
  const report = await makeReport(page, context, { project: 'Office fit-out', location: 'Makati City', prepared: 'J. A. B.', checked: 'Checker' })
  await expect(report).toHaveTitle(/MTB-\d{8}-DUCT\d{3} — Equal Friction Duct Calculator/)
  await expect(report.locator('.meta')).toContainText('Office fit-out')
  await expect(report.locator('.meta')).toContainText('Makati City')
  await expect(report.locator('h2')).toHaveText(['01Design inputs', '02Method', '03Results', '04Drawing', '05Design suggestions', '06Codes & references', '07Notes & limitations'])
  await expect(report.locator('table.results')).toContainText('⌀ 350 mm')
  await expect(report.locator('.fig svg')).toHaveCount(1)
  await expect(report.locator('ul.sg li').first()).toContainText('Choose ⌀ 350 mm round')
  await expect(report.locator('.sign')).toContainText('J. A. B.')
})

test('report remembers project details and shows the code basis', async ({ page, context }) => {
  await openSite(page)
  await setCode(page, 'ph')
  await page.evaluate(() => document.querySelector('#card-grid [data-open="elec"]').click())
  const first = await makeReport(page, context, { project: 'Tower A' })
  await expect(first.locator('.meta')).toContainText('Philippines')
  await first.close()
  await page.locator('#pdf-btn').click()
  await expect(page.locator('#rp-project')).toHaveValue('Tower A')
})

test('wide calculators (Precise Cooling Load) report the hourly table and chart', async ({ page, context }) => {
  await openSite(page)
  await page.evaluate(() => document.querySelector('#card-grid [data-open="pcl"]').click())
  const report = await makeReport(page, context)
  await expect(report.locator('h2', { hasText: 'Drawing & chart' })).toHaveCount(1)
  await expect(report.locator('.extra table tbody tr')).toHaveCount(24)
  await expect(report.locator('table.inputs')).not.toContainText('Layer 1') // construction builder is excluded
})
