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
- `patches/Silinx/` (coming): Vivado backend for *View Implemented Design*, an openXC7 flow, a *Cross-check* process
  (AGPL-3.0-only, as Silinx).

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
- Silinx integration (Vivado backend for *View Implemented Design*, an openXC7 flow, a *Cross-check* process):
  in progress; it will be added as `patches/Silinx/`.
- UltraScale+ / Versal: untested (no device files installed); Versal has no open bitstream database, so only
  Vivado-internal consistency checks are possible there.
