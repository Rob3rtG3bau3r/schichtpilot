import React from "react";
import { Navigate, useLocation } from "react-router-dom";

// Erkenne echte Mobile-Geräte (Telefon/Tablet), nicht nur schmale Fenster
const isRealMobileDevice = () => {
  const ua = navigator.userAgent || "";
  const uaMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|webOS/i.test(ua);
  const pointerCoarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  return uaMobile || pointerCoarse;
};

export default function DesktopOnlyProtectedLayout({ children }) {
  const location = useLocation();

  // Nur beim ersten Render prüfen (kein Resize-Redirect)
  if (isRealMobileDevice()) {
    return <Navigate to="/mobile" replace state={{ from: location }} />;
  }

  return children;
}
