// Mock ESM modules that Jest can't parse in this environment
import { render, screen } from '@testing-library/react';
import App from './App.jsx';
import { APP_NAME } from './constants';

jest.mock('react-syntax-highlighter', () => {
  const React = require('react');
  return { Prism: ({ children }) => React.createElement('div', null, children) };
});
jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({ materialLight: {} }));

test('renders app title', () => {
  // simulate authenticated user so App shows the main page
  try { localStorage.setItem('auth_token', 'fake-token'); } catch (e) {}
  render(<App />);
    const titles = screen.getAllByText(new RegExp(APP_NAME, 'i'));
  expect(titles.length).toBeGreaterThan(0);
});
