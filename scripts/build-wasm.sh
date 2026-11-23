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

# An empty argument is a mistake, a variable that was never set for example.
# It must not quietly become "build into the site".
[ "$#" -le 1 ] || fail "takes one argument at most, the output directory. Nothing was changed."
if [ "$#" -eq 1 ] && [ -z "$1" ]; then
  fail "the output directory is an empty string. Nothing was changed."
fi
dest="${1-$root/web/react-app/src/wasm}"

command -v wasm-pack >/dev/null 2>&1 || fail "wasm-pack is not installed. Nothing was changed."

# The scratch directory. Apart from it, the only thing this script removes is
# a copy of its own that it was still putting in place when it stopped.
work="$(mktemp -d)"
staged=""
cleanup() {
  rm -rf -- "$work"
  if [ -n "$staged" ]; then
    rm -f -- "$staged"
  fi
}
trap cleanup EXIT

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
# previous output: all five files and nothing else. No other directory is
# accepted, and nothing in the destination is deleted except those five
# files as the new ones take their place.
#
# Only the last part of the path is checked for a symbolic link. A link
# higher up is followed, as it would be by any command given that path, and
# the rule above then applies to the directory it leads to.
if [ -e "$dest" ] || [ -L "$dest" ]; then
  [ -d "$dest" ] && [ ! -L "$dest" ] || fail "$dest is not a directory. Nothing was changed."
  # A directory that cannot be listed is not an empty one. The list goes to
  # a file so that a find that fails stops the script here.
  find "$dest" -mindepth 1 -maxdepth 1 -print0 > "$work/listing" 2>/dev/null \
    || fail "cannot list what is in $dest. Nothing was changed."
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
  done < "$work/listing"
  if [ "$found" -ne 0 ] && [ "$found" -ne "${#outputs[@]}" ]; then
    fail "$dest holds some of the output files but not all five, so it is not a previous output. Nothing was changed."
  fi
fi

if [ -z "${CARGO_HOME:-}" ] || [ -z "${RUSTUP_HOME:-}" ]; then
  [ -n "${HOME:-}" ] || fail "HOME is not set, so the cargo and rustup directories are unknown. Nothing was changed."
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

# Build in the scratch directory and copy the five files over only when the
# build worked, so a failed build leaves the files that were there.
cd "$root/web"
wasm-pack build --target web --release --out-dir "$work/out" -- --locked
for output in "${outputs[@]}"; do
  [ -f "$work/out/$output" ] || fail "the build left no $output. Nothing was changed."
done

# Each file is copied under a name of its own and then renamed into place.
# A rename swaps the directory entry: it never writes into the file that was
# there, which could be a hard link to a file somewhere else, and it leaves
# either the old file or the new one, never half of one.
mkdir -p -- "$dest"
for output in "${outputs[@]}"; do
  staged="$dest/.$output.build-wasm.$$"
  if [ -e "$staged" ] || [ -L "$staged" ]; then
    taken="$staged"
    staged=""
    fail "$taken is in the way. Remove it and run again."
  fi
  cp -- "$work/out/$output" "$staged"
  mv -f -- "$staged" "$dest/$output"
  staged=""
done

# The checksum is for the person at the keyboard; the files are in place.
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$dest/web_bg.wasm"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$dest/web_bg.wasm"
else
  echo "build-wasm: no sha256sum or shasum here; $dest/web_bg.wasm was written." >&2
fi
