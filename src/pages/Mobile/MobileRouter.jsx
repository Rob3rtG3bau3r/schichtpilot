// src/pages/Mobile/MobileRouter.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MobileLogin from './MobileLogin';
import MobileMeineDienste from './MobileMeineDienste';
import MobileLayout from './MobileLayout';
import MobileMeineAnfragen from './MobileMeineAnfragen';
import MobileMeineUebersicht from "./MobileMeineUebersicht";

const MobileRouter = () => {
  return (
    <Routes>
      <Route path="login" element={<MobileLogin />} />
      {/* Layout-Seite für Dienste + Anfragen */}
      <Route path="/" element={<MobileLayout />}>
        <Route index element={<MobileMeineDienste />} />
        <Route path="dienste" element={<MobileMeineDienste />} />
        <Route path="uebersicht" element={<MobileMeineUebersicht />} />
        <Route path="anfragen" element={<MobileMeineAnfragen />} />
      </Route>
    </Routes>
  );
};

export default MobileRouter;
