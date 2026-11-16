import { render, screen } from '@testing-library/react';
import App from './App';

// The loader resolves to the raw WASM exports. Their functions take a
// pointer and a length, so a Uint8Array passed to them is read as an empty
// slice and the collected entropy is dropped without any error. The page
// must get the typed wrapper that web.js exports by name.
jest.mock('./wasm/web', () => ({
  __esModule: true,
  default: () =>
    Promise.resolve({ generate_wallet_with_salt: () => ({ from: 'raw export' }) }),
  generate_wallet_with_salt: () => ({ from: 'typed wrapper' }),
}));

jest.mock('./pages/Home', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ wasm }) =>
      React.createElement(
        'p',
        null,
        `wallets come from the ${wasm.generate_wallet_with_salt(new Uint8Array(1)).from}`
      ),
  };
});

test('hands the typed wrapper to the page, not the raw WASM export', async () => {
  render(<App />);

  expect(await screen.findByText('wallets come from the typed wrapper')).toBeInTheDocument();
});
