// src/components/Dashboard/BAM_SchichtTausch.jsx
import React from 'react';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';

const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };

export default function BAM_SchichtTausch({
  // Deckung / Over
  deckungByShift,
  overByShift,
  missingText,

  // Aktivierung
  tauschenMoeglich,
  tauschAktiv,
  setTauschAktiv,

  // Quelle / Ziel
  sch,                 // Zielschicht (Modal)
  tauschQuelle,
  setTauschQuelle,

  // Prüfungen
  tauschAutoLoading,
  tauschShowAll,
  setTauschShowAll,
  tauschOkIds,
  tauschChecks,
  shiftUserIds,

  // User Daten / Notizen
  userNameById,
  notizByUser,
  flagsSummary,
  onPickUser,          // (uid) => void  (öffnet User Modal)

  // NEU: Fenster ±3 für alle User (damit Tauschliste genauso aussieht)
  dienstFensterByUserId, // { [uid]: {vor3,vor2,vor1,heute,nach1,nach2,nach3} }

  modalDatum,
}) {
  return (
    <div>
      {/* Bedarf / Überbesetzung */}
      {deckungByShift && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300 space-y-1">
          <div>
            Früh: Bedarf {deckungByShift.F.totalNeed} / Ist {deckungByShift.F.totalHave}
            {overByShift.F ? (
              <span className="ml-2 text-green-700 font-semibold">
                Überbesetzt (+{deckungByShift.F.overCount})
              </span>
            ) : null}
            {deckungByShift.F.missingTotal > 0 ? (
              <span className="ml-2 text-red-600">
                Fehlt: {missingText(deckungByShift.F)}
              </span>
            ) : null}
          </div>

          <div>
            Spät: Bedarf {deckungByShift.S.totalNeed} / Ist {deckungByShift.S.totalHave}
            {overByShift.S ? (
              <span className="ml-2 text-green-700 font-semibold">
                Überbesetzt (+{deckungByShift.S.overCount})
              </span>
            ) : null}
            {deckungByShift.S.missingTotal > 0 ? (
              <span className="ml-2 text-red-600">
                Fehlt: {missingText(deckungByShift.S)}
              </span>
            ) : null}
          </div>

          <div>
            Nacht: Bedarf {deckungByShift.N.totalNeed} / Ist {deckungByShift.N.totalHave}
            {overByShift.N ? (
              <span className="ml-2 text-green-700 font-semibold">
                Überbesetzt (+{deckungByShift.N.overCount})
              </span>
            ) : null}
            {deckungByShift.N.missingTotal > 0 ? (
              <span className="ml-2 text-red-600">
                Fehlt: {missingText(deckungByShift.N)}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Schichttausch möglich */}
      <label
        className={`text-sm flex items-center gap-2 mt-2 ${
          tauschenMoeglich ? 'text-green-800 font-semibold' : 'text-gray-400'
        }`}
        title={
          !tauschenMoeglich
            ? 'Kein Überschuss vorhanden – Tausch nicht möglich.'
            : 'Überschuss vorhanden – Tausch kann möglich sein.'
        }
      >
        <input
          type="checkbox"
          checked={tauschAktiv}
          disabled={!tauschenMoeglich}
          onChange={(e) => setTauschAktiv(e.target.checked)}
          className="accent-green-600"
        />
        Schichttausch
        {tauschenMoeglich ? (
          <span className="ml-1 px-2 py-0.5 rounded-full bg-green-300 text-green-900 border border-green-500 text-xs">
            möglich
          </span>
        ) : null}
      </label>

      {!tauschenMoeglich && (
        <div className="ml-6 -mt-1 text-[11px] text-gray-400">
          Keine Überbesetzung gefunden – Schichttausch aktuell nicht möglich.
        </div>
      )}

      {/* MOVE UI */}
      {tauschAktiv && deckungByShift && (
        <div className="mt-1 mb-2 rounded-xl p-1 text-xs">
          <div className="font-semibold mb-2">Tauschprüfung (MOVE)</div>

          <div className="flex items-center gap-1 mb-2">
            <span className="text-gray-600 dark:text-gray-300">Quelle:</span>
            <select
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2"
              value={tauschQuelle}
              onChange={(e) => {
                setTauschQuelle(e.target.value);
              }}
            >
              <option value="">— wählen —</option>
              {deckungByShift.F?.overCount > 0 && <option value="F">Früh (über +{deckungByShift.F.overCount})</option>}
              {deckungByShift.S?.overCount > 0 && <option value="S">Spät (über +{deckungByShift.S.overCount})</option>}
              {deckungByShift.N?.overCount > 0 && <option value="N">Nacht (über +{deckungByShift.N.overCount})</option>}
            </select>

            <span className="ml-2 text-gray-600 dark:text-gray-300">Ziel:</span>
            <span className="font-semibold">{SCH_LABEL[sch] || sch}</span>
          </div>

          {!tauschQuelle ? (
            <div className="text-gray-500 dark:text-gray-400 italic">
              Quelle wählen, für Mitarbeiter Prüfung.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header: Status + Toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {tauschAutoLoading
                    ? 'Prüfe alle…'
                    : `OK: ${tauschOkIds.length} / ${(shiftUserIds[tauschQuelle] || []).length}`
                  }
                </div>

                <label className="flex items-center gap-1 text-[11px]">
                  <input
                    type="checkbox"
                    checked={tauschShowAll}
                    onChange={(e) => setTauschShowAll(e.target.checked)}
                  />
                  auch ❌ anzeigen
                </label>
              </div>

              {/* ✅ NEU: Tauschliste als ±3-Tage Tabelle (wie Verfügbare) */}
              {(() => {
                const ids = (shiftUserIds[tauschQuelle] || []).map(String);

                const list = tauschShowAll
                  ? ids
                  : ids.filter((uid) => tauschChecks.get(uid)?.ok);

                if (!list.length) {
                  return <div className="text-gray-500 italic">Keine passenden MA für MOVE gefunden.</div>;
                }

                return (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-[12px] border-separate border-spacing-y-0">
                      <thead className="bg-gray-50 dark:bg-gray-900/30">
                        <tr className="text-left">
                          <th className="pl-2 py-1">Name</th>
                          <th className="px-1 text-[10px] text-gray-500">---</th>
                          <th className="px-1 text-[10px] text-gray-500">--</th>
                          <th className="px-1 text-[10px] text-gray-500">-</th>
                          <th className="px-1 text-[10px] text-center font-semibold">
                            {dayjs(modalDatum).format('DD.MM.YYYY')}
                          </th>
                          <th className="px-1 text-[10px] text-gray-500">+</th>
                          <th className="px-1 text-[10px] text-gray-500">++</th>
                          <th className="px-1 text-[10px] text-gray-500">+++</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.slice(0, 30).map((uid) => {
                          const check = tauschChecks.get(String(uid));
                          const profil = userNameById?.[uid];
                          const n = notizByUser?.get?.(String(uid));
                          const opt = flagsSummary?.(n);

                          const tooltip =
                            `${profil?.voll || uid}\n` +
                            `Tel1: ${profil?.tel1 || '—'}\n` +
                            `Tel2: ${profil?.tel2 || '—'}\n` +
                            (opt ? `Optionen: ${opt}\n` : '') +
                            (n ? `Notiz heute: ${n.notiz || '—'}` : '');

                          const hasAny =
                            !!n &&
                            (
                              (n.notiz && String(n.notiz).trim().length > 0) ||
                              n.kann_heute_nicht ||
                              n.kann_keine_frueh ||
                              n.kann_keine_spaet ||
                              n.kann_keine_nacht ||
                              n.kann_nur_frueh ||
                              n.kann_nur_spaet ||
                              n.kann_nur_nacht 
                            );

                          const row = dienstFensterByUserId?.[uid] || {
                            vor3: '-', vor2: '-', vor1: '-', heute: '-', nach1: '-', nach2: '-', nach3: '-',
                          };

                          const ok = !!check?.ok;
                          const rowStyle = ok
                            ? 'bg-green-100 dark:bg-green-900/25'
                            : 'bg-red-100 dark:bg-red-900/25';

                          return (
                            <tr key={uid} className={rowStyle}>
                              <td className="pl-2 py-1">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-2 hover:underline text-left"
                                  title={`${tooltip}\n\n${check?.text || ''}`}
                                  onClick={() => onPickUser?.(uid)}
                                >
                                  <span className="truncate max-w-[180px] inline-block">
                                    {profil?.voll || String(uid)}
                                  </span>
                                  {hasAny ? <Info size={14} className="opacity-80" /> : null}
                                  <span className="ml-2 text-[11px] opacity-80">
                                    {ok ? '✅' : '❌'}
                                  </span>
                                </button>
                              </td>

                              <td className="px-1 text-[10px] text-gray-600">{row.vor3}</td>
                              <td className="px-1 text-[10px] text-gray-600">{row.vor2}</td>
                              <td className="px-1 text-[11px]">{row.vor1}</td>
                              <td className="px-1 text-[12px] font-semibold text-center">{row.heute}</td>
                              <td className="px-1 text-[11px]">{row.nach1}</td>
                              <td className="px-1 text-[10px] text-gray-600">{row.nach2}</td>
                              <td className="px-1 text-[10px] text-gray-600">{row.nach3}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
