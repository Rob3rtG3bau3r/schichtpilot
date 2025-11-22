// src/components/WochenPlaner/WochenPlanerMitarbeiterListe.jsx
import React from 'react';
import { Crown } from 'lucide-react';

const WochenPlanerMitarbeiterListe = ({
  firma,
  unit,
  loadingMitarbeiter,
  errorMitarbeiter,
  oben,
  unten,
  schichtFarben,
  anzahlWochen,
  selectedMitarbeiterId,   // aktuell ungenutzt, kann später ausgebaut werden
  setSelectedMitarbeiterId, // dito
}) => {
  return (
    <div className="border shadow-xl border-gray-500 dark:border-gray-700 rounded-xl p-3 bg-gray-200 dark:bg-gray-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium text-sm">Mitarbeiter</h2>
      </div>

      {!firma || !unit ? (
        <p className="text-xs text-gray-500">
          Bitte zuerst Firma und Unit auswählen.
        </p>
      ) : loadingMitarbeiter ? (
        <p className="text-xs text-gray-500">Lade Mitarbeitende…</p>
      ) : errorMitarbeiter ? (
        <p className="text-xs text-red-500">{errorMitarbeiter}</p>
      ) : oben.length === 0 && unten.length === 0 ? (
        <p className="text-xs text-gray-500">
          Keine Mitarbeitenden für diese Unit gefunden.
        </p>
      ) : (
        <div className="max-h-[480px] overflow-y-auto pr-1 space-y-2">
          {/* Oben: normale MA */}
          {oben.map((m) => (
            <div
              key={m.user_id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', `list:${m.user_id}`);
              }}
              // ✅ KEIN onClick mehr, keine blaue Auswahl
              className="flex flex-col px-2 py-1 text-xs rounded-lg border border-gray-500/50 cursor-move bg-gray-300 dark:bg-gray-900 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {m.isTeamLeader && (
                    <Crown className="w-3 h-3 text-yellow-400" />
                  )}
                  <span className="font-medium">
                    {m.nachname}, {m.vorname}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {m.qualiCount > 0 && (
                    <span
                      className="text-[10px] px-1 rounded bg-gray-600 border border-gray-500 text-white"
                      title={m.qualis.map((q) => q.quali_kuerzel).join(', ')}
                    >
                      {m.qualiRoman}
                    </span>
                  )}
                </div>
              </div>

              {/* Wochen-Badges (Haken/Kreuz) für den ausgewählten Zeitraum */}
              {anzahlWochen >= 1 && (
                <div className="mt-0.5 flex gap-0.5">
                  {Array.from({ length: anzahlWochen }, (_, idx) => {
                    const isAssigned = m.assignedWeeksFlags?.[idx];

                    return (
                      <span
                        key={idx}
                        className={
                          'text-xs px-0.5 rounded-xl border ' +
                          (isAssigned
                            ? 'bg-green-600 text-white border-green-500'
                            : 'bg-red-500/10 text-red-500 border-red-500/40')
                        }
                        title={
                          isAssigned
                            ? 'In dieser Woche im Planungsboard eingeplant'
                            : 'In dieser Woche im Planungsboard nicht eingeplant'
                        }
                      >
                        {isAssigned ? '✓' : '✗'}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Vorwoche + aktuelle KW */}
              <div className="mt-1 flex flex-col gap-0.5">
                {/* Vorwoche (kleiner) */}
                {m.weekPrevCodes && (
                  <div className="flex gap-0.5 opacity-70">
                    {m.weekPrevCodes.map((code, idx) => {
                      const farbe =
                        code && code !== '-' ? schichtFarben[code] : null;
                      const style = farbe
                        ? {
                            backgroundColor: farbe.bg || undefined,
                            color: farbe.text || undefined,
                          }
                        : {};
                      return (
                        <span
                          key={idx}
                          style={style}
                          className="w-3 h-3 rounded-[2px] text-[8px] flex items-center justify-center bg-gray-400 text-gray-900"
                          title={`Vorwoche Tag ${idx + 1}: ${code || '-'}`}
                        >
                          {code || '-'}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* aktuelle KW (größer – wichtig) */}
                {m.weekCodes && (
                  <div className="flex gap-0.5">
                    {m.weekCodes.map((code, idx) => {
                      const farbe =
                        code && code !== '-' ? schichtFarben[code] : null;

                      const style = farbe
                        ? {
                            backgroundColor: farbe.bg || undefined,
                            color: farbe.text || undefined,
                          }
                        : {};

                      return (
                        <span
                          key={idx}
                          style={style}
                          className="w-4 h-4 rounded-sm text-[9px] flex items-center justify-center bg-gray-400 text-gray-900"
                          title={`KW-Tag ${idx + 1}: ${code || '-'}`}
                        >
                          {code || '-'}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Unten: Urlaub/Krank */}
          {unten.length > 0 && (
            <>
              <div className="border-t border-gray-400 dark:border-gray-600 my-2" />
              <div className="text-[10px] font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Urlaub / Krank (ausgewählte KW)
              </div>

              {unten.map((m) => (
                <div
                  key={m.user_id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData(
                      'text/plain',
                      `list:${m.user_id}`
                    );
                  }}
                  className="flex flex-col px-2 py-1 text-xs rounded-lg cursor-move bg-gray-100 dark:bg-gray-900 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {m.isTeamLeader && (
                        <Crown className="w-3 h-3 text-yellow-400" />
                      )}
                      <span className="font-medium">
                        {m.nachname}, {m.vorname}
                      </span>
                    </div>
                    {anzahlWochen > 1 && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-gray-700 text-gray-100">
                        {m.assignedWeeks}/{anzahlWochen} Wo
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {m.qualiCount > 0 && (
                        <span
                          className="text-[10px] px-1 rounded bg-gray-600 border border-gray-500 text-white"
                          title={m.qualis
                            .map((q) => q.quali_kuerzel)
                            .join(', ')}
                        >
                          {m.qualiRoman}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Wochen-Badges (Haken/Kreuz) für den ausgewählten Zeitraum */}
                  {anzahlWochen >= 1 && (
                    <div className="mt-0.5 flex gap-0.5">
                      {Array.from({ length: anzahlWochen }, (_, idx) => {
                        const isAssigned = m.assignedWeeksFlags?.[idx];

                        return (
                          <span
                            key={idx}
                            className={
                              'text-[9px] px-1 py-0.5 rounded-full border ' +
                              (isAssigned
                                ? 'bg-green-600 text-white border-green-500'
                                : 'bg-red-500/10 text-red-500 border-red-500/40')
                            }
                            title={
                              isAssigned
                                ? 'In dieser Woche im Planungsboard eingeplant'
                                : 'In dieser Woche im Planungsboard nicht eingeplant'
                            }
                          >
                            {isAssigned ? '✓' : '✗'}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-1 flex flex-col gap-0.5">
                    {/* Vorwoche klein */}
                    {m.weekPrevCodes && (
                      <div className="flex gap-0.5 opacity-70">
                        {m.weekPrevCodes.map((code, idx) => {
                          const farbe =
                            code && code !== '-'
                              ? schichtFarben[code]
                              : null;
                          const style = farbe
                            ? {
                                backgroundColor: farbe.bg || undefined,
                                color: farbe.text || undefined,
                              }
                            : {};
                          return (
                            <span
                              key={idx}
                              style={style}
                              className="w-3 h-3 rounded-[2px] text-[8px] flex items-center justify-center bg-gray-400 text-gray-900"
                              title={`Vorwoche Tag ${idx + 1}: ${
                                code || '-'
                              }`}
                            >
                              {code || '-'}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* aktuelle KW groß */}
                    {m.weekCodes && (
                      <div className="flex gap-0.5">
                        {m.weekCodes.map((code, idx) => {
                          const farbe =
                            code && code !== '-'
                              ? schichtFarben[code]
                              : null;

                          const style = farbe
                            ? {
                                backgroundColor: farbe.bg || undefined,
                                color: farbe.text || undefined,
                              }
                            : {};

                          return (
                            <span
                              key={idx}
                              style={style}
                              className="w-4 h-4 rounded-sm text-[9px] flex items-center justify-center bg-gray-400 text-gray-900"
                              title={`KW-Tag ${idx + 1}: ${
                                code || '-'
                              }`}
                            >
                              {code || '-'}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WochenPlanerMitarbeiterListe;
