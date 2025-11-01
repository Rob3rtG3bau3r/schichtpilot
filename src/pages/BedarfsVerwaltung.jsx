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
  const [vorbelegtFormular, setVorbelegtFormular] = useState(null);

  // Rechts: Tabs ('zb' = Zeitlich begrenzt | 'nb' = Normalbetrieb)
  const [tab, setTab] = useState('zb');

  const handleRefresh = () => setRefreshKey((prev) => prev + 1);

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-12 gap-3">
        {/* Links: Qualifikationen */}
        <div className="col-span-3 bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
          <QualiMatrixAnzeige
            onQualiClick={(id, name) => setAusgewaehlteQuali({ id, name })}
          />
        </div>

        {/* Mitte: Formular */}
        <div className="col-span-3 bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
          <BedarfErfassenFormular
            ausgewaehlteQualiId={ausgewaehlteQuali.id}
            ausgewaehlteQualiName={ausgewaehlteQuali.name}
            onRefresh={handleRefresh}
            vorbelegt={vorbelegtFormular}
          />
        </div>

        {/* Rechts: Tabs (NB | ZB) → Standard ZB */}
        <div className="col-span-6 flex flex-col">
          {/* Tab-Navigation */}
          <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded-xl">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1 rounded ${
                  tab === 'zb' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'
                }`}
                onClick={() => setTab('zb')}
              >
                Zeitlich begrenzt
              </button>
              <button
                className={`px-3 py-1 rounded ${
                  tab === 'nb' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'
                }`}
                onClick={() => setTab('nb')}
              >
                Normalbetrieb
              </button>
            </div>
          </div>

          {/* Inhalt pro Tab */}
          {tab === 'nb' ? (
            // NORMALBETRIEB
            <div className="bg-gray-200 dark:bg-gray-800 px-2 rounded-xl">
              <NormalbetriebAnzeige refreshKey={refreshKey} />
            </div>
          ) : (
            // ZEITLICH BEGRENZT
            <>
              <div className="bg-gray-200 dark:bg-gray-800 px-2 rounded-xl">
                <ZeitlichBegrenzteListe
                  refreshKey={refreshKey}
                  maxVisible={5}          // ⬅️ nur 5 sichtbar, Rest via Scroll
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
              <div className="bg-gray-200 dark:bg-gray-800 px-2 pt-1 rounded-xl">
                <ZeitlichBegrenztBearbeiten
                  eintrag={ausgewaehlterZeitEintrag}
                  refreshKey={refreshKey}
                  onSaved={() => setRefreshKey((k) => k + 1)}
                  onClose={() => setAusgewaehlterZeitEintrag(null)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BedarfsVerwaltung;
