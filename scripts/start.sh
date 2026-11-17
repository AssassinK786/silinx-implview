#!/bin/bash
# Start Silinx with implview-plus available (implview on PATH). ISE_SETTINGS may point to ISE 14.7's settings64.sh.
cd "$(dirname "$0")/.."
export PATH="$PWD/.venv/bin:$PATH"
cd Silinx && exec node bin/silinx.js serve --open
