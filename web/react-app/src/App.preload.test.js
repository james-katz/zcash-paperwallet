import { render, screen } from '@testing-library/react';
import App from './App';

const mockTemplateRequests = [];

jest.mock('./wasm/web', () => ({
  __esModule: true,
  default: () => Promise.resolve({}),
  generate_wallet_with_salt: () => ({}),
}));

jest.mock('./components/template', () => ({
  __esModule: true,
  loadTemplate: () => {
    mockTemplateRequests.push('requested');
    return Promise.reject(new Error('the wallet template image did not load'));
  },
}));

// The site tells people to switch the network off before they generate.
// The card template has to be in memory by then, so it is asked for when
// the page opens, not when the first wallet is made.
test('asks for the card template when the page opens, before any wallet', async () => {
  render(<App />);

  expect(await screen.findByText(/move your mouse to gather entropy/i)).toBeInTheDocument();
  expect(mockTemplateRequests.length).toBeGreaterThan(0);
});
