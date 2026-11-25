import { render, screen } from '@testing-library/react';
import WalletCardImg from './WalletCardImg';
import { SEED_HIDDEN_TEXT } from './WalletCard';
import { FAKE_WALLET } from '../test-utils/fakeWallet';

// A slow connection: the template is still on its way when the wallet is made.
jest.mock('./template', () => ({
  __esModule: true,
  loadTemplate: () => new Promise(() => {}),
}));

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toCanvas: () => Promise.resolve() },
}));

// An empty canvas prints as a blank sheet. Until the card is drawn, the
// wallet is on the page as a text card that only the printer sees.
test('keeps a text card for the printer while the image is on its way', async () => {
  render(<WalletCardImg wallet={FAKE_WALLET} />);

  expect(await screen.findByText(/preparing the wallet image/i)).toBeInTheDocument();
  expect(screen.queryByTestId('image-card')).not.toBeInTheDocument();

  const printOnly = screen.getByTestId('text-stand-in');
  expect(printOnly).toHaveClass('print-only');
  expect(printOnly).toHaveTextContent(FAKE_WALLET.address);
  expect(printOnly).toHaveTextContent(SEED_HIDDEN_TEXT);
  expect(printOnly).not.toHaveTextContent(FAKE_WALLET.seed);
});

// The page says "the recovery phrase is on screen" once it is asked for, so
// it has to be: the text card comes out of hiding with the words in it.
test('asking for the phrase brings the text card onto the screen', async () => {
  const { rerender } = render(<WalletCardImg wallet={FAKE_WALLET} showSeed />);

  await screen.findByText(/preparing the wallet image/i);
  const standIn = screen.getByTestId('text-stand-in');
  expect(standIn).toHaveTextContent(FAKE_WALLET.seed);
  expect(standIn).not.toHaveClass('print-only');

  rerender(<WalletCardImg wallet={FAKE_WALLET} showSeed={false} />);
  expect(screen.getByTestId('text-stand-in')).toHaveClass('print-only');
  expect(screen.getByTestId('text-stand-in')).not.toHaveTextContent(FAKE_WALLET.seed);
});
