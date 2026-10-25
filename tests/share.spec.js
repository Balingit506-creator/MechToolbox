import { test, expect } from '@playwright/test'
import { openSite, openCalc, setField, setCode, SITE } from './helpers.js'

test('a shared link opens the calculator with the same inputs, units and code basis', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const errors = await openSite(page)
  await setCode(page, 'ph')
  await openCalc(page, 'duct')
  await setField(page, 'duct', 'q', '2400')
  await page.locator('#f-duct-ar').selectOption('3')
  await page.locator('#share-btn').click()
  await expect(page.locator('#share-btn')).toHaveText('Link copied ✓')
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/\?calc=duct&sys=si&code=ph&q=2400&v=4&ar=3/)
  expect(errors).toEqual([])

  // someone else, with imperial units saved, opens the link
  const other = await browser.newContext()
  const p2 = await other.newPage()
  await p2.goto(SITE)
  await p2.evaluate(() => localStorage.setItem('mechtoolbox-sys', 'imp'))
  const errors2 = []
  p2.on('pageerror', (e) => errors2.push(e.message))
  await p2.goto(SITE + url.slice(url.indexOf('?')))
  await expect(p2.locator('#modal')).toBeVisible()
  await expect(p2.locator('#m-title')).toHaveText('Duct Size Calculator')
  await expect(p2.locator('#f-duct-q')).toHaveValue('2400')
  await expect(p2.locator('#f-duct-ar')).toHaveValue('3')
  await expect(p2.locator('.site-header .sys button[data-sys="si"]')).toHaveAttribute('aria-pressed', 'true')
  expect(new URL(p2.url()).search).toBe('') // the address is tidied once the link is applied
  expect(errors2).toEqual([])
  await other.close()
})

test('a link keeps the value when the sender picked another unit', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openSite(page)
  await openCalc(page, 'duct')
  const unit = page.locator('#f-duct-q-u')
  if (await unit.evaluate((el) => el.tagName) !== 'SELECT') test.skip(true, 'airflow has no unit choice')
  const opts = await unit.locator('option').allTextContents()
  const alt = opts.find((o) => /L\/s/.test(o))
  test.skip(!alt, 'no L/s option')
  await unit.selectOption({ label: alt })
  await setField(page, 'duct', 'q', '1000') // 1,000 L/s = 3,600 m³/h, the built-in SI unit
  await page.locator('#share-btn').click()
  const url = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toContain('&q=3600&')
  const other = await browser.newContext()
  const p2 = await other.newPage()
  await p2.goto(SITE + url.slice(url.indexOf('?')))
  await expect(p2.locator('#f-duct-q')).toHaveValue('3600')
  await other.close()
})
