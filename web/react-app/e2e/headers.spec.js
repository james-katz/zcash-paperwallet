const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const EXPECTED = {
  'content-security-policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; " +
    "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; " +
    "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), display-capture=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

// Records every CSP violation the page reports, from the first script on.
async function recordViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}

const violations = (page) => page.evaluate(() => window.__cspViolations);

async function generateWallet(page) {
  await page.goto('/');
  const addButton = page.getByRole('button', { name: 'Add New Wallet' });
  for (let lap = 0; lap < 40 && !(await addButton.isVisible()); lap++) {
    await page.mouse.move(200 + ((lap * 137) % 800), 150 + ((lap * 91) % 500), {
      steps: 40,
    });
  }
  await expect(addButton).toBeVisible();
}

test('every response carries the security headers from vercel.json', async ({ request }) => {
  for (const url of ['/', '/about', '/static/does-not-exist.js', '/manifest.json']) {
    const headers = (await request.get(url)).headers();
    for (const [name, value] of Object.entries(EXPECTED)) {
      expect(headers[name], `${name} on ${url}`).toBe(value);
    }
  }
});

test('a missing build asset is a 404, as on the live site', async ({ request }) => {
  expect((await request.get('/static/does-not-exist.js')).status()).toBe(404);
  expect((await request.get('/about')).status()).toBe(200);
});

// Headers declared by a vercel.json for every path, in either syntax.
function declaredHeaders(file) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const found = {};
  for (const rule of config.headers || []) {
    if (rule.source === '/(.*)') {
      rule.headers.forEach(({ key, value }) => { found[key.toLowerCase()] = value; });
    }
  }
  for (const route of config.routes || []) {
    if (route.src === '/(.*)' && route.headers && route.continue) {
      Object.entries(route.headers).forEach(([key, value]) => { found[key.toLowerCase()] = value; });
    }
  }
  return found;
}

// Which file Vercel reads depends on the Root Directory of the project, so
// both carry the headers and neither may drift.
test('both vercel.json files declare exactly the expected headers', () => {
  const appRoot = path.resolve(__dirname, '..', 'vercel.json');
  const repoRoot = path.resolve(__dirname, '..', '..', '..', 'vercel.json');

  expect(declaredHeaders(appRoot)).toEqual(EXPECTED);
  expect(declaredHeaders(repoRoot)).toEqual(EXPECTED);
});

test('the bundle has no inline script or style for the policy to block', () => {
  const html = fs.readFileSync(path.resolve(__dirname, '..', 'build', 'index.html'), 'utf8');

  expect(html).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/i);
  expect(html).not.toMatch(/<style/i);
  expect(html).not.toMatch(/\sstyle="/i);
});

test('the whole flow runs under the policy without a single violation', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await recordViolations(page);

  await generateWallet(page);
  await page.waitForFunction(() => {
    const canvas = document.querySelector('.paper-wallet-img canvas');
    return canvas && canvas.width > 1000;
  });
  await page.getByRole('button', { name: 'Show recovery phrase' }).click();
  await page.getByLabel('Text only').check();
  await expect(page.locator('.wallet-card canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Add New Wallet' }).click();
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page.getByText('About This Website')).toBeVisible();

  expect(await violations(page)).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('the policy is enforced: inline script and outside requests are blocked', async ({ page }) => {
  // Nothing may leave the machine even if the policy were missing.
  const outside = [];
  await page.route('https://example.com/**', (route) => {
    outside.push(route.request().url());
    return route.abort();
  });
  await recordViolations(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const script = document.createElement('script');
    script.textContent = 'window.__inlineRan = true;';
    document.body.appendChild(script);

    let fetchBlocked = false;
    try {
      await fetch('https://example.com/collect');
    } catch (error) {
      fetchBlocked = true;
    }
    return { inlineRan: window.__inlineRan === true, fetchBlocked };
  });

  expect(result).toEqual({ inlineRan: false, fetchBlocked: true });
  expect(outside).toEqual([]);
  const seen = (await violations(page)).join('\n');
  expect(seen).toMatch(/script-src/);
  expect(seen).toMatch(/connect-src https:\/\/example\.com/);
});
