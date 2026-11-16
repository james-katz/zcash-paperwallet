import { render, screen } from '@testing-library/react';
import WalletCard from './WalletCard';
import { FAKE_WALLET } from '../test-utils/fakeWallet';
import { installFakeCanvas } from '../test-utils/fakeCanvas';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toCanvas: () => {} },
}));

let canvas;

beforeEach(() => {
  canvas = installFakeCanvas();
});

afterEach(() => {
  canvas.restore();
});

// A bare number means nothing to someone restoring the wallet years later.
test('the text card says what the birthday height is for', () => {
  render(<WalletCard wallet={FAKE_WALLET} />);

  const line = screen.getByText(/Wallet birthday/);
  expect(line).toHaveTextContent(String(FAKE_WALLET.birthday));
  expect(line).toHaveTextContent('The wallet syncs from this block.');
});
