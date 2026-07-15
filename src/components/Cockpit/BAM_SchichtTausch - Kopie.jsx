// src/components/Dashboard/BAM_SchichtTausch.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };

export default function BAM_SchichtTausch({
  // Deckung / Over
  deckungByShift,
  overByShift,
  missingText,

  // Aktivierung
  tauschenMoeglich,

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
  const [bereichOffen, setBereichOffen] = useState(true);

  const defaultBulkText = useMemo(() => {
    const label = SCH_LABEL[sch] || sch;
    return `❗ ${label}schicht am ${dayjs(modalDatum).format('DD.MM.YYYY')} unterbesetzt – kannst du helfen?`;
  }, [sch, modalDatum]);

  useEffect(() => {
    // Wenn kein Schichttausch möglich ist, startet der Bereich eingeklappt.
    setBereichOffen(!!tauschenMoeglich);
    if (!tauschenMoeglich) {
      setMultiAktiv(false);
      setSelectedIds(new Set());
    }
  }, [tauschenMoeglich]);

  useEffect(() => {
    // Tag/Schicht: Text vorfüllen, Auswahl reset
    setSelectedIds(new Set());
    setBulkText((prev) => (prev?.trim() ? prev : defaultBulkText));
  }, [defaultBulkText]);

useEffect(() => {
  setSelectedIds(new Set());
  setBulkHint('');
  setBulkTone('info');
  setMultiAktiv(false);
}, [tauschQuelle]);

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
    !!tauschenMoeglich &&
    !!tauschQuelle &&
    multiAktiv &&
    selectedIds.size > 0 &&
    msgTrim.length > 0 &&
    !!onSendPush;

  const sendBulk = () => {
    const ids = Array.from(selectedIds);
    const msg = String(bulkText || '').trim();

    if (!tauschenMoeglich || !tauschQuelle) {
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

  const StatusPill = ({ shiftKey }) => {
    if (!deckungByShift?.[shiftKey]) return null;

    const d = deckungByShift[shiftKey];
    const label = SCH_LABEL[shiftKey];

    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{label}</span>
          {overByShift?.[shiftKey] ? (
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
              +{d.overCount}
            </span>
          ) : d.missingTotal > 0 ? (
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200">
              fehlt
            </span>
          ) : (
            <span className="text-[11px] rounded-full px-2 py-0.5 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              ok
            </span>
          )}
        </div>

        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          Bedarf {d.totalNeed} / Ist {d.totalHave}
        </div>

        {d.missingTotal > 0 ? (
          <div className="mt-1 text-[11px] text-red-600 dark:text-red-300">
            Fehlt: {missingText(d)}
          </div>
        ) : null}
      </div>
    );
  };

  const headerText = tauschenMoeglich
    ? 'Mitarbeiter für Diensttausch'
    : 'Keine Überbesetzung gefunden';

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setBereichOffen((v) => !v)}
        className={[
          'w-full px-4 py-3 flex items-center justify-between gap-3 text-left border-b border-gray-200 dark:border-gray-700',
          tauschenMoeglich
            ? 'bg-green-50 dark:bg-green-900/20'
            : 'bg-gray-100 dark:bg-gray-800',
        ].join(' ')}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {bereichOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <h2 className="font-bold truncate">{headerText}</h2>
          </div>

          {!tauschenMoeglich ? (
            <p className="mt-1 ml-7 text-xs text-gray-500 dark:text-gray-400">
              Schichttausch aktuell nicht möglich. Details können bei Bedarf aufgeklappt werden.
            </p>
          ) : (
            <p className="mt-1 ml-7 text-xs text-green-700 dark:text-green-300">
              Überbesetzung vorhanden – Tauschprüfung kann genutzt werden.
            </p>
          )}
        </div>

        <span
          className={[
            'shrink-0 text-xs px-2 py-1 rounded-full border',
            tauschenMoeglich
              ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-200 dark:border-green-700'
              : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600',
          ].join(' ')}
        >
          {bereichOffen ? 'Einklappen' : 'Ausklappen'}
        </span>
      </button>

      {!bereichOffen ? null : (
        <div className="p-4 space-y-4">
          {/* Bedarf / Überbesetzung */}
          {deckungByShift && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <StatusPill shiftKey="F" />
              <StatusPill shiftKey="S" />
              <StatusPill shiftKey="N" />
            </div>
          )}

          {/* Schichttausch möglich */}
         
          {!tauschenMoeglich && (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
              Keine Überbesetzung gefunden – deshalb wird die Tauschprüfung nicht automatisch angezeigt.
            </div>
          )}

          {/* MOVE UI */}
          {tauschenMoeglich && deckungByShift && (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950/40 p-3 text-xs">
              <div className="font-bold mb-3">Tauschprüfung</div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-gray-600 dark:text-gray-300">Quelle:</span>
                <select
                  className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1"
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

                <span className="ml-1 text-gray-600 dark:text-gray-300">Ziel:</span>
                <span className="font-semibold rounded-full px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  {SCH_LABEL[sch] || sch}
                </span>
              </div>

              {!tauschQuelle ? (
                <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-3 text-gray-500 dark:text-gray-400 italic">
                  Quelle wählen, damit die Mitarbeiter geprüft werden können.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header: Status + Toggle */}
                  <div className="flex items-center justify-between gap-2">
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
                    <div className="p-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
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
                        Mehrfachauswahl für Benachrichtigungen (Tauschliste)
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
                            Benachrichtigung an Auswahl senden
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
                      return (
                        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-3 text-gray-500 dark:text-gray-400 italic">
                          Keine passenden MA für die Tauschprüfung gefunden.
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
                        <table className="w-full text-[12px] border-separate border-spacing-y-0">
                          <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr className="text-left">
                              <th className="pl-2 py-2">Name</th>
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
                              const rowStyle = ok ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';

                              return (
                                <tr key={uid} className={rowStyle}>
                                  <td className="pl-2 py-1.5">
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

                                  <td className="px-1 text-[10px] text-gray-600 dark:text-gray-300">{row.vor3}</td>
                                  <td className="px-1 text-[10px] text-gray-600 dark:text-gray-300">{row.vor2}</td>
                                  <td className="px-1 text-[11px]">{row.vor1}</td>
                                  <td className="px-1 text-[12px] font-semibold text-center">{row.heute}</td>
                                  <td className="px-1 text-[11px]">{row.nach1}</td>
                                  <td className="px-1 text-[10px] text-gray-600 dark:text-gray-300">{row.nach2}</td>
                                  <td className="px-1 text-[10px] text-gray-600 dark:text-gray-300">{row.nach3}</td>
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
      )}
    </div>
  );
}
