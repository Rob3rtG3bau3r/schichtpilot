import React, { useState } from 'react';
import ZusatzbedarfFormular from '../components/Zusatzbedarf/ZusatzbedarfFormular';
import ZusatzbedarfListe from '../components/Zusatzbedarf/ZusatzbedarfListe';
import ZusatzbedarfVorlagen from '../components/Zusatzbedarf/ZusatzbedarfVorlagen';
import ZusatzbedarfBearbeiten from '../components/Zusatzbedarf/ZusatzbedarfBearbeiten';

const Zusatzbedarf = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [ausgewaehlterEintrag, setAusgewaehlterEintrag] = useState(null);
  const [ausgewaehlteVorlage, setAusgewaehlteVorlage] = useState(null);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-12 gap-3">
        {/* Links: Vorlagen */}
        <div className="col-span-3 bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
          <ZusatzbedarfVorlagen
            refreshKey={refreshKey}
            onVorlageWaehlen={(vorlage) => setAusgewaehlteVorlage(vorlage)}
          />
        </div>

        {/* Mitte: Formular */}
        <div className="col-span-4 bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
          <ZusatzbedarfFormular
            vorlage={ausgewaehlteVorlage}
            onSaved={() => {
              setAusgewaehlteVorlage(null);
              handleRefresh();
            }}
          />
        </div>

        {/* Rechts: Liste + Bearbeitung */}
        <div className="col-span-5 flex flex-col gap-3">
          <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
            <ZusatzbedarfListe
              refreshKey={refreshKey}
              onAuswahl={(eintrag) => setAusgewaehlterEintrag(eintrag)}
            />
          </div>

          <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
            <ZusatzbedarfBearbeiten
              eintrag={ausgewaehlterEintrag}
              onClose={() => setAusgewaehlterEintrag(null)}
              onSaved={handleRefresh}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Zusatzbedarf;