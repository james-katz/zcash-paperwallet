#!/usr/bin/env bash
# Run with: bash scripts/build-wasm.test.sh
#
# Checks what build-wasm.sh writes, and that it deletes nothing. wasm-pack
# is replaced by a stub, so nothing is compiled and the repo is not touched.
set -uo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-wasm.sh"
repo_web="$(cd "$(dirname "${BASH_SOURCE[0]}")/../web" && pwd)"
box="$(mktemp -d)"
trap 'rm -rf -- "$box"' EXIT

# A wasm-pack that writes the five files and a .gitignore into --out-dir.
#   STUB_FAILS   fail instead
#   STUB_TOUCH   also create this file, as if something wrote it mid-build
#   STUB_FLAGS   save the rustflags it was given into this file
mkdir "$box/bin"
cat > "$box/bin/wasm-pack" <<'STUB'
#!/usr/bin/env bash
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out-dir" ]; then out="$2"; fi
  shift
done
[ -z "${STUB_FAILS:-}" ] || exit 1
[ -z "${STUB_TOUCH:-}" ] || echo "mid-build" > "$STUB_TOUCH"
[ -z "${STUB_FLAGS:-}" ] || printf '%s' "${CARGO_ENCODED_RUSTFLAGS:-}" > "$STUB_FLAGS"
mkdir -p "$out"
for name in package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts .gitignore; do
  echo "new" > "$out/$name"
done
STUB
chmod +x "$box/bin/wasm-pack"

failures=0
check() { # check <description> <command...>
  local description="$1"
  shift
  if "$@"; then
    echo "ok - $description"
  else
    echo "not ok - $description"
    failures=$((failures + 1))
  fi
}

