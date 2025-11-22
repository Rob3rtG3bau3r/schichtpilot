// src/components/WochenPlaner/WochenPlanerHeader.jsx
import React from 'react';

const WochenPlanerHeader = ({
  jahr,
  setJahr,
  anzahlWochen,
  setAnzahlWochen,
  zeitraumLabel,
  onOpenConfig,
}) => {
  const aktJahr = new Date().getFullYear();

  return (
    <div className="bg-gray-200 dark:bg-gray-800 pt-2 px-4 pb-2 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700 mb-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Links: Jahr + Wochenanzahl + Zeitraum */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Jahr-Auswahl – exakt wie in KalenderStruktur */}
          <select
            value={jahr}
            onChange={(e) => setJahr(parseInt(e.target.value, 10))}
            className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-3 py-1 rounded-xl"
          >
            {[aktJahr - 1, aktJahr, aktJahr + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Wochenanzahl (1–4) */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-700 dark:text-gray-300">Wochen:</span>
            {[1, 2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setAnzahlWochen(w)}
                className={
                  'px-2 py-1 rounded-lg border text-xs transition-colors ' +
                  (anzahlWochen === w
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-400 dark:border-gray-600')
                }
              >
                {w}
              </button>
            ))}
          </div>

          {/* Zeitraum-Label */}
          <span className="text-xs text-gray-600 dark:text-gray-300">
            Zeitraum: {zeitraumLabel}
          </span>
        </div>

        {/* Rechts: Konfig-Button */}
        <button
          type="button"
          onClick={onOpenConfig}
          className="px-3 py-1 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
        >
          Schichtgruppen-Konfiguration
        </button>
      </div>
    </div>
  );
};

export default WochenPlanerHeader;
