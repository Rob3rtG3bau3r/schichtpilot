import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MobileLogin from './MobileLogin';
import MobilePinEntry from './MobilePinEntry';
import MobileMeineDienste from './MobileMeineDienste';
import MobileLayout from './MobileLayout';
import MobileMeineAnfragen from './MobileMeineAnfragen';

const MobileRouter = () => {
  return (
    <Routes>
      <Route path="login" element={<MobileLogin />} />
      <Route path="pin" element={<MobilePinEntry />} />

      {/* Layout-Seite für Dienste + Anfragen */}
      <Route path="/" element={<MobileLayout />}>
      <Route index element={<MobileMeineDienste />} />
        <Route path="dienste" element={<MobileMeineDienste />} />
        <Route path="anfragen" element={<MobileMeineAnfragen />} />
      </Route>
    </Routes>
  );
};

export default MobileRouter;
