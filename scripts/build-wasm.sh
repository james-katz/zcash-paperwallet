#!/usr/bin/env bash
# Builds the WASM the site ships.
#
#   bash scripts/build-wasm.sh           build, then put the five files in
#                                        web/react-app/src/wasm of this repo
#   bash scripts/build-wasm.sh --check   build, compare with the files that
#                                        are there, and change no site file
#
# It takes no destination. It writes five files, under their own names, in
# that one directory of the repo it sits in, and leaves every other file
# there alone.
#
# What it does not do:
# - Like any build, it fills cargo's target directory and the caches of
#   cargo and wasm-pack. "No site file was changed" is about the site.
# - It does not guard against another program changing the site directory
#   while it runs.
# - Stopped by a signal sent to it alone, it cleans up and exits, but the
#   build it started may go on for a while and write in its scratch
#   directory again.
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
unset CDPATH

fail() {
  echo "build-wasm: $1" >&2
  exit 1
}

mode="install"
case "$#" in
  0) ;;
  1)
    [ "$1" = "--check" ] || fail "unknown argument '$1'. Run it with no argument, or with --check. No site file was changed."
    mode="check"
    ;;
  *) fail "takes --check or no argument at all. No site file was changed." ;;
esac

# The repo is the one this file sits in, so the file has to be reached by
# its own path: through a symbolic link it would name another place.
self="${BASH_SOURCE[0]:-}"
if [ -z "$self" ] || [ ! -f "$self" ] || [ -L "$self" ]; then
  fail "run this script as a file, by its real path, not through a symbolic link or a pipe. No site file was changed."
fi

# The physical path: it is the one cargo sees, so it is the one to remap.
# The x keeps a newline at the end of a directory name from being dropped.
root="$(cd -- "$(dirname -- "$self")/.." && pwd -P && printf x)" \
  || fail "cannot tell which repo this script is in. No site file was changed."
root="${root%x}"
root="${root%$'\n'}"
dest="$root/web/react-app/src/wasm"
outputs=(package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts)

# No part of the way to the site may be a symbolic link: the build and the
# five files would land where the link points.
for part in "$root/web" "$root/web/react-app" "$root/web/react-app/src" "$dest"; do
  [ ! -L "$part" ] || fail "$part is a symbolic link. No site file was changed."
done
[ -d "$root/web" ] || fail "$root/web is not a directory. No site file was changed."

command -v wasm-pack >/dev/null 2>&1 || fail "wasm-pack is not installed. No site file was changed."

if [ -z "${CARGO_HOME:-}" ] || [ -z "${RUSTUP_HOME:-}" ]; then
  [ -n "${HOME:-}" ] || fail "HOME is not set, so the cargo and rustup directories are unknown. No site file was changed."
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

# The build goes into a scratch directory. The script changes directory
# before it builds, so that directory has to be named in full: a relative
# TMPDIR would give a name that means another place afterwards.
case "${TMPDIR:-/tmp}" in
  /*) ;;
  *) fail "TMPDIR is a relative path ('${TMPDIR:-}'). Give it in full or unset it. No site file was changed." ;;
esac
work="$(mktemp -d)" || fail "could not make a scratch directory. No site file was changed."
case "$work" in
  /*) ;;
  *) fail "the scratch directory came back as '$work', not as a full path. No site file was changed." ;;
esac
[ -d "$work" ] || fail "the scratch directory $work is not there. No site file was changed."

# On the way out the script removes that directory and any copy of its own
# that it had not yet put in place.
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

cd -- "$root/web" || fail "cannot enter $root/web. No site file was changed."
wasm-pack build --target web --release --out-dir "$work/out" -- --locked \
  || fail "the build failed. No site file was changed."
for output in "${outputs[@]}"; do
  [ -f "$work/out/$output" ] || fail "the build left no $output. No site file was changed."
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
  [ -z "$different" ] || fail "this build is not what is in $dest. No site file was changed."
  echo "build-wasm: this build is byte for byte what is in $dest. No site file was changed."
  exit 0
fi

# What the five names are in the destination now: nothing, or plain files.
if [ -L "$dest" ] || { [ -e "$dest" ] && [ ! -d "$dest" ]; }; then
  fail "$dest is not a plain directory. No site file was changed."
fi
for output in "${outputs[@]}"; do
  if [ -L "$dest/$output" ] || { [ -e "$dest/$output" ] && [ ! -f "$dest/$output" ]; }; then
    fail "$dest/$output is not a plain file. No site file was changed."
  fi
done
mkdir -p -- "$dest" || fail "could not make $dest. No site file was changed."

# All five files are copied in under names of their own first, and renamed
# into place only when all five are there. A rename swaps the directory
# entry: it never writes into the file that was there, which could be a hard
# link to a file somewhere else, and it leaves the old file or the new one,
# never half of one.
for output in "${outputs[@]}"; do
  copy="$dest/.$output.build-wasm.$$"
  if [ -e "$copy" ] || [ -L "$copy" ]; then
    fail "$copy is in the way. Remove it and run again. No site file was changed."
  fi
  staged+=("$copy")
  cp -- "$work/out/$output" "$copy" \
    || fail "could not copy $output into $dest. No site file was changed."
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
