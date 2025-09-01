import React, { useState } from 'react';
import QualiMatrixAnzeige from '../components/BedarfsVerwaltung/QualiMatrixAnzeige';
import BedarfErfassenFormular from '../components/BedarfsVerwaltung/BedarfErfassenFormular';
import NormalbetriebAnzeige from '../components/BedarfsVerwaltung/NormalbetriebAnzeige';
import ZeitlichBegrenzteListe from '../components/BedarfsVerwaltung/ZeitlichBegrenzteListe';
import ZeitlichBegrenztBearbeiten from '../components/BedarfsVerwaltung/ZeitlichBegrenztBearbeiten';

const BedarfsVerwaltung = () => {
    const [ausgewaehlteQuali, setAusgewaehlteQuali] = useState({ id: null, name: '' });
    const [refreshKey, setRefreshKey] = useState(0);
    const [ausgewaehlterZeitEintrag, setAusgewaehlterZeitEintrag] = useState(null);
    const handleRefresh = () => setRefreshKey((prev) => prev + 1);
    const [vorbelegtFormular, setVorbelegtFormular] = useState(null);
  return (
    <div className="px-6 pb-6">
      <div className=" grid grid-cols-12 gap-2">
        
        {/* Links: Qualifikationen im Betrieb */}
        <div className="col-span-3 bg-gray-200 dark:bg-gray-800 p-2">
          <QualiMatrixAnzeige onQualiClick={(id, name) => setAusgewaehlteQuali({ id, name })} />
        </div>

        {/* Mitte: Formular */}
        <div className="col-span-3 bg-gray-200 dark:bg-gray-800 p-2">
<BedarfErfassenFormular
  ausgewaehlteQualiId={ausgewaehlteQuali.id}
  ausgewaehlteQualiName={ausgewaehlteQuali.name}
  onRefresh={handleRefresh}
  vorbelegt={vorbelegtFormular} // 👈 NEU
/>
        </div>

        {/* Rechts: Tabellen + Bearbeiten */}
        <div className="col-span-5 flex flex-col gap-4">
          <div className="bg-gray-200 dark:bg-gray-800 p-2">
            <NormalbetriebAnzeige refreshKey={refreshKey} />
          </div>
          <div className="bg-gray-200 dark:bg-gray-800 p-2">
<ZeitlichBegrenzteListe
  refreshKey={refreshKey}
  onAuswahl={(eintrag) => {
    setAusgewaehlterZeitEintrag(eintrag);
    setVorbelegtFormular({
      von: eintrag.von,
      bis: eintrag.bis,
      farbe: eintrag.farbe,
      namebedarf: eintrag.namebedarf,
    });
  }}
/>
          </div>
          <div className="bg-gray-200 dark:bg-gray-800 p-4">
<ZeitlichBegrenztBearbeiten
  eintrag={ausgewaehlterZeitEintrag}
  refreshKey={refreshKey}
/>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BedarfsVerwaltung;