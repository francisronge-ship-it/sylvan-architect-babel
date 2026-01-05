import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * APPLICATION ENTRY POINT
 * The API key is assumed to be pre-configured in process.env.API_KEY as per the execution environment standards.
 */

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