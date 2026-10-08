import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'

export const SITE = pathToFileURL(resolve('index.html')).href

// Open the site and fail the test on any script error.
export async function openSite(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(SITE)
  await expect(page.locator('#card-grid .card')).toHaveCount(74)
  return errors
}

export async function openCalc(page, id) {
  await page.locator(`[data-open="${id}"]`).first().click()
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

export async function setCode(page, code) {
  await page.locator(`#std-ph .codeb button[data-code="${code}"]`).click()
}
