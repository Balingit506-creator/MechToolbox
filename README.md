# MechToolBox

Engineering calculators for M·E·P·F·S design (mechanical, electrical, plumbing, fire protection, sanitary), with live drawings, design suggestions, printable PDF calculation reports, a step-by-step design guide (HVAC, electrical, plumbing & sanitary, fire), projects that carry room data from one calculator to the next, a bill of quantities for Electrical, Plumbing & Sanitary, Mechanical and Fire Protection in the standard QS format (material and labor costs, supervision & profit, contingencies, VAT) with a BOM, and code references for International, Philippine, Australian and US practice.

Refrigeration tools include cold-room load, product freezing load and time (blast freezers), evaporator and condensing-unit selection, refrigeration cycle and COP, a refrigerant P–T chart, superheat and subcooling, refrigerant pipe sizing, refrigerant charge safety (ASHRAE 15 / IEC 60335-2-40) and ice thermal storage.

Plumbing adds hot water recirculation, high-rise pressure zones (PRV), water hammer surge and swimming pool circulation and heating. Fire protection adds clean agent quantity (NFPA 2001), fire alarm battery standby, detector spacing and count (NFPA 72), occupant load and egress (IBC) and foam concentrate quantity (NFPA 11 / 16).

Hanger and support take-offs cover chilled water, ductwork, plumbing (IPC Table 308.5 spacing, riser clamps), fire sprinkler piping (NFPA 13 spacing and rod sizes, seismic sway braces) and refrigerant line sets (insulated liquid + suction lines, supports at bends) — supports, rod sizes and lengths, angle bar, clamps or saddles, anchors and cost.

The site works like an app: the header switches between views (Home, Calculators, Guide, Projects, Estimate, Utilities, Standards, About) instead of one long page. Each view has its own address (`#calculators`, `#projects`…), so links and the Back button work. Calculators are grouped in a sidebar by category, open in a two-column window (inputs beside the result), and the last six you used are listed on Home and in the sidebar.

The Design Pitfalls view shows 116 common design and installation mistakes across HVAC, plumbing, fire protection, electrical and refrigeration — such as a branch duct cut into an elbow, an intake beside an exhaust, an S-trap, a relief valve piped uphill, sprinklers blocked by a wide duct, a socket by a sink without GFCI, or brazing without nitrogen — each drawn beside the right way, with why it matters, the rule, the code reference and the calculator to check it. Search them or filter by discipline (the Codes & Standards view has its own search too); related calculators link to them from their window header.

The whole site is one self-contained file, `index.html` (vanilla JavaScript, inline CSS and SVG). Vite is used only to serve and build it.

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
| `npm run build` | Build `dist/index.html` for hosting. |
| `npm run preview` | Serve the built `dist` folder. |
| `npm test` | Run the browser tests (uses the installed Microsoft Edge). |
| `npm run lint` | Lint with Oxlint. |

## Tests

`tests/` holds Playwright tests that open `index.html` directly:

- `site.spec.js` — page loads without errors, category filters, compact view, minimize all, search.
- `navigation.spec.js` — one view at a time, header links and Back, "/" to search, Home category tiles, recently used calculators, inputs beside the result on wide screens, compact list by default.
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
