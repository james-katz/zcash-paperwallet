#!/usr/bin/env bash
# Builds the WASM the site ships.
#
#   bash scripts/build-wasm.sh           build, then put the five files in
#                                        web/react-app/src/wasm of this repo
#   bash scripts/build-wasm.sh --check   build, compare with the files that
#                                        are there, and change nothing
#
# It takes no destination. It writes five files, under their own names, in
# that one directory of the repo it sits in, and leaves every other file
# there alone. It does not guard against another program changing that
# directory while it runs.
#
# Panic messages carry the path of the source file they come from. Without
# the remapping below, the published binary would name the home directory
# of whoever built it.
#
# The file committed in the site was built on Linux with rustc 1.100.0
# (pinned in rust-toolchain.toml), wasm-pack 0.13.1 and the clang of
# wasi-sdk 34. wasm-pack, the wasm-opt it downloads and the C compiler are
# not pinned by this repo, and other versions of them give other bytes.
# Run it on Linux or in WSL: under Git Bash a Windows toolchain would be
# handed paths in a form it does not use, and they would not be remapped.
#
# Needs wasm-pack, and a C compiler that targets wasm32 for secp256k1-sys:
# set CC_wasm32_unknown_unknown and AR_wasm32_unknown_unknown if the
# default one does not.
set -euo pipefail

fail() {
  echo "build-wasm: $1" >&2
  exit 1
}

mode="install"
case "$#" in
  0) ;;
  1)
    [ "$1" = "--check" ] || fail "unknown argument '$1'. Run it with no argument, or with --check. Nothing was changed."
    mode="check"
    ;;
  *) fail "takes --check or no argument at all. Nothing was changed." ;;
esac

# The physical path: it is the one cargo sees, so it is the one to remap.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
dest="$root/web/react-app/src/wasm"
outputs=(package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts)

command -v wasm-pack >/dev/null 2>&1 || fail "wasm-pack is not installed. Nothing was changed."

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

# The build goes into a scratch directory. On the way out the script removes
# that directory and any copy of its own that it had not yet put in place.
work="$(mktemp -d)"
staged=()
cleanup() {
  rm -rf -- "$work"
  local copy
  for copy in "${staged[@]+"${staged[@]}"}"; do
    rm -f -- "$copy"
  done
}
trap cleanup EXIT

checksum() { # checksum <file>: its sha256, or nothing where no tool gives one
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  fi
}

cd "$root/web"
wasm-pack build --target web --release --out-dir "$work/out" -- --locked \
  || fail "the build failed. Nothing was changed."
for output in "${outputs[@]}"; do
  [ -f "$work/out/$output" ] || fail "the build left no $output. Nothing was changed."
done
echo "build-wasm: web_bg.wasm sha256 $(checksum "$work/out/web_bg.wasm")"

if [ "$mode" = "check" ]; then
  different=""
  for output in "${outputs[@]}"; do
    if [ -f "$dest/$output" ] && cmp -s -- "$work/out/$output" "$dest/$output"; then
      echo "build-wasm: same       $output"
    else
      echo "build-wasm: DIFFERENT  $output"
      different="yes"
    fi
  done
  [ -z "$different" ] || fail "this build is not what is in $dest. Nothing was changed."
  echo "build-wasm: this build is byte for byte what is in $dest. Nothing was changed."
  exit 0
fi

# What the five names are in the destination now: nothing, or plain files.
if [ -L "$dest" ] || { [ -e "$dest" ] && [ ! -d "$dest" ]; }; then
  fail "$dest is not a plain directory. Nothing was changed."
fi
for output in "${outputs[@]}"; do
  if [ -L "$dest/$output" ] || { [ -e "$dest/$output" ] && [ ! -f "$dest/$output" ]; }; then
    fail "$dest/$output is not a plain file. Nothing was changed."
  fi
done
mkdir -p -- "$dest"

# All five files are copied in under names of their own first, and renamed
# into place only when all five are there. A rename swaps the directory
# entry: it never writes into the file that was there, which could be a hard
# link to a file somewhere else, and it leaves the old file or the new one,
# never half of one.
for output in "${outputs[@]}"; do
  copy="$dest/.$output.build-wasm.$$"
  if [ -e "$copy" ] || [ -L "$copy" ]; then
    fail "$copy is in the way. Remove it and run again. No output file was changed."
  fi
  staged+=("$copy")
  cp -- "$work/out/$output" "$copy" \
    || fail "could not copy $output into $dest. No output file was changed."
done
for output in "${outputs[@]}"; do
  if [ -L "$dest/$output" ] || [ -d "$dest/$output" ]; then
    fail "$dest/$output stopped being a plain file while this ran. $dest may hold old and new files: run again."
  fi
  mv -f -- "$dest/.$output.build-wasm.$$" "$dest/$output" \
    || fail "could not put $output in place. $dest may hold old and new files: run again."
done
staged=()

echo "build-wasm: the five files are in $dest."
