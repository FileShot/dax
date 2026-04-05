import { initWebSocketBridge } from './ws-bridge';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// In browser mode (not Electron), connect to the real backend via WebSocket.
// Falls back to dev-mock only if explicitly needed for offline UI development.
initWebSocketBridge();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
