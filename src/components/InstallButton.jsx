import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;

  // Nur auf /mobile/login ODER /mobile/login/... (trailing slash / query egal)
  const onLoginRoute = pathname.startsWith("/mobile/login");

  useEffect(() => {
    if (!onLoginRoute || isStandalone) return;

    const handler = (e) => {
      // Android feuert dieses Event (iOS nie)
      e.preventDefault();
      setPromptEvent(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler, { once: true });
    window.addEventListener("appinstalled", () => setShow(false));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [onLoginRoute, isStandalone]);

  // iOS: kein beforeinstallprompt → zeig stattdessen kurzen Hinweis
  if (isIOS && onLoginRoute && !isStandalone) {
    return (
      <button
        onClick={() => alert("iOS: Teilen-Icon → 'Zum Home-Bildschirm'")}
        className="px-3 py-2 bg-gray-700 text-white rounded-lg"
      >
        📲 Auf iPhone hinzufügen
      </button>
    );
  }

  // Android: Button nur zeigen, wenn Event verfügbar ist
  if (!(isAndroid && onLoginRoute && show && promptEvent && !isStandalone)) {
    return null;
  }

  const handleInstall = async () => {
    promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    setShow(false);
  };

  return (
    <button onClick={handleInstall} className="px-3 py-2 bg-blue-600 text-white rounded-lg">
      📲 Installieren
    </button>
  );
}
