# FASM skyline (3D) for any 7-series part

`skyline/` vendors t27.ai's [FASM skyline](https://t27.ai/widgets/fasm-skyline/) widget (Apache-2.0; commit 7df7acb of
Trinity-S-AI-DNA/trinity, fetched 2026-11-17; see [skyline/NOTICE](../skyline/NOTICE)). Each tile that a FASM
configures becomes a column. Its height is the number of FASM features set in that tile. The floor is the whole die,
coloured by tile family. The view keeps upstream's colours, camera, controls (pan, zoom, rotate, Whole die / Fit
design) and PNG / STL export.

Upstream draws only the XC7A200T. This version adds three things:

- `skyline/build-grid.py <part>` builds the widget's `grid.json` for any 7-series part from prjxray-db's
  `tilegrid.json`. Part names resolve through `mapping/parts.yaml` and `devices.yaml`, so `xc7a35tcsg324-1` gives the
  xc7a50t fabric. For xc7a200t the output is byte-identical to upstream's `grid.json`, apart from the database revision
  in `source.db`.
- `skyline/make-page.mjs` writes one self-contained offline page, with the widget's JS and CSS, the grid and the FASM
  counts inline. Only the die's numbers (`K_GRID_*`, `K_CONFIG_*`) and the die's name in the texts change.
- The only code change in `tool.js` is that the data can come inline (`K_DATA_INLINE`) instead of `fetch`.

## Command line

```
scripts/skyline.sh build/openxc7/routed.fasm xc7s25csga324-1 -o blinky.html            # nextpnr FASM (openXC7)
scripts/skyline.sh build/implview/crosscheck/design.fasm xc7a35tcsg324-1 -o clock.html  # Vivado, decoded by bit2fasm
scripts/skyline.sh vivado.fasm xc7s25csga324-1 --label "Vivado" --add routed.fasm --label "openXC7" -o both.html
```

- **Inputs.** The Vivado FASM is the one Cross-Check writes, `build/implview/crosscheck/design.fasm`, or the output of
  `bit2fasm --db-root <prjxray-db>/<family> --part <part> top.bit`.
- **Samples.** `--add` puts another FASM on the page as a second sample button.
- **Counts.** `--json` also writes the counts.
- **Grid cache.** Grids are cached in `~/.cache/silinx-implview/skyline/`.
- **Databases.** The search order is `--db`, then `$PRJXRAY_DB`, then `~/tools/prjxray-db` (spartan7), then
  `~/fpga-toolchain/f4pga-xc-fasm2bels/third_party/prjxray-db` (artix7, kintex7, zynq7).
- **Requirements.** python3 and node >= 18.

`node skyline/selftest.mjs [fasm part]` checks four things:

- the xc7a200t grid is byte-identical to upstream's;
- upstream's own sample numbers (`K_NODE_*`, `K_MAC_*`, `K_CONFIG_*`) are reproduced;
- every tile of every die in the databases (xc7s25/50/100, xc7a50t/100t/200t, xc7k70t, xc7z010/020) resolves to its
  own grid cell;
- a generated page needs no other file.

The xc7a100t's `BRKH_GTX_X130Y52` shares a grid line with another X coordinate. It goes to the grid's `except` list
(upstream's script would stop on that die).

## In Silinx

Use Place & Route ▸ **3D Skyline (FASM)**, or the MCP tool `fpga_skyline`. Both are available for Vivado and openXC7
projects.

- **Which FASM is drawn.** For an openXC7 project, nextpnr's `build/openxc7/routed.fasm`. For a Vivado project,
  Cross-Check's `design.fasm` when it is at least as new as `post_route.dcp`; otherwise `bit2fasm` of Vivado's own
  `build/<top>.bit`. Silinx never draws a FASM that is older than the build, and never reads openXC7's copy of the
  bitstream as Vivado's.
- **Where the page goes.** Silinx writes the offline page to `build/skyline.html` and opens the same page in a new tab.
- **How the tab loads.** Silinx's Content-Security-Policy does not run inline scripts. The tab's page therefore loads
  the widget's code from the server, at `/vendor/skyline/` (`boot.mjs`), and its constants sit in a JSON element.
- **Where Silinx finds the widget.** `paths.skyline` in `~/.silinx/config.json`, else `<silinx>/../skyline` (the
  umbrella checkout).
- **What `fpga_skyline` returns.** The page's counts: features, tiles, tallest tile, share of the die, families, and
  the tallest columns.

## Results (2026-11-17, E2E workspace)

| Design | FASM | Part | Features | Tiles | Tallest |
|---|---|---|---|---|---|
| blinky, Arty S7-25 | Vivado, bit2fasm | xc7s25 | 2450 | 179 (3.58 %) | INT_R_X3Y36, 70 |
| blinky, Arty S7-25 | openXC7, nextpnr | xc7s25 | 4424 | 294 (5.88 %) | CLBLM_R_X3Y84, 81 |
| digital clock, Arty S7-25 | Vivado, bit2fasm | xc7s25 | 603 | 55 (1.10 %) | INT_L_X2Y65, 42 |
| digital clock, Arty S7-25 | openXC7, nextpnr | xc7s25 | 1060 | 79 (1.58 %) | CLBLL_L_X14Y70, 66 |
| digital clock, Arty A7-35 | Vivado, bit2fasm | xc7a35t (xc7a50t fabric) | 668 | 90 (0.87 %) | INT_R_X3Y49, 46 |

nextpnr's FASM has more lines than the decoded bitstream: it also lists pseudo pips and zero-bit defaults (see
Cross-Check).

Screenshots, taken with headless Edge, are in [docs/skyline/](skyline/):

- `*_vivado.png` / `*_openxc7.png` are the page;
- `*-export.png` are the widget's own Download PNG output (1200 x 630);
- `original_t27_xc7a200t.png` is upstream's page, for comparison.
