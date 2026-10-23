import { test, expect } from '@playwright/test'
import { openSite } from './helpers.js'

async function openGame(page, id) {
  await page.locator(`#utilities [data-open="${id}"]`).click()
  await expect(page.locator('#modal')).toBeVisible()
}

// Read the puzzle off the page: each piece's openings (N 1, E 2, S 4, W 8) and how many quarter turns it has had.
async function readPuzzle(page) {
  return page.evaluate(() => {
    const ends = { '20 0': 1, '40 20': 2, '20 40': 4, '0 20': 8 }
    const cells = [...document.querySelectorAll('.pp-cell')].map((b) => {
      const d = b.querySelector('.pp-wall').getAttribute('d')
      const m0 = [...d.matchAll(/L(\d+ \d+)/g)].reduce((m, x) => m | ends[x[1]], 0)
      return { m0, rot: parseInt(b.style.getPropertyValue('--a'), 10) / 90 }
    })
    const r = (sel) => +getComputedStyle(document.querySelector(sel)).getPropertyValue('--r')
    return { n: Math.sqrt(cells.length), cells, src: r('.pp-in'), drain: r('.pp-out') }
  })
}

// Depth-first search for a route from the supply to the drain; returns the quarter turns each piece on it needs.
function solve({ n, cells, src, drain }) {
  const rot = (m, k) => { for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15; return m }
  const DIRS = [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]] // bit out, dr, dc, bit in on the neighbour
  const seen = new Set(), turns = {}
  const go = (i, inBit) => {
    seen.add(i)
    for (let k = 0; k < 4; k++) {
      const m = rot(cells[i].m0, k)
      if (!(m & inBit)) continue
      turns[i] = k
      if (i === drain * n + n - 1 && (m & 2)) return true
      for (const [b, dr, dc, back] of DIRS) {
        const r = Math.floor(i / n) + dr, c = (i % n) + dc, j = r * n + c
        if (b === inBit || !(m & b) || r < 0 || r >= n || c < 0 || c >= n || seen.has(j)) continue
        if (go(j, back)) return true
      }
    }
    delete turns[i]; seen.delete(i)
    return false
  }
  if (!go(src * n, 8)) throw new Error('puzzle has no solution')
  return turns
}

test.describe('games', () => {
  test.beforeEach(async ({ page }) => { await openSite(page, 'utilities') })

  test('pipe puzzle — clicks turn pieces, and the solved puzzle offers the next level', async ({ page }) => {
    await openGame(page, 'pipes')
    await expect(page.locator('#m-sys')).toBeHidden() // no units or code basis in a game
    await expect(page.locator('#modal .codeb')).toBeHidden()
    await expect(page.locator('.pp-cell')).toHaveCount(25)

    const before = await page.locator('.pp-cell').first().evaluate((b) => b.style.getPropertyValue('--a'))
    await page.locator('.pp-cell').first().click()
    await expect(page.locator('#pp-moves')).toHaveText('1')
    expect(await page.locator('.pp-cell').first().evaluate((b) => b.style.getPropertyValue('--a'))).toBe(parseInt(before, 10) + 90 + 'deg')

    // the arrow keys move between pieces
    await page.locator('.pp-cell').first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator('.pp-cell').nth(1)).toBeFocused()

    const puzzle = await readPuzzle(page)
    const turns = solve(puzzle)
    for (const [i, k] of Object.entries(turns)) {
      for (let t = (k - (puzzle.cells[i].rot % 4) + 4) % 4; t > 0; t--) {
        if (await page.locator('#pp-msg').textContent()) break // water reached the drain early
        await page.locator('.pp-cell').nth(+i).click()
      }
    }
    await expect(page.locator('#pp-msg')).toContainText('Solved in')
    await expect(page.locator('.pp-out')).toHaveClass(/wet/)
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('mechtoolbox-games')).best.pp1)).toBeGreaterThan(0)

    await page.locator('[data-gm="pp-next"]').click()
    await expect(page.locator('.pp-cell')).toHaveCount(36) // level 2 is 6 × 6
    await page.locator('[data-gm="pp-new"]').click()
    await expect(page.locator('#pp-moves')).toHaveText('0')
  })

  test('spot the mistake — the labels stay hidden until you answer', async ({ page }) => {
    await openGame(page, 'spot')
    await expect(page.locator('.sp-fig text').first()).toBeHidden()
    await page.keyboard.press('m')
    await expect(page.locator('.sp-verdict')).toBeVisible()
    await expect(page.locator('.sp-verdict b')).toHaveText(/^(✓ Correct|✕ Not quite) — this is the (mistake|right way)\.$/)
    await expect(page.locator('.gm-bar')).toContainText(/Score [01] \/ 1/)
    await page.keyboard.press('n')
    await expect(page.locator('.sp-verdict')).toHaveCount(0)
    await page.locator('[data-gm="sp-answer"][data-v="good"]').click()
    await expect(page.locator('.gm-bar')).toContainText('/ 2')
  })
})

test('unit sprint — answer with the keys, and the round ends after 60 s', async ({ page }) => {
  await page.clock.install()
  const errors = await openSite(page, 'utilities')
  await openGame(page, 'sprint')
  await page.locator('[data-gm="us-start"]').click()
  await expect(page.locator('#us-time')).toHaveText('60 s')
  const q = await page.locator('#us-q').textContent()
  await page.keyboard.press('1')
  await expect(page.locator('#us-msg')).toHaveText(/^(Correct|It was .+)$/)
  await page.clock.runFor(1200)
  await expect(page.locator('.us-choice').first()).toBeEnabled() // the next question
  expect(await page.locator('#us-q').textContent()).toBeTruthy()
  expect(q).toMatch(/ = \? /)

  await page.clock.runFor(60000)
  await expect(page.locator('.us-final')).toContainText('correct')
  await expect(page.locator('.us-start .m-desc')).toContainText('1 answered')
  await expect(page.locator('[data-gm="us-start"]')).toHaveText(/Play again/)

  // a round left halfway starts over next time
  await page.locator('[data-gm="us-start"]').click()
  await page.evaluate(() => document.getElementById('modal').close())
  await openGame(page, 'sprint')
  await expect(page.locator('[data-gm="us-start"]')).toHaveText(/Play again|Start/)
  await expect(page.locator('.us-choice')).toHaveCount(0)
  expect(errors).toEqual([])
})
