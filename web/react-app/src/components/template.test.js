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

test('reports a template that did not load, and tries again next time', async () => {
  installImage('onerror');
  const { loadTemplate } = freshModule();

  await expect(loadTemplate()).rejects.toThrow(/did not load/);
  await expect(loadTemplate()).rejects.toThrow(/did not load/);

  expect(created).toHaveLength(2);
});
