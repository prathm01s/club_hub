import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 1. Find the "root" div in your HTML file
const root = ReactDOM.createRoot(document.getElementById('root'));

// 2. Render your App inside it
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);