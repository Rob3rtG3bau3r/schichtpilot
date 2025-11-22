// src/components/WochenPlaner/KWSelector.jsx
import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const KWSelector = ({ jahr, kw, setKw, anzahlWochen }) => {
  const heute = dayjs();

  // Anzahl ISO-KWs im Jahr
  const maxKw = useMemo(() => {
    return dayjs(`${jahr}-12-28`).isoWeek();
  }, [jahr]);

  return (
    <div className="flex flex-wrap border border-gray-700 rounded-xl p-2">
      {Array.from({ length: maxKw }, (_, i) => i + 1).map((kwNum) => {
        const isCurrentWeek =
          jahr === heute.year() && kwNum === heute.isoWeek();

        const rangeStart = kw;
        const rangeEnd = Math.min(kw + anzahlWochen - 1, maxKw);

        const isInRange = kwNum >= rangeStart && kwNum <= rangeEnd;
        const isPrimarySelected = kwNum === kw;
        const isAdditionalRange = isInRange && !isPrimarySelected;

        // 🔥 NEU: Abgelaufene KWs markieren
        const isPastWeek =
          jahr === heute.year() && kwNum < heute.isoWeek();

        let baseClasses =
          'm-0.5 px-2 py-1 text-xs rounded-xl border cursor-pointer select-none transition-colors';

        let classes =
          'border-gray-500 bg-gray-500 dark:bg-gray-700 text-gray-100 hover:bg-gray-400 dark:hover:bg-gray-900';

        if (isPrimarySelected) {
          classes =
            'border-blue-400 bg-blue-600 text-white hover:bg-blue-500';
        } else if (isAdditionalRange) {
          classes =
            'border-blue-400/60 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30';
        } 
        // 🔥 NEU: abgelaufene KW schwach rot
        else if (isPastWeek) {
          classes =
            'border-gray-500 bg-red-400/20 text-gray-700 dark:text-gray-200 hover:bg-red-400/30 ';
        }

        if (isCurrentWeek) {
          classes += ' ring-2 ring-yellow-400';
        }

        return (
          <button
            key={kwNum}
            type="button"
            onClick={() => setKw(kwNum)}
            className={`${baseClasses} ${classes}`}
            title={`KW ${kwNum}`}
          >
            KW {kwNum}
          </button>
        );
      })}
    </div>
  );
};

export default KWSelector;
