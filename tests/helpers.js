import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'

export const SITE = pathToFileURL(resolve('index.html')).href

// Open the site on one of its views (default: Calculators) and fail the test on any script error.
export async function openSite(page, view = 'calculators') {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(SITE + (view ? '#' + view : ''))
  await expect(page.locator('#card-grid .card')).toHaveCount(131)
  return errors
}

// Switch to another view — Home ('top'), 'calculators', 'guide', 'projects', 'estimate', 'utilities', 'standards', 'about' — like the header links do.
export async function show(page, view) {
  await page.evaluate((v) => { location.hash = v }, view)
  await expect(page.locator('#' + view)).toBeVisible()
}

export async function openCalc(page, id) {
  const btn = page.locator(`#card-grid [data-open="${id}"]`)
  if (await btn.isVisible()) await btn.click()
  else await page.evaluate((x) => (document.querySelector('#card-grid [data-open="' + x + '"]') || document.querySelector('[data-open="' + x + '"]')).click(), id) // another view, or a utility
  await expect(page.locator('#modal')).toBeVisible()
}

export async function closeCalc(page) {
  await page.evaluate(() => document.getElementById('modal').close())
}

// Set a calculator field (text input or select) the way a user would.
export async function setField(page, id, key, value) {
  const el = page.locator(`#f-${id}-${key}`)
  if ((await el.evaluate((n) => n.tagName)) === 'SELECT') await el.selectOption(value)
  else await el.fill(String(value))
}

// Result rows as [{ label, text, sub }] — text is the value, sub the small note under it.
export async function rows(page) {
  return page.locator('#r-rows > div').evaluateAll((divs) => divs.map((d) => {
    const dd = d.querySelector('dd'), sub = dd.querySelector('.sub')
    return { label: d.querySelector('dt').textContent.trim(), text: (dd.firstChild ? dd.firstChild.textContent : '').trim(), sub: sub ? sub.textContent.trim() : '' }
  }))
}

// Value of the first row with this label.
export async function row(page, label) {
  const r = (await rows(page)).find((x) => x.label === label)
  if (!r) throw new Error(`No result row "${label}"`)
  return r.text
}

export async function suggestions(page) {
  return page.locator('#r-sugg li').allTextContents()
}

export async function setSystem(page, sys) {
  await page.locator(`.site-header button[data-sys="${sys}"]`).click()
}

// Pick the code basis on the Standards view, then return to the view the test was on.
export async function setCode(page, code) {
  const back = await page.evaluate(() => document.body.dataset.view)
  await show(page, 'standards')
  await page.locator(`#std-ph .codeb button[data-code="${code}"]`).click()
  await show(page, back)
}
