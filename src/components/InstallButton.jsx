import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [show, setShow] = useState(false);
  const { pathname } = useLocation();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useEffect(() => {
    if (!isMobile) return;
    const onBeforeInstall = (e) => { e.preventDefault(); setPromptEvent(e); setShow(true); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [isMobile]);

  if (!isMobile || pathname !== "/mobile/login" || !show) return null;

  const handleInstall = async () => {
    if (!promptEvent) return;
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
