// src/pages/Kundenverwaltung.jsx
import React, { useState } from 'react';
import KundenInfo from '../components/Kunden/KundenInfo';
import KundenUnit from '../components/Kunden/KundenUnit';
import KundenFeatureUebersicht from '../components/Kunden/KundenFeatureUebersicht';
import KundenUnitTabelle from '../components/Kunden/KundenUnitTabelle';
import { useRollen } from '../context/RollenContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

const Kundenverwaltung = () => {
  const [showUnit, setShowUnit] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showTabelle, setShowTabelle] = useState(true); 
  const { sichtFirma } = useRollen();

  const ToggleBlock = ({ title, children, isOpen, onToggle }) => (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 mb-4">
      <div
        className="flex items-center justify-between p-4 cursor-pointer rounded-xl hover:bg-gray-300 dark:hover:bg-gray-700"
        onClick={onToggle}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        {isOpen ? <ChevronDown /> : <ChevronRight />}
      </div>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );

  return (
    <div className="px-6 pb-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Linke Seite */}
        <div>
          <KundenInfo firma={sichtFirma} />
        </div>

        {/* Rechte Seite – drei einklappbare Bereiche untereinander */}
        <div>
          <ToggleBlock
            title="Unit erstellen"
            isOpen={showUnit}
            onToggle={() => setShowUnit(!showUnit)}
          >
            <KundenUnit />
          </ToggleBlock>

          <ToggleBlock
            title="Feature auswählen"
            isOpen={showFeatures}
            onToggle={() => setShowFeatures(!showFeatures)}
          >
            <KundenFeatureUebersicht />
          </ToggleBlock>

          <ToggleBlock
            title="Vorhandene Units"
            isOpen={showTabelle}
            onToggle={() => setShowTabelle(!showTabelle)}
          >
            <KundenUnitTabelle />
          </ToggleBlock>
        </div>
      </div>
    </div>
  );
};

export default Kundenverwaltung;
