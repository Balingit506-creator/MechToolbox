import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { openSite } from './helpers.js'

test('no ads load in an automated (test) browser', async ({ page }) => {
  await openSite(page, 'top')
  await expect(page.locator('.ad-slot:not([hidden])')).toHaveCount(0)
  await expect(page.locator('iframe.ad-frame')).toHaveCount(0)
  await expect(page.locator('body > script[src*="58ae293542b30c60805187f5eac6be77"]')).toHaveCount(0) // Social Bar not injected
})

// The live Native Banner template; tests never call the real ad server.
const NATIVE = /<template data-ad="([^"]*)" data-size="auto"[^>]*>[\s\S]*?<\/template>/

// A copy of the site with dummy codes pasted into the templates, loaded as a normal (non-automated) browser would.
function siteFile(html) {
  const file = join(mkdtempSync(join(tmpdir(), 'mtb-ads-')), 'index.html')
  writeFileSync(file, html)
  return pathToFileURL(file).href
}
function siteWithAds() {
  let html = readFileSync(resolve('index.html'), 'utf8').replace(NATIVE, '') // test the fixed-size banners on their own
  html = html.replace(/<script src="https:\/\/[^"]+\/94cabf42639f417dd7c1dba17450e483"><\/script>/, '<script>document.write(\'<div class="fake-ad">AD 320 \' + atOptions.width + \'x\' + atOptions.height + \'</div>\')</script>') // stand-in for the live 320x50 script
  html = html.replace(/<script src="https:\/\/[^"]+\/5242aee04730c2507cd1ad2241469a2b"><\/script>/, `<script>document.write('<div class="fake-ad">AD 728 ' + atOptions.width + 'x' + atOptions.height + '</div>')</script>`) // stand-in for the live 728x90 script
    .replace('<!-- paste a 300x250 banner code here -->', '<div class="fake-ad">AD 300</div>')
    .replace(/<script data-cfasync="false" src="https:\/\/[^"]+\/58ae293542b30c60805187f5eac6be77"><\/script>/, '<script data-cfasync="false">window.__socialBar = (window.__socialBar || 0) + 1</script>') // stand-in for the live Social Bar script
  return siteFile(html)
}

test('the Native Banner runs in the page once and follows the view and the calculator window', async ({ page }) => {
  const html = readFileSync(resolve('index.html'), 'utf8')
  const live = html.match(NATIVE)
  expect(live, 'native banner template').not.toBeNull()
  expect(live[0].replace(/<!--[\s\S]*?-->/g, '').replace(/<\/?template[^>]*>/g, '').trim(), 'the live native banner is switched off').toBe('')
  // a stand-in native code that fills its container a moment later, like the real one
  const fake = `<template data-ad="home calc-result pitfalls standards" data-size="auto" data-media="all"><div id="container-4ac7cb50622a8d6588263c9b3708ebf2"></div><script>setTimeout(function () { var c = document.getElementById('container-4ac7cb50622a8d6588263c9b3708ebf2'); c.style.height = '240px'; c.textContent = 'NATIVE'; window.__nativeRuns = (window.__nativeRuns || 0) + 1; }, 300)</script></template>`
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  await page.goto(siteFile(html.replace(NATIVE, () => fake)) + '#top')
  const C = '#container-4ac7cb50622a8d6588263c9b3708ebf2'
  await page.locator('.ad-slot[data-ad-slot="home"]').scrollIntoViewIfNeeded()
  await expect(page.locator('.ad-slot[data-ad-slot="home"] ' + C)).toHaveText('NATIVE') // in the page, not in a frame
  await expect(page.locator('.ad-slot[data-ad-slot="home"] iframe')).toHaveCount(0)
  const box = await page.locator(C).boundingBox(), slot = await page.locator('.ad-slot[data-ad-slot="home"]').boundingBox()
  expect(box.width).toBeGreaterThan(slot.width - 2) // full width
  // moves to Pitfalls with the view
  await page.evaluate(() => { location.hash = 'pitfalls' })
  await expect(page.locator('.ad-slot[data-ad-slot="pitfalls"] ' + C)).toHaveText('NATIVE')
  // into a calculator window and back out
  await page.evaluate(() => { location.hash = 'calculators' })
  await page.locator('#card-grid [data-open="duct"]').click()
  await expect(page.locator('#modal .ad-slot ' + C)).toHaveText('NATIVE')
  await page.locator('#m-close').click()
  await page.evaluate(() => { location.hash = 'standards' })
  await expect(page.locator('.ad-slot[data-ad-slot="standards"] ' + C)).toHaveText('NATIVE')
  await expect(page.locator(C)).toHaveCount(1) // only ever one container
  expect(await page.evaluate(() => window.__nativeRuns)).toBe(1) // the ad code ran once
  expect(errors).toEqual([])
})

test('fixed-size codes fill their slots in their own frames, and page-level codes run once', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }))
  await page.goto(siteWithAds() + '#top')
  // Home banner (desktop size) loads in its slot
  const home = page.locator('.ad-slot[data-ad-slot="home"]')
  await home.scrollIntoViewIfNeeded()
  await expect(home.locator('iframe.ad-frame')).toHaveAttribute('width', '728')
  await expect.poll(() => home.locator('iframe.ad-frame').evaluate((f) => f.contentDocument.body.textContent)).toContain('AD 728 728x90')
  // empty templates leave their slots hidden
  await expect(page.locator('.ad-slot[data-ad-slot="calc-side"]')).toBeHidden()
  // the 320x50 banner shows above the calculator list, with its own atOptions inside its frame
  await page.evaluate(() => { location.hash = 'calculators' })
  const top = page.locator('.ad-slot[data-ad-slot="calc-top"] iframe.ad-frame')
  await expect(top).toHaveAttribute('width', '320')
  await expect(top).toHaveAttribute('height', '50')
  await expect.poll(() => top.evaluate((f) => f.contentDocument.body.textContent)).toContain('AD 320 320x50')
  // the 300x250 shows under the result in a calculator window
  await page.locator('#card-grid [data-open="duct"]').click()
  await page.locator('#modal .ad-slot').scrollIntoViewIfNeeded() // it loads when scrolled to
  await expect(page.locator('#modal .ad-slot iframe.ad-frame')).toHaveAttribute('height', '250')
  // page-level code (Social Bar) runs once in the page
  expect(await page.evaluate(() => window.__socialBar)).toBe(1)
  expect(errors).toEqual([])
})
