// Run with: node --test scripts/update-checkpoint.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CHECKPOINT_FILE,
  ageInDays,
  pickHeight,
  readCheckpoint,
  rewrite,
  rustInt,
} from './update-checkpoint.mjs';

const SAMPLE = [
  'pub const CHECKPOINT_HEIGHT_MAIN: u32 = 3_580_609;',
  'pub const CHECKPOINT_DATE: &str = "2026-11-16";',
  'pub const BIRTHDAY_MARGIN: u32 = 7_000;',
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
