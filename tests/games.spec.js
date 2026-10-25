import { test, expect } from '@playwright/test'
import { openSite, SITE } from './helpers.js'

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

  test('spot the mistake — parts are named, the verdict notes wait until you answer', async ({ page }) => {
    await openGame(page, 'spot')
    await expect(page.locator('.sp-scene')).toContainText('In the picture')
    await expect(page.locator('.sp-look')).toBeVisible()
    await expect(page.locator('.sp-fig .pf-tp').first()).toBeVisible()
    for (const t of await page.locator('.sp-fig :is(.pf-tb, .pf-tg, .sp-only)').all()) await expect(t).toBeHidden()
    await page.keyboard.press('m')
    await expect(page.locator('.sp-fig :is(.pf-tb, .pf-tg)').first()).toBeVisible()
    await expect(page.locator('.sp-verdict')).toBeVisible()
    await expect(page.locator('.sp-verdict b')).toHaveText(/^(✓ Correct|✕ Not quite) — this is the (mistake|right way)\.$/)
    await expect(page.locator('.gm-bar')).toContainText(/Score [01] \/ 1/)
    await page.keyboard.press('n')
    await expect(page.locator('.sp-verdict')).toHaveCount(0)
    await page.locator('[data-gm="sp-answer"][data-v="good"]').click()
    await expect(page.locator('.gm-bar')).toContainText('/ 2')
  })

  test('symbol match — a wrong pair turns back, and remembering every card clears the board', async ({ page }) => {
    await openGame(page, 'match')
    const cards = page.locator('.mm-card')
    await expect(cards).toHaveCount(12)
    // a flipped card's label names it ("Gate valve symbol" or "Gate valve"), so play like someone with a perfect memory
    const name = async (i) => (await cards.nth(i).getAttribute('aria-label')).replace(/, matched$/, '').replace(/ symbol$/, '')
    const seen = new Map(), done = new Set() // seen: card → name, for cards turned back face down
    const flip = async (i) => { await cards.nth(i).click(); await expect(cards.nth(i)).toHaveClass(/open/); return name(i) }
    const partner = (n, not) => [...seen].find(([k, v]) => v === n && k !== not && !done.has(k))
    const pair = async (i, j) => { await flip(i); await flip(j); done.add(i).add(j); seen.delete(i); seen.delete(j) }
    while (done.size < 12) {
      const known = [...seen].find(([k, v]) => partner(v, k)) // a pair already remembered
      if (known) { await pair(known[0], partner(known[1], known[0])[0]); continue }
      const i = [...Array(12).keys()].find((k) => !done.has(k) && !seen.has(k))
      const a = await flip(i)
      const p = partner(a, i)
      if (p) { await flip(p[0]); done.add(i).add(p[0]); seen.delete(p[0]); continue }
      const j = [...Array(12).keys()].find((k) => k !== i && !done.has(k) && !seen.has(k))
      const b = await flip(j)
      if (a === b) { done.add(i).add(j); continue }
      await expect(cards.nth(i)).not.toHaveClass(/open/) // no match: both turn back
      seen.set(i, a).set(j, b)
    }
    await expect(page.locator('#mm-msg')).toContainText('All matched in')
    await page.locator('[data-gm="mm-next"]').click()
    await expect(cards).toHaveCount(16) // level 2: 8 pairs
  })

  test('phase balance — loads move between phases, and the best split wins', async ({ page }) => {
    await openGame(page, 'phase')
    const loads = await page.locator('.pb-tray .pb-load').evaluateAll((bs) => bs.map((b) => ({ i: +b.dataset.i, a: parseInt(b.querySelector('b').textContent, 10) })))
    expect(loads.length).toBe(6)
    // tap a load, tap L2 — then take it back off with 0
    await page.locator(`.pb-load[data-i="${loads[0].i}"]`).click()
    await page.locator('.pb-col[data-ph="1"]').click()
    await expect(page.locator('.pb-col[data-ph="1"] .pb-load')).toHaveCount(1)
    await page.locator(`.pb-load[data-i="${loads[0].i}"]`).click()
    await page.keyboard.press('0')
    await expect(page.locator('.pb-tray .pb-load')).toHaveCount(6)
    // the best split, found the long way
    let best = null
    for (let m = 0; m < 3 ** loads.length; m++) {
      const s = [0, 0, 0], ph = []
      for (let k = 0, x = m; k < loads.length; k++, x = Math.floor(x / 3)) { ph.push(x % 3); s[x % 3] += loads[k].a }
      const avg = (s[0] + s[1] + s[2]) / 3, v = (Math.max(...s) - avg) / avg
      if (!best || v < best.v - 1e-12) best = { v, ph }
    }
    for (let k = 0; k < loads.length; k++) {
      await page.locator(`.pb-load[data-i="${loads[k].i}"]`).click()
      await page.keyboard.press(String(best.ph[k] + 1))
    }
    await expect(page.locator('#pb-msg')).toContainText('the best possible')
    await page.locator('[data-gm="pb-next"]').click()
    await expect(page.locator('.pb-tray .pb-load')).toHaveCount(7)
  })

  test('term scramble — typing, a wrong order, showing the answer and hints', async ({ page }) => {
    await openGame(page, 'scramble')
    await expect(page.locator('.ts-clue')).toContainText('letters)')
    const pool = (await page.locator('.ts-tile').allTextContents()).join('')
    await page.keyboard.type(pool.toLowerCase()) // the scrambled order is never the answer
    await expect(page.locator('#ts-msg')).toHaveText('Not quite — tap a letter to take it back')
    await page.keyboard.press('Backspace')
    await expect(page.locator('.ts-slot.full')).toHaveCount(pool.length - 1)
    await page.locator('[data-gm="ts-skip"]').click()
    await expect(page.locator('#ts-msg')).toHaveText(/^It was [A-Z]+$/)
    await page.keyboard.press('Enter')
    await expect(page.locator('.ts-slot.full')).toHaveCount(0)
    while (await page.locator('[data-gm="ts-hint"]').count()) await page.locator('[data-gm="ts-hint"]').click()
    await expect(page.locator('#ts-msg')).toHaveText(/^Solved — with \d+ hints?$/)
    await expect(page.locator('.gm-bar')).toContainText('Solved 1 / 2')
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

test('spot the mistake — the daily challenge is the same five drawings for everyone, once a day', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T09:00:00'))
  const errors = await openSite(page, 'utilities')
  await page.locator('#utilities [data-open="spot"]').click()
  await page.locator('[data-gm="sp-mode"][data-m="daily"]').click()
  await expect(page.locator('.gm-bar')).toContainText('2026-10-25')
  const titles = []
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('.gm-bar')).toContainText(`${i + 1} / 5`)
    await page.keyboard.press('m')
    titles.push((await page.locator('.sp-verdict strong').textContent()).replace(/\.$/, ''))
    await page.keyboard.press('n')
  }
  await expect(page.locator('.sp-day-score')).toHaveText(/^[0-5] \/ 5$/)
  await expect(page.locator('.sp-day-grid')).toHaveText(/^[🟩🟥]{5}$/u)
  expect((await page.locator('.sp-day-list li .linkish').allTextContents())).toEqual(titles)
  // one try a day: reopening shows the result, not a new round
  await page.evaluate(() => document.getElementById('modal').close())
  await page.locator('#utilities [data-open="spot"]').click()
  await expect(page.locator('.sp-day-score')).toBeVisible()
  expect(errors).toEqual([])

  // someone else on the same day gets the same drawings, straight from a shared link
  const other = await browser.newContext()
  const p2 = await other.newPage()
  await p2.clock.setFixedTime(new Date('2026-10-25T20:00:00'))
  await p2.goto(SITE + '?play=daily')
  await expect(p2.locator('#m-title')).toHaveText('Spot the Mistake')
  await p2.keyboard.press('r')
  await expect(p2.locator('.sp-verdict strong')).toHaveText(titles[0] + '.')
  await other.close()
})
