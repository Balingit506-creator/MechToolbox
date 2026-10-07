import { test, expect } from '@playwright/test'
import { openSite, closeCalc } from './helpers.js'

// Wide tables (room schedule, BOQ) must scroll inside their own box — the page itself never scrolls sideways.
for (const width of [390, 600, 1280]) {
  test(`no horizontal page overflow at ${width}px with a project and the BOQ open`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await openSite(page)
    await page.locator('#pj-new-name').fill('Office L3')
    await page.locator('#pj-create').click()
    await page.locator('#pj-r-l').fill('12.5')
    await page.locator('#pj-r-w').fill('8')
    await page.locator('#pj-r-p').fill('10')
    await page.locator('#pj-r-ds').fill('20')
    await page.locator('#pj-form button[type="submit"]').click()
    for (let i = 0; i < 6; i++) {
      await page.locator('.pj-next').click()
      await page.locator('#pj-save').click()
      await closeCalc(page)
    }
    await page.locator('#pj-boq-btn').click()
    await expect(page.locator('#pj-boq')).toBeVisible()
    const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(scroll).toBe(client)
    // the export buttons stay inside the window
    for (const id of ['#boq-pdf', '#boq-csv', '#bom-csv', '#pj-ahu']) {
      const box = await page.locator(id).boundingBox()
      expect(box.x + box.width, id + ' is cut off').toBeLessThanOrEqual(client)
    }
  })
}
