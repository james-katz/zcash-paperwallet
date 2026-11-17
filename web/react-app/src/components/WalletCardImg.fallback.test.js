import { render, screen } from '@testing-library/react';
import WalletCardImg from './WalletCardImg';
import { SEED_HIDDEN_TEXT } from './WalletCard';
import { FAKE_WALLET } from '../test-utils/fakeWallet';

// Someone who switched the network off before the template arrived.
jest.mock('./template', () => ({
  __esModule: true,
  loadTemplate: () => Promise.reject(new Error('the wallet template image did not load')),
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toCanvas: () => Promise.resolve() },
}));

// Without the template the canvas stays blank, and a blank page would come
// out of the printer. The text card carries the same wallet.
test('shows the wallet as text when the template image does not load', async () => {
  render(<WalletCardImg wallet={FAKE_WALLET} />);

  expect(await screen.findByText(/image did not load/i)).toBeInTheDocument();
  expect(screen.getByText(FAKE_WALLET.address)).toBeInTheDocument();
  expect(screen.getByText(SEED_HIDDEN_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(FAKE_WALLET.seed)).not.toBeInTheDocument();
});

test('the text shown in its place still follows showSeed', async () => {
  render(<WalletCardImg wallet={FAKE_WALLET} showSeed />);

  expect(await screen.findByText(FAKE_WALLET.seed)).toBeInTheDocument();
});
