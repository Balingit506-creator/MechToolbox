import { test, expect } from '@playwright/test'
import { openSite, closeCalc } from './helpers.js'

async function quickStart(page) {
  await page.locator('#gd-q-name').fill('Office L3')
  await page.locator('#gd-q-room').fill('Open office')
  await page.locator('#gd-q-l').fill('12.5')
  await page.locator('#gd-q-w').fill('8')
  await page.locator('#gd-q-p').fill('10')
  await page.locator('#gd-quick button[type="submit"]').click()
}

test('quick start creates the project and the first step opens the calculator filled from the room', async ({ page }) => {
  const errors = await openSite(page)
  await expect(page.locator('#gd-quick')).toBeVisible()
  await quickStart(page)
  await expect(page.locator('.gd-panel h3')).toHaveText('Cooling load')
  await expect(page.locator('.gd-tab[aria-pressed="true"]')).toContainText('HVAC0/6')
  await page.locator('#gd-open').click()
  await expect(page.locator('#m-title')).toHaveText('Cooling Load Calculator')
  await expect(page.locator('#f-cool-area')).toHaveValue('100')
  await expect(page.locator('#f-cool-n')).toHaveValue('10')
  await page.locator('#pj-save').click()
  await closeCalc(page)
  // the step is ticked off and the guide moves on to outdoor air
  await expect(page.locator('.gd-step.done')).toHaveCount(1)
  await expect(page.locator('.gd-panel h3')).toHaveText('Outdoor air')
  await expect(page.locator('.gd-tab[aria-pressed="true"]')).toContainText('1/6')
  // the finished step shows its saved result
  await page.locator('.gd-step', { hasText: 'Cooling load' }).click()
  await expect(page.locator('.gd-result')).toContainText('kW')
  // the room also appears in Projects
  await expect(page.locator('.pj-table tbody tr')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('workflows, code-basis targets, optional steps and the review step', async ({ page }) => {
  await openSite(page)
  await quickStart(page)
  await page.locator('#std-ph .codeb button[data-code="ph"]').click()
  await page.locator('.gd-tab', { hasText: 'Electrical' }).click()
  await expect(page.locator('.gd-panel h3')).toHaveText('Lighting')
  await expect(page.locator('.gd-panel')).toContainText('Philippine Green Building Code')
  await page.locator('#gd-open').click()
  await expect(page.locator('#f-light-l')).toHaveValue('12.5')
  await page.locator('#pj-save').click()
  await closeCalc(page)
  await expect(page.locator('.gd-panel h3')).toHaveText('Electrical load')
  // optional step offers Skip
  await page.locator('.gd-step', { hasText: 'Voltage drop check' }).click()
  await expect(page.locator('#gd-next')).toHaveText('Skip →')
  // review step opens the BOQ in Projects
  await page.locator('.gd-step', { hasText: 'Review & export' }).click()
  await page.locator('#gd-boq').click()
  await expect(page.locator('#pj-boq')).toBeVisible()
  await expect(page.locator('#pj-boq')).toContainText('LED luminaire')
})

test('the guide follows the active room', async ({ page }) => {
  await openSite(page)
  await quickStart(page)
  await page.locator('#gd-open').click()
  await page.locator('#pj-save').click()
  await closeCalc(page)
  await page.locator('#pj-r-name').fill('Meeting room')
  await page.locator('#pj-r-l').fill('6')
  await page.locator('#pj-r-w').fill('5')
  await page.locator('#pj-r-p').fill('8')
  await page.locator('#pj-form button[type="submit"]').click()
  await expect(page.locator('#gd-room')).toHaveValue(/.+/)
  await expect(page.locator('.gd-tab[aria-pressed="true"]')).toContainText('0/6') // new room, nothing done yet
  await page.locator('#gd-room').selectOption({ label: 'Open office' })
  await expect(page.locator('.gd-tab[aria-pressed="true"]')).toContainText('1/6')
})
