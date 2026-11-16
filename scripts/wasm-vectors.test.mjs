// Run with: node --test scripts/wasm-vectors.test.mjs
//
// Loads the WASM file the site ships and checks it against the Rust sources:
// same keys as the vectors in lib/src/paper.rs, and the birthday from
// lib/src/checkpoint.rs. It fails when the committed WASM is older than the
// Rust code, so a rebuild cannot be forgotten.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

import { readCheckpoint } from './update-checkpoint.mjs';
import {
  initSync,
  generate_wallet_from_entropy,
  generate_wallet_with_salt,
} from '../web/react-app/src/wasm/web.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(path.join(root, ...parts), 'utf8');

const paperRs = read('lib', 'src', 'paper.rs');
const checkpointRs = read('lib', 'src', 'checkpoint.rs');
const glue = read('web', 'react-app', 'src', 'wasm', 'web.js');

// The expected values are read from the Rust test, so there is one copy of them.
function rustVector(call) {
  const at = paperRs.indexOf(`assert_eq!(wallet.${call}, "`);
  assert.notEqual(at, -1, `vector for ${call} not found in paper.rs`);
  const start = paperRs.indexOf('"', at) + 1;
  return paperRs.slice(start, paperRs.indexOf('"', start));
}

function margin() {
  const match = /pub const BIRTHDAY_MARGIN: u32 = ([0-9_]+);/.exec(checkpointRs);
  assert.ok(match, 'BIRTHDAY_MARGIN not found in checkpoint.rs');
  return Number(match[1].replaceAll('_', ''));
}

// Same entropy as test_generate_wallet_from_entropy in lib/src/paper.rs: bytes 0 to 31.
const ENTROPY = Uint8Array.from({ length: 32 }, (_, index) => index);

initSync({ module: readFileSync(path.join(root, 'web', 'react-app', 'src', 'wasm', 'web_bg.wasm')) });
const wallet = generate_wallet_from_entropy(ENTROPY);

test('the shipped WASM derives the same phrase as the Rust vector', () => {
  assert.equal(wallet.seed, rustVector('get_seed_phrase()'));
});

test('the shipped WASM derives the same viewing key as the Rust vector', () => {
  assert.equal(wallet.ufvk, rustVector('get_ufvk()'));
});

test('the shipped WASM derives the same unified address as the Rust vector', () => {
  assert.equal(wallet.address, rustVector('get_unified_address(vec![])'));
});

test('the shipped WASM takes the birthday from the checkpoint in the source', () => {
  assert.equal(wallet.birthday, readCheckpoint(checkpointRs).height - margin());
});

test('the WASM glue never reads the clock', () => {
  assert.ok(!glue.includes('getTime'), 'web.js calls getTime');
  assert.ok(!glue.includes('new Date'), 'web.js creates a Date');
});

test('a salted wallet is a fresh 24 word phrase each time', () => {
  const first = generate_wallet_with_salt(new Uint8Array(32));
  const second = generate_wallet_with_salt(new Uint8Array(32));
  assert.equal(first.seed.split(' ').length, 24);
  assert.notEqual(first.seed, second.seed);
  assert.equal(first.birthday, wallet.birthday);
});
