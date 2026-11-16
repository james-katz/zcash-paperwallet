// A wallet-shaped object for unit tests. Nothing here is a real key.
// The phrase is the public BIP-39 test mnemonic; the other strings are
// placeholders with the right prefixes, not decodable keys.
export const FAKE_WALLET = Object.freeze({
  seed:
    'abandon abandon abandon abandon abandon abandon abandon abandon ' +
    'abandon abandon abandon abandon abandon abandon abandon abandon ' +
    'abandon abandon abandon abandon abandon abandon abandon art',
  ufvk: 'uview1fakefakefakefakefakefakefakefakefakefakefakefakefakefakefake',
  address: 'u1fakefakefakefakefakefakefakefakefakefakefakefakefakefakefakefake',
  birthday: 3570000,
});

export const CONSOLE_METHODS = [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'trace',
  'dir',
  'table',
];

// Replaces every console method with a silent spy and returns the spies.
export function spyOnConsole() {
  return CONSOLE_METHODS.map((method) =>
    jest.spyOn(console, method).mockImplementation(() => {})
  );
}

function asText(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) || String(value);
  } catch (error) {
    return String(value);
  }
}

// Every console call, as text, that carries the recovery phrase or the UFVK.
export function consoleLeaks(spies, wallet = FAKE_WALLET) {
  const secrets = [wallet.seed, wallet.ufvk];
  return spies
    .flatMap((spy) => spy.mock.calls)
    .map((args) => args.map(asText).join(' '))
    .filter((line) => secrets.some((secret) => line.includes(secret)));
}
