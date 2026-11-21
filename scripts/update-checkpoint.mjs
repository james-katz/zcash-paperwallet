#!/usr/bin/env node
// Refreshes the mainnet birthday checkpoint in lib/src/checkpoint.rs.
//
//   node scripts/update-checkpoint.mjs            read the chain tip, rewrite the constants
//   node scripts/update-checkpoint.mjs --check    no network: fail if the checkpoint is too old
//   node scripts/update-checkpoint.mjs --check --max-age-days 14
//   add --file <path> to work on another copy of the constants (the tests do)
//
// The tip is read from two independent explorers. They must agree within a
// few blocks, the lower height is kept, and the checkpoint never moves back.
// In one run it never moves further ahead than MAX_BLOCKS_PER_DAY allows for
// the days gone by plus one, and --check fails on a checkpoint dated in the
// future. Run `cargo test` after it: the anchor test bounds the total.
// Run it before every release, then rebuild the WASM.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CHECKPOINT_FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'lib',
  'src',
  'checkpoint.rs'
);

export const SOURCES = [
  {
    name: 'api.blockchair.com',
    url: 'https://api.blockchair.com/zcash/stats',
    height: (body) => body.data.best_block_height,
  },
  {
    name: 'mainnet.zcashexplorer.app',
    url: 'https://mainnet.zcashexplorer.app/api/v1/blockchain-info',
    height: (body) => body.blocks,
  },
];

// Explorers lag each other by a block or two. More than this is a disagreement.
export const TOLERANCE_BLOCKS = 20;
export const DEFAULT_MAX_AGE_DAYS = 7;

// Anchored to the start of a line: a copy of a declaration inside a comment
// is not the declaration.
const HEIGHT_RE = /^(pub const CHECKPOINT_HEIGHT_MAIN: u32 = )([0-9_]+)(;)/m;
const DATE_RE = /^(pub const CHECKPOINT_DATE: &str = ")([0-9]{4}-[0-9]{2}-[0-9]{2})(";)/m;
const MAX_PER_DAY_RE = /^pub const MAX_BLOCKS_PER_DAY: u32 = ([0-9_]+);/m;

const U32_MAX = 4_294_967_295;

/** Reads the current checkpoint out of the Rust source. */
export function readCheckpoint(source) {
  const height = HEIGHT_RE.exec(source);
  const date = DATE_RE.exec(source);
  if (!height || !date) {
    throw new Error('checkpoint constants not found in checkpoint.rs');
  }
  return { height: Number(height[2].replaceAll('_', '')), date: date[2] };
}

/** The lower of the reported heights, or an error if the sources disagree. */
export function pickHeight(heights, tolerance = TOLERANCE_BLOCKS) {
  if (heights.length < 2) {
    throw new Error('need at least two sources');
  }
  for (const height of heights) {
    if (!Number.isSafeInteger(height) || height <= 0) {
      throw new Error(`not a block height: ${height}`);
    }
  }
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  if (high - low > tolerance) {
    throw new Error(`sources disagree by ${high - low} blocks (${heights.join(', ')})`);
  }
  return low;
}

/** 3580609 -> "3_580_609", the way the constant is written in Rust. */
export function rustInt(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '_');
}

/** Reads MAX_BLOCKS_PER_DAY out of the Rust source, so there is one copy. */
export function readMaxBlocksPerDay(source) {
  const match = MAX_PER_DAY_RE.exec(source);
  if (!match) {
    throw new Error('MAX_BLOCKS_PER_DAY not found in checkpoint.rs');
  }
  return Number(match[1].replaceAll('_', ''));
}

