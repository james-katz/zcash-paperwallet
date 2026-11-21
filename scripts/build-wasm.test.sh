#!/usr/bin/env bash
# Run with: bash scripts/build-wasm.test.sh
#
# Checks what build-wasm.sh deletes and what it refuses to delete. wasm-pack
# is replaced by a stub, so nothing is compiled and the repo is not touched.
set -uo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-wasm.sh"
box="$(mktemp -d)"
trap 'rm -rf -- "$box"' EXIT

# A wasm-pack that writes the five files and a .gitignore into --out-dir,
# or fails when STUB_FAILS is set.
mkdir "$box/bin"
cat > "$box/bin/wasm-pack" <<'STUB'
#!/usr/bin/env bash
out=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out-dir" ]; then out="$2"; fi
  shift
done
[ -z "${STUB_FAILS:-}" ] || exit 1
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
build_without_wasm_pack() { PATH="/usr/bin:/bin" bash "$script" "$@" >/dev/null 2>&1; }
refused() { ! "$@"; }

# A relative path names one place for rm and another for the build.
mkdir -p "$box/caller/precious"
echo "keep" > "$box/caller/precious/file"
check "a relative destination is refused" refused bash -c "cd '$box/caller' && PATH='$box/bin:/usr/bin:/bin' bash '$script' precious >/dev/null 2>&1"
check "and what it named is still there" test -f "$box/caller/precious/file"

# A directory that is not a previous output.
mkdir -p "$box/other"
echo "keep" > "$box/other/notes.txt"
check "a directory with other files is refused" refused build "$box/other"
check "and its files are still there" test -f "$box/other/notes.txt"

mkdir -p "$box/nested/web_bg.wasm"
check "a directory where an output name is a folder is refused" refused build "$box/nested"
check "and the folder is still there" test -d "$box/nested/web_bg.wasm"

echo "keep" > "$box/afile"
check "a destination that is a file is refused" refused build "$box/afile"
check "and the file is still there" test -f "$box/afile"

# The cases that must work.
check "a new directory is built" build "$box/fresh/wasm"
check "with the WASM in it" test -f "$box/fresh/wasm/web_bg.wasm"
check "and no .gitignore" test ! -e "$box/fresh/wasm/.gitignore"

mkdir -p "$box/empty"
check "an empty directory is built into" build "$box/empty"
check "with the WASM in it" test -f "$box/empty/web_bg.wasm"

echo "old" > "$box/fresh/wasm/web_bg.wasm"
check "a previous output is replaced" build "$box/fresh/wasm"
check "by the new file" grep -q new "$box/fresh/wasm/web_bg.wasm"

mkdir -p "$box/with space"
check "a path with a space works" build "$box/with space/wasm"
check "with the WASM in it" test -f "$box/with space/wasm/web_bg.wasm"

# Failures must leave what was there.
echo "old" > "$box/fresh/wasm/web_bg.wasm"
check "a failed build is reported" refused env STUB_FAILS=1 PATH="$box/bin:/usr/bin:/bin" bash "$script" "$box/fresh/wasm"
check "and leaves the previous output" grep -q old "$box/fresh/wasm/web_bg.wasm"

check "a missing wasm-pack is reported" refused build_without_wasm_pack "$box/fresh/wasm"
check "and leaves the previous output" grep -q old "$box/fresh/wasm/web_bg.wasm"

echo "# failures: $failures"
[ "$failures" -eq 0 ]
