#!/bin/bash
# FASM skyline (t27.ai's widget, skyline/): a 7-series FASM as a 3D skyline on its die, one offline HTML page.
#
#   scripts/skyline.sh <fasm> <part> [-o out.html] [--label TEXT] [--add <fasm2> [--label TEXT]]... [--db PRJXRAY_DB]
#
#   <fasm>  nextpnr-xilinx's FASM (openXC7: build/openxc7/routed.fasm) or a bitstream decoded by bit2fasm
#           (Vivado: build/implview/crosscheck/design.fasm, written by Cross-Check / implview crosscheck)
#   <part>  e.g. xc7s25csga324-1, xc7a35tcsg324-1, xc7a200t (any part of prjxray-db's artix7/spartan7/...)
#   --add   another FASM of the same part: one more sample button on the page (e.g. Vivado and openXC7 side by side)
#   --json  also write the counts (per sample: totals, families, every column) as JSON
#   --db    prjxray-db root (repeatable); default $PRJXRAY_DB, ~/tools/prjxray-db, then the f4pga copy
#
# The die's grid.json is built from prjxray-db's tilegrid.json (skyline/build-grid.py) and cached in
# ${XDG_CACHE_HOME:-~/.cache}/silinx-implview/skyline/. Needs python3 and node (>= 18).
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
usage() { sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-2}"; }
[ "$1" = -h ] || [ "$1" = --help ] && usage 0
[ $# -ge 2 ] || usage
fasm="$1"; part="$2"; shift 2
out=skyline.html; dbs=(); page=(--fasm "$fasm")
while [ $# -gt 0 ]; do
  case "$1" in
    -o|--out) out="$2"; shift 2 ;;
    --json) page+=(--json "$2"); shift 2 ;;
    --label|--note|--flow) page+=("$1" "$2"); shift 2 ;;
    --add) page+=(--fasm "$2"); shift 2 ;;
    --db) dbs+=(--db "$2"); shift 2 ;;
    *) echo "skyline.sh: unknown argument $1" >&2; usage ;;
  esac
done
node="${NODE:-$(command -v node || true)}"
[ -n "$node" ] || { echo "skyline.sh: node not found (set NODE=/path/to/node)" >&2; exit 1; }
cache="${XDG_CACHE_HOME:-$HOME/.cache}/silinx-implview/skyline"
mkdir -p "$cache"
key="$(printf '%s' "$part ${dbs[*]} ${PRJXRAY_DB:-}" | sha256sum | cut -c1-12)"
grid="$cache/grid-$(echo "$part" | tr 'A-Z' 'a-z')-$key.json"
if [ ! -s "$grid" ] || [ "$here/skyline/build-grid.py" -nt "$grid" ]; then
  python3 -I "$here/skyline/build-grid.py" "$part" "${dbs[@]}" -o "$grid.tmp"
  mv "$grid.tmp" "$grid"
fi
"$node" "$here/skyline/make-page.mjs" --grid "$grid" --part "$part" "${page[@]}" -o "$out"
echo "skyline: $out"
