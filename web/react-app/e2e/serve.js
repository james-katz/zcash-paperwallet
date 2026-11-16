// Minimal static server for the end-to-end tests.
//
// Serves ./build the way the live site answers: files first, 404 for a
// missing file under /static, index.html for any other path, plus every
// header declared in a vercel.json. It exists so the Content-Security-Policy
// is exercised against the real bundle before anything is deployed. It is
// not meant for production, and it does not prove what Vercel will send.
//
// The live site behaves like a Vercel project rooted at web/react-app, where
// Vercel reads web/react-app/vercel.json and ignores the one at the top of
// the repository. Both files declare the headers, and headers.spec.js checks
// that they stay equal. VERCEL_JSON picks the file to serve from.

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'build');
const VERCEL_JSON = process.env.VERCEL_JSON
  ? path.resolve(process.env.VERCEL_JSON)
  : path.resolve(__dirname, '..', 'vercel.json');
const PORT = Number(process.env.PORT || 4173);

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

// vercel.json can declare headers in two ways: the "headers" array, or a
// legacy route with "headers" and "continue": true. Both are read here.
function headerRules() {
  const config = JSON.parse(fs.readFileSync(VERCEL_JSON, 'utf8'));
  const modern = (config.headers || []).map((rule) => ({
    source: rule.source,
    headers: rule.headers.map(({ key, value }) => [key, value]),
  }));
  const legacy = (config.routes || [])
    .filter((route) => route.headers && route.continue)
    .map((route) => ({
      source: route.src,
      headers: Object.entries(route.headers),
    }));
  // The sources used in vercel.json are plain "/(.*)" style patterns,
  // which are valid regular expressions as written.
  return [...modern, ...legacy].map((rule) => ({
    pattern: new RegExp(`^${rule.source}$`),
    headers: rule.headers,
  }));
}

// A missing or broken vercel.json stops the server: serving without the
// headers would let the tests pass against nothing.
const rules = headerRules();

function resolveFile(urlPath) {
  const wanted = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));
  if (wanted.startsWith(ROOT) && fs.existsSync(wanted) && fs.statSync(wanted).isFile()) {
    return wanted;
  }
  // The live site answers 404 for a missing build asset and falls back to
  // index.html for everything else.
  return urlPath.startsWith('/static/') ? null : path.join(ROOT, 'index.html');
}

http
  .createServer((request, response) => {
    const urlPath = new URL(request.url, 'http://localhost').pathname;
    const file = resolveFile(urlPath);

    rules
      .filter((rule) => rule.pattern.test(urlPath))
      .forEach((rule) =>
        rule.headers.forEach(([key, value]) => response.setHeader(key, value))
      );
    if (!file) {
      response.statusCode = 404;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.end('Not Found');
      return;
    }
    response.setHeader(
      'Content-Type',
      TYPES[path.extname(file)] || 'application/octet-stream'
    );
    fs.createReadStream(file).pipe(response);
  })
  .listen(PORT, '127.0.0.1');
