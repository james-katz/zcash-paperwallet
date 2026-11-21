// Run with: node --test scripts/update-checkpoint.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import {
  CHECKPOINT_FILE,
  ageInDays,
  checkAge,
  daysBetween,
  isIsoDay,
  pickHeight,
  readCheckpoint,
  readMaxBlocksPerDay,
  rewrite,
  rustInt,
} from './update-checkpoint.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'update-checkpoint.mjs');

const sample = (height = '3_580_609', date = '2026-11-16') =>
  [
    `pub const CHECKPOINT_HEIGHT_MAIN: u32 = ${height};`,
    `pub const CHECKPOINT_DATE: &str = "${date}";`,
    'pub const BIRTHDAY_MARGIN: u32 = 7_000;',
    'pub const MAX_BLOCKS_PER_DAY: u32 = 6_912;',
  ].join('\n');

const SAMPLE = sample();

// The day the tests pretend it is: nine days after the sample checkpoint.
const NOW = new Date('2026-11-25T12:00:00Z');

test('reads the checkpoint that is committed in checkpoint.rs', () => {
  const checkpoint = readCheckpoint(readFileSync(CHECKPOINT_FILE, 'utf8'));
  assert.ok(Number.isSafeInteger(checkpoint.height) && checkpoint.height > 2_726_400);
  assert.match(checkpoint.date, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
});

test('keeps the lower height when the sources agree', () => {
  assert.equal(pickHeight([3_580_612, 3_580_609]), 3_580_609);
});

test('fails when the sources disagree', () => {
  assert.throws(() => pickHeight([3_580_609, 3_590_000]), /disagree/);
});

test('fails on one source, or on something that is not a height', () => {
  assert.throws(() => pickHeight([3_580_609]), /two sources/);
  assert.throws(() => pickHeight([3_580_609, undefined]), /not a block height/);
  assert.throws(() => pickHeight([3_580_609, '3580609']), /not a block height/);
});

test('writes the new height and date, and nothing else', () => {
  const updated = rewrite(SAMPLE, 3_600_000, '2026-11-22', NOW);
  assert.deepEqual(readCheckpoint(updated), { height: 3_600_000, date: '2026-11-22' });
  assert.ok(updated.includes('pub const CHECKPOINT_HEIGHT_MAIN: u32 = 3_600_000;'));
  assert.ok(updated.includes('pub const BIRTHDAY_MARGIN: u32 = 7_000;'));
});

test('never moves the checkpoint back', () => {
  assert.throws(() => rewrite(SAMPLE, 3_580_608, '2026-11-22', NOW), /move the checkpoint back/);
});

test('rejects a date that is not an ISO day', () => {
  assert.throws(() => rewrite(SAMPLE, 3_600_000, '22/11/2026', NOW), /ISO day/);
});

test('formats integers the way Rust source writes them', () => {
  assert.equal(rustInt(3580609), '3_580_609');
  assert.equal(rustInt(999), '999');
  assert.equal(rustInt(1000), '1_000');
});

test('measures the age of a checkpoint in whole days', () => {
  assert.equal(ageInDays('2026-11-16', new Date('2026-11-16T22:00:00Z')), 0);
  assert.equal(ageInDays('2026-11-16', new Date('2026-11-24T01:00:00Z')), 8);
});

test('reads the daily ceiling from the Rust source', () => {
  assert.equal(readMaxBlocksPerDay(SAMPLE), 6_912);
  assert.equal(readMaxBlocksPerDay(readFileSync(CHECKPOINT_FILE, 'utf8')), 6_912);
});

// A copy of a declaration inside a comment is not the declaration.
test('reads the constants from their own lines, not from a comment', () => {
  const decoy = [
    '// pub const MAX_BLOCKS_PER_DAY: u32 = 999_999;',
    '// pub const CHECKPOINT_HEIGHT_MAIN: u32 = 1;',
    '// pub const CHECKPOINT_DATE: &str = "2020-01-01";',
    SAMPLE,
  ].join('\n');
  assert.equal(readMaxBlocksPerDay(decoy), 6_912);
  assert.deepEqual(readCheckpoint(decoy), { height: 3_580_609, date: '2026-11-16' });
  assert.ok(rewrite(decoy, 3_600_000, '2026-11-22', NOW).includes('// pub const CHECKPOINT_HEIGHT_MAIN: u32 = 1;'));
});

test('tells a calendar day from something that only looks like one', () => {
  assert.equal(isIsoDay('2026-11-16'), true);
  assert.equal(isIsoDay('2028-02-29'), true);
  assert.equal(isIsoDay('2026-11-31'), false);
  assert.equal(isIsoDay('2027-02-30'), false);
  assert.equal(isIsoDay('2026-13-01'), false);
  assert.equal(isIsoDay('22/11/2026'), false);
  assert.equal(isIsoDay(20261116), false);
});

test('counts whole days between two ISO days', () => {
  assert.equal(daysBetween('2026-11-16', '2026-11-16'), 0);
  assert.equal(daysBetween('2026-11-16', '2026-11-22'), 6);
  assert.equal(daysBetween('2026-11-16', '2026-11-15'), -1);
  assert.throws(() => daysBetween('2026-11-16', '2026-11-31'), /ISO day/);
});

// A height above the real tip would hide funds on restore, so a jump the
// chain cannot have made is refused even when both sources report it.
test('refuses a height the chain cannot have reached since the checkpoint', () => {
  // Same day: one day of blocks at most.
  assert.ok(rewrite(SAMPLE, 3_580_609 + 6_912, '2026-11-16', NOW));
  assert.throws(() => rewrite(SAMPLE, 3_580_609 + 6_913, '2026-11-16', NOW), /cannot have reached/);
  // Six days later: seven days of blocks at most.
  assert.ok(rewrite(SAMPLE, 3_580_609 + 7 * 6_912, '2026-11-22', NOW));
  assert.throws(() => rewrite(SAMPLE, 3_580_609 + 7 * 6_912 + 1, '2026-11-22', NOW), /cannot have reached/);
  assert.throws(() => rewrite(SAMPLE, 35_806_090, '2026-11-22', NOW), /cannot have reached/);
});

test('refuses a date before the checkpoint that is already there', () => {
  assert.throws(() => rewrite(SAMPLE, 3_580_700, '2026-11-15', NOW), /before the current checkpoint/);
});

// The ceiling grows with the date, so a date ahead of the clock would let
// any height through.
test('refuses a date after today, whatever the height', () => {
  assert.ok(rewrite(SAMPLE, 3_600_000, '2026-11-25', NOW));
  assert.throws(() => rewrite(SAMPLE, 3_600_000, '2026-11-26', NOW), /in the future/);
  assert.throws(() => rewrite(SAMPLE, 6_110_401, '2027-11-16', NOW), /in the future/);
  assert.throws(() => rewrite(SAMPLE, 99_999_999, '2099-01-01', NOW), /in the future/);
});

test('refuses a day that is not on the calendar', () => {
  const later = new Date('2027-03-15T12:00:00Z');
  assert.throws(() => rewrite(SAMPLE, 3_600_000, '2026-11-31', later), /ISO day/);
  assert.throws(() => rewrite(SAMPLE, 3_600_000, '2027-02-30', later), /ISO day/);
});

test('refuses a height that is not a whole number of blocks', () => {
  for (const height of [NaN, undefined, null, 3_580_700.5, '3_580_700', '3580700', '4_000_000_000', Infinity, {}]) {
    assert.throws(() => rewrite(SAMPLE, height, '2026-11-22', NOW), /not a block height/, String(height));
  }
  // More than a u32 holds, even where the ceiling would allow it.
  const far = sample('4_294_967_290', '2026-11-16');
  assert.throws(() => rewrite(far, 4_294_967_296, '2026-11-22', NOW), /not a block height/);
});

test('refuses to work without a clock it can read', () => {
  assert.throws(() => rewrite(SAMPLE, 3_600_000, '2026-11-22', new Date('nonsense')), /clock/);
  assert.throws(() => checkAge({ height: 3_580_609, date: '2026-11-16' }, 7, new Date('nonsense')), /clock/);
});

test('--check accepts a fresh checkpoint and rejects an old one', () => {
  const current = { height: 3_580_609, date: '2026-11-16' };
  assert.equal(checkAge(current, 7, new Date('2026-11-23T12:00:00Z')), 7);
  assert.throws(() => checkAge(current, 7, new Date('2026-11-24T12:00:00Z')), /8 days old/);
});

// A date ahead of the clock has a negative age, which would pass any limit.
test('--check rejects a checkpoint dated in the future', () => {
  const current = { height: 3_580_609, date: '2026-11-16' };
  assert.throws(() => checkAge(current, 7, new Date('2026-11-15T12:00:00Z')), /in the future/);
});

test('--check rejects a limit that is not a number, and a date that is not a day', () => {
  const current = { height: 3_580_609, date: '2026-11-16' };
  assert.throws(() => checkAge(current, Number('abc'), new Date('2026-11-17T12:00:00Z')), /--max-age-days/);
  assert.throws(() => checkAge({ height: 3_580_609, date: '2026-02-31' }, 7, NOW), /ISO day/);
});

// The tests above call the functions. These run the command itself, on a
// copy of the constants, so they fail if --check stops using them.
function runCheck(date, ...extra) {
  const folder = mkdtempSync(path.join(tmpdir(), 'checkpoint-'));
  try {
    const file = path.join(folder, 'checkpoint.rs');
    writeFileSync(file, sample('3_580_609', date));
    const result = spawnSync(process.execPath, [SCRIPT, '--check', '--file', file, ...extra], {
      encoding: 'utf8',
    });
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

test('the --check command passes a checkpoint read today', () => {
  const result = runCheck(isoDay(0));
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /0 days old: ok/);
});

test('the --check command fails on a checkpoint dated in the future', () => {
  const result = runCheck(isoDay(40));
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /in the future/);
});

test('the --check command fails on an old checkpoint, within the limit it is given', () => {
  const old = runCheck(isoDay(-30));
  assert.equal(old.status, 1, old.output);
  assert.match(old.output, /30 days old/);

  assert.equal(runCheck(isoDay(-30), '--max-age-days', '45').status, 0);
  assert.equal(runCheck(isoDay(-30), '--max-age-days', 'abc').status, 1);
});

test('the command fails on --file without a path', () => {
  const result = spawnSync(process.execPath, [SCRIPT, '--check', '--file'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--file needs a path/);
});
