import { render, screen } from '@testing-library/react';
import App from './App';

// An old browser that refuses WebAssembly under the page's security policy,
// or a .wasm file that did not arrive.
jest.mock('./wasm/web', () => ({
  __esModule: true,
  default: () => Promise.reject(new Error('WebAssembly.instantiate(): refused')),
  generate_wallet_with_salt: () => ({}),
}));

test('says so when the wallet generator does not load', async () => {
  render(<App />);

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/did not load/i);
  expect(alert).toHaveTextContent(/no wallet was made/i);
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  expect(screen.queryByText(/move your mouse/i)).not.toBeInTheDocument();
});
