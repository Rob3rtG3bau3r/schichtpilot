// src/components/Dashboard/BAM_SchichtTausch.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
  sch, // Zielschicht (Modal)
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
  onPickUser, // (uid) => void  (öffnet User Modal)

  // NEU: Fenster ±3 für alle User (damit Tauschliste genauso aussieht)
  dienstFensterByUserId, // { [uid]: {vor3,vor2,vor1,heute,nach1,nach2,nach3} }

  // Push
  onSendPush, // (userIds: string[], msg: string) => void

  modalDatum,
}) {
  // ===== Multi-Push (Tauschliste) =====
  const [multiAktiv, setMultiAktiv] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkText, setBulkText] = useState('');
  const [bulkHint, setBulkHint] = useState('');
  const [bulkTone, setBulkTone] = useState('info'); // 'info'|'warn'|'ok'

  const defaultBulkText = useMemo(() => {
    const label = SCH_LABEL[sch] || sch;
    return `❗ ${label}schicht am ${dayjs(modalDatum).format('DD.MM.YYYY')} unterbesetzt – kannst du helfen?`;
  }, [sch, modalDatum]);

  useEffect(() => {
    // Tag/Schicht: Text vorfüllen, Auswahl reset
    setSelectedIds(new Set());
    setBulkText((prev) => (prev?.trim() ? prev : defaultBulkText));
  }, [defaultBulkText]);

  useEffect(() => {
    // Quelle / Aktivierung: Auswahl & Hint resetten (damit nichts “hängen bleibt”)
    setSelectedIds(new Set());
    setBulkHint('');
    setBulkTone('info');
    setMultiAktiv(false); // ✅ sinnvoll: Multi immer aus beim Wechsel
  }, [tauschQuelle, tauschAktiv]);

  useEffect(() => {
    if (!bulkHint) return;
    const t = setTimeout(() => setBulkHint(''), 3000);
    return () => clearTimeout(t);
  }, [bulkHint]);

  const idsFromQuelle = useMemo(() => {
    if (!tauschQuelle) return [];
    return (shiftUserIds?.[tauschQuelle] || []).map(String);
  }, [tauschQuelle, shiftUserIds]);

  const listIds = useMemo(() => {
    const ids = idsFromQuelle;
    return tauschShowAll ? ids : ids.filter((uid) => tauschChecks.get(uid)?.ok);
  }, [idsFromQuelle, tauschShowAll, tauschChecks]);

  const toggleId = (uid) => {
    const id = String(uid);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(listIds));
  const selectNone = () => setSelectedIds(new Set());

  const msgTrim = String(bulkText || '').trim();
  const canSendBulk =
    !!tauschAktiv &&
    !!tauschQuelle &&
    multiAktiv &&
    selectedIds.size > 0 &&
    msgTrim.length > 0 &&
    !!onSendPush;

  const sendBulk = () => {
    const ids = Array.from(selectedIds);
    const msg = String(bulkText || '').trim();

    if (!tauschAktiv || !tauschQuelle) {
      setBulkTone('warn');
      setBulkHint('Bitte zuerst Tausch aktivieren und Quelle wählen.');
      return;
    }
    if (!multiAktiv) {
      setBulkTone('warn');
      setBulkHint('Bitte „Mehrfachauswahl“ aktivieren.');
      return;
    }
    if (!ids.length) {
      setBulkTone('warn');
      setBulkHint('Bitte mindestens einen Mitarbeiter auswählen.');
      return;
    }
    if (!msg) {
      setBulkTone('warn');
      setBulkHint('Bitte Nachricht eingeben.');
      return;
    }
    if (!onSendPush) {
      setBulkTone('warn');
      setBulkHint('Senden ist gerade nicht verfügbar.');
      return;
    }

    setBulkTone('ok');
    setBulkHint(`✅ Sende an ${ids.length} Mitarbeiter…`);
    onSendPush(ids, msg);
  };

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
              <span className="ml-2 text-red-600">Fehlt: {missingText(deckungByShift.F)}</span>
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
              <span className="ml-2 text-red-600">Fehlt: {missingText(deckungByShift.S)}</span>
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
              <span className="ml-2 text-red-600">Fehlt: {missingText(deckungByShift.N)}</span>
            ) : null}
          </div>
        </div>
      )}
      <h2 className="mt-2 px-2 py-1 border border-gray-600 rounded-xl bg-gray-900/50"> Mitarbeiter für Diensttausch </h2>
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
              onChange={(e) => setTauschQuelle(e.target.value)}
            >
              <option value="">— wählen —</option>
              {deckungByShift.F?.overCount > 0 && (
                <option value="F">Früh (über +{deckungByShift.F.overCount})</option>
              )}
              {deckungByShift.S?.overCount > 0 && (
                <option value="S">Spät (über +{deckungByShift.S.overCount})</option>
              )}
              {deckungByShift.N?.overCount > 0 && (
                <option value="N">Nacht (über +{deckungByShift.N.overCount})</option>
              )}
            </select>

            <span className="ml-2 text-gray-600 dark:text-gray-300">Ziel:</span>
            <span className="font-semibold">{SCH_LABEL[sch] || sch}</span>
          </div>

          {!tauschQuelle ? (
            <div className="text-gray-500 dark:text-gray-400 italic">Quelle wählen, für Mitarbeiter Prüfung.</div>
          ) : (
            <div className="space-y-2">
              {/* Header: Status + Toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {tauschAutoLoading
                    ? 'Prüfe alle…'
                    : `OK: ${tauschOkIds.length} / ${(shiftUserIds[tauschQuelle] || []).length}`}
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

              {/* ✅ WICHTIG: Wenn keine passenden MA => Push-Box NICHT anzeigen */}
              {listIds.length > 0 ? (
                <div className="mt-2 p-2 rounded-xl border border-gray-700/30 bg-gray-900/20">
                  <label className="text-sm flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={multiAktiv}
                      onChange={(e) => {
                        setMultiAktiv(e.target.checked);
                        setSelectedIds(new Set());
                        setBulkText(defaultBulkText);
                        setBulkHint('');
                        setBulkTone('info');
                      }}
                    />
                    Mehrfachauswahl für Push (Tauschliste)
                  </label>

                  {multiAktiv && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-800 text-sm"
                          onClick={selectAll}
                        >
                          Alle
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-800 text-sm"
                          onClick={selectNone}
                        >
                          Keine
                        </button>
                        <div className="text-xs text-gray-500">Ausgewählt: {selectedIds.size}</div>
                      </div>

                      <textarea
                        rows={2}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-sm"
                        maxLength={180}
                      />

                      <button
                        type="button"
                        className="w-full rounded-xl px-4 py-2 bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-60"
                        disabled={!canSendBulk}
                        onClick={sendBulk}
                      >
                        Push an Auswahl senden (Test)
                      </button>

                      {bulkHint ? (
                        <div
                          className={[
                            'text-xs mt-1',
                            bulkTone === 'ok'
                              ? 'text-green-600 dark:text-green-400'
                              : bulkTone === 'warn'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-gray-600 dark:text-gray-300',
                          ].join(' ')}
                        >
                          {bulkHint}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}

              {/* ✅ Tauschliste als ±3-Tage Tabelle */}
              {(() => {
                const list = listIds;

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
                            ((n.notiz && String(n.notiz).trim().length > 0) ||
                              n.kann_heute_nicht ||
                              n.kann_keine_frueh ||
                              n.kann_keine_spaet ||
                              n.kann_keine_nacht ||
                              n.kann_nur_frueh ||
                              n.kann_nur_spaet ||
                              n.kann_nur_nacht);

                          const row = dienstFensterByUserId?.[uid] || {
                            vor3: '-',
                            vor2: '-',
                            vor1: '-',
                            heute: '-',
                            nach1: '-',
                            nach2: '-',
                            nach3: '-',
                          };

                          const ok = !!check?.ok;
                          const rowStyle = ok ? 'bg-green-100 dark:bg-green-900/25' : 'bg-red-100 dark:bg-red-900/25';

                          return (
                            <tr key={uid} className={rowStyle}>
                              <td className="pl-2 py-1">
                                <div className="flex items-center gap-2">
                                  {multiAktiv ? (
                                    <input
                                      type="checkbox"
                                      checked={selectedIds.has(String(uid))}
                                      onChange={() => toggleId(uid)}
                                      className="mt-[1px]"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : null}

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
                                    <span className="ml-2 text-[11px] opacity-80">{ok ? '✅' : '❌'}</span>
                                  </button>
                                </div>
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
