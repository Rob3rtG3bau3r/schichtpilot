// src/components/Dashboard/BAM_MitarbeiterimDienst.jsx
import React from 'react';

export default function BAM_MitarbeiterimDienst({ mitarbeiter = [] }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Mitarbeiter im Dienst</h3>
          <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
            {mitarbeiter.length}
          </span>
        </div>
      </div>

      <div className="p-3">
        {mitarbeiter.length > 0 ? (
          <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
            {mitarbeiter.map((m, i) => (
              <div
                key={`${m.nachname}-${m.vorname}-${i}`}
                className="flex items-center gap-2 rounded-xl px-3 py-2 bg-gray-50 dark:bg-gray-800/70 text-sm"
              >
                <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="font-medium">{m.nachname}, {m.vorname}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-6 text-center text-sm italic text-gray-500 dark:text-gray-400">
            Keine Mitarbeiter gefunden
          </div>
        )}
      </div>
    </div>
  );
}
