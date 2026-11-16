import { render, waitFor } from '@testing-library/react';
import WalletCardImg from './WalletCardImg';
import { FAKE_WALLET } from '../test-utils/fakeWallet';
import { installFakeCanvas } from '../test-utils/fakeCanvas';

jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toCanvas: jest.fn() },
}));

const WORDS = FAKE_WALLET.seed.split(' ');

let canvas;

beforeEach(() => {
  canvas = installFakeCanvas();
});

afterEach(() => {
  canvas.restore();
});

const seedWordsDrawn = () =>
  canvas.drawnText().filter((text) => WORDS.includes(text));

// The birthday is the last thing a finished drawing always contains.
const waitForDrawing = () =>
  waitFor(() =>
    expect(canvas.drawnText()).toContain(String(FAKE_WALLET.birthday))
  );

test('draws no recovery word on the canvas by default', async () => {
  render(<WalletCardImg wallet={FAKE_WALLET} />);
  await waitForDrawing();

  expect(seedWordsDrawn()).toEqual([]);
  expect(canvas.drawnText().join(' ')).toMatch(/hidden on screen/i);
});

test('draws the 24 words when showSeed is set, and removes them again', async () => {
  const { rerender } = render(<WalletCardImg wallet={FAKE_WALLET} />);
  await waitForDrawing();

  canvas.ctx.fillText.mockClear();
  rerender(<WalletCardImg wallet={FAKE_WALLET} showSeed />);
  // No waiting here on purpose: a print job needs the words in the same tick.
  expect(seedWordsDrawn()).toEqual(WORDS);

  canvas.ctx.fillText.mockClear();
  rerender(<WalletCardImg wallet={FAKE_WALLET} showSeed={false} />);
  expect(canvas.drawnText()).toContain(String(FAKE_WALLET.birthday));
  expect(seedWordsDrawn()).toEqual([]);
});
