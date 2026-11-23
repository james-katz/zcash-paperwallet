#!/usr/bin/env bash
# Run with: bash scripts/build-wasm.test.sh
#
# Checks what build-wasm.sh writes and what it leaves alone. The script works
# on the repo it sits in, so every case runs a copy of it inside a temporary
# "repo", with wasm-pack replaced by a stub: nothing is compiled.
#
# Everything happens in one temporary directory, which is removed at the end.
# If that directory cannot be made, the file stops before doing anything.
set -uo pipefail
unset CDPATH

test_file="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/build-wasm.test.sh"
source_script="$(dirname -- "$test_file")/build-wasm.sh"

stop() {
  echo "build-wasm.test: $1" >&2
  exit 1
}

# The box is removed with rm -rf at the end, so it must be the directory
# mktemp made and nothing else: not empty, not relative, not where we stand.
box="$(mktemp -d)" || stop "cannot make a temporary directory. Nothing was run."
case "$box" in
  /*) ;;
  *) stop "the temporary directory came back as '$box', not as a full path. Nothing was run." ;;
esac
[ -d "$box" ] || stop "the temporary directory $box is not there. Nothing was run."
box="$(cd -- "$box" && pwd -P)" || stop "cannot enter the temporary directory. Nothing was run."
if [ -z "$box" ] || [ "$box" = "/" ] || [ "$box" = "$(pwd -P)" ]; then
  stop "refusing to use '$box' as the temporary directory. Nothing was run."
fi
trap 'rm -rf -- "$box"' EXIT

outputs=(package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts)

# A wasm-pack that writes the five files and a .gitignore into --out-dir.
#   STUB_CONTENT     what to write in them (default: new)
#   STUB_FAILS       exit 1 before writing anything
#   STUB_LATE        write the files, then exit 1
#   STUB_PARTIAL     leave web.d.ts out
#   STUB_FLAGS       save the rustflags it was given into this file
#   STUB_CALL        save where it was run and with what into this file
#   STUB_BLOCK       create, in this directory, a file under the name the
#                    script is about to use for its copy of web.js (the
#                    script is this stub's parent, so its number is known)
#   STUB_BLOCK_LINK  the same, with a symbolic link that points nowhere
mkdir "$box/bin"
cat > "$box/bin/wasm-pack" <<'STUB'
#!/usr/bin/env bash
out=""
call=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--out-dir" ]; then
    out="$2"
    call="$call --out-dir <scratch>"
    shift 2
    continue
  fi
  call="$call $1"
  shift
done
[ -z "${STUB_FAILS:-}" ] || exit 1
[ -z "${STUB_FLAGS:-}" ] || printf '%s' "${CARGO_ENCODED_RUSTFLAGS:-}" > "$STUB_FLAGS"
[ -z "${STUB_CALL:-}" ] || printf '%s\n%s\n' "$(pwd -P)" "$call" > "$STUB_CALL"
[ -z "${STUB_BLOCK:-}" ] || echo "foreign" > "$STUB_BLOCK/.web.js.build-wasm.$PPID"
[ -z "${STUB_BLOCK_LINK:-}" ] || ln -s "$STUB_BLOCK_LINK/nowhere" "$STUB_BLOCK_LINK/.web.js.build-wasm.$PPID"
mkdir -p "$out"
for name in package.json web.js web.d.ts web_bg.wasm web_bg.wasm.d.ts .gitignore; do
  if [ -n "${STUB_PARTIAL:-}" ] && [ "$name" = "web.d.ts" ]; then continue; fi
  echo "${STUB_CONTENT:-new}" > "$out/$name"
done
[ -z "${STUB_LATE:-}" ] || exit 1
STUB
chmod +x "$box/bin/wasm-pack"

# A cp and a mv that fail on their third call, for work that stops halfway.
# With CP_HALF set, the cp leaves half a file behind before it fails.
for tool in cp mv; do
  mkdir "$box/bad$tool"
  cat > "$box/bad$tool/$tool" <<STUB
#!/usr/bin/env bash
count="\$(cat "\$CALL_COUNT" 2>/dev/null || echo 0)"
count=\$((count + 1))
echo "\$count" > "\$CALL_COUNT"
if [ "\$count" -eq 3 ]; then
  if [ -n "\${CP_HALF:-}" ]; then echo "half" > "\${@: -1}"; fi
  exit 1
fi
for real in /usr/bin/$tool /bin/$tool; do
  if [ -x "\$real" ]; then exec "\$real" "\$@"; fi
done
exit 1
STUB
  chmod +x "$box/bad$tool/$tool"
done

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

# new_repo <name>: a fresh copy of the script in a repo of its own. With
# "old" as second argument, the site already holds a previous output.
new_repo() {
  repo="$box/$1"
  site="$repo/web/react-app/src/wasm"
  mkdir -p "$repo/scripts" "$repo/web" "$repo/tmp"
  cp "$source_script" "$repo/scripts/build-wasm.sh"
  if [ "${2:-}" = "old" ]; then
    mkdir -p "$site"
    for name in "${outputs[@]}"; do echo "old" > "$site/$name"; done
  fi
}

# run [VAR=value ...] [-- argument ...]: the copy of the script in $repo, with
# the stub first on the PATH. What it prints goes to $box/last.
run() {
  local settings=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    settings+=("$1")
    shift
  done
  [ "$#" -eq 0 ] || shift
  env TMPDIR="$repo/tmp" PATH="$box/bin:/usr/bin:/bin" "${settings[@]+"${settings[@]}"}" \
    bash "$repo/scripts/build-wasm.sh" "$@" > "$box/last" 2>&1
}

# refused <words> <run arguments...>: the script fails and says <words>.
refused() {
  local words="$1"
  shift
  if run "$@"; then return 1; fi
  grep -q -- "$words" "$box/last"
}

all_are() { # all_are <word>: every output file in the site holds <word>
  local name
  for name in "${outputs[@]}"; do
    grep -qx -- "$1" "$site/$name" || return 1
  done
}
entries() { [ "$(ls -A "$1" | wc -l)" -eq "$2" ]; } # entries <dir> <count>
only_different() { # only_different <name>: --check named that file and no other
  [ "$(grep -c "DIFFERENT" "$box/last")" -eq 1 ] && grep -q "DIFFERENT  $1\$" "$box/last"
}

# --- Building into the site -------------------------------------------------

new_repo fresh
check "with no argument it builds" run STUB_CALL="$box/call"
check "into the site, which it creates" all_are new
check "five files and nothing else, no .gitignore and no copy in progress" entries "$site" 5
check "and the scratch directory is gone" entries "$repo/tmp" 0
printf '%s\n%s\n' "$repo/web" " build --target web --release --out-dir <scratch> -- --locked" > "$box/expected-call"
check "the build is run in web/, for the web, in release mode, with the lockfile" cmp -s "$box/call" "$box/expected-call"

new_repo again old
echo "keep" > "$site/notes.txt"
check "a previous output is replaced" run
check "by the five new files" all_are new
check "and a file of another name next to them is left alone" grep -qx keep "$site/notes.txt"
check "with nothing else added" entries "$site" 6

# A new file takes the place of the old one; it is not written into it. If
# the old one is a hard link, the file at the other end must not change.
new_repo linked old
echo "precious" > "$box/outside"
rm "$site/web.js"
if ln "$box/outside" "$site/web.js" 2>/dev/null; then
  check "a previous output with a hard link in it is replaced" run
  check "by the new files" all_are new
  check "and the file at the other end of the link is untouched" grep -qx precious "$box/outside"
else
  echo "skip - hard link case: this shell makes none"
fi

# --- Comparing, without writing ---------------------------------------------

new_repo same old
ls -i "$site" > "$box/inodes-before"
check "--check passes when the build is what the site holds" run STUB_CONTENT=old -- --check
check "and says so" grep -q "byte for byte" "$box/last"
ls -i "$site" > "$box/inodes-after"
check "without putting new files in place of the ones that were there" cmp -s "$box/inodes-before" "$box/inodes-after"
check "--check fails when the build differs" refused "is not what is in" -- --check
check "names the files that differ" grep -q "DIFFERENT  web_bg.wasm" "$box/last"
check "and leaves the site as it was" all_are old
check "with no copy in progress" entries "$site" 5

# One file is enough, wherever it is in the list.
new_repo onefirst old
echo "changed" > "$site/package.json"
check "--check fails when only the first file differs" refused "is not what is in" STUB_CONTENT=old -- --check
check "and names that file alone" only_different package.json
new_repo onelast old
echo "changed" > "$site/web_bg.wasm.d.ts"
check "--check fails when only the last file differs" refused "is not what is in" STUB_CONTENT=old -- --check
check "and names that file alone" only_different web_bg.wasm.d.ts
new_repo onemissing old
rm "$site/web.d.ts"
check "--check fails when only one file is missing" refused "is not what is in" STUB_CONTENT=old -- --check
check "names that file alone" only_different web.d.ts
check "and does not put it there" test ! -e "$site/web.d.ts"

new_repo absent
check "--check fails when the site holds no WASM" refused "is not what is in" -- --check
check "and does not create it" test ! -e "$repo/web/react-app"
check "nor leave its scratch directory" entries "$repo/tmp" 0

# --- Arguments --------------------------------------------------------------

new_repo args old
check "a directory as argument is refused: there is no destination to choose" refused "unknown argument" -- "$box/elsewhere"
check "and nothing is built there" test ! -e "$box/elsewhere"
check "an empty argument is refused" refused "unknown argument" -- ""
check "a misspelt --check is refused" refused "unknown argument" -- --chek
check "so is --check with something after it" refused "unknown argument" -- --checkx
check "a second argument after --check is refused" refused "takes --check or no argument" -- --check "$box/elsewhere"
check "a second argument after anything else too" refused "takes --check or no argument" -- "$box/elsewhere" --check
check "and the site is as it was after all of them" all_are old

# --- Failures ---------------------------------------------------------------

new_repo failing old
check "a build that fails is reported" refused "the build failed" STUB_FAILS=1
check "also when it fails after writing its files" refused "the build failed" STUB_LATE=1
check "a build that leaves a file out is reported" refused "left no web.d.ts" STUB_PARTIAL=1
check "and the site is as it was after all three" all_are old
check "with no copy in progress" entries "$site" 5
check "and no scratch directory left" entries "$repo/tmp" 0

new_repo nopack old
no_wasm_pack() {
  if env TMPDIR="$repo/tmp" PATH="/usr/bin:/bin" bash "$repo/scripts/build-wasm.sh" > "$box/last" 2>&1; then return 1; fi
  grep -q "wasm-pack is not installed" "$box/last"
}
if PATH="/usr/bin:/bin" command -v wasm-pack >/dev/null 2>&1; then
  echo "skip - missing wasm-pack case: there is a real one in /usr/bin or /bin"
else
  check "a missing wasm-pack is reported" no_wasm_pack
  check "and the site is as it was" all_are old
fi

new_repo halfway old
check "a copy that fails halfway is reported" refused "could not copy" CALL_COUNT="$box/cp-count" PATH="$box/badcp:$box/bin:/usr/bin:/bin"
check "and the site still holds the five old files, not a mix" all_are old
check "with the copies that were made removed" entries "$site" 5

new_repo halffile old
check "a copy that fails after writing half a file is reported" refused "could not copy" CP_HALF=1 CALL_COUNT="$box/cp-count-2" PATH="$box/badcp:$box/bin:/usr/bin:/bin"
check "the site still holds the five old files" all_are old
check "and the half file is removed with the other copies" entries "$site" 5

new_repo norename old
check "a rename that fails is reported, and says the site may be half updated" refused "may hold old and new files" CALL_COUNT="$box/mv-count" PATH="$box/badmv:$box/bin:/usr/bin:/bin"
check "the copies that were not put in place are removed" entries "$site" 5
check "and the scratch directory is gone" entries "$repo/tmp" 0

new_repo blocked old
check "a file already under the name of a copy is not overwritten" refused "is in the way" STUB_BLOCK="$box/blocked/web/react-app/src/wasm"
check "it is still there" test "$(cat "$site"/.web.js.build-wasm.* 2>/dev/null)" = "foreign"
check "the site still holds the five old files" all_are old
check "and the script's own copies are removed" entries "$site" 6

new_repo folder old
rm "$site/web.d.ts"
mkdir "$site/web.d.ts"
check "an output name that is a folder is refused" refused "is not a plain file"
check "and the files next to it are as they were" grep -qx old "$site/web_bg.wasm"
check "with no copy in progress" entries "$site" 5

new_repo sitefile
mkdir -p "$repo/web/react-app/src"
echo "keep" > "$repo/web/react-app/src/wasm"
check "a site path that is a file is refused" refused "is not a plain directory"
check "and the file is as it was" grep -qx keep "$repo/web/react-app/src/wasm"

# --- The scratch directory --------------------------------------------------

# The script changes directory before it builds. A relative TMPDIR would
# then name another place, inside the repo.
new_repo reltmp old
relative_tmpdir() { (cd "$repo" && refused "TMPDIR is a relative path" TMPDIR=tmp "$@"); }
check "a relative TMPDIR is refused" relative_tmpdir
check "also for --check" relative_tmpdir -- --check
check "nothing is made in the directory it names" entries "$repo/tmp" 0
check "nor inside web/" test ! -e "$repo/web/tmp"
check "and the site is as it was" all_are old

new_repo notmp old
check "a TMPDIR that does not exist is reported" refused "could not make a scratch directory" TMPDIR="$box/missing"
check "and the site is as it was" all_are old

# --- Symbolic links ---------------------------------------------------------

# None is followed. Skipped where the shell cannot make one.
new_repo symlinks old
echo "elsewhere" > "$box/pointed"
rm "$site/web.js"
ln -s "$box/pointed" "$site/web.js" 2>/dev/null
if [ -L "$site/web.js" ]; then
  check "an output name that is a symbolic link is refused" refused "is not a plain file"
  check "and what it points at is untouched" grep -qx elsewhere "$box/pointed"

  new_repo sitelink
  mkdir -p "$box/realsite" "$repo/web/react-app/src"
  echo "keep" > "$box/realsite/web.js"
  ln -s "$box/realsite" "$repo/web/react-app/src/wasm"
  check "a site directory that is a symbolic link is refused" refused "is a symbolic link"
  check "and what it points at is untouched" grep -qx keep "$box/realsite/web.js"
  check "with nothing added to it" entries "$box/realsite" 1

  new_repo midlink
  mkdir -p "$box/realsrc" "$repo/web/react-app"
  ln -s "$box/realsrc" "$repo/web/react-app/src"
  check "a symbolic link higher up on the way to the site is refused" refused "is a symbolic link"
  check "and nothing is made where it points" entries "$box/realsrc" 0

  new_repo weblink
  rmdir "$repo/web"
  mkdir -p "$box/realweb"
  ln -s "$box/realweb" "$repo/web"
  check "a web directory that is a symbolic link is refused" refused "is a symbolic link"
  check "and nothing is made where it points" entries "$box/realweb" 0

  new_repo danglingcopy old
  check "a symbolic link under the name of a copy is not written through" refused "is in the way" STUB_BLOCK_LINK="$box/danglingcopy/web/react-app/src/wasm"
  check "nothing is made where it points" test ! -e "$site/nowhere"
  check "and the site still holds the five old files" all_are old

  # The repo is the one the script file sits in. Reached through a link to
  # the file, it would take the place the link is in for the repo.
  new_repo owner old
  mkdir -p "$box/stranger/scripts" "$box/stranger/web"
  ln -s "$repo/scripts/build-wasm.sh" "$box/stranger/scripts/build-wasm.sh"
  through_file_link() {
    if env TMPDIR="$repo/tmp" PATH="$box/bin:/usr/bin:/bin" bash "$box/stranger/scripts/build-wasm.sh" > "$box/last" 2>&1; then return 1; fi
    grep -q "by its real path" "$box/last"
  }
  check "the script reached through a link to its file is refused" through_file_link
  check "nothing is built where the link is" test ! -e "$box/stranger/web/react-app"
  check "and its own site is as it was" all_are old

  # Cargo works on the real path of the repo, so that is the one to remap,
  # also when the repo is reached through a link.
  new_repo real
  ln -s "$box/real" "$box/alias"
  printf '%s\037%s\037%s' \
    "--remap-path-prefix=$box/c=/cargo" \
    "--remap-path-prefix=$box/r=/rustup" \
    "--remap-path-prefix=$box/real=/src" > "$box/expected-real"
  through_alias() {
    env STUB_FLAGS="$box/alias-flags" CARGO_HOME="$box/c" RUSTUP_HOME="$box/r" TMPDIR="$repo/tmp" \
      PATH="$box/bin:/usr/bin:/bin" bash "$box/alias/scripts/build-wasm.sh" > "$box/last" 2>&1
  }
  check "a repo reached through a symbolic link is built" through_alias
  check "with its real path remapped, not the link" cmp -s "$box/alias-flags" "$box/expected-real"
else
  echo "skip - symbolic link cases: this shell makes none. Run this file on Linux or in WSL before a release."
fi

# --- What the build is told -------------------------------------------------

new_repo flagged
mkdir -p "$box/cargo home" "$box/rustup=home"
printf '%s\037%s\037%s' \
  "--remap-path-prefix=$box/cargo home=/cargo" \
  "--remap-path-prefix=$box/rustup=home=/rustup" \
  "--remap-path-prefix=$repo=/src" > "$box/expected-flags"
check "a build is handed the three path remappings" run STUB_FLAGS="$box/given-flags" CARGO_HOME="$box/cargo home" RUSTUP_HOME="$box/rustup=home"
check "cargo home, rustup home and repo, in the form cargo wants" cmp -s "$box/given-flags" "$box/expected-flags"

new_repo nohome
without_home() { # without_home [VAR=value ...]: the script with HOME unset
  env -u HOME -u CARGO_HOME -u RUSTUP_HOME TMPDIR="$repo/tmp" PATH="$box/bin:/usr/bin:/bin" "$@" \
    bash "$repo/scripts/build-wasm.sh" > "$box/last" 2>&1
}
says_no_home() {
  if without_home "$@"; then return 1; fi
  grep -q "HOME is not set" "$box/last"
}
check "a build without HOME is refused, in the script's own words" says_no_home
check "also when only the cargo directory is given" says_no_home CARGO_HOME="$box/cargo home"
check "also when only the rustup directory is given" says_no_home RUSTUP_HOME="$box/rustup=home"
check "and nothing is built" test ! -e "$repo/web/react-app"
check "unless both are given" without_home CARGO_HOME="$box/cargo home" RUSTUP_HOME="$box/rustup=home"

# --- This file itself -------------------------------------------------------

# It removes its temporary directory with rm -rf. If that directory cannot be
# made, it must stop, not carry on in the directory it was started from.
if [ -z "${BUILD_WASM_TEST_NESTED:-}" ]; then
  mkdir -p "$box/started-here"
  echo "keep" > "$box/started-here/file"
  stops_without_tmp() {
    if (cd "$box/started-here" && BUILD_WASM_TEST_NESTED=1 TMPDIR="$box/missing" bash "$test_file" > "$box/last" 2>&1); then
      return 1
    fi
    grep -q "cannot make a temporary directory" "$box/last"
  }
  check "this test file stops when it cannot make its temporary directory" stops_without_tmp
  check "and deletes nothing in the directory it was started from" grep -qx keep "$box/started-here/file"
fi

echo "# failures: $failures"
[ "$failures" -eq 0 ]