build() { PATH="$box/bin:/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1; }
build_from() { (cd "$1" && shift && PATH="$box/bin:/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1); }
build_with() { env "$1" PATH="$box/bin:/usr/bin:/bin" bash "$script" "$2" >/dev/null 2>&1; } # build_with VAR=value <dir>
build_without_wasm_pack() { PATH="/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1; }
refused() { ! "$@"; }
previous_output() { # previous_output <dir>: the five files, marked old
  mkdir -p "$1"
  for name in package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts; do
    echo "old" > "$1/$name"
  done
}
count_remaps() { [ "$(tr '\037' '\n' < "$1" | grep -c '^--remap-path-prefix=')" -eq 3 ]; }

# A relative path names one place for the checks and another for the build.
mkdir -p "$box/caller/precious"
echo "keep" > "$box/caller/precious/file"
check "a relative destination that exists is refused" refused build_from "$box/caller" precious
check "and what it named is still there" test -f "$box/caller/precious/file"
relative="zz-build-wasm-test-relative"
check "a relative destination that does not exist is refused" refused build_from "$box/caller" "$relative"
check "and nothing was made where the caller stood" test ! -e "$box/caller/$relative"
check "nor inside the repo" test ! -e "$repo_web/$relative"

check "a destination with .. in it is refused" refused build "$box/caller/../caller/out"
check "and nothing was made" test ! -e "$box/caller/out"

# Directories that are not a previous output, even when the names look right.
mkdir -p "$box/other"
echo "keep" > "$box/other/notes.txt"
check "a directory with other files is refused" refused build "$box/other"
check "and its files are still there" grep -q keep "$box/other/notes.txt"

mkdir -p "$box/project"
echo "keep" > "$box/project/README.md"
echo "keep" > "$box/project/package.json"
check "a directory holding someone's README.md and package.json is refused" refused build "$box/project"
check "and the README.md is still there" grep -q keep "$box/project/README.md"
check "and the package.json is untouched" grep -q keep "$box/project/package.json"

mkdir -p "$box/partial"
echo "keep" > "$box/partial/web.js"
check "a directory holding only one of the output names is refused" refused build "$box/partial"
check "and that file is untouched" grep -q keep "$box/partial/web.js"

previous_output "$box/extra"
echo "keep" > "$box/extra/.gitignore"
check "a previous output with one more file in it is refused" refused build "$box/extra"
check "and its files are untouched" grep -q old "$box/extra/web_bg.wasm"

mkdir -p "$box/nested/web_bg.wasm"
check "a directory where an output name is a folder is refused" refused build "$box/nested"
check "and the folder is still there" test -d "$box/nested/web_bg.wasm"

echo "keep" > "$box/afile"
check "a destination that is a file is refused" refused build "$box/afile"
check "and the file is still there" grep -q keep "$box/afile"

# The cases that must work.
check "a new directory is built" build "$box/fresh/wasm"
check "with the five files in it" test "$(ls -A "$box/fresh/wasm" | wc -l)" -eq 5
check "the WASM among them" grep -q new "$box/fresh/wasm/web_bg.wasm"
check "and no .gitignore" test ! -e "$box/fresh/wasm/.gitignore"

mkdir -p "$box/empty"
check "an empty directory is built into" build "$box/empty"
check "with the WASM in it" test -f "$box/empty/web_bg.wasm"

previous_output "$box/again"
check "a previous output is written over" build "$box/again/"
check "by the new files" grep -q new "$box/again/web_bg.wasm"
check "all five of them" refused grep -q -r old "$box/again"

mkdir -p "$box/with space"
check "a path with a space works" build "$box/with space/wasm"
check "with the WASM in it" test -f "$box/with space/wasm/web_bg.wasm"

check "a build hands the path remappings to cargo" build_with STUB_FLAGS="$box/flags" "$box/flagged"
check "three of them, separated the way cargo wants" count_remaps "$box/flags"

# Nothing is deleted, whatever turns up in the destination meanwhile.
previous_output "$box/busy"
check "a build finishes when a file appears in the destination meanwhile" build_with STUB_TOUCH="$box/busy/notes.txt" "$box/busy"
check "and that file is still there" grep -q mid-build "$box/busy/notes.txt"

# A symbolic link is not followed. Skipped where the shell cannot make one.
previous_output "$box/target"
ln -s "$box/target" "$box/link" 2>/dev/null
if [ -L "$box/link" ]; then
  check "a symbolic link is refused" refused build "$box/link"
  check "also with a trailing slash" refused build "$box/link/"
  check "and what it points at is untouched" grep -q old "$box/target/web_bg.wasm"
else
  echo "skip - symbolic link cases: this shell makes none. Run this file on Linux or in WSL before a release."
fi

# A directory that cannot be listed is not an empty one.
mkdir -p "$box/unlistable"
echo "keep" > "$box/unlistable/package.json"
chmod 300 "$box/unlistable"
check "a directory that cannot be listed is refused" refused build "$box/unlistable"
chmod 700 "$box/unlistable"
check "and the file in it is untouched" grep -q keep "$box/unlistable/package.json"

# Nor is one that find fails on, whatever the reason.
mkdir "$box/badfind"
cat > "$box/badfind/find" <<'STUB'
#!/usr/bin/env bash
exit 2
STUB
chmod +x "$box/badfind/find"
mkdir -p "$box/project2"
echo "keep" > "$box/project2/README.md"
echo "keep" > "$box/project2/package.json"
build_with_bad_find() { PATH="$box/badfind:$box/bin:/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1; }
check "a destination that find fails on is refused" refused build_with_bad_find "$box/project2"
check "and its package.json is untouched" grep -q keep "$box/project2/package.json"
check "even when it is a previous output" refused build_with_bad_find "$box/again"

# An empty argument must not become "build into the site". Run on a copy of
# the script, so that a regression writes into the box and not into the repo.
mkdir -p "$box/repo/scripts" "$box/repo/web"
cp "$script" "$box/repo/scripts/build-wasm.sh"
copy_build() { PATH="$box/bin:/usr/bin:/bin" bash "$box/repo/scripts/build-wasm.sh" "$@" >/dev/null 2>&1; }
check "an empty argument is refused" refused copy_build ""
check "and nothing was built into the default place" test ! -e "$box/repo/web/react-app"
check "a second argument is refused" refused copy_build "$box/two" "$box/three"
check "and nothing was built" test ! -e "$box/two"
check "no argument builds into the default place" copy_build
check "which is the site" test -f "$box/repo/web/react-app/src/wasm/web_bg.wasm"

# Five files are not a previous output unless they are the five.
mkdir -p "$box/fivenames"
for name in a b c d e; do echo "keep" > "$box/fivenames/$name"; done
check "five files with other names are refused" refused build "$box/fivenames"
check "and they are untouched" grep -q keep "$box/fivenames/a"

previous_output "$box/fivewithdir"
rm "$box/fivewithdir/web.d.ts"
mkdir "$box/fivewithdir/web.d.ts"
check "five entries where one output name is a folder are refused" refused build "$box/fivewithdir"
check "and the files next to it are untouched" grep -q old "$box/fivewithdir/web_bg.wasm"

# A new file takes the place of the old one; it is not written into it. If
# the old one is a hard link, the file at the other end must not change.
previous_output "$box/linked"
echo "precious" > "$box/outside"
rm "$box/linked/web.js"
if ln "$box/outside" "$box/linked/web.js" 2>/dev/null; then
  check "a previous output with a hard link in it is written over" build "$box/linked"
  check "by the new file" grep -q new "$box/linked/web.js"
  check "and the file at the other end of the link is untouched" grep -q precious "$box/outside"
else
  echo "skip - hard link case: this shell makes none"
fi
check "no copy in progress is left behind" test "$(ls -A "$box/fresh/wasm" | wc -l)" -eq 5

# Without HOME the directories to remap are unknown, unless they are given.
no_home() { env -u HOME -u CARGO_HOME -u RUSTUP_HOME PATH="$box/bin:/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1; }
given_homes() { env -u HOME CARGO_HOME="$box/cargo" RUSTUP_HOME="$box/rustup" PATH="$box/bin:/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1; }
check "a build without HOME is refused" refused no_home "$box/nohome"
check "and nothing was built" test ! -e "$box/nohome"
check "unless the cargo and rustup directories are given" given_homes "$box/nohome"

# Failures must leave what was there.
previous_output "$box/kept"
check "a failed build is reported" refused build_with STUB_FAILS=1 "$box/kept"
check "and leaves the previous output" grep -q old "$box/kept/web_bg.wasm"

check "a missing wasm-pack is reported" refused build_without_wasm_pack "$box/kept"
check "and leaves the previous output" grep -q old "$box/kept/web_bg.wasm"

echo "# failures: $failures"
[ "$failures" -eq 0 ]
