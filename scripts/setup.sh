#!/bin/bash
# Fetch the original projects (submodules), apply this repository's patches on top,
# install Silinx's Node dependencies and fpga-design-implview (+ patches) in a local Python venv.
set -e
cd "$(dirname "$0")/.."
git submodule update --init --recursive
for sub in fpga-design-implview Silinx; do
  [ -d "patches/$sub" ] || continue
  for p in patches/$sub/*.patch; do
    [ -e "$p" ] || continue
    if git -C "$sub" apply --reverse --check "../$p" 2>/dev/null; then echo "already applied: $p"
    else git -C "$sub" apply "../$p" && echo "applied: $p"; fi
  done
done
(cd Silinx && npm ci --omit=dev --ignore-scripts)
python3 -m venv .venv
.venv/bin/pip install -e fpga-design-implview
echo "setup done: run scripts/start.sh"
