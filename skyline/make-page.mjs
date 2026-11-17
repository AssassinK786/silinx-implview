#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// make-page.mjs -- the fasm-skyline widget (widgets/fasm-skyline/, t27.ai, unchanged but for its data loading) as one
// self-contained offline HTML page for any 7-series part: the page's own index.html, widget.css, tool.css, tool.js and
// skyline.js inlined; the die's grid.json (build-grid.py) and the counts of one or more FASM files (skyline.js
// parseFasm, the page's own counting) as its samples. Only the part-dependent constants (K_GRID_W, K_CONFIG_TILES, ...)
// and the die's name in the SAY_ texts change; every colour, control and the PNG / STL export are the widget's.
//
//   node make-page.mjs --grid grid.json --part xc7s25csga324-1 --fasm a.fasm [--label L] [--note N] [--fasm b.fasm ...] -o out.html
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeGrid, familyOf, parseFasm, summarize } from './widgets/fasm-skyline/skyline.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const W_DIR = path.join(HERE, 'widgets', 'fasm-skyline')
const read = (p) => readFileSync(p, 'utf8')
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const fail = (m) => { console.error(`make-page: ${m}`); process.exit(1) }

function args(argv) {
  const a = { fasm: [], out: '-' }
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { if (i + 1 >= argv.length) fail(`${k} needs a value`); return argv[++i] }
    if (k === '--grid') a.grid = v()
    else if (k === '--part') a.part = v()
    else if (k === '--die') a.die = v()
    else if (k === '--fasm') a.fasm.push({ path: v() })
    else if (k === '--label' || k === '--note' || k === '--flow') { if (!a.fasm.length) fail(`${k} before any --fasm`); a.fasm.at(-1)[k.slice(2)] = v() }
    else if (k === '-o' || k === '--out') a.out = v()
    else if (k === '--json') a.json = v()
    else if (k === '--app-out') a.appOut = v()
    else fail(`unknown argument ${k}`)
  }
  if (!a.grid || !a.part || !a.fasm.length) fail('usage: make-page.mjs --grid grid.json --part PART --fasm F [--label L] [--note N] ... [-o out.html]')
  return a
}

/** The widget's constants (the T27_WIDGET object of index.html) and the page around them. */
function widgetPage() {
  const html = read(path.join(W_DIR, 'index.html'))
  const m = /<script>window\.T27_WIDGET=(\{.*?\})<\/script>/s.exec(html)
  if (!m) fail('widgets/fasm-skyline/index.html: no window.T27_WIDGET')
  return { html, W: JSON.parse(m[1]), at: m.index, len: m[0].length }
}

