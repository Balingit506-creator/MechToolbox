import { test, expect } from '@playwright/test'
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

// The production build: minified assets, one page per calculator, a working offline worker.
test('npm run build makes the assets, calculator pages and the offline worker', async () => {
  test.setTimeout(180_000)
  execSync('npm run build', { stdio: 'pipe' })
  const assets = readdirSync('dist/assets')
  expect(assets.filter((f) => /^app-[0-9a-f]{10}\.js$/.test(f))).toHaveLength(1)
  expect(assets.filter((f) => /^app-[0-9a-f]{10}\.css$/.test(f))).toHaveLength(1)
  const home = readFileSync('dist/index.html', 'utf8')
  expect(home.length).toBeLessThan(150_000) // the scripts and styles are separate, cached files
  expect(home).toMatch(/<script src="assets\/app-[0-9a-f]{10}\.js"><\/script>/)
  expect(home).toContain('application/ld+json')

  expect(readdirSync('dist/calculators')).toHaveLength(131)
  const duct = readFileSync('dist/calculators/duct-size-calculator/index.html', 'utf8')
  expect(duct).toContain('<title>Duct Size Calculator — Free Online Calculator | MechToolBox</title>')
  expect(duct).toContain('data-calc="duct" data-root="../../"')
  expect(duct).toContain('<h1 id="calc-title">Duct Size Calculator</h1>')
  expect(duct).toMatch(/src="\.\.\/\.\.\/assets\/app-/)

  const sw = readFileSync('dist/sw.js', 'utf8')
  expect(sw).not.toContain('__PRECACHE__')
  expect(sw).not.toContain('__VERSION__')
  expect(() => new Function(sw)).not.toThrow()
  expect(existsSync('dist/manifest.webmanifest')).toBe(true)
  expect(existsSync('dist/icons/icon-512.png')).toBe(true)
  expect(readFileSync('dist/robots.txt', 'utf8')).toContain('User-agent: *')
})
