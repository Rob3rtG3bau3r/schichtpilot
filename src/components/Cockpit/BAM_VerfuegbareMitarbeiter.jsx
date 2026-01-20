// src/components/Dashboard/BAM_VerfuegbareMitarbeiter.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';

export default function BAM_VerfuegbareMitarbeiter({
  modalDatum,
  modalSchicht,
  kollidiertAktiv,
  setKollidiertAktiv,
  freieMitarbeiter,
  getBewertungsStufe,
  flagsSummary,
  notizByUser,
  onPickUser, 
  onSendPush, 
}) {
  const [multiAktiv, setMultiAktiv] = useState(false);
const [selectedIds, setSelectedIds] = useState(() => new Set());

const defaultBulkText = useMemo(() => {
  const s = String(modalSchicht || '').toUpperCase();
  const label = s === 'F' ? 'Früh' : s === 'S' ? 'Spät' : s === 'N' ? 'Nacht' : s;
  return `❗ ${label}schicht am ${dayjs(modalDatum).format('DD.MM.YYYY')} unterbesetzt – kannst du helfen?`;
}, [modalDatum, modalSchicht]);

const [bulkText, setBulkText] = useState('');
const [bulkHint, setBulkHint] = useState('');     // kleine Inline Meldung
const [bulkTone, setBulkTone] = useState('info'); // 'info' | 'warn' | 'ok'

useEffect(() => {
  setSelectedIds(new Set());
  setBulkText((prev) => (prev?.trim() ? prev : defaultBulkText));
}, [defaultBulkText]);

useEffect(() => {
  if (!bulkHint) return;
  const t = setTimeout(() => setBulkHint(''), 3000);
  return () => clearTimeout(t);
}, [bulkHint]);

const allIds = useMemo(
  () => (freieMitarbeiter || []).map((x) => String(x?.uid)).filter(Boolean),
  [freieMitarbeiter]
);

const toggleId = (uid) => {
  const id = String(uid);
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const selectAll = () => setSelectedIds(new Set(allIds));
const selectNone = () => setSelectedIds(new Set());
const msgTrim = String(bulkText || '').trim();
const canSendBulk = multiAktiv && selectedIds.size > 0 && msgTrim.length > 0 && !!onSendPush;

const sendBulk = () => {
  const ids = Array.from(selectedIds);
  const msg = String(bulkText || '').trim();

  console.log('BULK CLICK', { ids, msg, hasHandler: !!onSendPush });

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
    setBulkHint('Senden ist gerade nicht verfügbar (Handler fehlt).');
    return;
  }

  setBulkTone('ok');
  setBulkHint(`✅ Sende an ${ids.length} Mitarbeiter…`);
  onSendPush(ids, msg);
};

  return (
    <div>
          <h2 className="mt-2 px-2 py-1 border border-gray-600 rounded-xl bg-gray-900/50"> Verfügbare Mitarbeiter </h2>
      {/* Kollidiert */}
      <div className="mt-2">
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={kollidiertAktiv}
            onChange={(e) => setKollidiertAktiv(e.target.checked)}
            className="accent-red-500"
          />
          Kollidiert mit Dienst
        </label>
      </div>
      {/* ✅ Multi-Push */}
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
    Mehrfachauswahl für Push
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
        <div className="text-xs text-gray-500">
          Ausgewählt: {selectedIds.size}
        </div>
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
            "text-xs mt-1",
            bulkTone === "ok" ? "text-green-600 dark:text-green-400" :
            bulkTone === "warn" ? "text-amber-700 dark:text-amber-400" :
            "text-gray-600 dark:text-gray-300",
          ].join(" ")}
        >
          {bulkHint}
        </div>
      ) : null}
            
          </div>
        )}
      </div>

      <table className="w-full text-sm border-separate border-spacing-y-1">
        <thead>
          <tr className="text-left">
            <th className="pl-2 text-left text-sm">Name</th>
            <th className="px-0 text-[10px]">---</th>
            <th className="px-0 text-[10px]">--</th>
            <th className="px-0 text-center">-</th>
            <th className="px-0 text-center text-[10px]">{dayjs(modalDatum).format('DD.MM.YYYY')}</th>
            <th className="px-0 text-center">+</th>
            <th className="px-0 text-[10px]">++</th>
            <th className="px-0 text-[10px]">+++</th>
          </tr>
        </thead>

        <tbody>
          {(freieMitarbeiter || [])
            .filter(Boolean)
            .sort((a, b) => {
              const gewicht = (f) => {
                const st = getBewertungsStufe(f);
                return st === 'grün' ? -3 : st === 'gelb' ? -2 : st === 'amber' ? -1 : 0;
              };
              const gA = gewicht(a);
              const gB = gewicht(b);
              if (gA !== gB) return gA - gB;

              const schichtGewicht = (v) => {
                if (modalSchicht === 'F') return v.vorher === 'N' ? 2 : v.vorher === 'S' ? 1 : 0;
                if (modalSchicht === 'N') return v.nachher === 'F' ? 2 : v.nachher === 'S' ? 1 : 0;
                if (modalSchicht === 'S') return (v.vorher === 'N' || v.nachher === 'F') ? 1 : 0;
                return 0;
              };
              return schichtGewicht(a) - schichtGewicht(b);
            })
            .map((f) => {
              const bewertung = getBewertungsStufe(f);
              const istKollisionRot = bewertung === 'rot';
              if (!kollidiertAktiv && istKollisionRot) return null;

              let rowStyle = '';
              if (bewertung === 'grün') rowStyle = 'bg-green-100 dark:bg-green-900/40';
              else if (bewertung === 'gelb') rowStyle = 'bg-yellow-100 dark:bg-yellow-900/40';
              else if (bewertung === 'amber') rowStyle = 'bg-amber-100 dark:bg-amber-900/40 text-red-500 dark:text-red-500';
              else if (bewertung === 'rot') rowStyle = 'bg-red-100 dark:bg-red-900/40';

              const n = notizByUser.get(String(f.uid));
              const opt = flagsSummary(n);

              const tooltip =
                `${f.name}\n` +
                `Tel1: ${f.tel1 || '—'}\n` +
                `Tel2: ${f.tel2 || '—'}\n` +
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

              return (
                <tr key={String(f.uid)} className={`text-center ${rowStyle}`}>
                    <td className="pl-2 text-left">
                    <div className="flex items-center gap-2">
                      {multiAktiv && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(f.uid))}
                          onChange={() => toggleId(f.uid)}
                          className="mt-[1px]"
                        />
                      )}

                      <button
                        type="button"
                        className="inline-flex items-center gap-2 hover:underline text-left"
                        title={tooltip}
                        onClick={() => onPickUser(f)}
                      >
                        <span>{f.name}</span>

                        {hasAny ? (
                          <Info
                            size={14}
                            className={n?.kann_heute_nicht ? "text-red-600 opacity-90" : "text-blue-500 opacity-80"}
                            title={opt ? `Gesprächsnotiz: ${opt}` : "Gesprächsnotiz vorhanden"}
                          />
                        ) : null}
                      </button>
                    </div>
                  </td>
                  <td className="text-[10px] text-gray-500 px-1">{f.vor3}</td>
                  <td className="text-[10px] text-gray-500 px-1">{f.vor2}</td>
                  <td className="text-xs px-2">{f.vor1}</td>
                  <td className="text-md font-semibold px-2">
                    <span className={
                      f.heute === 'F' ? 'text-blue-500' :
                      f.heute === 'S' ? 'text-amber-500' :
                      f.heute === 'N' ? 'text-purple-500' :
                      'text-gray-500'
                    }>
                      {f.heute}
                    </span>
                  </td>
                  <td className="text-xs px-2">{f.nach1}</td>
                  <td className="text-[10px] text-gray-500 px-1">{f.nach2}</td>
                  <td className="text-[10px] text-gray-500 px-1">{f.nach3}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
