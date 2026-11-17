# Silinx 7-series guide: implview viewer, openXC7 flow, Cross-Check, 3D Skyline

Branch `implview-openxc7` of `~/ext/silinx/repo`, based on pmnmalo/Silinx `main` at 5ee9ec0.
Patches: `patches/Silinx/` (applied by `scripts/setup.sh`).

The work was tested on the 7-series only. The code is family-neutral, but UltraScale+ and Versal are untested,
because the Vivado 2025.2.1 install here has only 7-series parts.

## What it adds

| Feature | Where in the interface | MCP tool |
|---|---|---|
| View Implemented Design (FPGA) of an AMD Vivado build | Processes ▸ Implement Design ▸ Place & Route ▸ View Implemented Design (FPGA) | `fpga_view` (and `run_process` runs the `fpgaview` step) |
| Open 7-series flow (openXC7): Yosys `synth_xilinx`, nextpnr-xilinx, fasm2frames, xc7frames2bit | Design Properties ▸ Synthesis Tool ▸ "openXC7 (Yosys + nextpnr-xilinx; no Vivado needed)" | `set_design_properties synth_tool=openxc7`, then `run_process` |
| View Implemented Design of an openXC7 build | the same process | `fpga_view` |
| Cross-Check Implementation against Bitstream | Place & Route ▸ Cross-Check… (Vivado and openXC7 projects only) | `cross_check` |
| 3D Skyline (FASM): the build's FASM per tile, drawn on the die ([SKYLINE.md](SKYLINE.md)) | Place & Route ▸ 3D Skyline (FASM) (Vivado and openXC7 projects; opens a tab) | `fpga_skyline` |

## Setup (`~/.silinx/config.json`)

Program paths can only be set in `config.json`, never through the HTTP API, which is Silinx's rule for any setting
that names a program. The `openxc7` block follows the same rule.

```json
{
  "vivado": { "mode": "local", "settings": "/opt/Xilinx/2025.2.1/Vivado/settings64.sh" },
  "paths": {
    "implview": "<umbrella>/.venv/bin/implview",
    "yosys": "~/.local/bin/yosys",
    "nextpnr-xilinx": "~/fpga-toolchain/nextpnr_main_corrected/build_fresh/nextpnr-xilinx",
    "fasm2frames": "~/tools/litex_wrap/bin/fasm2frames",
    "xc7frames2bit": "~/tools/litex_wrap/bin/xc7frames2bit",
    "bit2fasm": "~/tools/litex_wrap/bin/bit2fasm"
  },
  "openxc7": {
    "chipdbs": { "xc7s25csga324-1": "~/fpga-toolchain/nextpnr-xilinx/xc7s25csga324-1_new.chipdb" },
    "chipdbDir": "",
    "prjxrayDb": "~/tools/prjxray-db"
  }
}
```

