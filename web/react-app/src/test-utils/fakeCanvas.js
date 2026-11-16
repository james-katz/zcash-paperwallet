// jsdom implements neither canvas drawing nor image loading. These helpers
// give the wallet image card a recording 2D context and an Image that
// "loads" on the next tick.

export function installFakeCanvas() {
  const ctx = {
    drawImage: jest.fn(),
    fillText: jest.fn(),
    clearRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    font: '',
    fillStyle: '',
  };
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => ctx);

  const RealImage = global.Image;
  global.Image = class FakeImage {
    constructor() {
      this.width = 2339;
      this.height = 1654;
      this.onload = null;
    }

    set src(_value) {
      setTimeout(() => this.onload && this.onload(), 0);
    }
  };

  return {
    ctx,
    // Every string the card wrote on the canvas, in order.
    drawnText: () => ctx.fillText.mock.calls.map(([text]) => String(text)),
    restore: () => {
      global.Image = RealImage;
    },
  };
}
