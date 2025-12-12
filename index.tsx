import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// import './index.css';  <-- DELETE THIS LINE

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily disabled StrictMode to fix Three.js animation
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
