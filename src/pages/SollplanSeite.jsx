import React, { useState } from 'react';
import SchichtartListe from '../components/Sollplan/SchichtartListe';
import SchichtUebernahme from '../components/Sollplan/SchichtUebernahme';
import SollplanAnzeige from '../components/Sollplan/SollplanAnzeige';

const SollplanSeite = () => {
  const [schicht, setSchicht] = useState(null);
  const [schichtgruppe, setSchichtgruppe] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedFirma, setSelectedFirma] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const handleGruppeChange = (gruppe) => {
    setSchichtgruppe(gruppe);
  };

  const handleSaveSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="px-6 pb-2 text-white">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5">
          <SchichtartListe
            onSelect={setSchicht}
            selectedFirma={selectedFirma}
            selectedUnit={selectedUnit}
          />
        </div>

        <div className="col-span-2">
          <SchichtUebernahme
            schicht={schicht}
            setSchicht={setSchicht}
            onGruppeChange={handleGruppeChange}
            onSaveSuccess={handleSaveSuccess}
            selectedFirma={selectedFirma}
            setSelectedFirma={setSelectedFirma}
            selectedUnit={selectedUnit}
            setSelectedUnit={setSelectedUnit}
          />
        </div>

        <div className="col-span-5">
          <SollplanAnzeige
            schichtgruppe={schichtgruppe}
            firma={selectedFirma}
            unit={selectedUnit}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
};

export default SollplanSeite;