/** True for a day that exists on the calendar, written YYYY-MM-DD. */
export function isIsoDay(text) {
  if (typeof text !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text)) {
    return false;
  }
  // 2026-11-31 parses as the first of December; a real day comes back as itself.
  const time = Date.parse(`${text}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === text;
}

function dayToTime(text) {
  if (!isIsoDay(text)) {
    throw new Error(`not an ISO day: ${text}`);
  }
  return Date.parse(`${text}T00:00:00Z`);
}

/** The UTC day of a clock reading, or an error if the reading is not a date. */
function clockDay(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('the clock of this machine gave no usable date');
  }
  return now.toISOString().slice(0, 10);
}

/** Whole days from one ISO day to another. Negative when `to` is earlier. */
export function daysBetween(from, to) {
  return Math.round((dayToTime(to) - dayToTime(from)) / 86_400_000);
}

/**
 * Returns the Rust source with the new height and date. Never moves back,
 * and never further ahead than the chain can have gone since the checkpoint
 * that is already there: a height above the real tip would hide funds.
 *
 * The limit is a sanity bound, not a proof: MAX_BLOCKS_PER_DAY is twice the
 * measured rate and one extra day is allowed, so it stops a wrong source or
 * a typo, and the two sources and the margin do the rest. It grows with the
 * date, which is why a date after today is refused. It is counted from the
 * checkpoint that is there, so it bounds one run, not a day: run again and
 * again, the script would allow one more day each time. The total is bounded
 * by the anchor test in checkpoint.rs, which runs with `cargo test`.
 */
export function rewrite(source, height, date, now = new Date()) {
  const current = readCheckpoint(source);
  if (typeof height !== 'number' || !Number.isSafeInteger(height) || height <= 0 || height > U32_MAX) {
    throw new Error(`not a block height: ${height}`);
  }
  if (height < current.height) {
    throw new Error(`refusing to move the checkpoint back: ${current.height} -> ${height}`);
  }
  if (!isIsoDay(date)) {
    throw new Error(`not an ISO day: ${date}`);
  }
  const today = clockDay(now);
  if (daysBetween(today, date) > 0) {
    throw new Error(`${date} is in the future: today is ${today} (UTC). Check the clock of this machine.`);
  }
  const days = daysBetween(current.date, date);
  if (days < 0) {
    throw new Error(`${date} is before the current checkpoint date, ${current.date}`);
  }
  const ceiling = current.height + (days + 1) * readMaxBlocksPerDay(source);
  if (height > ceiling) {
    throw new Error(
      `${height} is a height the chain cannot have reached: at most ${ceiling} by ${date}, ` +
        `counting from ${current.height} on ${current.date}`
    );
  }
  return source
    .replace(HEIGHT_RE, (_, before, __, after) => before + rustInt(height) + after)
    .replace(DATE_RE, (_, before, __, after) => before + date + after);
}

/** Whole days between the checkpoint date and now (UTC). */
export function ageInDays(date, now = new Date()) {
  clockDay(now);
  return Math.floor((now.getTime() - dayToTime(date)) / 86_400_000);
}

/** The age of the checkpoint in days, or an error if it fails `--check`. */
export function checkAge(current, maxAge, now = new Date()) {
  if (!Number.isFinite(maxAge) || maxAge < 0) {
    throw new Error('--max-age-days needs a number of days');
  }
  const age = ageInDays(current.date, now);
  if (age < 0) {
    throw new Error(`checkpoint date ${current.date} is in the future. Check it, and the clock of this machine.`);
  }
  if (age > maxAge) {
    throw new Error(
      `checkpoint ${current.height} is ${age} days old (limit ${maxAge}). Run this script without --check.`
    );
  }
  return age;
}

async function fetchHeight(source) {
  const response = await fetch(source.url, {
    headers: { accept: 'application/json', 'user-agent': 'update-checkpoint' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${source.name} answered ${response.status}`);
  }
  return source.height(await response.json());
}

async function main(argv) {
  // --file points the command at another copy of the constants. The tests
  // use it; a release always works on lib/src/checkpoint.rs.
  const fileFlag = argv.indexOf('--file');
  if (fileFlag !== -1 && !argv[fileFlag + 1]) {
    throw new Error('--file needs a path');
  }
  const file = fileFlag === -1 ? CHECKPOINT_FILE : path.resolve(argv[fileFlag + 1]);
  const source = readFileSync(file, 'utf8');
  const current = readCheckpoint(source);

  if (argv.includes('--check')) {
    const flag = argv.indexOf('--max-age-days');
    const maxAge = flag === -1 ? DEFAULT_MAX_AGE_DAYS : Number(argv[flag + 1]);
    const age = checkAge(current, maxAge);
    console.log(`checkpoint ${current.height} from ${current.date} is ${age} days old: ok`);
    return;
  }

  const heights = await Promise.all(SOURCES.map(fetchHeight));
  SOURCES.forEach((entry, index) => console.log(`${entry.name}: ${heights[index]}`));
  const height = pickHeight(heights);
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  writeFileSync(file, rewrite(source, height, date, now));
  console.log(`checkpoint ${current.height} (${current.date}) -> ${height} (${date})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`update-checkpoint: ${error.message}`);
    process.exit(1);
  });
}
