import { render, screen } from '@testing-library/react';
import App from './App';

// The real loader fetches the .wasm file; unit tests replace it with a stub.
// Plain functions on purpose: CRA sets resetMocks, which would wipe a jest.fn
// implementation before the test runs.
jest.mock('./wasm/web', () => ({
  __esModule: true,
  default: () => Promise.resolve({ generate_wallet_with_salt: () => ({}) }),
}));

test('loads the WASM module and shows the entropy collector', async () => {
  render(<App />);
  expect(
    await screen.findByText(/move your mouse to gather entropy/i)
  ).toBeInTheDocument();
});
