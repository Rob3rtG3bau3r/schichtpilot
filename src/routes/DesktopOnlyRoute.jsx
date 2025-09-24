import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const isRealMobileDevice = () => {
  const ua = navigator.userAgent || "";
  const uaMobile = /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|webOS/i.test(ua);
  const pointerCoarse = window.matchMedia?.("(pointer: coarse)")?.matches;
  return uaMobile || pointerCoarse;
};

export default function DesktopOnlyRoute({ children }) {
  const location = useLocation();

  if (isRealMobileDevice()) {
    return <Navigate to="/mobile" replace state={{ from: location }} />;
  }
  return children;
}
