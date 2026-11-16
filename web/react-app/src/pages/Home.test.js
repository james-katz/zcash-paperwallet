import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from './Home';
import {
  FAKE_WALLET,
  consoleLeaks,
  spyOnConsole,
} from '../test-utils/fakeWallet';

// The real collector listens to pointer movement on window. Here a button
// stands in for "the user finished moving the mouse".
jest.mock('../components/EntropyCollector', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ onEntropyCollected }) =>
      React.createElement(
        'button',
        { onClick: () => onEntropyCollected(new Uint8Array(512).fill(7)) },
        'finish collecting'
      ),
  };
});

// The image card draws on a canvas, which jsdom does not implement.
jest.mock('../components/WalletCardImg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'wallet-img' }),
  };
});

function fakeWasm() {
  return { generate_wallet_with_salt: jest.fn(() => FAKE_WALLET) };
}

async function generateFirstWallet(wasm) {
  render(<Home wasm={wasm} />);
  await userEvent.click(screen.getByText('finish collecting'));
  await screen.findByTestId('wallet-img');
}

test('feeds the collected pointer entropy to every wallet, the first included', async () => {
  const wasm = fakeWasm();

  await generateFirstWallet(wasm);
  await userEvent.click(screen.getByText('Add New Wallet'));

  expect(wasm.generate_wallet_with_salt).toHaveBeenCalledTimes(2);
  wasm.generate_wallet_with_salt.mock.calls.forEach(([salt]) => {
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt).toHaveLength(512);
    expect(Array.from(salt).every((byte) => byte === 7)).toBe(true);
  });
});

test('never writes the generated wallet to the console', async () => {
  const spies = spyOnConsole();

  await generateFirstWallet(fakeWasm());
  await userEvent.click(screen.getByText('Add New Wallet'));

  expect(consoleLeaks(spies)).toEqual([]);
});
