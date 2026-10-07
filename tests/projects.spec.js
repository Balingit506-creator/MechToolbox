import { test, expect } from '@playwright/test'
import { openSite, closeCalc, row } from './helpers.js'

async function createProjectWithRoom(page) {
  await page.locator('#pj-new-name').fill('Office L3')
  await page.locator('#pj-create').click()
  await page.locator('#pj-r-name').fill('Open office')
  await page.locator('#pj-r-l').fill('12.5')
  await page.locator('#pj-r-w').fill('8')
  await page.locator('#pj-r-h').fill('3')
  await page.locator('#pj-r-p').fill('10')
  await page.locator('#pj-form button[type="submit"]').click()
  await expect(page.locator('.pj-table tbody tr')).toHaveCount(1)
}

// Open the room's next design step, save the result to the room, close.
async function doNextStep(page, expectedTitle) {
  await page.locator('.pj-next').click()
  await expect(page.locator('#m-title')).toHaveText(expectedTitle)
  await page.locator('#pj-save').click()
  await expect(page.locator('#pj-msg')).toHaveText('✓ Saved to Open office')
  await closeCalc(page)
}

test('a room carries results along the design chain', async ({ page }) => {
  const errors = await openSite(page)
  await createProjectWithRoom(page)
  await expect(page.locator('.pj-next')).toHaveText('Next: Cooling load →')

  // 1. Cooling load is filled from the room (100 m², 10 people).
  await page.locator('.pj-next').click()
  await expect(page.locator('#f-cool-area')).toHaveValue('100')
  await expect(page.locator('#f-cool-n')).toHaveValue('10')
  await page.locator('#pj-save').click()
  await closeCalc(page)
  const supply = (await page.locator('.pj-table tbody td').nth(1).textContent()).trim()
  expect(supply).toMatch(/m³\/h$/)

  // 2. Outdoor air gets the area and people.
  await page.locator('.pj-next').click()
  await expect(page.locator('#f-oa-a')).toHaveValue('100')
  await expect(page.locator('#f-oa-p')).toHaveValue('10')
  await page.locator('#pj-save').click()
  await closeCalc(page)

  // 3. Diffusers get the room size and the supply airflow from the cooling load.
  await page.locator('.pj-next').click()
  await expect(page.locator('#f-ndiff-l')).toHaveValue('12.5')
  await expect(page.locator('#f-ndiff-w')).toHaveValue('8')
  const q = Number(await page.locator('#f-ndiff-q').inputValue())
  expect(Math.abs(q - Number(supply.replace(/[^\d.]/g, '')))).toBeLessThan(1)
  await page.locator('#pj-save').click()
  await closeCalc(page)

  // 4–6. Duct, pressure and fan.
  await doNextStep(page, 'Equal Friction Duct Calculator')
  await doNextStep(page, 'Total Pressure Loss Calculator')
  await page.locator('.pj-next').click()
  await expect(page.locator('#m-title')).toHaveText('Supply Fan Calculator')
  expect(Number(await page.locator('#f-fsup-q').inputValue())).toBeCloseTo(q, 0)
  await page.locator('#pj-save').click()
  await closeCalc(page)

  await expect(page.locator('.pj-done')).toHaveText('✓ Chain complete')
  await expect(page.locator('.pj-step.done')).toHaveCount(6)
  await expect(page.locator('.pj-table tfoot')).toContainText('TR')
  await expect(page.locator('#pj-ahu')).toBeVisible()
  expect(errors).toEqual([])
})

test('projects persist after reload and the AHU button sizes the total', async ({ page }) => {
  await openSite(page)
  await createProjectWithRoom(page)
  await page.locator('.pj-next').click()
  await page.locator('#pj-save').click()
  await closeCalc(page)
  await page.reload()
  await expect(page.locator('#pj-select')).toHaveValue(/.+/)
  await expect(page.locator('.pj-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.pj-step.done')).toHaveCount(1)
  await page.locator('#pj-ahu').click()
  await expect(page.locator('#m-title')).toHaveText('Supply Fan Calculator')
  expect(await row(page, 'Motor size')).toMatch(/kW$/)
})

test('a project backs up to a JSON file', async ({ page }) => {
  await openSite(page)
  await createProjectWithRoom(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#pj-export').click()])
  expect(download.suggestedFilename()).toBe('Office-L3.mechtoolbox.json')
})

test('room schedule exports as an Excel-ready CSV', async ({ page }) => {
  await openSite(page)
  await createProjectWithRoom(page)
  await page.locator('.pj-next').click() // cooling load
  await page.locator('#pj-save').click()
  await closeCalc(page)
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#pj-csv').click()])
  expect(download.suggestedFilename()).toBe('Office-L3-room-schedule.csv')
  const text = (await (await download.createReadStream()).toArray()).join('')
  expect(text.charCodeAt(0)).toBe(0xfeff) // BOM so Excel reads UTF-8
  const lines = text.slice(1).split('\r\n')
  expect(lines).toContain('Project,Office L3')
  const head = lines.find((l) => l.startsWith('Room,')).split(',')
  const room = lines.find((l) => l.startsWith('Open office,')).split(',')
  expect(head[1]).toBe('Length (m)')
  expect(room.slice(1, 6)).toEqual(['12.5', '8', '3', '100', '10'])
  expect(Number(room[head.indexOf('Cooling load (kW)')])).toBeGreaterThan(0)
  expect(lines.some((l) => l.startsWith('Project total,'))).toBe(true)
})

test('project PDF report lists the rooms, totals and saved calculations', async ({ page, context }) => {
  await openSite(page)
  await createProjectWithRoom(page)
  await page.locator('.pj-next').click()
  await page.locator('#pj-save').click()
  await closeCalc(page)
  const [report] = await Promise.all([context.waitForEvent('page'), page.locator('#pj-pdf').click()])
  await report.waitForLoadState('domcontentloaded')
  await expect(report).toHaveTitle(/MTB-\d{8}-PRJ-OFFICEL3 — Office L3/)
  await expect(report.locator('h2')).toHaveText(['01Room schedule', '02Project totals & equipment', '03Room calculations', '04Notes & limitations'])
  await expect(report.locator('table.sched tbody tr')).toHaveCount(1)
  await expect(report.locator('table.sched tfoot')).toContainText('TR')
  await expect(report.locator('.room .chip.on')).toHaveText(['Cooling load'])
  await expect(report.locator('.room table.calcs')).toContainText('Cooling Load Calculator')
})
