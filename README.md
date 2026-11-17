# silinx-implview

An ISE-style FPGA IDE ([Silinx](https://github.com/pmnmalo/Silinx)) combined with a Vivado implemented-design viewer
([fpga-design-implview](https://github.com/rardino/fpga-design-implview)) for Xilinx 7-series (UltraScale+ / Versal planned),
with open-source cross-verification of the bitstream (openXC7: Yosys, nextpnr-xilinx, prjxray).

| Submodule (original repository, unmodified) | What | License |
|---|---|---|
| `Silinx/` → [pmnmalo/Silinx](https://github.com/pmnmalo/Silinx) | Project Navigator-style IDE: HDL editor, schematics, simulation, board emulator, ISE / Vivado / open flows | AGPL-3.0-only |
| `fpga-design-implview/` → [rardino/fpga-design-implview](https://github.com/rardino/fpga-design-implview) | Device view of a routed Vivado checkpoint | MIT |

This repository's own additions are kept as patches in `patches/<submodule>/`, applied on top of the pinned upstream
commits by `scripts/setup.sh`:

- `patches/fpga-design-implview/`: detailed export (LUT INIT + pin map, FF settings, routed nets), interactive viewer
  (module tree, LUT equations, net routes, clock network, timing paths), `crosscheck` against prjxray `bit2fasm`,
  `import-nextpnr` for the open flow (MIT, as the upstream project).
- `patches/Silinx/`: Vivado backend for *View Implemented Design (FPGA)* (through `implview`), an **openXC7** synthesis
  tool for 7-series parts (Yosys → nextpnr-xilinx → prjxray → `.bit`), and a **Cross-Check** process and MCP tool
  (AGPL-3.0-only, as Silinx). See [docs/SILINX_7SERIES_GUIDE.md](docs/SILINX_7SERIES_GUIDE.md).

Each submodule and its patches keep that project's license; the scripts and docs of this repository are MIT.

## Get it

```
git clone --recurse-submodules https://github.com/AssassinK786/silinx-implview.git
cd silinx-implview
scripts/setup.sh        # Node.js deps for Silinx, Python venv for fpga-design-implview (+ patches)
scripts/start.sh        # start Silinx with implview on the PATH; open the printed URL
```

Requirements: Linux or WSL2, Node.js >= 18, Python >= 3.11, Vivado (7-series device files) for Vivado builds and checkpoint
export, and for the open flow and cross-check: Yosys, nextpnr-xilinx (with chipdbs), prjxray + prjxray-db, openFPGALoader.

## Status

- fpga-design-implview patches: 7-series viewer + cross-check working (100 % BEL / LUT INIT / FF / pip agreement with the bitstream on
  Artix-7 and Spartan-7 test designs).
- Silinx patches: Vivado and openXC7 flows end to end on Arty S7-25 (blinky, digital clock); cross-check of Vivado
  builds 100 % on most categories (a few LUT1-in-carry-chain INIT and one pip difference under investigation), openXC7
  builds bit-identical to nextpnr's FASM after re-encoding; Artix-7 Vivado build 100 %.
- UltraScale+ / Versal: untested (no device files installed); Versal has no open bitstream database, so only
  Vivado-internal consistency checks are possible there.
