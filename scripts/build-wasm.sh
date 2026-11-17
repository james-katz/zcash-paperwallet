#!/usr/bin/env bash
# Builds the WASM the site ships into web/react-app/src/wasm.
#
#   bash scripts/build-wasm.sh              build into the site
#   bash scripts/build-wasm.sh /some/dir    build somewhere else, to compare
#
# Panic messages carry the path of the source file they come from. Without
# the remapping below, the published binary would name the home directory
# of whoever built it. With it, two people on the pinned toolchain get the
# same paths in the binary whatever their own directories are called.
#
# Needs wasm-pack, and a C compiler that targets wasm32 for secp256k1-sys:
# set CC_wasm32_unknown_unknown and AR_wasm32_unknown_unknown if the
# default one does not.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="${1:-$root/web/react-app/src/wasm}"
cargo_home="${CARGO_HOME:-$HOME/.cargo}"
rustup_home="${RUSTUP_HOME:-$HOME/.rustup}"

# CARGO_ENCODED_RUSTFLAGS takes the flags separated by 0x1f, so a directory
# with a space in its name still works. It replaces RUSTFLAGS if that is set.
flags=(
  "--remap-path-prefix=${cargo_home}=/cargo"
  "--remap-path-prefix=${rustup_home}=/rustup"
  "--remap-path-prefix=${root}=/src"
)
CARGO_ENCODED_RUSTFLAGS="$(IFS=$'\x1f'; printf '%s' "${flags[*]}")"
export CARGO_ENCODED_RUSTFLAGS

rm -rf "$out"
cd "$root/web"
wasm-pack build --target web --release --out-dir "$out" -- --locked
rm -f "$out/.gitignore"

sha256sum "$out/web_bg.wasm"
