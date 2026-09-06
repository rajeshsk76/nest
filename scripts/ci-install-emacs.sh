#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update
sudo apt-get install -y --no-install-recommends emacs-nox
emacs --version | head -1
# Proven locally: GNU Emacs 30.1; ubuntu runners log whatever emacs-nox ships.
