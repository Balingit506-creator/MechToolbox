import { test, expect } from '@playwright/test'
import { openSite, show } from './helpers.js'

test('sun mode switches to the light theme and is remembered', async ({ page }) => {
  const errors = await openSite(page)
  const btn = page.locator('.site-header .icon-btn.theme-btn')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'sun')
  await btn.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sun')
  await expect(btn).toHaveAttribute('aria-pressed', 'true')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(247, 243, 234)')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sun') // applied before the page draws
  await page.locator('.site-header .icon-btn.theme-btn').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'sun')
  expect(errors).toEqual([])
})

test("What's new lists the changes and signs people up for updates", async ({ page }) => {
  const errors = await openSite(page)
  let sent = null
  await page.route('https://formspree.io/**', async (route) => { sent = route.request().postDataJSON(); await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }) })
  await page.locator('.ft-links a[href="#whatsnew"]').click()
  await expect(page.locator('#whatsnew')).toBeVisible()
  await expect(page.locator('.wn-log > li').first().locator('time')).toHaveText('2026-10-25')
  await page.locator('#wn-email').fill('nope')
  await page.locator('#wn-send').click()
  await expect(page.locator('#wn-msg')).toHaveText('Enter a valid email address.')
  await page.locator('#wn-email').fill('engr@example.com')
  await page.locator('#wn-send').click()
  await expect(page.locator('#wn-msg')).toHaveText('✓ Thanks — you are on the list.', { timeout: 15000 })
  expect(sent).toMatchObject({ email: 'engr@example.com', type: 'Notify me' })
  expect(errors).toEqual([])
})

test('cheat sheets open as printable pages', async ({ page, context }) => {
  const errors = await openSite(page, 'utilities')
  for (const [k, title, text] of [['hvac', 'HVAC Quick Reference', 'Duct velocities'], ['pipe', 'Pipe Size Data', '½ in · DN 15'], ['wire', 'Wire & Breaker Table', '12 AWG'], ['check', 'Design Pitfall Checklist', 'Branch duct cut into an elbow.']]) {
    const [sheet] = await Promise.all([context.waitForEvent('page'), page.locator(`[data-sheet="${k}"]`).click()])
    await sheet.waitForLoadState()
    await expect(sheet.locator('h1')).toHaveText(title)
    await expect(sheet.locator('body')).toContainText(text)
    await sheet.close()
  }
  expect(errors).toEqual([])
})

test('the phone menu has sun mode and the What\'s new link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await openSite(page)
  await page.locator('.menu-btn').click()
  await expect(page.locator('.nav-mobile a[href="#whatsnew"]')).toBeVisible()
  await page.locator('.nav-mobile .theme-menu').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sun')
  await show(page, 'calculators')
})
