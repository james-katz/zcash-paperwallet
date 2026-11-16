#!/usr/bin/env node
// Refreshes the mainnet birthday checkpoint in lib/src/checkpoint.rs.
//
//   node scripts/update-checkpoint.mjs            read the chain tip, rewrite the constants
//   node scripts/update-checkpoint.mjs --check    no network: fail if the checkpoint is too old
//   node scripts/update-checkpoint.mjs --check --max-age-days 14
//
// The tip is read from two independent explorers. They must agree within a
// few blocks, the lower height is kept, and the checkpoint never moves back.
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

const HEIGHT_RE = /(pub const CHECKPOINT_HEIGHT_MAIN: u32 = )([0-9_]+)(;)/;
const DATE_RE = /(pub const CHECKPOINT_DATE: &str = ")([0-9]{4}-[0-9]{2}-[0-9]{2})(";)/;

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

/** Returns the Rust source with the new height and date. Never moves back. */
export function rewrite(source, height, date) {
  const current = readCheckpoint(source);
  if (height < current.height) {
    throw new Error(`refusing to move the checkpoint back: ${current.height} -> ${height}`);
  }
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    throw new Error(`not an ISO day: ${date}`);
  }
  return source
    .replace(HEIGHT_RE, (_, before, __, after) => before + rustInt(height) + after)
    .replace(DATE_RE, (_, before, __, after) => before + date + after);
}

/** Whole days between the checkpoint date and now (UTC). */
export function ageInDays(date, now = new Date()) {
  const then = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(then)) {
    throw new Error(`not an ISO day: ${date}`);
  }
  return Math.floor((now.getTime() - then) / 86_400_000);
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
  const source = readFileSync(CHECKPOINT_FILE, 'utf8');
  const current = readCheckpoint(source);

  if (argv.includes('--check')) {
    const flag = argv.indexOf('--max-age-days');
    const maxAge = flag === -1 ? DEFAULT_MAX_AGE_DAYS : Number(argv[flag + 1]);
    const age = ageInDays(current.date);
    if (!(age <= maxAge)) {
      throw new Error(
        `checkpoint ${current.height} is ${age} days old (limit ${maxAge}). Run this script without --check.`
      );
    }
    console.log(`checkpoint ${current.height} from ${current.date} is ${age} days old: ok`);
    return;
  }

  const heights = await Promise.all(SOURCES.map(fetchHeight));
  SOURCES.forEach((entry, index) => console.log(`${entry.name}: ${heights[index]}`));
  const height = pickHeight(heights);
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(CHECKPOINT_FILE, rewrite(source, height, date));
  console.log(`checkpoint ${current.height} (${current.date}) -> ${height} (${date})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(`update-checkpoint: ${error.message}`);
    process.exit(1);
  });
}
