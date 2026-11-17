# silinx-implview

An ISE-style FPGA IDE ([Silinx](https://github.com/pmnmalo/Silinx)) combined with a Vivado implemented-design viewer
([implview-plus](https://github.com/AssassinK786/implview-plus)) for Xilinx 7-series (UltraScale+ / Versal planned),
with open-source cross-verification of the bitstream (openXC7: Yosys, nextpnr-xilinx, prjxray).

| Submodule | What | License |
|---|---|---|
| `Silinx/` | Project Navigator-style IDE: HDL editor, schematics, simulation, board emulator, ISE / Vivado / open flows | AGPL-3.0-only |
| `implview-plus/` | Device view of a routed Vivado checkpoint: sites by module, LUT equations, routed nets, clock network, timing paths; `crosscheck` against prjxray `bit2fasm` | MIT |

Each submodule keeps its own license; the files in this repository (scripts, docs) are MIT.

## Get it

```
git clone --recurse-submodules https://github.com/AssassinK786/silinx-implview.git
cd silinx-implview
scripts/setup.sh        # Node.js deps for Silinx, Python venv for implview-plus
scripts/start.sh        # start Silinx with implview-plus on the PATH; open the printed URL
```

Requirements: Linux or WSL2, Node.js >= 18, Python >= 3.11, Vivado (7-series device files) for Vivado builds and checkpoint
export, and for the open flow and cross-check: Yosys, nextpnr-xilinx (with chipdbs), prjxray + prjxray-db, openFPGALoader.

## Status

- implview-plus: 7-series viewer + cross-check working (100 % BEL / LUT INIT / FF / pip agreement with the bitstream on
  Artix-7 and Spartan-7 test designs).
- Silinx integration (Vivado backend for *View Implemented Design*, an openXC7 flow, a *Cross-check* process):
  in progress on the `Silinx` submodule's integration branch; the submodule currently tracks upstream Silinx `main`.
- UltraScale+ / Versal: untested (no device files installed); Versal has no open bitstream database, so only
  Vivado-internal consistency checks are possible there.