- **implview.** Silinx looks for it in this order:
  1. `paths.implview`;
  2. `<silinx>/../.venv/bin/implview` (the umbrella checkout's sibling, installed by `setup.sh`);
  3. `implview` on PATH.

  It runs as a separate program. Silinx reads only its output files. Its cache, which holds the device file of each
  part, is kept in `build/implview/cache`.
- **Vivado.** implview uses Vivado for `export`, `device` and `crosscheck`. It must be the local Vivado
  (`vivado.mode: local`): implview gets `IMPLVIEW_VIVADO=<settings dir>/bin/vivado`.
- **nextpnr-xilinx and chipdb must match.** For the xc7s25, use `nextpnr_main_corrected/build_fresh` with
  `xc7s25csga324-1_new.chipdb`. The openXC7 0.8.2 binary in `~/tools/openxc7` rejects that chipdb with "internal IDs
  inconsistent". The default `xc7s25csga324-1.chipdb` was regenerated on the correct XC7S25 grid and is also usable (the old one, built on the xc7s50 grid, is kept as `*.WRONG_xc7s50_grid`; see `~/fpga-toolchain/nextpnr-xilinx/XC7S25_CHIPDB_README.txt`). `_v3.chipdb` has the wrong grid.
- **`bit2fasm` wrapper.** `~/tools/litex_wrap/bin/bit2fasm` (and `bitread`) is a new wrapper. It runs the unpacked
  openXC7's python3.8 `bit2fasm.py` through the system loader, like the other `litex_wrap` wrappers.
- **Database.** `~/tools/prjxray-db` has only `spartan7`. The open flow therefore works for the Spartan-7 only until
  `artix7` is added. Cross-Check of a Vivado Artix-7 build still works, because implview finds another prjxray-db on
  its own.
- **Backup.** The original config is saved as `~/.silinx/config.json.bak-implview`. Its `vivado.mode` was `docker`.

## Using it

1. **Create a project.** Make a project for a 7-series board or part, for example the Arty S7-25 (`arty-s7`, variant
   25). Trust it: Trust Project, or `"trusted": true` for a project an assistant made.
2. **Vivado flow.** Set Synthesis Tool to Vivado and run Generate Programming File.
   - View Implemented Design (FPGA) then runs `implview export --detail` on `build/post_route.dcp`. This takes about
     12 s for blinky.
   - The view shows the chip on Vivado's tile grid, with the sites coloured by module.
   - Click a site to see its cells:
     - LUT equations over the BEL pins A1..A6, minimised from INIT and the pin map, with the input nets;
     - flip-flops with INIT, set/reset and sync/async;
     - an IOB's pad, direction and I/O standard.
   - Pick a net to see its driver, its loads and the tiles of its route.
   - The Clock network button shows the global clock nets.
   - Selecting a module in the Design hierarchy and selecting it on the chip select each other.
3. **openXC7 flow.** Set Synthesis Tool to openXC7 and run Generate Programming File.
   - **Output files:** everything goes into `build/openxc7/`. The `.bit` is copied to `build/<top>.bit`, so Configure
     Target Device (openFPGALoader) programs it.
   - **Reports:** the Design Summary uses `reports.json` (`source: openxc7`): Yosys statistics, nextpnr utilisation, and
     nextpnr's timing estimate per clock.
   - **Constraints:** the XDC is rewritten into a form nextpnr-xilinx reads (`build/openxc7/nextpnr.xdc`).
     `create_clock` becomes `--freq`. The constraints nextpnr cannot read are listed as INFO lines.
   - **Sources:** Verilog is read by Yosys with `-defer`, which keeps the hierarchy. VHDL and drawings go through the
     Silinx front end as one flat Verilog module, so the hierarchy is flattened.
   - **View:** the FPGA view is `implview import-nextpnr`'s placement plus nextpnr's own INITs, ports and ROUTING.
4. **Cross-Check.**
   - **Vivado build:** runs `implview crosscheck`. It decodes the bitstream with bit2fasm and compares it with the
     export: BELs, physical LUT INIT, FF settings, pips, `report_route_status`, and ROUTE vs `get_nodes`.
   - **openXC7 build:** decodes the bitstream with bit2fasm and compares it bit by bit with nextpnr's FASM. Every
     difference must be a feature with no configuration bit (pseudo pips, zero-bit defaults, defaults of unused pads).
     The decoded FASM is then encoded again and compared with the build's frames.
   - **Both builds present:** adds a Vivado-vs-open table.
   - **Output:** the report goes to the console, `build/crosscheck.txt` and `build/crosscheck.json`.
   - **UltraScale+ / Versal:** reported as not cross-checkable: "prjuray partial (UltraScale+)" or "no open bitstream
     database (Versal)". Only Vivado's own checks run.

MCP example:

```
set_design_properties {project, synth_tool: "openxc7"}
run_process {project, process: "bitstream"}
fpga_view {project}
fpga_view {project, site: "SLICE_X2Y45"}
fpga_view {project, net: "clk_IBUF_BUFG"}
cross_check {project}
```

## Results (2026-11-17)

| Design | Flow | Build | View | Cross-Check |
|---|---|---|---|---|
| blinky, Arty S7-25 | Vivado | ok, 64 s | 75 sites, 363 nets, modules u_count/u_display/u_knight/u_pre/u_speed | slices 47/47, LUT/FF BELs 100 %, LUT INIT 116/119 (3 LUT1 in carry chains, see Limitations), FF/CE/SR 100 %, pips 1235/1236, route_status 0 errors, ROUTE vs nodes 100 % |
| blinky, Arty S7-25 | openXC7 | ok, 6 s | 123 sites (flat: VHDL) | 10841 vs 9603 set bits; identical on every feature with bits (1559 pseudo pips, 321 zero-bit defaults); frames identical (2624) |
| digital clock (no ILA), Arty S7-25 | Vivado | ok | u_clk/u_div/u_cnt, u_clk/u_sec | 14/14 slices, LUT INIT 13/13, FF 33, pips 270/270, 100 % |
| digital clock, Arty S7-25 | openXC7 | ok | 31 sites | identical on every feature with bits (373 pseudo pips; 204 zero-bit + 54 unused-pad defaults); frames identical |
| digital clock, Arty S7-25 | both | | | Vivado vs open flow: slices 14 vs 21, LUTs 13 vs 88, FFs 33 vs 33, CARRY4 7 vs 10, PIPs 429 vs 951 |
| digital clock, xc7a35tcsg324-1 (Arty A7 pins) | Vivado | ok | ok | 14/14 slices, LUT INIT 13/13, pips 321/321, 100 % |

The digital clock was built from `~/fpga-projects/digital_clock/rtl` with `USE_ILA(0)`, because Silinx's Vivado flow
takes HDL only. The Arty A7 build used the commercial part xc7a35tcsg324-1, which has the same fabric as the board's
xc7a35ticsg324-1L.

No hardware was programmed: no Digilent device was attached (`usbipd list`).

## Limitations

- **UltraScale+ / Versal untested.** The model and the view are family-neutral: tiles from implview's device file,
  site types by name. Cross-Check reports these families as not cross-checkable.
- **Vivado in implview must be local.** Docker or ssh Vivado is not passed to implview.
- **Open flow on VHDL designs:** the design is flattened by the Silinx front end, so most sites colour as the top
  module and the nets have Yosys names. Verilog-only designs keep their hierarchy.
- **Open flow device file:** `implview device <part>` needs Vivado once per part. After that, the build's cache
  holds the device file.
- **Remaining Vivado Cross-Check mismatches.** On Vivado blinky, implview crosscheck reports two kinds of mismatch.
  Neither is investigated; the second may be the same effect.
  - Three LUT1 cells whose decoded INIT differs from the predicted one. All three are inverters in carry-chain
    A6LUTs with I0 on A3.
  - One pip (`INT_L_X0Y67.IMUX_L34.ER1END1`) is missing from the bitstream. It is probably the same LUT pin effect
    (Vivado rewriting the LUT and its pins after routing).
- **Timing:** the open flow's timing is nextpnr's estimate only.
- **Not done:**
  - no UI test (`test/ui/`) for the new process and the openXC7 descriptor;
  - the Vivado `fpgaview` step goes to implview whatever Toolchain Settings' Vivado mode is.

