# MechToolBox

Engineering calculators for M·E·P·F·S design (mechanical, electrical, plumbing, fire protection, sanitary), with live drawings, design suggestions, printable PDF calculation reports, projects that carry room data from one calculator to the next, an HVAC bill of quantities in the standard QS format (material and labor costs, supervision & profit, contingencies, VAT) with a BOM, and code references for International, Philippine, Australian and US practice.

The whole site is one self-contained file, `index.html` (vanilla JavaScript, inline CSS and SVG). Vite is used only to serve and build it.

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
- `all-calculators.spec.js` — every calculator opens and produces a result in SI and IMP under every code basis (INTL / PH / AU / US).
- `values.spec.js` — known results for key calculators (duct sizing, diffusers, electrical, fire). If one fails, a formula or table changed.
- `projects.spec.js` — a project room followed through the design chain (cooling load → outdoor air → diffusers → duct → pressure → fan), persistence after reload, AHU totals, JSON backup, Excel/CSV room schedule and the project PDF report.
- `boq.spec.js` — the HVAC BOQ take-off (equipment, diffusers, duct area by gauge, insulation), unit rates with VAT, BOQ / BOM CSV and the BOQ PDF.
- `report.spec.js` — the PDF calculation report: project details, sections, results, drawing, suggestions, code basis, wide calculators.
- `codes-units.spec.js` — Philippine / Australian / US electrical rules, natural-ventilation rules, unit conversion round trips and unit lists per system.

Run one file with `npx playwright test tests/values.spec.js`.

## Note

Results are preliminary estimates. Verify against the codes adopted by your authority having jurisdiction, with a qualified engineer.
