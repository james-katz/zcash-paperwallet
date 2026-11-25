// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// react-router 7 expects these globals; the jsdom bundled with CRA lacks them.
Object.assign(global, { TextDecoder, TextEncoder });
