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

# The five files this script writes, and the only ones it ever touches.
outputs=(package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts)

# The script changes directory before it builds, so a relative path would
# name two different places. A trailing slash would hide a symbolic link
# from the checks below, and ".." would make the path mean something else.
while [ "$dest" != "/" ] && [ "${dest%/}" != "$dest" ]; do
  dest="${dest%/}"
done
case "$dest" in
  /*) ;;
  *) fail "give the output directory as an absolute path, not '$dest'. Nothing was changed." ;;
esac
case "$dest/" in
  */../* | */./*) fail "give the output directory without '.' or '..' in it. Nothing was changed." ;;
esac

# The files are written into a directory that is new, empty, or holds a
# previous output: all five files and nothing else. Nothing is ever deleted
# from the destination, and no other directory is accepted.
if [ -e "$dest" ] || [ -L "$dest" ]; then
  [ -d "$dest" ] && [ ! -L "$dest" ] || fail "$dest is not a directory. Nothing was changed."
  found=0
  while IFS= read -r -d '' entry; do
    name="$(basename "$entry")"
    known=""
    for output in "${outputs[@]}"; do
      [ "$name" != "$output" ] || known="yes"
    done
    [ -n "$known" ] || fail "$dest holds '$name', which this script did not put there. Nothing was changed."
    [ -f "$entry" ] && [ ! -L "$entry" ] || fail "$dest/$name is not a plain file. Nothing was changed."
    found=$((found + 1))
  done < <(find "$dest" -mindepth 1 -maxdepth 1 -print0)
  if [ "$found" -ne 0 ] && [ "$found" -ne "${#outputs[@]}" ]; then
    fail "$dest holds some of the output files but not all five, so it is not a previous output. Nothing was changed."
  fi
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

# Build in a scratch directory and copy the five files over only when the
# build worked, so a failed build leaves the files that were there. The
# scratch directory is the only thing this script removes.
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT

cd "$root/web"
wasm-pack build --target web --release --out-dir "$work/out" -- --locked
for output in "${outputs[@]}"; do
  [ -f "$work/out/$output" ] || fail "the build left no $output. Nothing was changed."
done

mkdir -p -- "$dest"
for output in "${outputs[@]}"; do
  cp -f -- "$work/out/$output" "$dest/$output"
done

sha256sum "$dest/web_bg.wasm"
