import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * ENVIRONMENT SHIM
 * Forces population of process.env from various potential sources.
 */
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.process = window.process || { env: {} };
  const env = (window as any).process.env;
  
  const key = 
    env.GEMINI_API_KEY || 
    env.API_KEY || 
    (window as any).importMetaEnv?.VITE_GEMINI_API_KEY || 
    "";

  if (key) {
    env.API_KEY = key;
    console.debug("Arbor: Environment initialized.");
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