import { SEED_HIDDEN_TEXT } from './WalletCard';
import { SEED_HIDDEN_NOTE } from './WalletCardImg';

// If a browser prints the page without the words, this placeholder is what
// ends up on the paper. It has to be true there too.
test.each([
  ['text card', SEED_HIDDEN_TEXT],
  ['image card', SEED_HIDDEN_NOTE.join(' ')],
])('the %s placeholder tells someone holding the paper that the print failed', (_, text) => {
  expect(text).toMatch(/hidden on screen/i);
  expect(text).toMatch(/on paper/i);
  expect(text).toMatch(/print failed/i);
  expect(text).toMatch(/do not use this wallet/i);
  expect(text).not.toMatch(/appear on the printed page/i);
});
