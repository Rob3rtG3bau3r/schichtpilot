// src/components/UnitUserStundenPflege/VorgabestundenTab.jsx
'use client';
import React, { useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import {
  Upload, Download, CheckCircle2, AlertTriangle, X,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { downloadTextFile, parseCsv, rowsToObjects, toNumberDE } from '../../utils/spCsv';

const T_STUNDEN = 'DB_Stunden';

/* ---------------- UI Mini-Components ---------------- */
const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
    {children}
  </div>
);

const Btn = ({ className = '', children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold
      border border-gray-300 dark:border-gray-700
      bg-gray-100 hover:bg-gray-200 dark:bg-gray-900/40 dark:hover:bg-gray-900/70
      text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const BtnPrimary = ({ className = '', children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold
      bg-gray-900 text-white hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

const Input = ({ className = '', ...props }) => (
  <input
    {...props}
    className={`w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
      px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
      focus:ring-2 focus:ring-gray-400/40 ${className}`}
  />
);

const Select = ({ className = '', ...props }) => (
  <select
    {...props}
    className={`w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
      px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
      focus:ring-2 focus:ring-gray-400/40 ${className}`}
  />
);

const fmt = (v, digits = 2) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(digits).replace('.', ',');
};

/* ========================================================= */

export default function VorgabestundenTab({
  // vom Parent:
  firma_id,
  unit_id,
  jahr,
  jahrNext,
  loading,
  setLoading,
  msg,
  setMsg,

  selectedIds,
  setSelectedIds,
  clearSelection,
  setAllVisibleSelected, // (on:boolean, visibleRows:Array) => void
  toggleSelected,

  // rows:
  vorgabeRows, // [{ userId, name, waz, vorgabeAktuell, vorgabeNext, vorname, nachname, personalnummer }]
  loadAll,

  // Filter:
  onlyWithWAZ,
  setOnlyWithWAZ,
  wazFilter,
  setWazFilter,
  wazOptions,

  // Sort:
  sortBy,
  toggleSort,
  sortRows,

  // Aktionen:
  manualVorgabe,
  setManualVorgabe,
  bulkCalcNextYearFromWAZ,
  bulkCopyCurrentToNextVorgabe,
  bulkSetManualVorgabeNextYear,
}) {
  const fileRef = useRef(null);

  // ------- Import UI -------
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]); // normalized preview rows
  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importFileName, setImportFileName] = useState('');

  /* ------------------------ Lookups / Visible Rows ------------------------ */

  const userRowById = useMemo(() => {
    const m = new Map();
    (vorgabeRows || []).forEach((r) => m.set(String(r.userId), r));
    return m;
  }, [vorgabeRows]);

  const filteredRows = useMemo(() => {
    let rows = [...(vorgabeRows || [])];

    if (onlyWithWAZ) rows = rows.filter((r) => r.waz != null);

    if (wazFilter !== 'ALL') {
      const w = Number(String(wazFilter).replace(',', '.'));
      rows = rows.filter((r) => Number(r.waz) === w);
    }

    return rows;
  }, [vorgabeRows, onlyWithWAZ, wazFilter]);

  const visibleRows = useMemo(() => {
    return sortRows ? sortRows(filteredRows) : filteredRows;
  }, [filteredRows, sortRows]);

  const allVisibleSelected = useMemo(() => {
    if (!visibleRows.length) return false;
    return visibleRows.every((r) => selectedIds?.has(r.userId));
  }, [visibleRows, selectedIds]);

  /* =========================
     CSV EXPORT
     ========================= */

  const exportCsvSync = () => {
    const ids = Array.from(selectedIds || []);
    if (!ids.length) {
      setMsg?.({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
      return;
    }

    const header = [
      'sp_user_id',
      'nachname',
      'vorname',
      'personalnummer',
      'waz',
      'vorgabeAktuell',
      'zieljahr',
      'zieljahrVorgabe',
    ];

    const lines = [header.join(';')];

    ids.forEach((id) => {
      const r = userRowById.get(String(id));
      if (!r) return;

      const nachname = r.nachname ?? r.nach_name ?? '';
      const vorname = r.vorname ?? '';
      const personalnummer = r.personalnummer ?? r.personal_nummer ?? '';
      const waz = r.waz == null ? '' : String(r.waz).replace('.', ',');
      const vorgabeAktuell = r.vorgabeAktuell == null ? '' : String(r.vorgabeAktuell).replace('.', ',');
      const zieljahr = String(jahrNext);
      const zieljahrVorgabe = r.vorgabeNext == null ? '' : String(r.vorgabeNext).replace('.', ',');

      const row = [
        String(r.userId),
        nachname,
        vorname,
        personalnummer,
        waz,
        vorgabeAktuell,
        zieljahr,
        zieljahrVorgabe,
      ].map(csvEscape);

      lines.push(row.join(';'));
    });

    const filename = `schichtpilot_sync_vorgabe_${unit_id}_${jahrNext}_${dayjs().format('YYYY-MM-DD')}.csv`;
    downloadTextFile(filename, lines.join('\n'));
  };

  const exportCsvExcel = () => {
    const ids = Array.from(selectedIds || []);
    if (!ids.length) {
      setMsg?.({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
      return;
    }

    const header = [
      'nachname',
      'vorname',
      'personalnummer',
      'waz',
      'vorgabeAktuell',
      'zieljahr',
      'zieljahrVorgabe',
    ];

    const lines = [header.join(';')];

    ids.forEach((id) => {
      const r = userRowById.get(String(id));
      if (!r) return;

      const nachname = r.nachname ?? '';
      const vorname = r.vorname ?? '';
      const personalnummer = r.personalnummer ?? '';
      const waz = r.waz == null ? '' : String(r.waz).replace('.', ',');
      const vorgabeAktuell = r.vorgabeAktuell == null ? '' : String(r.vorgabeAktuell).replace('.', ',');
      const zieljahr = String(jahrNext);
      const zieljahrVorgabe = r.vorgabeNext == null ? '' : String(r.vorgabeNext).replace('.', ',');

      const row = [
        nachname,
        vorname,
        personalnummer,
        waz,
        vorgabeAktuell,
        zieljahr,
        zieljahrVorgabe,
      ].map(csvEscape);

      lines.push(row.join(';'));
    });

    const filename = `schichtpilot_excel_vorgabe_${unit_id}_${jahrNext}_${dayjs().format('YYYY-MM-DD')}.csv`;
    downloadTextFile(filename, lines.join('\n'));
  };

  /* =========================
     CSV IMPORT (SYNC)
     ========================= */

  const openImportDialog = () => fileRef.current?.click();

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setMsg?.(null);
    setImportErrors([]);
    setImportWarnings([]);
    setImportPreview([]);
    setImportFileName(file.name);

    const text = await file.text();
    const { rows } = parseCsv(text);
    const objs = rowsToObjects(rows);

    const errors = [];
    const warnings = [];
    const preview = [];

    if (!objs.length) {
      errors.push('CSV ist leer oder konnte nicht gelesen werden.');
      setImportErrors(errors);
      setImportOpen(true);
      return;
    }

    const pick = (o, keys) => {
      for (const k of keys) {
        const v = o?.[k];
        if (v != null && String(v).trim() !== '') return v;
      }
      return '';
    };

    objs.forEach((o, idx) => {
      const line = idx + 2; // Header = Zeile 1
      const sp_user_id = pick(o, ['sp_user_id', 'spuserid', 'user_id', 'userid', 'spuser_id']);
      const zieljahrStr = pick(o, ['zieljahr', 'year', 'jahr']);
      const zieljahrVorgabeStr = pick(o, ['zieljahrvorgabe', 'zieljahrVorgabe', 'vorgabenext', 'vorgabe', 'vorgabestunden', 'ziel_vorgabe']);

      if (!sp_user_id) errors.push(`Zeile ${line}: sp_user_id fehlt.`);

      const zieljahr = zieljahrStr ? Number(String(zieljahrStr).trim()) : null;
      if (!zieljahr || !Number.isFinite(zieljahr)) errors.push(`Zeile ${line}: zieljahr ist ungültig (${zieljahrStr || 'leer'}).`);
      if (zieljahr !== jahrNext) errors.push(`Zeile ${line}: zieljahr=${zieljahr} passt nicht zum aktuellen Zieljahr ${jahrNext}.`);

      const v = toNumberDE(zieljahrVorgabeStr);
      if (v == null) errors.push(`Zeile ${line}: zieljahrVorgabe ist keine Zahl (${zieljahrVorgabeStr || 'leer'}).`);

      const local = userRowById.get(String(sp_user_id));
      if (!local) warnings.push(`Zeile ${line}: sp_user_id ${sp_user_id} ist in dieser Unit/Jahr-Ansicht nicht vorhanden.`);

      preview.push({
        line,
        sp_user_id: String(sp_user_id || ''),
        name: local?.name || `${local?.nachname || ''} ${local?.vorname || ''}`.trim() || '—',
        zieljahr,
        zieljahrVorgabe: v,
        ok: !!sp_user_id && zieljahr === jahrNext && v != null && !!local,
      });
    });

    setImportErrors(dedupe(errors));
    setImportWarnings(dedupe(warnings));
    setImportPreview(preview);
    setImportOpen(true);
  };

  const applyImport = async () => {
    const okRows = (importPreview || []).filter((r) => r.ok);
    if (!okRows.length) {
      setMsg?.({ type: 'err', text: 'Keine gültigen Zeilen zum Import vorhanden.' });
      return;
    }

    setLoading?.(true);
    setMsg?.(null);

    try {
      for (const r of okRows) {
        const uid = r.sp_user_id;
        const v = Number(r.zieljahrVorgabe);

        const { error } = await supabase
          .from(T_STUNDEN)
          .upsert(
            {
              user_id: uid,
              firma_id,
              unit_id,
              jahr: jahrNext,
              vorgabe_stunden: v,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,jahr,firma_id,unit_id' }
          );

        if (error) throw error;
      }

      setSelectedIds?.(new Set(okRows.map((r) => String(r.sp_user_id))));
      setMsg?.({ type: 'ok', text: `Import erfolgreich: ${okRows.length} Vorgaben für ${jahrNext} gespeichert.` });
      setImportOpen(false);
      await loadAll?.();
    } catch (e) {
      setMsg?.({ type: 'err', text: e?.message || 'Import fehlgeschlagen.' });
    } finally {
      setLoading?.(false);
    }
  };

  /* =========================
     UI
     ========================= */

  return (
    <div className="space-y-3">

      {/* Filter + Auswahl + Aktionen */}
      <Card className="p-3 space-y-3">
        {/* Auswahl */}
        <div className="flex flex-wrap gap-2 items-center">
          <Btn onClick={() => setAllVisibleSelected?.(true, visibleRows)} disabled={!visibleRows.length}>
            Alle sichtbaren
          </Btn>

          <Btn onClick={clearSelection} disabled={!selectedIds?.size}>
            Auswahl leeren
          </Btn>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Ausgewählt: <b>{selectedIds?.size || 0}</b> · Zieljahr: <b>{jahrNext}</b>
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={!!onlyWithWAZ}
              onChange={(e) => setOnlyWithWAZ?.(e.target.checked)}
            />
            Nur MA mit WAZ
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-200">WAZ:</span>
            <Select
              className="w-44"
              value={wazFilter}
              onChange={(e) => setWazFilter?.(e.target.value)}
            >
              <option value="ALL">Alle</option>
              {(wazOptions || []).map((w) => (
                <option key={w} value={String(w)}>
                  {String(w).replace('.', ',')}
                </option>
              ))}
            </Select>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Sortieren: Klick auf Tabellenkopf (Name/WAZ/Vorgaben)
          </div>
        </div>

        {/* Aktionen */}
        <div className="flex flex-wrap gap-2 items-center">
          <BtnPrimary onClick={bulkCalcNextYearFromWAZ} disabled={loading || !selectedIds?.size}>
            <SettingsIcon />
            Aus WAZ berechnen
          </BtnPrimary>

          <Btn onClick={bulkCopyCurrentToNextVorgabe} disabled={loading || !selectedIds?.size}>
            Aus Vorjahr übernehmen
          </Btn>

          <div className="flex items-center gap-2">
            <Input
              className="w-44"
              placeholder="manuell (z.B. 1680)"
              value={manualVorgabe || ''}
              onChange={(e) => setManualVorgabe?.(e.target.value)}
            />
            <Btn onClick={bulkSetManualVorgabeNextYear} disabled={loading || !selectedIds?.size}>
              Manuell setzen
            </Btn>
          </div>
        </div>
      </Card>

      {/* Tabelle */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-900/40">
              <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => setAllVisibleSelected?.(e.target.checked, visibleRows)}
                  />
                </th>

                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort?.('name')}>
                  Name {sortBy?.key === 'name' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort?.('waz')}>
                  WAZ {sortBy?.key === 'waz' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort?.('vorgabeAktuell')}>
                  Vorgabe ({jahr}) {sortBy?.key === 'vorgabeAktuell' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>

                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort?.('vorgabeNext')}>
                  Vorgabe ({jahrNext}) {sortBy?.key === 'vorgabeNext' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.userId} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(r.userId)}
                      onChange={() => toggleSelected?.(r.userId)}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {r.waz == null ? 'Keine WAZ gefunden' : `gültig zum 01.01.${jahrNext}`}
                    </div>
                  </td>
                  <td className="p-2 text-right tabular-nums">{r.waz == null ? '—' : fmt(r.waz)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.vorgabeAktuell)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.vorgabeNext)}</td>
                </tr>
              ))}

              {!visibleRows.length && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-gray-600 dark:text-gray-300">
                    Keine Einträge gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CSV Actions Row */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Btn onClick={exportCsvSync} disabled={loading || !selectedIds?.size}>
            <Download className="w-4 h-4" />
            CSV (für Import/Sync)
          </Btn>

          <Btn onClick={exportCsvExcel} disabled={loading || !selectedIds?.size}>
            <Download className="w-4 h-4" />
            CSV (für Menschen/Excel)
          </Btn>

          <BtnPrimary onClick={openImportDialog} disabled={loading}>
            <Upload className="w-4 h-4" />
            CSV hochladen (Sync)
          </BtnPrimary>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFilePicked}
          />

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Upload schreibt nur <b>zieljahrVorgabe</b> in DB_Stunden (Jahr <b>{jahrNext}</b>)
          </div>
        </div>

        {/* Import Modal */}
        {importOpen && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Import Vorschau – {importFileName || 'CSV'}
              </div>
              <button
                onClick={() => setImportOpen(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900/40"
              >
                <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {importErrors?.length > 0 && (
                <div className="rounded-xl border border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100 p-3 text-sm">
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Fehler (Import blockiert)
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importErrors.slice(0, 12).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                  {importErrors.length > 12 && (
                    <div className="text-xs mt-2 opacity-80">…und {importErrors.length - 12} weitere</div>
                  )}
                </div>
              )}

              {importWarnings?.length > 0 && (
                <div className="rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-100 p-3 text-sm">
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Hinweise (Import möglich, aber Zeilen ggf. übersprungen)
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importWarnings.slice(0, 10).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                  {importWarnings.length > 10 && (
                    <div className="text-xs mt-2 opacity-80">…und {importWarnings.length - 10} weitere</div>
                  )}
                </div>
              )}

              <div className="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-[700px] w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-900/40">
                    <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                      <th className="p-2 w-20">Zeile</th>
                      <th className="p-2">sp_user_id</th>
                      <th className="p-2">Name</th>
                      <th className="p-2 text-right">Zieljahr</th>
                      <th className="p-2 text-right">zieljahrVorgabe</th>
                      <th className="p-2 w-24">OK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(importPreview || []).slice(0, 200).map((r) => (
                      <tr key={r.line} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="p-2 tabular-nums">{r.line}</td>
                        <td className="p-2 tabular-nums">{r.sp_user_id}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2 text-right tabular-nums">{r.zieljahr}</td>
                        <td className="p-2 text-right tabular-nums">{fmt(r.zieljahrVorgabe)}</td>
                        <td className="p-2">
                          {r.ok ? (
                            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-300 font-semibold">
                              <CheckCircle2 className="w-4 h-4" /> OK
                            </span>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!importPreview || importPreview.length === 0) && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-gray-600 dark:text-gray-300">
                          Keine Vorschau-Daten
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Btn onClick={() => setImportOpen(false)}>
                  Schließen
                </Btn>

                <BtnPrimary
                  onClick={applyImport}
                  disabled={loading || importErrors.length > 0 || (importPreview || []).filter((r) => r.ok).length === 0}
                >
                  Import speichern ({(importPreview || []).filter((r) => r.ok).length} Zeilen)
                </BtnPrimary>

                <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
                  Importiert werden nur Zeilen mit OK=true (Match über sp_user_id).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hilfe */}
        <div className="text-[11px] text-gray-600 dark:text-gray-300">
          Hinweis: Die Upload-CSV muss <b>sp_user_id</b>, <b>zieljahr</b> und <b>zieljahrVorgabe</b> enthalten.
          Delimiter <b>;</b> oder <b>,</b> wird automatisch erkannt.
        </div>
      </Card>

      {/* Optional: msg-Anzeige (wenn du sie im Parent nicht zeigen willst) */}
      {msg?.type && (
        <div className={`rounded-xl border p-2 text-sm
          ${msg.type === 'ok'
            ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
            : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100'
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function dedupe(arr) {
  return Array.from(new Set(arr || []));
}

// Mini Icon (damit wir nicht noch lucide Settings importen müssen)
function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-90">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.1 7.1 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
      />
    </svg>
  );
}
