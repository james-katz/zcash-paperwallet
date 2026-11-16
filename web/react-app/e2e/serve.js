// Minimal static server for the end-to-end tests.
//
// Serves ./build the way the deployment does: files first, index.html for
// any other path, plus every header declared in the repository vercel.json.
// It exists so the Content-Security-Policy is exercised against the real
// bundle before anything is deployed. It is not meant for production.

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'build');
const VERCEL_JSON = path.resolve(__dirname, '..', '..', '..', 'vercel.json');
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
  try {
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
  } catch (error) {
    return [];
  }
}

const rules = headerRules();

function resolveFile(urlPath) {
  const wanted = path.normalize(path.join(ROOT, decodeURIComponent(urlPath)));
  if (wanted.startsWith(ROOT) && fs.existsSync(wanted) && fs.statSync(wanted).isFile()) {
    return wanted;
  }
  return path.join(ROOT, 'index.html');
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
    response.setHeader(
      'Content-Type',
      TYPES[path.extname(file)] || 'application/octet-stream'
    );
    fs.createReadStream(file).pipe(response);
  })
  .listen(PORT, '127.0.0.1');
