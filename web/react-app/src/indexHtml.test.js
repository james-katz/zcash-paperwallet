import { readFileSync } from 'fs';
import path from 'path';

const html = readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const page = new DOMParser().parseFromString(html, 'text/html');

// A browser that translates a page sends its text to a translation service.
// With the recovery phrase on screen, that text includes the 24 words.
test('the page asks browsers not to translate it', () => {
  expect(page.documentElement.getAttribute('translate')).toBe('no');
  expect(page.querySelector('meta[name="google"]')?.getAttribute('content')).toBe('notranslate');
});
