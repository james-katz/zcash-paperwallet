// Each test gets a fresh copy of the module, which keeps the loaded image.
function freshModule() {
  let loaded;
  jest.isolateModules(() => {
    loaded = require('./template');
  });
  return loaded;
}

const RealImage = global.Image;
let created;

// An Image that reports the outcome the test chose, on the next tick.
function installImage(outcome) {
  created = [];
  global.Image = class FakeImage {
    constructor() {
      created.push(this);
    }

    set src(value) {
      this.requested = value;
      setTimeout(() => this[outcome] && this[outcome](), 0);
    }
  };
}

afterEach(() => {
  global.Image = RealImage;
});

test('asks for the template once and hands the same image to every caller', async () => {
  installImage('onload');
  const { loadTemplate, TEMPLATE_URL } = freshModule();

  const first = await loadTemplate();
  const second = await loadTemplate();

  expect(created).toHaveLength(1);
  expect(first).toBe(created[0]);
  expect(second).toBe(first);
  expect(first.requested).toBe(TEMPLATE_URL);
});

// Asking again would be a request after the page has loaded, sent at the
// moment a wallet is made.
test('reports a template that did not load, and never asks for it again', async () => {
  installImage('onerror');
  const { loadTemplate } = freshModule();

  await expect(loadTemplate()).rejects.toThrow(/did not load/);
  await expect(loadTemplate()).rejects.toThrow(/did not load/);

  expect(created).toHaveLength(1);
});

// A request that never answers must not leave the wallet waiting for good.
test('gives up on a template that takes too long, and stays given up', async () => {
  jest.useFakeTimers();
  try {
    installImage('never');
    const { loadTemplate, TEMPLATE_TIMEOUT_MS } = freshModule();

    const outcome = loadTemplate().then(
      () => 'loaded',
      (error) => error.message
    );
    jest.advanceTimersByTime(TEMPLATE_TIMEOUT_MS - 1);
    await Promise.resolve();
    jest.advanceTimersByTime(1);
    expect(await outcome).toMatch(/did not load/);

    // An answer that comes after that changes nothing.
    created[0].onload();
    await expect(loadTemplate()).rejects.toThrow(/did not load/);
    expect(created).toHaveLength(1);
  } finally {
    jest.useRealTimers();
  }
});
