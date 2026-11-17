#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# build-grid.py -- writes the grid.json the fasm-skyline widget (tool.js / skyline.js) reads, for any
# 7-series part, from a prjxray-db tilegrid.json. Same format as the grid.json t27.ai builds with
# scripts/widget-data/fasm-skyline.mjs (schema 1); for xc7a200t the output is byte-identical to theirs.
#
#   build-grid.py <part|device|fabric> [-o grid.json] [--db DIR ...]
#
# Format: w, h; types (sorted tile types); rle ([typeIndex, count] runs over cells gx*h+gy);
# x / y per type: tile-name X (Y) -> grid_x (grid_y) as [k0, v0, n, dk, dv] arithmetic runs;
# except: tiles whose name does not follow the majority mapping of their type -> [gx, gy];
# bits: 1 when a tile of that type holds configuration bits; schema; source.
import argparse, collections, hashlib, json, os, re, subprocess, sys

DEFAULT_DBS = [os.path.expanduser('~/tools/prjxray-db'),
               os.path.expanduser('~/fpga-toolchain/f4pga-xc-fasm2bels/third_party/prjxray-db')]
FAMILIES = ['artix7', 'spartan7', 'kintex7', 'zynq7', 'virtex7']
TILE_RE = re.compile(r'^([A-Z0-9_]+)_X(\d+)Y(\d+)$')


def simple_yaml(path):
    """The two-level maps of prjxray-db mapping/*.yaml (no PyYAML needed)."""
    out, cur = {}, None
    for line in open(path):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if not line.startswith(' '):
            cur = line.split(':')[0].strip().strip('"\'')
            out[cur] = {}
        else:
            k, _, v = line.strip().partition(':')
            out[cur][k.strip()] = v.strip().strip('"\'')
    return out


def find_tilegrid(name, dbs):
    name = name.lower()
    for db in dbs:
        for fam in FAMILIES:
            d = os.path.join(db, fam)
            if not os.path.isdir(d):
                continue
            dev = name
            parts = os.path.join(d, 'mapping', 'parts.yaml')
            if os.path.exists(parts):
                dev = simple_yaml(parts).get(name, {}).get('device', name)
            fab = dev
            devs = os.path.join(d, 'mapping', 'devices.yaml')
            if os.path.exists(devs):
                dmap = simple_yaml(devs)
                if dev not in dmap:
                    # a part the database does not list (another package, speed or temperature grade, e.g.
                    # xc7a35ticsg324-1L): the longest device name it starts with
                    dev = max((k for k in dmap if dev.startswith(k)), key=len, default=dev)
                fab = dmap.get(dev, {}).get('fabric', dev)
            p = os.path.join(d, fab, 'tilegrid.json')
            if os.path.exists(p):
                return db, fam, fab, p
    sys.exit(f'build-grid: no tilegrid.json for {name} in {", ".join(dbs)}')


def segments(pairs):
    """Sorted (k, v) pairs as greedy arithmetic runs [k0, v0, n, dk, dv]."""
    out, i = [], 0
    while i < len(pairs):
        k0, v0 = pairs[i]
        if i + 1 == len(pairs):
            out.append([k0, v0, 1, 1, 0]); break
        dk, dv = pairs[i + 1][0] - k0, pairs[i + 1][1] - v0
        n = 2
        while i + n < len(pairs) and pairs[i + n][0] - pairs[i + n - 1][0] == dk and pairs[i + n][1] - pairs[i + n - 1][1] == dv:
            n += 1
        out.append([k0, v0, n, dk, dv]); i += n
    return out


