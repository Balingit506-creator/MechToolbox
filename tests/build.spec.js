import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' }
// Serve dist/ under any made-up address, as if the site were hosted there.
async function host(page, origin) {
  await page.route(origin + '/**', (route) => {
    let p = decodeURIComponent(new URL(route.request().url()).pathname)
    if (p.endsWith('/')) p += 'index.html'
    const f = join('dist', p)
    if (!existsSync(f)) return route.fulfill({ status: 404, body: 'not found' })
    return route.fulfill({ status: 200, contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) })
  })
}
const build = (env = {}) => execSync('npm run build', { stdio: 'pipe', env: { ...process.env, ...env } })

test.describe.configure({ mode: 'serial' })

test('npm run build makes the minified assets and one page per calculator — and no offline app', async () => {
  test.setTimeout(180_000)
  build()
  const assets = readdirSync('dist/assets')
  expect(assets.filter((f) => /^app-[0-9a-f]{10}\.js$/.test(f))).toHaveLength(1)
  expect(assets.filter((f) => /^app-[0-9a-f]{10}\.css$/.test(f))).toHaveLength(1)
  const home = readFileSync('dist/index.html', 'utf8')
  expect(home.length).toBeLessThan(150_000) // the scripts and styles are separate, cached files
  expect(home).toMatch(/<script src="assets\/app-[0-9a-f]{10}\.js"><\/script>/)
  expect(home).not.toContain('manifest')
  expect(existsSync('dist/sw.js')).toBe(false)
  expect(existsSync('dist/manifest.webmanifest')).toBe(false)

  expect(readdirSync('dist/calculators')).toHaveLength(131)
  const duct = readFileSync('dist/calculators/duct-size-calculator/index.html', 'utf8')
  expect(duct).toContain('<title>Duct Size Calculator — Free Online Calculator | MechToolBox</title>')
  expect(duct).toContain('<h1 id="calc-title">Duct Size Calculator</h1>')
  expect(duct).toMatch(/src="\.\.\/\.\.\/assets\/app-/)
  expect(readFileSync('dist/robots.txt', 'utf8')).toMatch(/User-agent: HTTrack\nDisallow: \//)
})

test('a saved copy opened from disk shows the online-only notice, not the tools', async ({ page }) => {
  await page.goto(pathToFileURL(join(process.cwd(), 'dist/index.html')).href)
  await expect(page.locator('#mt-lock')).toContainText('MechToolBox only runs online')
  await expect(page.locator('#card-grid')).toHaveCount(0)
})

test('with SITE_URL set, the site runs on its own domain only — not on a mirror or inside another site', async ({ page, browser }) => {
  test.setTimeout(180_000)
  build({ SITE_URL: 'https://mechtoolbox.example/' })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await host(page, 'https://mechtoolbox.example')
  await page.goto('https://mechtoolbox.example/#calculators')
  await expect(page.locator('#card-grid .card')).toHaveCount(131)
  // Ctrl+S is caught with a hint instead of saving the page
  await page.keyboard.press('Control+s')
  await expect(page.locator('#toast')).toContainText('bookmark it')
  expect(errors).toEqual([])

  const mirror = await browser.newPage()
  await host(mirror, 'https://copycat.example')
  await mirror.goto('https://copycat.example/')
  await expect(mirror.locator('#mt-lock')).toContainText('mechtoolbox.example')
  await expect(mirror.locator('#mt-lock a')).toHaveAttribute('href', 'https://mechtoolbox.example/')

  const framer = await browser.newPage()
  await host(framer, 'https://mechtoolbox.example')
  await framer.route('https://other.example/**', (r) => r.fulfill({ contentType: 'text/html', body: '<iframe src="https://mechtoolbox.example/" style="width:800px;height:600px"></iframe>' }))
  await framer.goto('https://other.example/')
  await expect(framer.frameLocator('iframe').locator('#mt-lock')).toBeVisible()
  build() // leave the normal build behind
})
