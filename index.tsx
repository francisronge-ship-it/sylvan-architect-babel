import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * ENVIRONMENT SHIM
 * This block ensures process.env.API_KEY is available globally in the browser.
 * It maps Vite's import.meta.env to the standard process.env structure.
 */
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.process = window.process || { env: {} };
  // @ts-ignore
  if (!window.process.env.API_KEY) {
    // @ts-ignore
    window.process.env.API_KEY = import.meta.env?.VITE_API_KEY || "";
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);