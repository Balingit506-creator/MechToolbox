# MechToolBox

Engineering calculators for M·E·P·F·S design (mechanical, electrical, plumbing, fire protection, sanitary), with live drawings, design suggestions, printable PDF calculation reports, a step-by-step design guide (HVAC, electrical, plumbing & sanitary, fire), projects that carry room data from one calculator to the next, a bill of quantities for Electrical, Plumbing & Sanitary, Mechanical and Fire Protection in the standard QS format (material and labor costs, supervision & profit, contingencies, VAT) with a BOM, and code references for International, Philippine, Australian and US practice.

Refrigeration tools include cold-room load, product freezing load and time (blast freezers), evaporator and condensing-unit selection, refrigeration cycle and COP, a refrigerant P–T chart, superheat and subcooling, refrigerant pipe sizing, refrigerant charge safety (ASHRAE 15 / IEC 60335-2-40) and ice thermal storage.

Plumbing adds hot water recirculation, high-rise pressure zones (PRV), water hammer surge and swimming pool circulation and heating. Fire protection adds clean agent quantity (NFPA 2001), fire alarm battery standby, detector spacing and count (NFPA 72), occupant load and egress (IBC) and foam concentrate quantity (NFPA 11 / 16).

Also included: kitchen hood exhaust (IMC 507.13), cable tray fill (NEC 392.22), earth electrode resistance (Dwight / IEEE 142), voltage drop along a feeder with several loads, sewage treatment plant sizing (extended aeration) and compressed-air pipe sizing.

Hanger and support take-offs cover chilled water, ductwork, plumbing (IPC Table 308.5 spacing, riser clamps), fire sprinkler piping (NFPA 13 spacing and rod sizes, seismic sway braces) and refrigerant line sets (insulated liquid + suction lines, supports at bends) — supports, rod sizes and lengths, angle bar, clamps or saddles, anchors and cost.

