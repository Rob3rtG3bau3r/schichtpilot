import React, { useState } from 'react';
import BedarfVorlagen from '../components/BedarfsVerwaltung/BedarfVorlagen';
import NormalbetriebFormular from '../components/BedarfsVerwaltung/NormalbetriebFormular';
import NormalbedarfVersionen from '../components/BedarfsVerwaltung/NormalbedarfVersionen';
import ZeitlicherBedarfFormular from '../components/BedarfsVerwaltung/ZeitlicherBedarfFormular';
import ZeitlichBegrenzteListe from '../components/BedarfsVerwaltung/ZeitlichBegrenzteListe';
import ZeitlichBegrenztBearbeiten from '../components/BedarfsVerwaltung/ZeitlichBegrenztBearbeiten';
import Zusatzbedarf from './Zusatzbedarf';

const BedarfsVerwaltung = () => {
  const [tab, setTab] = useState('zeitlich');
  const [refreshKey, setRefreshKey] = useState(0);
  const [ausgewaehlteVorlage, setAusgewaehlteVorlage] = useState(null);

  const [ausgewaehlterZeitEintrag, setAusgewaehlterZeitEintrag] =
    useState(null);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const handleTabChange = (neuerTab) => {
    setTab(neuerTab);

    if (neuerTab !== 'zeitlich') {
      setAusgewaehlterZeitEintrag(null);
      setAusgewaehlteVorlage(null);
    }
  };

  const handleVorlageWaehlen = (vorlage) => {
    setAusgewaehlterZeitEintrag(null);

    // Lade-Key ermöglicht, dieselbe Vorlage erneut anzuklicken.
    setAusgewaehlteVorlage({
      ...vorlage,
      _ladeKey: Date.now(),
    });
  };

  return (
    <div className="px-6 pb-6">
      <div className="mb-4 rounded-xl border border-gray-300 bg-gray-100 p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'normal'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleTabChange('normal')}
          >
            Normalbetrieb
          </button>

          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'zeitlich'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleTabChange('zeitlich')}
          >
            Zeitlicher Bedarf
          </button>

          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === 'zusatz'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600'
            }`}
            onClick={() => handleTabChange('zusatz')}
          >
            Zusatzbedarf
          </button>
        </div>

        <div className="mt-2 px-1 text-xs text-gray-500 dark:text-gray-400">
          {tab === 'normal' &&
            'Dauerhafter Grundbedarf je Qualifikation und Schicht.'}
          {tab === 'zeitlich' &&
            'Befristete Abweichungen vom normalen Personalbedarf.'}
          {tab === 'zusatz' &&
            'Zusätzliche Arbeiten und Einsätze, die Mitarbeitende binden.'}
        </div>
      </div>

      {tab === 'zeitlich' ? (
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2 rounded-xl bg-gray-200 p-2 dark:bg-gray-800">
            <BedarfVorlagen
              refreshKey={refreshKey}
              onVorlageWaehlen={handleVorlageWaehlen}
            />
          </div>

          <div className="col-span-6 rounded-xl bg-gray-200 p-2 dark:bg-gray-800">
            <ZeitlicherBedarfFormular
              vorlage={ausgewaehlteVorlage}
              onSaved={() => {
                setAusgewaehlterZeitEintrag(null);
                setAusgewaehlteVorlage(null);
                handleRefresh();
              }}
            />
          </div>

          <div className="col-span-4 flex flex-col gap-3">
            <div className="rounded-xl bg-gray-200 px-2 dark:bg-gray-800">
              <ZeitlichBegrenzteListe
                refreshKey={refreshKey}
                maxVisible={8}
                onAuswahl={(eintrag) => {
                  setAusgewaehlteVorlage(null);
                  setAusgewaehlterZeitEintrag(eintrag);
                }}
              />
            </div>

            <div className="rounded-xl bg-gray-200 px-2 pt-1 dark:bg-gray-800">
              <ZeitlichBegrenztBearbeiten
                eintrag={ausgewaehlterZeitEintrag}
                refreshKey={refreshKey}
                onSaved={handleRefresh}
                onClose={() => setAusgewaehlterZeitEintrag(null)}
              />
            </div>
          </div>
        </div>
      ) : tab === 'normal' ? (
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-9 rounded-xl bg-gray-200 p-2 dark:bg-gray-800">
            <NormalbetriebFormular
              key={refreshKey}
              onSaved={handleRefresh}
            />
          </div>

          <div className="col-span-3 rounded-xl bg-gray-200 p-2 dark:bg-gray-800">
            <NormalbedarfVersionen refreshKey={refreshKey} />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-300 bg-gray-100 p-2 dark:border-gray-700 dark:bg-gray-800">
          <Zusatzbedarf />
        </div>
      )}
    </div>
  );
};

export default BedarfsVerwaltung;
