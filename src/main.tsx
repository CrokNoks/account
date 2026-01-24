import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Development debugging setup
if (import.meta.env.DEV) {
  // Add debugging utilities if needed
  console.log('Development mode enabled');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);