The site works like an app: the header switches between views (Home, Calculators, Guide, Projects, Estimate, Utilities, Standards, About, and What's new from the footer) instead of one long page. Each view has its own address (`#calculators`, `#projects`…), so links and the Back button work. Calculators are grouped in a sidebar by category, open in a two-column window (inputs beside the result), and the last six you used are listed on Home and in the sidebar. **Share link** (next to Copy result) copies an address that opens the same calculator with the same inputs, unit system and code basis (`?calc=duct&sys=si&code=ph&q=2400…`; values are written in the built-in unit, so the receiver's own unit choices don't matter).

**Sun mode** (sun button in the header, or in the phone menu) switches to a light theme that stays readable outdoors; the choice is remembered.

The Design Pitfalls view shows 116 common design and installation mistakes across HVAC, plumbing, fire protection, electrical and refrigeration — such as a branch duct cut into an elbow, an intake beside an exhaust, an S-trap, a relief valve piped uphill, sprinklers blocked by a wide duct, a socket by a sink without GFCI, or brazing without nitrogen — each drawn beside the right way, with why it matters, the rule, the code reference and the calculator to check it. Search them or filter by discipline (the Codes & Standards view has its own search too); related calculators link to them from their window header.

The Utilities view groups 13 quick tools: unit converter, MEP references, slope converter, drawing scale, wire gauge (AWG ↔ mm²), pipe size data (steel Sch. 40/80, copper K/L/M), air and water properties, duct dimensions, flow and velocity, heat ↔ flow for air and water, Ohm's law and power, pipe and conduit offsets, and tank volume by level.

**Cheat sheets** (also in Utilities) open as one-page printable references — HVAC quick reference, pipe size data, wire & breaker table, and the full design pitfall checklist — ready to print or save as PDF.

Six small games sit at the bottom of Utilities, for a break: **Pipe Puzzle** (turn the pieces until water runs from the supply to the drain; the grid grows each level), **Unit Sprint** (60 seconds of HVAC, pressure, flow and temperature conversions), **Spot the Mistake** (a Design Pitfalls drawing with its parts named and the verdict notes hidden: right way or mistake? — plus a **daily challenge**: the same five drawings for everyone each day, one try, a shareable 🟩🟥 result and a day streak; `?play=daily` opens it), **Symbol Match** (memory game pairing drawing symbols such as valves, pumps and detectors with their names), **Phase Balance** (share single-phase loads across L1, L2 and L3 until the imbalance is the lowest possible) and **Term Scramble** (unscramble MEP terms from a clue). They work with mouse, touch or keyboard, keep your best scores in the browser, and have optional sound.

The source is one self-contained file, `index.html` (vanilla JavaScript, inline CSS and SVG). Vite serves it; `npm run build` then runs `scripts/postbuild.mjs`, which:

- moves the CSS and JavaScript into minified, cached files (`dist/assets/app-<hash>.css/.js`), so pages after the first load in about 16 KB;
- writes one page per calculator, `dist/calculators/<name>/` (e.g. `calculators/duct-size-calculator/`), with its own title, description, heading, formula and inputs for search engines — it opens that calculator;
- puts the **site lock** at the top of the script (see below) and writes `robots.txt`; the favicon and share icons are in `public/icons/`.

## Going live — two settings

| Setting | Where | What it does |
|---|---|---|
| `SITE_URL` | top of `scripts/postbuild.mjs`, or the `SITE_URL` environment variable on your host | The live address, e.g. `https://mechtoolbox.com/`. Adds canonical links and social tags to every page, writes `sitemap.xml` (submit it in Google Search Console) and locks the site to that domain. Left empty, they are skipped and the lock only blocks saved copies and framing. |
| `CF_ANALYTICS_TOKEN` | `index.html`, search for `Visitor stats` | Cloudflare Web Analytics token (free, no cookies). Counts visits and each view; only loads on the live https site. |

## Online only — copy protection

The site does not install as an app or work offline (an earlier build's offline worker is removed from any browser that picked it up). The production build also guards against copying:

- **Site lock** — the built script starts with a check: opened from a saved file (Save Page As, HTTrack, …), inside another site's frame, or — once `SITE_URL` is set — on any other domain, the page is replaced by "MechToolBox only runs online at …" with a link to your site. `localhost` stays allowed for `npm run preview`; add hosting-preview domains with the `ALLOWED_HOSTS` environment variable (comma-separated). The source `index.html` is not locked, so editing and tests work as before.
- **Ctrl+S / ⌘S** shows "bookmark it instead" rather than saving the page.
- **robots.txt** tells website copiers (HTTrack, WebCopier, Wget, Offline Explorer and others) to stay out.
- A copyright line heads the minified script.

No website can be made impossible to copy — what a browser shows has been downloaded to it, and determined people can edit the code. These steps stop casual copying and make saved or mirrored copies useless. Right-click and developer tools are left alone: blocking them gets in the way of normal use and is easy to get around.

## What's new and updates

The What's new view (`#whatsnew`, linked from the footer and the phone menu) is a dated list in `index.html` — add an entry at the top when you ship something. Its "Get notified" form sends the email to the same Formspree form as Feedback, with the subject "MechToolBox — notify me of new tools".

## Donations

Set `DONATE_URL` in `index.html` (search for `/* ---------- Donations`) to your PayPal.me link, e.g. `'https://paypal.me/yourname'`. That shows a small heart button in the header, a "Donate with PayPal" item in the phone menu and a support line in the footer. Each opens a Support window with amounts to choose from (USD $3/5/10/25 or PHP ₱100/250/500/1,000, PHP first when the code basis is PH) plus "Choose your own amount"; the amounts are set in `DONATE_AMOUNTS` and open `paypal.me/<name>/<amount><currency>` in a new tab. While `DONATE_URL` is empty the buttons stay hidden.

## Ads (Adsterra)

Ad codes go in the `ADSTERRA ADS` block near the end of `index.html`, just above the calculator window markup. Paste each code from Adsterra (Websites → your site → GET CODE) inside one `<template>`, exactly as Adsterra gives it; an empty template shows nothing.

| Template | Size to create in Adsterra | Shows in |
|---|---|---|
| Native Banner (switched off — code kept in a comment) | responsive | Home, calculator windows, Design Pitfalls, Codes & Standards when switched on |
| 728 × 90 banner (added) | 728 × 90 | Home (under the category tiles), Design Pitfalls, Codes & Standards — screens 800 px and wider |
| 320 × 50 banner (added) | 320 × 50 | above the calculator list (all screens); Home, Pitfalls and Standards on screens under 800 px |
| sidebar | 160 × 300 | the calculator category sidebar (desktop) |
| calculator result | 300 × 250 | every calculator window, under the result |
| Social Bar (added) · Popunder | — | whole page; Social Bar position is set in the Adsterra dashboard |

Change `data-ad` to move a code to other slots (`home`, `calc-top`, `calc-side`, `calc-result`, `pitfalls`, `standards`), `data-size` to match the banner size (or `auto` for a Native Banner) and `data-media` to `desktop`, `mobile` or `all`. Fixed-size banners load in their own frame when their slot scrolls into view; the Native Banner runs in the page itself (in a frame its images never load) and moves to whichever of its slots is on screen, and ads never load in automated test browsers. Add your live domain in Adsterra before testing — ads usually do not fill on `localhost` or a file opened from disk.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install the dev tools (Vite, Playwright, Oxlint). |
| `npm run dev` | Start a local server with live reload at http://localhost:5173. Add `-- --host` to open it from a phone on the same Wi-Fi. |
| `npm run build` | Build `dist/` for hosting: the site, minified and locked assets, calculator pages, robots.txt (and sitemap.xml when `SITE_URL` is set). |
| `npm run preview` | Serve the built `dist` folder at http://localhost:4173. |
| `npm test` | Run the browser tests (uses the installed Microsoft Edge). |
| `npm run lint` | Lint with Oxlint. |

## Tests

`tests/` holds Playwright tests that open `index.html` directly:

- `site.spec.js` — page loads without errors, category filters, compact view, minimize all, search.
- `navigation.spec.js` — one view at a time, header links and Back, "/" to search, Home category tiles, recently used calculators, inputs beside the result on wide screens, compact list by default.
- `utilities.spec.js` — known values for the utilities (pipe data, wire gauge, Ohm's law, slope, offset, tank, heat ↔ flow, air and water properties, drawing scale) in SI and IMP.
- `games.spec.js` — the six games and the daily challenge (same drawings for everyone, one try a day, `?play=daily`): solving a pipe puzzle, Unit Sprint answers and the 60-second timer, Spot the Mistake parts named but verdict notes hidden until you answer, clearing a Symbol Match board, finding the best Phase Balance split, and Term Scramble typing, answers and hints.
- `share.spec.js` — Share link: the copied address opens the same calculator, inputs, unit system and code basis in another browser, also when the sender picked a different unit.
- `more-calcs.spec.js` — known values for kitchen hood exhaust, cable tray fill, earth electrode resistance, feeder voltage drop, STP sizing and compressed-air pipe sizing.
- `extras.spec.js` — sun mode (switch, remembered after reload, phone menu), What's new and its sign-up form, and the four cheat sheets.
- `build.spec.js` — runs `npm run build` and checks the minified assets, the 131 calculator pages and robots.txt, that there is no offline app, and the site lock: a saved copy and a mirror domain show the online-only notice, another site cannot frame it, Ctrl+S is caught.
- `ads.spec.js` — ad slots stay hidden without codes; pasted codes fill their slots in their own frames, and page-level codes run once.
- `search.spec.js` — Standards search (references, sources, regional codes, whole-number matching, highlights), Pitfalls search highlights, and "/" focusing the search of the current view.
- `pitfalls.spec.js` — the Design Pitfalls view: a wrong and a right drawing for each mistake, labels kept inside every drawing, discipline filter and search, links to and from calculators.
- `refrigeration.spec.js` — known values for the refrigerant P–T chart, product freezing, evaporator / condensing unit selection, refrigerant charge safety, ice storage and refrigerant pipe supports.
- `plumbing-fire.spec.js` — known values for hot water recirculation, pressure zones, water hammer, pool circulation, clean agent, fire alarm battery, detector layout, egress, foam, and plumbing and sprinkler pipe hangers.
- `all-calculators.spec.js` — every calculator opens and produces a result in SI and IMP under every code basis (INTL / PH / AU / US).
- `values.spec.js` — known results for key calculators (duct sizing, diffusers, electrical, fire). If one fails, a formula or table changed.
- `guide.spec.js` — the design guide: quick start, steps that open calculators filled from the room, auto-advance after saving, code-basis targets, optional steps, review / BOQ, and switching rooms.
- `projects.spec.js` — a project room followed through the design chain (cooling load → outdoor air → diffusers → duct → pressure → fan), persistence after reload, AHU totals, JSON backup, Excel/CSV room schedule and the project PDF report.
- `boq.spec.js` — the HVAC BOQ take-off (equipment, diffusers, duct area by gauge, insulation), unit rates with VAT, BOQ / BOM CSV and the BOQ PDF.
- `boq-mepfs.spec.js` — electrical (breaker, wire, conduit), plumbing & sanitary (pipe lengths, fixtures, drains) and fire (sprinkler heads, B.I. pipe, fire pump) divisions, and totals across divisions.
- `new-calcs.spec.js` — chilled-water pipe sizing, pump head, cable sizing with derating, lighting (lumen method) and water supply fixture units: known values, project-room links and their BOQ items.
- `report.spec.js` — the PDF calculation report: project details, sections, results, drawing, suggestions, code basis, wide calculators.
- `codes-units.spec.js` — Philippine / Australian / US electrical rules, natural-ventilation rules, unit conversion round trips and unit lists per system.

Run one file with `npx playwright test tests/values.spec.js`. On a slower PC, limit the browsers running at once with `npx playwright test --workers=2` — with too many in parallel, tests time out.

Tests open the site on the Calculators view; use the `show(page, 'projects')` helper to switch views, as a user would with the header links.

## Note

Results are preliminary estimates. Verify against the codes adopted by your authority having jurisdiction, with a qualified engineer.