/** A sample entry, as scripts/widget-data/fasm-skyline.mjs sampleFrom writes them (samples.json). */
function sampleOf(f, part) {
  const buf = readFileSync(f.path)
  const parsed = parseFasm(buf.toString('utf8'))
  if (!parsed.features) fail(`${f.path} sets no FASM features`)
  const chip = parsed.header.find((h) => /^chipdb /.test(h)) || ''
  const nextpnr = parsed.header.some((h) => /^nextpnr/.test(h))
  const flow = f.flow || (nextpnr ? 'nextpnr-xilinx (openXC7)' : 'bitstream decoded by Project X-Ray bit2fasm')
  return {
    id: path.basename(f.path), file: f.label || path.basename(f.path), path: path.basename(f.path), sha256: sha256(buf), bytes: buf.length,
    features: parsed.features, comments: parsed.comments, cleared: parsed.cleared, bad: parsed.bad.length,
    header: parsed.header, part, chipdb: chip.replace(/^chipdb (\S+).*$/, '$1'), commands: [], tools: {}, flow,
    note: f.note || `${f.label || path.basename(f.path)}: ${flow}, part ${part}; ${path.basename(f.path)}, ${buf.length} bytes.`,
    tiles: [...parsed.tiles].sort((a, b) => (a[0] < b[0] ? -1 : 1)),
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// a JSON inside <script>: no '</script' and no '<!--' can end or bend it
const scriptJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c')

function main() {
  const a = args(process.argv.slice(2))
  const g = JSON.parse(read(a.grid))
  const grid = decodeGrid(g)
  const { html, W: W0 } = widgetPage()
  const fams = W0.K_FAMILIES
  const famOfType = (t) => familyOf(t, W0.K_TYPE_PREFIX, W0.K_TYPE_FAMILY, fams)
  // the die's numbers, as fasm-skyline.mjs dieCounts: tiles per family with configuration bits
  const config = new Array(fams.length).fill(0)
  let configTiles = 0
  for (let i = 0; i < grid.cells.length; i++) if (g.bits[grid.cells[i]]) { config[famOfType(g.types[grid.cells[i]])]++; configTiles++ }
  const part = a.part.toLowerCase()
  const die = (a.die || part.replace(/^(xc7[aksz]\d+t?).*$/, '$1')).toUpperCase()
  const samples = a.fasm.map((f) => sampleOf(f, part))
  // the die's name in the texts: the widget's are the XC7A200T's
  const DIE = /XC7A200T/g
  const W = {}
  for (const [k, v] of Object.entries(W0)) {
    W[k] = typeof v === 'string' ? v.replace(DIE, die) : Array.isArray(v) && v.every((x) => typeof x === 'string') ? v.map((x) => x.replace(DIE, die)) : v
  }
  const sum0 = summarize({ features: samples[0].features, tiles: new Map(samples[0].tiles) }, grid, famOfType, fams.length)
  Object.assign(W, {
    K_DATA_INLINE: { grid: g, samples: { schema: 1, samples } },
    K_GRID_W: g.w, K_GRID_H: g.h, K_DIE_TILES: g.w * g.h, K_CONFIG_TILES: configTiles, K_CONFIG_FAMILY_TILES: config,
    K_TILEGRID_SHA256: g.source?.sha256 || '',
    SAY_SAMPLES: samples.map((s) => s.file),
    SAY_SAMPLE_LINES: samples.map((s) => s.note),
    // (the link-preview note is the t27.ai page's; an offline page has no preview card)
    SAY_SHARE_NOTE: '',
    HOOK: `${sum0.placedFeatures} FASM features in ${sum0.tiles} tiles of an ${die}.`,
    DATA_SOURCES: [
      `${g.source?.db || 'prjxray-db'}, ${g.source?.file || 'tilegrid.json'} (sha256 ${(g.source?.sha256 || '').slice(0, 16)}...): ${g.source?.tiles} tiles, reduced to grid.json by skyline/build-grid.py (the format of t27.ai's scripts/widget-data/fasm-skyline.mjs)`,
      ...samples.map((s) => `${s.file}: ${s.path} (sha256 ${s.sha256.slice(0, 16)}..., ${s.bytes} bytes), ${s.flow}, part ${part}`),
      'skyline/make-page.mjs: counted by the widget\'s own skyline.js; widget by t27.ai (Trinity S3AI), Apache-2.0',
    ],
  })
  // (the t27.ai page's own two samples' numbers and its link-preview card's text: not this page's)
  for (const k of Object.keys(W)) if (/^K_(NODE|MAC)_/.test(k) || k === 'IMAGE_ALT') delete W[k]

  const css = read(path.join(HERE, 'widgets', 'widget.css')) + '\n' + read(path.join(W_DIR, 'tool.css'))
  // one module: skyline.js's exports as plain declarations, then tool.js without its import of them
  const sky = read(path.join(W_DIR, 'skyline.js')).replace(/^export (function|const) /gm, '$1 ')
  const tool = read(path.join(W_DIR, 'tool.js')).replace(/^import \{[^}]*\} from '\.\/skyline\.js'\n/m, '')
  if (/^import /m.test(tool) || /^export /m.test(sky)) fail('tool.js / skyline.js: an import or export left after inlining')
  const icon = 'data:image/svg+xml;base64,' + readFileSync(path.join(HERE, 'favicon.svg')).toString('base64')
  const title = W.TITLE
  const T27 = 'https://t27.ai/widgets/fasm-skyline/'
  let out = html
    .replace(/<title>.*?<\/title>/s, `<title>${esc(title)} &middot; Trinity S³AI</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(W.DESCRIPTION)}">`)
    .replace(/<meta name="t27:hook"[^>]*>\n/, '')
    .replace(/<link rel="canonical"[^>]*>\n/, '')
    .replace(/<meta (property="og:|name="twitter:)[^>]*>\n/g, '')
    .replace(/<link rel="icon" href="[^"]*"/, `<link rel="icon" href="${icon}"`)
    .replace(/<link rel="stylesheet" href="\.\.\/widget\.css[^"]*">/, () => `<style>\n${css}</style>`)
    .replace(/<a class="t27-widget-brand" href="\.\.\/\.\.\/"/, '<a class="t27-widget-brand" href="https://t27.ai/"')
    .replace(/<img src="\.\.\/\.\.\/favicon\.svg"/, `<img src="${icon}"`)
    .replace(/<h1>.*?<\/h1>/s, `<h1>${esc(title)}</h1>`)
    .replace(/(<\/h1>\n<p>).*?(<\/p>)/s, (_, x, y) => `${x}${esc(W.DESCRIPTION)}${y}`)
    .replace(/<summary>Where the numbers come from<\/summary><ul>.*?<\/ul>/s, () => `<summary>Where the numbers come from</summary><ul>${W.DATA_SOURCES.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`)
    .replace(/<a href="\.\/fasm-skyline\.t27"[^>]*>This widget's \.t27 source<\/a> &middot; <a href="\.\.\/\.\.\/#\/queen\?tab=widgets"[^>]*>All widgets<\/a>/,
      `<a href="${T27}" target="_blank" rel="noopener">FASM skyline widget by t27.ai</a> (Apache-2.0) &middot; offline page of silinx-implview`)
    .replace(/<script>window\.T27_WIDGET=\{.*?\}<\/script>/s, () => `<script>window.T27_WIDGET=${scriptJson(W)}</script>`)
    .replace(/<script type="module" src="\.\/tool\.js[^"]*"><\/script>/, () => `<script type="module">\n${sky}\n${tool}</script>`)
  for (const [what, re] of [['stylesheet link', /<link rel="stylesheet" href=/], ['tool.js', /src="\.\/tool\.js/], ['relative link', /(href|src)="\.\.?\//]]) {
    if (re.test(out)) fail(`index.html: the ${what} was not inlined (the widget's page changed?)`)
  }
  if (a.out === '-') process.stdout.write(out)
  else writeFileSync(a.out, out)
  // (--app-out: the same page for a server whose Content-Security-Policy runs no inline script, Silinx's: the constants
  // in a JSON element, the widget's code from the server, {{ORIGIN}}/vendor/skyline/ (boot.mjs), the origin put in by
  // the page that opens it)
  if (a.appOut) {
    const app = out
      .replace(/<script>if\(\/\[\?&\]embed=1[^<]*<\/script>\n/, '')
      .replace(/<script>window\.T27_WIDGET=\{.*?\}<\/script>/s, () => `<script type="application/json" id="t27-widget">${scriptJson(W)}</script>`)
      .replace(/<script type="module">\n[\s\S]*?<\/script>/, '<script type="module" src="{{ORIGIN}}/vendor/skyline/boot.mjs"></script>')
    if (/<script(?![^>]*\b(src=|type="application\/json"))[^>]*>/.test(app)) fail('--app-out: an inline script is left')
    writeFileSync(a.appOut, app)
  }
  const counts = []
  for (const s of samples) {
    const sm = summarize({ features: s.features, tiles: new Map(s.tiles) }, grid, famOfType, fams.length)
    counts.push({
      file: s.file, fasm: s.path, flow: s.flow, sha256: s.sha256, features: sm.placedFeatures, tiles: sm.tiles, cleared: s.cleared, bad: s.bad,
      share: +(100 * sm.tiles / configTiles).toFixed(2), tallest: sm.tallest ? { tile: sm.tallest.name, features: sm.tallest.n } : null,
      families: Object.fromEntries(fams.map((f, i) => [f, { tiles: sm.famTiles[i], features: sm.famFeatures[i], onDie: config[i] }])),
      off: sm.off.map(([tile, n]) => ({ tile, features: n })),
      columns: sm.cols.map((c) => ({ tile: c.name, type: c.type, family: fams[c.fam], features: c.n, gx: c.gx, gy: c.gy })),
    })
    console.error(`${s.file}: ${sm.placedFeatures} features in ${sm.tiles} tiles (${(100 * sm.tiles / configTiles).toFixed(2)}% of ${configTiles}), tallest ${sm.tallest?.name} ${sm.tallest?.n}; ${sm.off.length} tiles off the grid, ${s.cleared} cleared, ${s.bad} not features`)
  }
  // (--json: the same counts as the page's, for the MCP server's fpga_skyline)
  if (a.json) writeFileSync(a.json, JSON.stringify({ part, die, grid: { w: g.w, h: g.h, configTiles, source: g.source }, samples: counts }, null, 1) + '\n')
}

main()
