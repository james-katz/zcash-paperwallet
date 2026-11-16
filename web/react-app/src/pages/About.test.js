import { render } from '@testing-library/react';
import About from './About';

const pageText = () => document.body.textContent.replace(/\s+/g, ' ');

test('does not tell people to keep the wallet as a file', () => {
  render(<About />);

  expect(pageText()).not.toMatch(/right-click/i);
  expect(pageText()).not.toMatch(/save it/i);
  expect(pageText()).not.toMatch(/or save it as a PDF/i);
});

test('tells people to print on paper and what to do without a printer', () => {
  render(<About />);

  expect(pageText()).toMatch(/print the wallet on paper/i);
  expect(pageText()).toMatch(/do not choose .Save as PDF./i);
  expect(pageText()).toMatch(/copy the 24 words by hand/i);
});
