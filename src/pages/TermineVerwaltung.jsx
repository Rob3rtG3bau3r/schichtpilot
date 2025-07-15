// pages/Termine.jsx
import React, { useState } from 'react';
import TermineFormular from '../components/TermineVerwaltung/TermineFormular';
import TermineUebersicht from '../components/TermineVerwaltung/TermineUebersicht';

const TermineVerwaltung = () => {
  const [reloadKey, setReloadKey] = useState(0);
  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-12 gap-4 max-w-[1600px] mx-auto">
        {/* Links: Formular */}
        <div className="col-span-4 p-4">
          <TermineFormular setReloadKey={setReloadKey} />
        </div>

        {/* Rechts: Übersicht */}
        <div className="col-span-8 p-4">
          <TermineUebersicht reloadKey={reloadKey} />
        </div>
      </div>
    </div>
  );
};

export default TermineVerwaltung;
