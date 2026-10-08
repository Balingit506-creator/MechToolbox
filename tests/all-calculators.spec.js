import { test, expect } from '@playwright/test'
import { openSite, closeCalc, setSystem, setCode } from './helpers.js'

// Every calculator must open and produce a result (or its own validation message) without script errors,
// in both unit systems and under every code basis.
for (const sys of ['si', 'imp']) {
  for (const code of ['intl', 'ph', 'au', 'us']) {
    test(`every calculator works — ${sys.toUpperCase()} / ${code.toUpperCase()}`, async ({ page }) => {
      test.setTimeout(240_000)
      const errors = await openSite(page)
      if (sys === 'imp') await setSystem(page, 'imp')
      if (code !== 'intl') await setCode(page, code)
      const ids = await page.locator('#card-grid .card [data-open]').evaluateAll((b) => b.map((x) => x.dataset.open))
      expect(ids).toHaveLength(66)
      const empty = []
      for (const id of ids) {
        await page.evaluate((x) => document.querySelector('#card-grid [data-open="' + x + '"]').click(), id) // open directly, no scrolling
        const n = await page.locator('#m-body #r-rows > div').count()
        if (!n) empty.push(id)
        const err = page.locator('#m-body #r-err')
        if (await err.count()) await expect(err, `${id} shows an input error with default values`).toBeHidden()
        await closeCalc(page)
      }
      expect(empty, 'calculators with no result rows').toEqual([])
      expect(errors).toEqual([])
    })
  }
}
