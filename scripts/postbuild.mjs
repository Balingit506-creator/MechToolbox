// After `vite build`: split the page's CSS and JS into minified, cached files, lock the code to the website,
// add search-engine tags, and write one page per calculator (calculators/<name>/), a sitemap and robots.txt.
//
// Set the live address here (or as the SITE_URL environment variable) once the site is online — canonical
// links, social tags and sitemap.xml are only written when it is set, and the site lock then also refuses to run
// on any other domain. Extra domains that may run it (e.g. a hosting preview) go in ALLOWED_HOSTS, comma-separated.
const SITE_URL = process.env.SITE_URL || ''
const ALLOWED_HOSTS = (process.env.ALLOWED_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean)

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { minify } from 'vite'
import { transform as cssTransform } from 'lightningcss'

const DIST = 'dist'
const site = SITE_URL ? SITE_URL.replace(/\/?$/, '/') : ''
const src = readFileSync('index.html', 'utf8') // the readable source, for calculator titles and descriptions
let html = readFileSync(join(DIST, 'index.html'), 'utf8')
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---- 1. CSS: the big <style> goes to assets/app-<hash>.css; rules with url(#id) stay inline (they point into the page)
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
const main = styles.reduce((a, b) => (b[1].length > a[1].length ? b : a))
const keep = []
const rest = main[1].replace(/[^{}@]+\{[^{}]*url\(#[^{}]*\}/g, (rule) => { keep.push(rule.trim()); return '' }) // Vite has already minified it to one line
const cssOut = cssTransform({ filename: 'app.css', code: Buffer.from(rest), minify: true }).code.toString()

// ---- 2. JS: the big inline <script> goes to assets/app-<hash>.js, minified
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
const app = scripts.reduce((a, b) => (b[1].length > a[1].length ? b : a))
const min = await minify('app.js', app[1], { compress: true, mangle: true })
if (min.errors && min.errors.length) throw new Error('JS minify failed: ' + JSON.stringify(min.errors[0]))
// Site lock, run before anything else: a saved copy (file://), another site's frame or — once SITE_URL is set —
// another domain gets a short notice instead of the tools. localhost stays allowed for `npm run preview`.
const lockHosts = site ? [new URL(site).hostname].concat(ALLOWED_HOSTS) : ALLOWED_HOSTS
const lockHosts2 = lockHosts.concat(lockHosts.filter((x) => !/^www\./.test(x)).map((x) => 'www.' + x))
const guard = '/*! MechToolBox (c) ' + new Date().getFullYear() + ' JAB. All rights reserved. Free to use online' + (site ? ' at ' + site : '') + '; copying, saving or re-hosting the site is not permitted. */\n' +
  '(function(){var H=' + JSON.stringify(lockHosts2) + ',S=' + JSON.stringify(site) + ',l=location,h=l.hostname,ok=l.protocol!=="file:"&&(!H.length||H.indexOf(h)>=0||h==="localhost"||h==="127.0.0.1");' +
  'try{if(ok&&window.top!==window.self){window.top.location.replace(l.href);ok=false}}catch(e){ok=false}' +
  'if(ok)return;document.documentElement.innerHTML=\'<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MechToolBox</title></head>' +
  '<body style="margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0B0B0B;color:#F2E8CF;font:16px/1.6 system-ui,sans-serif;text-align:center"><div>' +
  '<p style="margin:0 0 10px;font:700 24px system-ui,sans-serif">MECH<span style="color:#A39A80"> / </span><span style="color:#FFB000">TOOLBOX</span></p>' +
  '<p id="mt-lock">MechToolBox only runs online\'+(S?\' at <a style="color:#FFB000" href="\'+S+\'">\'+S.replace(/^https?:\\/\\//,"").replace(/\\/$/,"")+\'</a>\':\' from its website\')+\'. Please open it there.</p></div></body>\';' +
  'throw new Error("MechToolBox only runs on its own website")})();\n'
const jsOut = guard + min.code

const cssName = 'assets/app-' + hash(cssOut) + '.css', jsName = 'assets/app-' + hash(jsOut) + '.js'
mkdirSync(join(DIST, 'assets'), { recursive: true })
writeFileSync(join(DIST, cssName), cssOut)
writeFileSync(join(DIST, jsName), jsOut)
html = html.replace(main[0], () => '<link rel="stylesheet" href="' + cssName + '">' + (keep.length ? '<style>' + keep.join('') + '</style>' : ''))
html = html.replace(app[0], () => '<script src="' + jsName + '"></script>')

// ---- 3. Search-engine tags for the home page
const desc = (html.match(/<meta name="description" content="([^"]*)">/) || [])[1] || ''
const social = (title, description, url) => [
  url ? '<link rel="canonical" href="' + url + '">' : '',
  '<meta property="og:type" content="website">', '<meta property="og:site_name" content="MechToolBox">',
  '<meta property="og:title" content="' + esc(title) + '">', '<meta property="og:description" content="' + esc(description) + '">',
  url ? '<meta property="og:url" content="' + url + '">' : '',
  site ? '<meta property="og:image" content="' + site + 'icons/icon-512.png">' : '',
  '<meta name="twitter:card" content="summary">'
].filter(Boolean).join('\n')
const ld = (obj) => '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>'
const home = html.replace('</head>', social('MechToolBox — Engineering Calculators', desc, site) + '\n' +
  ld({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'MechToolBox', description: desc, applicationCategory: 'EngineeringApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, ...(site ? { url: site } : {}) }) + '\n</head>')
writeFileSync(join(DIST, 'index.html'), home)

// ---- 4. One page per calculator
const unq = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')
const calcs = []
for (const m of src.matchAll(/^    (\w+): \{\n      code: '([^']*)', title: '((?:[^'\\]|\\.)*)', card: true, disc: '(\w)'(?:, special: true)?,\n      desc: '((?:[^'\\]|\\.)*)',?([\s\S]*?)\n    \},?\n/gm)) {
  const body = m[6]
  const note = (body.match(/\n      note: '((?:[^'\\]|\\.)*)'/) || [])[1]
  const f = body.match(/formula: function \(\) \{ return \[((?:\s*'(?:[^'\\]|\\.)*',?)+)\s*\]; \}/)
  const formula = f ? [...f[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => unq(x[1])) : []
  const fields = [...body.matchAll(/\{ k: '\w+', label: '((?:[^'\\]|\\.)*)'/g)].map((x) => unq(x[1]))
  calcs.push({ id: m[1], code: m[2], title: unq(m[3]), disc: m[4], desc: unq(m[5]), note: note ? unq(note) : '', formula, fields })
}
const slug = (t) => t.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const DISC = { M: 'Mechanical / HVAC', E: 'Electrical', P: 'Plumbing', F: 'Fire protection', S: 'Sanitary' }
if (existsSync(join(DIST, 'calculators'))) rmSync(join(DIST, 'calculators'), { recursive: true })
const headRe = /(<section class="section" id="calculators"[^>]*>\s*<div class="wrap">\s*<div class="section-head reveal">\s*<p class="eyebrow">)[^<]*(<\/p>\s*)<h2 id="calc-title">[^<]*<\/h2>\s*<p>[^<]*<\/p>/
if (!headRe.test(home)) throw new Error('calculators heading not found — update postbuild.mjs')
const seen = new Set()
for (const c of calcs) {
  let s = slug(c.title); if (seen.has(s)) s += '-' + c.id; seen.add(s)
  c.path = 'calculators/' + s + '/'
  const url = site ? site + c.path : ''
  const title = c.title + ' — Free Online Calculator | MechToolBox'
  const description = c.desc + ' Free, with the formula, a design check and a PDF report.'
  const intro = '$1' + esc(DISC[c.disc] + ' · ' + c.code) + '$2<h1 id="calc-title">' + esc(c.title) + '</h1><p>' + esc(c.desc) + '</p>' +
    '<div class="calc-seo">' + (c.formula.length ? '<p><strong>Formula</strong></p><pre class="formula">' + esc(c.formula.join('\n')) + '</pre>' : '') +
    (c.fields.length ? '<p><strong>Inputs:</strong> ' + esc(c.fields.join(' · ')) + '</p>' : '') + (c.note ? '<p>' + esc(c.note) + '</p>' : '') +
    '<p><button type="button" class="btn btn-solid btn-sm" data-open="' + c.id + '">Open the calculator →</button> <a class="btn btn-outline btn-sm" href="../../#calculators">All calculators</a></p></div>'
  let page = home
    .replace('<html lang="en">', '<html lang="en" data-calc="' + c.id + '">')
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(title) + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(description) + '">')
    .replace(/<link rel="canonical"[^>]*>\n?|<meta property="og:[^>]*>\n?|<meta name="twitter:card"[^>]*>\n?|<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '')
    .replace('</head>', social(title, description, url) + '\n' + ld({ '@context': 'https://schema.org', '@type': 'WebApplication', name: c.title, description: c.desc, applicationCategory: 'EngineeringApplication', operatingSystem: 'Any', isPartOf: { '@type': 'WebSite', name: 'MechToolBox', ...(site ? { url: site } : {}) }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, ...(url ? { url } : {}) }) + '\n</head>')
    .replace(headRe, intro)
    .replace(/(href|src)="(assets|icons)\//g, '$1="../../$2/')
  mkdirSync(join(DIST, c.path), { recursive: true })
  writeFileSync(join(DIST, c.path, 'index.html'), page)
}

// ---- 5. Sitemap and robots.txt (website copiers are asked to stay out; polite ones obey)
if (site) {
  const day = new Date().toISOString().slice(0, 10)
  writeFileSync(join(DIST, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [site].concat(calcs.map((c) => site + c.path)).map((u) => '  <url><loc>' + u + '</loc><lastmod>' + day + '</lastmod></url>').join('\n') + '\n</urlset>\n')
}
const COPIERS = ['HTTrack', 'WebCopier', 'WebZIP', 'Offline Explorer', 'Teleport', 'TeleportPro', 'WebStripper', 'SiteSnagger', 'Website Downloader', 'Wget', 'WebReaper', 'Web Downloader']
writeFileSync(join(DIST, 'robots.txt'), COPIERS.map((a) => 'User-agent: ' + a + '\nDisallow: /\n').join('\n') + '\nUser-agent: *\nAllow: /\n' + (site ? 'Sitemap: ' + site + 'sitemap.xml\n' : ''))

const kb = (n) => Math.round(n / 1024) + ' KB'
console.log('postbuild: ' + cssName + ' ' + kb(cssOut.length) + ', ' + jsName + ' ' + kb(jsOut.length) + ', index.html ' + kb(home.length) +
  ', ' + calcs.length + ' calculator pages, locked to ' + (lockHosts2.length ? lockHosts2.join(', ') : 'any website (not saved copies)') +
  (site ? ', sitemap.xml for ' + site : ' — set SITE_URL to add canonical links, sitemap.xml and the domain lock'))
