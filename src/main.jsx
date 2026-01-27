import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { RollenProvider } from './context/RollenContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <RollenProvider>
        <App />
      </RollenProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// ✅ Service Worker registrieren (PWA / Push Voraussetzung) — NUR HIER!
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      console.log("[SW] registered:", reg.scope, "active:", reg.active?.scriptURL || "none");
    } catch (e) {
      console.error("[SW] register failed:", e);
    }
  });
}