def build(tilegrid_path, label):
    raw = open(tilegrid_path, 'rb').read()
    tg = json.loads(raw)
    w = max(v['grid_x'] for v in tg.values()) + 1
    h = max(v['grid_y'] for v in tg.values()) + 1
    types = sorted({v['type'] for v in tg.values()})
    tix = {t: i for i, t in enumerate(types)}
    cells = [None] * (w * h)
    for v in tg.values():
        if cells[v['grid_x'] * h + v['grid_y']] is not None:
            sys.exit(f"build-grid: two tiles at grid {v['grid_x']},{v['grid_y']}")
        cells[v['grid_x'] * h + v['grid_y']] = tix[v['type']]
    if None in cells:
        sys.exit('build-grid: tilegrid.json leaves grid cells empty; schema 1 needs a full grid')
    rle = []
    for c in cells:
        if rle and rle[-2] == c:
            rle[-1] += 1
        else:
            rle += [c, 1]
    votes = {a: collections.defaultdict(collections.Counter) for a in 'xy'}
    named = []
    for name in sorted(tg):
        v = tg[name]
        m = TILE_RE.match(name)
        if not m or m.group(1) != v['type']:
            sys.exit(f'build-grid: tile {name} is not named <type>_X<n>Y<n>')
        X, Y = int(m.group(2)), int(m.group(3))
        votes['x'][(v['type'], X)][v['grid_x']] += 1
        votes['y'][(v['type'], Y)][v['grid_y']] += 1
        named.append((name, v, (X, Y)))
    # majority; a tie goes to the smaller grid line (as fasm-skyline.mjs)
    pick = {a: {k: min(c.items(), key=lambda kv: (-kv[1], kv[0]))[0] for k, c in votes[a].items()} for a in 'xy'}
    # A tile off the majority mapping goes to except; the maps are then built from the others only.
    maps = {a: {t: {} for t in types} for a in 'xy'}
    exc = {}
    for name, v, xy in named:
        if pick['x'][(v['type'], xy[0])] != v['grid_x'] or pick['y'][(v['type'], xy[1])] != v['grid_y']:
            exc[name] = [v['grid_x'], v['grid_y']]
        else:
            maps['x'][v['type']][xy[0]] = v['grid_x']
            maps['y'][v['type']][xy[1]] = v['grid_y']
    # A name resolves onto a cell of its own type only: exact only if no two X (or Y) of a type share a grid line.
    # fasm-skyline.mjs stops there (no such die in its one part); here, for any part, the coordinate with the most
    # tiles keeps the line and the other coordinates' tiles go to except (xc7a100t's BRKH_GTX, for one).
    ax = {'x': 0, 'y': 1}
    for a in 'xy':
        for t, m in maps[a].items():
            if len(set(m.values())) == len(m):
                continue
            n = collections.Counter(xy[ax[a]] for _, v, xy in named if v['type'] == t and _ not in exc)
            keep = {}
            for k in sorted(m, key=lambda k: (-n[k], k)):
                keep.setdefault(m[k], k)
            drop = {k for k in m if keep[m[k]] != k}
            for name, v, xy in named:
                if v['type'] == t and xy[ax[a]] in drop and name not in exc:
                    exc[name] = [v['grid_x'], v['grid_y']]
            print(f'build-grid: {t}: {a.upper()} {sorted(drop)} share a grid line with another {a.upper()}; their tiles go to except', file=sys.stderr)
    for a in 'xy':
        maps[a] = {t: {} for t in types}
    for name, v, xy in named:
        if name not in exc:
            maps['x'][v['type']][xy[0]] = v['grid_x']
            maps['y'][v['type']][xy[1]] = v['grid_y']
    exc = dict(sorted(exc.items()))
    hasbits = {}
    for name in sorted(tg):
        v = tg[name]
        has = 1 if v.get('bits') else 0
        if hasbits.setdefault(v['type'], has) != has:
            sys.exit(f"build-grid: type {v['type']}: some tiles have bits and some do not")
    seg = lambda a: {t: segments(sorted(maps[a][t].items())) for t in types}
    # as fasm-skyline.mjs: every tile, looked up the way skyline.js decodeGrid does, must land on its own cell
    for name, v, xy in named:
        if name in exc:
            continue
        for a, k, want in (('x', xy[0], v['grid_x']), ('y', xy[1], v['grid_y'])):
            if maps[a][v['type']].get(k) != want:
                sys.exit(f'build-grid: {name} does not resolve to its grid cell')
    return {'w': w, 'h': h, 'types': types, 'rle': rle, 'x': seg('x'), 'y': seg('y'),
            'except': dict(sorted(exc.items())), 'bits': [hasbits[t] for t in types], 'schema': 1,
            'source': {'db': label, 'file': os.path.relpath(tilegrid_path, os.path.dirname(os.path.dirname(tilegrid_path))),
                       'sha256': hashlib.sha256(raw).hexdigest(), 'tiles': len(tg)}}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('part', help='part (xc7s25csga324-1), device (xc7a35t) or fabric (xc7a50t)')
    ap.add_argument('-o', '--out', default='-')
    ap.add_argument('--db', action='append', help='prjxray-db root (repeatable); default ~/tools/prjxray-db, then the f4pga copy')
    ap.add_argument('--tilegrid', help='use this tilegrid.json directly')
    a = ap.parse_args()
    dbs = a.db or [d for d in [os.environ.get('PRJXRAY_DB')] if d] + DEFAULT_DBS
    if a.tilegrid:
        p, label = a.tilegrid, 'prjxray-db'
    else:
        db, fam, fab, p = find_tilegrid(a.part, dbs)
        try:
            rev = subprocess.run(['git', '-C', db, 'rev-parse', '--short=7', 'HEAD'], capture_output=True, text=True).stdout.strip()
        except OSError:
            rev = ''
        label = ' '.join(x for x in ['prjxray-db', rev, fam] if x)
    s = json.dumps(build(p, label), separators=(',', ':')) + '\n'
    if a.out == '-':
        sys.stdout.write(s)
    else:
        open(a.out, 'w').write(s)


if __name__ == '__main__':
    main()
