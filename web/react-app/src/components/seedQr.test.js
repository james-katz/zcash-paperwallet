import { render, waitFor } from '@testing-library/react';
import QRCode from 'qrcode';
import WalletCard from './WalletCard';
import WalletCardImg from './WalletCardImg';
import { FAKE_WALLET } from '../test-utils/fakeWallet';
import { installFakeCanvas } from '../test-utils/fakeCanvas';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toCanvas: jest.fn() },
}));

// The second argument of QRCode.toCanvas is the encoded data.
const encodedData = () => QRCode.toCanvas.mock.calls.map((call) => call[1]);

let canvas;

beforeEach(() => {
  canvas = installFakeCanvas();
});

afterEach(() => {
  canvas.restore();
});

test('the text card never encodes the recovery phrase as a QR code', async () => {
  render(<WalletCard wallet={FAKE_WALLET} />);

  await waitFor(() => expect(encodedData()).toContain(FAKE_WALLET.address));
  expect(encodedData()).not.toContain(FAKE_WALLET.seed);
});

test('the image card never encodes the recovery phrase as a QR code', async () => {
  render(<WalletCardImg wallet={FAKE_WALLET} />);

  await waitFor(() => expect(encodedData()).toContain(FAKE_WALLET.address));
  await waitFor(() => expect(canvas.ctx.drawImage).toHaveBeenCalled());
  expect(encodedData()).not.toContain(FAKE_WALLET.seed);
});
