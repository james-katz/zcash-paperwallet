#!/usr/bin/env bash
# Builds the WASM the site ships into web/react-app/src/wasm.
#
#   bash scripts/build-wasm.sh                   build into the site
#   bash scripts/build-wasm.sh /absolute/dir     build somewhere else, to compare
#
# Panic messages carry the path of the source file they come from. Without
# the remapping below, the published binary would name the home directory
# of whoever built it.
#
# The file committed in the site was built with rustc 1.100.0 (pinned in
# rust-toolchain.toml), wasm-pack 0.13.1 and the clang of wasi-sdk 34.
# wasm-pack, the wasm-opt it downloads and the C compiler are not pinned by
# this repo, and other versions of them give other bytes.
#
# Needs wasm-pack, and a C compiler that targets wasm32 for secp256k1-sys:
# set CC_wasm32_unknown_unknown and AR_wasm32_unknown_unknown if the
# default one does not.
set -euo pipefail

fail() {
  echo "build-wasm: $1" >&2
  exit 1
}

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dest="${1:-$root/web/react-app/src/wasm}"

command -v wasm-pack >/dev/null 2>&1 || fail "wasm-pack is not installed. Nothing was changed."

# The destination is replaced at the end. The script changes directory before
# it builds, so a relative path would name two different places.
case "$dest" in
  /*) ;;
  *) fail "give the output directory as an absolute path, not '$dest'. Nothing was changed." ;;
esac

# Only a new directory, an empty one or a previous output is replaced.
if [ -e "$dest" ] || [ -L "$dest" ]; then
  [ -d "$dest" ] && [ ! -L "$dest" ] || fail "$dest is not a directory. Nothing was changed."
  while IFS= read -r -d '' entry; do
    name="$(basename "$entry")"
    case "$name" in
      package.json | web.js | web.d.ts | web_bg.wasm | web_bg.wasm.d.ts | .gitignore | README.md) ;;
      *) fail "$dest holds '$name', which this script did not put there. Nothing was changed." ;;
    esac
    [ -f "$entry" ] && [ ! -L "$entry" ] || fail "$dest/$name is not a plain file. Nothing was changed."
  done < <(find "$dest" -mindepth 1 -maxdepth 1 -print0)
fi

cargo_home="${CARGO_HOME:-$HOME/.cargo}"
rustup_home="${RUSTUP_HOME:-$HOME/.rustup}"

# CARGO_ENCODED_RUSTFLAGS takes the flags separated by 0x1f, so a directory
# with a space in its name still works. It replaces RUSTFLAGS and the
# rustflags of any cargo config file.
flags=(
  "--remap-path-prefix=${cargo_home}=/cargo"
  "--remap-path-prefix=${rustup_home}=/rustup"
  "--remap-path-prefix=${root}=/src"
)
CARGO_ENCODED_RUSTFLAGS="$(IFS=$'\x1f'; printf '%s' "${flags[*]}")"
export CARGO_ENCODED_RUSTFLAGS

# Build in a scratch directory and swap it in only when the build worked, so
# a failed build leaves the files that were there.
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT

cd "$root/web"
wasm-pack build --target web --release --out-dir "$work/out" -- --locked
rm -f -- "$work/out/.gitignore"
[ -f "$work/out/web_bg.wasm" ] || fail "the build left no web_bg.wasm. Nothing was changed."

mkdir -p -- "$(dirname "$dest")"
rm -rf -- "$dest"
mv -- "$work/out" "$dest"

sha256sum "$dest/web_bg.wasm"
