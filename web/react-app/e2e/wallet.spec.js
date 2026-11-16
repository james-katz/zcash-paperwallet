const { test, expect } = require('@playwright/test');

const ORIGIN = 'http://127.0.0.1:4173';

// Moves the pointer until the entropy collector is satisfied and the first
// wallet is on the page.
async function generateWallet(page) {
  await page.goto('/');
  await expect(page.getByText('Move your mouse to gather entropy')).toBeVisible();

  const addButton = page.getByRole('button', { name: 'Add New Wallet' });
  for (let lap = 0; lap < 40 && !(await addButton.isVisible()); lap++) {
    await page.mouse.move(200 + ((lap * 137) % 800), 150 + ((lap * 91) % 500), {
      steps: 40,
    });
  }
  await expect(addButton).toBeVisible();
}

// Compares the canvas area that holds the 24 word slots with a snapshot
// taken earlier. `mode` "save" stores the snapshot; "diff" returns how many
// pixels changed clearly since then. A count with a threshold is used rather
// than an exact hash because Chrome may move a canvas from GPU to CPU
// rasterization after a readback, which shifts anti-aliasing by a hair.
const wordArea = (mode) => {
  const canvas = document.querySelector('.paper-wallet-img canvas');
  const { data } = canvas.getContext('2d').getImageData(1140, 190, 370, 330);
  if (mode === 'save') {
    window.__wordArea = new Uint8ClampedArray(data);
    return 0;
  }
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const delta =
      Math.abs(data[i] - window.__wordArea[i]) +
      Math.abs(data[i + 1] - window.__wordArea[i + 1]) +
      Math.abs(data[i + 2] - window.__wordArea[i + 2]);
    if (delta > 200) changed += 1;
  }
  return changed;
};

// Thresholds, in pixels out of 122 100: redrawing the same content moves a
// few edge pixels at most; swapping dots for 24 words moves thousands.
const SAME = 150;
const DIFFERENT = 1500;

async function waitForCanvas(page) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.paper-wallet-img canvas');
    return canvas && canvas.width > 1000;
  });
}

const WORD_LIST = /^([a-z]+ ){23}[a-z]+$/;

test('generating a wallet makes no network request off the site', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));

  await generateWallet(page);
  await waitForCanvas(page);

  expect(requests.length).toBeGreaterThan(0);
  expect(requests.filter((url) => !url.startsWith(ORIGIN))).toEqual([]);
});

test('the wallet never reaches the browser console', async ({ page }) => {
  const lines = [];
  page.on('console', (message) => lines.push(message.text()));

  await generateWallet(page);
  await page.getByLabel('Text only').check();

  // Learn the secrets of this wallet, then make sure no console line has them.
  await page.getByRole('button', { name: 'Show recovery phrase' }).click();
  const texts = await page.locator('.wallet-card .text-content').allInnerTexts();
  const seed = texts.find((text) => WORD_LIST.test(text.trim())).trim();
  const ufvk = texts.find((text) => text.trim().startsWith('uview1')).trim();
  expect(seed.split(' ')).toHaveLength(24);

  await page.getByRole('button', { name: 'Add New Wallet' }).click();

  const leaks = lines.filter((line) => line.includes(seed) || line.includes(ufvk));
  expect(leaks).toEqual([]);
  expect(lines.filter((line) => /uview1|"seed"/.test(line))).toEqual([]);
});

test('text mode shows the recovery phrase only on request or in print', async ({ page }) => {
  await generateWallet(page);
  await page.getByLabel('Text only').check();

  const phraseOnPage = () =>
    Array.from(document.querySelectorAll('.wallet-card p')).some((p) =>
      /^([a-z]+ ){23}[a-z]+$/.test(p.textContent.trim())
    );

  expect(await page.evaluate(phraseOnPage)).toBe(false);
  await expect(page.getByText('Hidden on screen.')).toBeVisible();

  await page.getByRole('button', { name: 'Show recovery phrase' }).click();
  expect(await page.evaluate(phraseOnPage)).toBe(true);
  await page.getByRole('button', { name: 'Hide recovery phrase' }).click();
  expect(await page.evaluate(phraseOnPage)).toBe(false);

  // Print: the phrase must be in the DOM by the time beforeprint returns.
  const duringPrint = await page.evaluate((check) => {
    window.dispatchEvent(new Event('beforeprint'));
    // eslint-disable-next-line no-eval
    return eval(`(${check})()`);
  }, phraseOnPage.toString());
  expect(duringPrint).toBe(true);

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect.poll(() => page.evaluate(phraseOnPage)).toBe(false);
});

test('image mode draws the recovery phrase only on request or in print', async ({ page }) => {
  await generateWallet(page);
  await waitForCanvas(page);

  // Snapshot of the hidden state: every later reading is compared to it.
  await page.evaluate(wordArea, 'save');
  expect(await page.evaluate(wordArea, 'diff')).toBeLessThan(SAME);

  await page.getByRole('button', { name: 'Show recovery phrase' }).click();
  expect(await page.evaluate(wordArea, 'diff')).toBeGreaterThan(DIFFERENT);

  await page.getByRole('button', { name: 'Hide recovery phrase' }).click();
  expect(await page.evaluate(wordArea, 'diff')).toBeLessThan(SAME);

  // Print: the words must be on the canvas by the time beforeprint returns.
  const duringPrint = await page.evaluate((source) => {
    window.dispatchEvent(new Event('beforeprint'));
    // eslint-disable-next-line no-eval
    return eval(`(${source})('diff')`);
  }, wordArea.toString());
  expect(duringPrint).toBeGreaterThan(DIFFERENT);

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect.poll(() => page.evaluate(wordArea, 'diff')).toBeLessThan(SAME);
});

test('a real print job fires the events the page relies on', async ({ page }) => {
  await generateWallet(page);
  await waitForCanvas(page);

  await page.evaluate(() => {
    window.__printEvents = [];
    window.addEventListener('beforeprint', () => window.__printEvents.push('before'));
    window.addEventListener('afterprint', () => window.__printEvents.push('after'));
  });
  await page.pdf();

  expect(await page.evaluate(() => window.__printEvents)).toEqual(['before', 'after']);
});
