#!/bin/bash
# Install Silinx's Node dependencies and implview-plus in a local Python venv.
set -e
cd "$(dirname "$0")/.."
git submodule update --init --recursive
(cd Silinx && npm ci --omit=dev --ignore-scripts)
python3 -m venv .venv
.venv/bin/pip install -e implview-plus
echo "setup done: run scripts/start.sh"
