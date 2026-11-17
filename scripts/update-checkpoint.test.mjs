// Run with: node --test scripts/update-checkpoint.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CHECKPOINT_FILE,
  ageInDays,
  checkAge,
  daysBetween,
  pickHeight,
  readMaxBlocksPerDay,
  readCheckpoint,
  rewrite,
  rustInt,
} from './update-checkpoint.mjs';

const SAMPLE = [
  'pub const CHECKPOINT_HEIGHT_MAIN: u32 = 3_580_609;',
  'pub const CHECKPOINT_DATE: &str = "2026-11-16";',
  'pub const BIRTHDAY_MARGIN: u32 = 7_000;',
  'pub const MAX_BLOCKS_PER_DAY: u32 = 6_912;',
].join('\n');

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
  const updated = rewrite(SAMPLE, 3_600_000, '2026-11-22');
  assert.deepEqual(readCheckpoint(updated), { height: 3_600_000, date: '2026-11-22' });
  assert.ok(updated.includes('pub const CHECKPOINT_HEIGHT_MAIN: u32 = 3_600_000;'));
  assert.ok(updated.includes('pub const BIRTHDAY_MARGIN: u32 = 7_000;'));
});

test('never moves the checkpoint back', () => {
  assert.throws(() => rewrite(SAMPLE, 3_580_608, '2026-11-22'), /move the checkpoint back/);
});

test('rejects a date that is not an ISO day', () => {
  assert.throws(() => rewrite(SAMPLE, 3_600_000, '22/11/2026'), /ISO day/);
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

test('counts whole days between two ISO days', () => {
  assert.equal(daysBetween('2026-11-16', '2026-11-16'), 0);
  assert.equal(daysBetween('2026-11-16', '2026-11-22'), 6);
  assert.equal(daysBetween('2026-11-16', '2026-11-15'), -1);
});

// A height above the real tip would hide funds on restore, so a jump the
// chain cannot have made is refused even when both sources report it.
test('refuses a height the chain cannot have reached since the checkpoint', () => {
  // Same day: one day of blocks at most.
  assert.ok(rewrite(SAMPLE, 3_580_609 + 6_912, '2026-11-16'));
  assert.throws(() => rewrite(SAMPLE, 3_580_609 + 6_913, '2026-11-16'), /cannot have reached/);
  // Six days later: seven days of blocks at most.
  assert.ok(rewrite(SAMPLE, 3_580_609 + 7 * 6_912, '2026-11-22'));
  assert.throws(() => rewrite(SAMPLE, 3_580_609 + 7 * 6_912 + 1, '2026-11-22'), /cannot have reached/);
  assert.throws(() => rewrite(SAMPLE, 35_806_090, '2026-11-22'), /cannot have reached/);
});

test('refuses a date before the checkpoint that is already there', () => {
  assert.throws(() => rewrite(SAMPLE, 3_580_700, '2026-11-15'), /before the current checkpoint/);
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

test('--check rejects a limit that is not a number', () => {
  const current = { height: 3_580_609, date: '2026-11-16' };
  assert.throws(() => checkAge(current, Number('abc'), new Date('2026-11-17T12:00:00Z')), /--max-age-days/);
});
