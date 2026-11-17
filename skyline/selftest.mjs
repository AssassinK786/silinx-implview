#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// selftest.mjs -- checks skyline/ against the widget's own numbers and prjxray-db:
//   1. build-grid.py xc7a200t is t27.ai's grid.json byte for byte (but the database's revision in source.db);
//   2. the die's counts (K_CONFIG_TILES, K_CONFIG_FAMILY_TILES) and the two samples' numbers (K_NODE_*, K_MAC_*) of the
//      widget's spec, recomputed by skyline.js on the vendored grid.json and samples.json;
//   3. for every 7-series die found in prjxray-db: build-grid.py's grid.json, every tile looked up by skyline.js
//      decodeGrid lands on its own grid_x, grid_y;
//   4. make-page.mjs on a FASM (argument, optional): a page with nothing left to fetch.
//   node skyline/selftest.mjs [some.fasm part]
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeGrid, familyOf, summarize } from './widgets/fasm-skyline/skyline.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const W_DIR = path.join(HERE, 'widgets', 'fasm-skyline')
const W = JSON.parse(/<script>window\.T27_WIDGET=(\{.*?\})<\/script>/s.exec(readFileSync(path.join(W_DIR, 'index.html'), 'utf8'))[1])
const famOfType = (t) => familyOf(t, W.K_TYPE_PREFIX, W.K_TYPE_FAMILY, W.K_FAMILIES)
const nFam = W.K_FAMILIES.length
const tmp = mkdtempSync(path.join(os.tmpdir(), 'skyline-'))
let failed = 0
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failed++ }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const HOME = os.homedir()
const DBS = [process.env.PRJXRAY_DB, path.join(HOME, 'tools/prjxray-db'), path.join(HOME, 'fpga-toolchain/f4pga-xc-fasm2bels/third_party/prjxray-db')].filter((d) => d && existsSync(d))
const buildGrid = (args) => { const o = path.join(tmp, 'g.json'); execFileSync('python3', ['-I', path.join(HERE, 'build-grid.py'), ...args, '-o', o], { stdio: ['ignore', 'ignore', 'pipe'] }); return readFileSync(o, 'utf8') }

// 1.
const theirs = readFileSync(path.join(W_DIR, 'grid.json'), 'utf8')
const a7 = DBS.find((d) => existsSync(path.join(d, 'artix7/xc7a200t/tilegrid.json')))
if (a7) {
  const ours = buildGrid(['xc7a200t', '--db', a7])
  const strip = (s) => s.replace(/"db":"prjxray-db [0-9a-f]* artix7"/, '"db":""')
  check(strip(ours) === strip(theirs), `build-grid.py xc7a200t (${a7}) = t27.ai grid.json, byte for byte`)
} else console.log('skip build-grid.py xc7a200t: no prjxray-db with artix7/xc7a200t')

// 2.
const g = JSON.parse(theirs), grid = decodeGrid(g)
const config = new Array(nFam).fill(0)
let configTiles = 0
for (let i = 0; i < grid.cells.length; i++) if (g.bits[grid.cells[i]]) { config[famOfType(g.types[grid.cells[i]])]++; configTiles++ }
check(configTiles === W.K_CONFIG_TILES && eq(config, W.K_CONFIG_FAMILY_TILES), `die counts ${configTiles} ${config} = K_CONFIG_TILES, K_CONFIG_FAMILY_TILES`)
const samples = JSON.parse(readFileSync(path.join(W_DIR, 'samples.json'), 'utf8')).samples
for (const [s, K] of [[samples[0], 'K_NODE_'], [samples[1], 'K_MAC_']]) {
  const sum = summarize({ features: s.features, tiles: new Map(s.tiles) }, grid, famOfType, nFam)
  const got = [sum.features, sum.tiles, s.cleared, sum.tallest.name, sum.tallest.n, sum.famTiles, sum.famFeatures]
  const want = ['FEATURES', 'TILES', 'CLEARED', 'TALLEST_TILE', 'TALLEST', 'FAMILY_TILES', 'FAMILY_FEATURES'].map((k) => W[K + k])
  check(eq(got, want), `${s.file}: ${sum.features} features in ${sum.tiles} tiles, tallest ${sum.tallest.name} = ${K}*`)
}

// 3.
for (const db of DBS) {
  for (const fam of ['artix7', 'spartan7', 'kintex7', 'zynq7']) {
    const d = path.join(db, fam)
    if (!existsSync(d)) continue
    for (const fab of execFileSync('ls', [d], { encoding: 'utf8' }).split('\n').filter((x) => existsSync(path.join(d, x, 'tilegrid.json')))) {
      const tg = JSON.parse(readFileSync(path.join(d, fab, 'tilegrid.json'), 'utf8'))
      const gr = decodeGrid(JSON.parse(buildGrid([fab, '--db', db])))
      let bad = 0
      for (const [n, t] of Object.entries(tg)) { const p = gr.lookup(n); if (!p || p.gx !== t.grid_x || p.gy !== t.grid_y) bad++ }
      check(!bad, `${fam}/${fab}: ${Object.keys(tg).length} tiles, ${gr.w} x ${gr.h}, every tile on its own cell (${bad} not)`)
    }
  }
}

// 4.
const [fasm, part] = process.argv.slice(2)
if (fasm) {
  const out = path.join(tmp, 'p.html')
  execFileSync(path.join(HERE, '..', 'scripts', 'skyline.sh'), [fasm, part, '-o', out], { stdio: ['ignore', 'ignore', 'inherit'] })
  const html = readFileSync(out, 'utf8')
  check(!/(href|src)="(?!data:|https:)/.test(html) && /"K_DATA_INLINE":\{"grid":/.test(html), `${path.basename(fasm)} (${part}): the page needs no other file (data inline, no relative link)`)
}
rmSync(tmp, { recursive: true, force: true })
console.log(failed ? `${failed} FAILED` : 'all passed')
process.exit(failed ? 1 : 0)
