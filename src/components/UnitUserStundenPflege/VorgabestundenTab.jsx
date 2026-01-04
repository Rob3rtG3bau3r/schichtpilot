// src/components/UnitUserStundenPflege/VorgabestundenTab.jsx
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { Search, RefreshCw, Upload, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { downloadTextFile, parseCsv, rowsToObjects, toNumberDE } from '../../utils/spCsv';

dayjs.locale('de');

const T_USERS = 'DB_User';
const T_STUNDEN = 'DB_Stunden';
const T_WAZ = 'DB_WochenArbeitsZeit';

// RPCs
const RPC_UPSERT_VORGABE = 'sp_upsert_vorgabe_stunden';

/* ---------------- UI Helpers ---------------- */
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

const yearOptions = () => {
  const now = dayjs().year();
  return [now - 1, now, now + 1];
};

const buildDisplayName = (u) => {
  if (!u) return '—';
  const vn = (u.vorname || '').trim();
  const nn = (u.nachname || '').trim();
  const s = `${vn} ${nn}`.trim();
  return s || u.email || u.user_id || u.id || '—';
};

export default function VorgabestundenTab({ firma_id, unit_id }) {
  const fileRef = useRef(null);

  const [jahr, setJahr] = useState(dayjs().year());
  const jahrNext = jahr + 1;

  // Suche + Filter
  const [search, setSearch] = useState('');
  const [onlyWithWAZ, setOnlyWithWAZ] = useState(true);
  const [wazFilter, setWazFilter] = useState('ALL');

  // Daten
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [stundenRows, setStundenRows] = useState([]);
  const [wazRows, setWazRows] = useState([]);

  // Auswahl + Msg
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [msg, setMsg] = useState(null);

  // Aktionen: manuell
  const [manualVorgabe, setManualVorgabe] = useState('');

  // Import UI
  const [importOpen, setImportOpen] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importWarnings, setImportWarnings] = useState([]);
  const [importFileName, setImportFileName] = useState('');

  const stundenByUserYear = useMemo(() => {
    const m = new Map();
    (stundenRows || []).forEach((r) => m.set(`${r.user_id}__${r.jahr}`, r));
    return m;
  }, [stundenRows]);

  const wazEffectiveForDate = (user_id, dateStr) => {
    const d = dayjs(dateStr).format('YYYY-MM-DD');
    const list = (wazRows || []).filter((r) => String(r.user_id) === String(user_id));
    if (!list.length) return null;

    const applicable = list
      .filter((r) => dayjs(r.gueltig_ab).format('YYYY-MM-DD') <= d)
      .sort((a, b) => dayjs(b.gueltig_ab).valueOf() - dayjs(a.gueltig_ab).valueOf());

    return applicable[0] || null;
  };

  const loadAll = async () => {
    if (!firma_id || !unit_id) return;
    setLoading(true);
    setMsg(null);

    try {
      // Users
      const { data: uData, error: uErr } = await supabase
        .from(T_USERS)
        .select('user_id, vorname, nachname, personal_nummer, email')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .order('nachname', { ascending: true })
        .order('vorname', { ascending: true });

      if (uErr) throw uErr;
      setUsers(uData || []);

      // Stunden (jahr + jahrNext)
      const yearsToLoad = Array.from(new Set([jahr, jahrNext]));
      const { data: sData, error: sErr } = await supabase
        .from(T_STUNDEN)
        .select('*')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .in('jahr', yearsToLoad);

      if (sErr) throw sErr;
      setStundenRows(sData || []);

      // WAZ
      const { data: wData, error: wErr } = await supabase
        .from(T_WAZ)
        .select('*')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .order('gueltig_ab', { ascending: true });

      if (wErr) throw wErr;
      setWazRows(wData || []);

      setSelectedIds(new Set());
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Fehler beim Laden.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma_id, unit_id, jahr]);

  const vorgabeRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const rows = (users || []).map((u) => {
      const userId = u.user_id || u.id;

      const sCur = stundenByUserYear.get(`${userId}__${jahr}`) || {};
      const sNext = stundenByUserYear.get(`${userId}__${jahrNext}`) || {};

      const eff = wazEffectiveForDate(userId, `${jahrNext}-01-01`);
      const waz = eff ? Number(eff.wochenstunden ?? 0) : null;

      return {
        userId,
        name: buildDisplayName(u),
        nachname: u.nachname,
        vorname: u.vorname,
        personalnummer: u.personal_nummer,
        waz,
        vorgabeAktuell: Number(sCur.vorgabe_stunden ?? 0),
        vorgabeNext: Number(sNext.vorgabe_stunden ?? 0),
      };
    });

    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (onlyWithWAZ && r.waz == null) return false;
      if (wazFilter !== 'ALL') {
        const w = Number(String(wazFilter).replace(',', '.'));
        if (Number(r.waz) !== w) return false;
      }
      return true;
    });
  }, [users, stundenByUserYear, wazRows, jahr, jahrNext, search, onlyWithWAZ, wazFilter]);

  const wazOptions = useMemo(() => {
    const set = new Set();
    (vorgabeRows || []).forEach((r) => { if (r.waz != null) set.add(Number(r.waz)); });
    return Array.from(set).sort((a, b) => a - b);
  }, [vorgabeRows]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const setAllVisibleSelected = (on) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      (vorgabeRows || []).forEach((r) => {
        if (on) n.add(String(r.userId));
        else n.delete(String(r.userId));
      });
      return n;
    });
  };

  const allVisibleSelected = useMemo(() => {
    if (!vorgabeRows.length) return false;
    return vorgabeRows.every((r) => selectedIds.has(String(r.userId)));
  }, [vorgabeRows, selectedIds]);

  /* ---------------- Aktionen ---------------- */

  const bulkCalcNextYearFromWAZ = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const { error } = await supabase.rpc(RPC_UPSERT_VORGABE, {
          p_user_id: uid,
          p_firma_id: firma_id,
          p_unit_id: unit_id,
          p_year: jahrNext,
        });
        if (error) throw error;
      }

      setMsg({ type: 'ok', text: `Vorgabe für ${jahrNext} aus WAZ berechnet (${ids.length} MA).` });
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Berechnung fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkCopyCurrentToNextVorgabe = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const cur = stundenByUserYear.get(`${uid}__${jahr}`) || {};
        const v = Number(cur?.vorgabe_stunden ?? 0);

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

      setMsg({ type: 'ok', text: `Vorgabe ${jahr} → ${jahrNext} übernommen (${ids.length} MA).` });
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Übernahme fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  const bulkSetManualVorgabeNextYear = async () => {
    const ids = Array.from(selectedIds);
    const v = Number(String(manualVorgabe).replace(',', '.'));

    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
    if (!Number.isFinite(v)) return setMsg({ type: 'err', text: 'Bitte eine gültige Zahl eingeben (z.B. 1680).' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
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

      setMsg({ type: 'ok', text: `Vorgabe ${jahrNext} manuell gesetzt (${ids.length} MA).` });
      setManualVorgabe('');
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Manuelles Setzen fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- CSV Export ---------------- */

  const userRowById = useMemo(() => {
    const m = new Map();
    (vorgabeRows || []).forEach((r) => m.set(String(r.userId), r));
    return m;
  }, [vorgabeRows]);

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

      const waz = r.waz == null ? '' : String(r.waz).replace('.', ',');
      const vorgabeAktuell = r.vorgabeAktuell == null ? '' : String(r.vorgabeAktuell).replace('.', ',');
      const zieljahrVorgabe = r.vorgabeNext == null ? '' : String(r.vorgabeNext).replace('.', ',');

      const row = [
        String(r.userId),
        r.nachname ?? '',
        r.vorname ?? '',
        r.personalnummer ?? '',
        waz,
        vorgabeAktuell,
        String(jahrNext),
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

      const waz = r.waz == null ? '' : String(r.waz).replace('.', ',');
      const vorgabeAktuell = r.vorgabeAktuell == null ? '' : String(r.vorgabeAktuell).replace('.', ',');
      const zieljahrVorgabe = r.vorgabeNext == null ? '' : String(r.vorgabeNext).replace('.', ',');

      const row = [
        r.nachname ?? '',
        r.vorname ?? '',
        r.personalnummer ?? '',
        waz,
        vorgabeAktuell,
        String(jahrNext),
        zieljahrVorgabe,
      ].map(csvEscape);

      lines.push(row.join(';'));
    });

    const filename = `schichtpilot_excel_vorgabe_${unit_id}_${jahrNext}_${dayjs().format('YYYY-MM-DD')}.csv`;
    downloadTextFile(filename, lines.join('\n'));
  };

  /* ---------------- CSV Import (SYNC) ---------------- */

  const openImportDialog = () => fileRef.current?.click();

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setMsg(null);
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
      const line = idx + 2;
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
      setMsg({ type: 'err', text: 'Keine gültigen Zeilen zum Import vorhanden.' });
      return;
    }

    setLoading(true);
    setMsg(null);

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

      setSelectedIds(new Set(okRows.map((r) => String(r.sp_user_id))));
      setMsg({ type: 'ok', text: `Import erfolgreich: ${okRows.length} Vorgaben für ${jahrNext} gespeichert.` });
      setImportOpen(false);
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Import fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 items-end">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Jahr</div>
            <Select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
              {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <div className="lg:col-span-2">
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Suche nach Name</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Suche nach Name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34 }}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-start lg:justify-end">
            <Btn onClick={loadAll} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </Btn>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Zieljahr: {jahrNext}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={!!onlyWithWAZ}
              onChange={(e) => setOnlyWithWAZ(e.target.checked)}
            />
            Nur MA mit WAZ
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-200">WAZ:</span>
            <Select className="w-44" value={wazFilter} onChange={(e) => setWazFilter(e.target.value)}>
              <option value="ALL">Alle</option>
              {(wazOptions || []).map((w) => (
                <option key={w} value={String(w)}>{String(w).replace('.', ',')}</option>
              ))}
            </Select>
          </div>
<div className="flex flex-wrap gap-2 items-center">
          <Btn onClick={() => setAllVisibleSelected(true)} disabled={!vorgabeRows.length}>
            Alle sichtbaren
          </Btn>
          <Btn onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>
            Auswahl leeren
          </Btn>
        </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Treffer: <b>{vorgabeRows.length}</b> · Ausgewählt: <b>{selectedIds.size}</b>
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl border p-2 text-sm
            ${msg.type === 'ok'
              ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100'
            }`}
          >
            {msg.text}
          </div>
        )}
      </Card>

      {/* Aktionen */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <BtnPrimary onClick={bulkCalcNextYearFromWAZ} disabled={loading || !selectedIds.size}>
            <SettingsIcon />
            Aus WAZ berechnen
          </BtnPrimary>

          <Btn onClick={bulkCopyCurrentToNextVorgabe} disabled={loading || !selectedIds.size}>
            Aus Vorjahr übernehmen
          </Btn>

          <div className="flex items-center gap-2">
            <Input
              className="w-44"
              placeholder="manuell (z.B. 1680)"
              value={manualVorgabe || ''}
              onChange={(e) => setManualVorgabe(e.target.value)}
            />
            <Btn onClick={bulkSetManualVorgabeNextYear} disabled={loading || !selectedIds.size}>
              Manuell setzen
            </Btn>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Zieljahr: <b>{jahrNext}</b>
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
                    onChange={(e) => setAllVisibleSelected(e.target.checked)}
                  />
                </th>

                <th className="p-2">Name</th>
                <th className="p-2 text-right">WAZ</th>
                <th className="p-2 text-right">Vorgabe ({jahr})</th>
                <th className="p-2 text-right">Vorgabe ({jahrNext})</th>
              </tr>
            </thead>

            <tbody>
              {vorgabeRows.map((r) => (
                <tr key={r.userId} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(r.userId))}
                      onChange={() => toggleSelected(String(r.userId))}
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

              {!vorgabeRows.length && (
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

      {/* CSV Row */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Btn onClick={exportCsvSync} disabled={loading || !selectedIds.size}>
            <Download className="w-4 h-4" />
            CSV (für Import/Sync)
          </Btn>

          <Btn onClick={exportCsvExcel} disabled={loading || !selectedIds.size}>
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

        {/* Import Modal (inline) */}
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
                ✕
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
                </div>
              )}

              {importWarnings?.length > 0 && (
                <div className="rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-100 p-3 text-sm">
                  <div className="font-semibold flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Hinweise
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importWarnings.slice(0, 10).map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
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

        <div className="text-[11px] text-gray-600 dark:text-gray-300">
          Hinweis: Upload-CSV muss <b>sp_user_id</b>, <b>zieljahr</b> und <b>zieljahrVorgabe</b> enthalten.
          Delimiter <b>;</b> oder <b>,</b> wird automatisch erkannt.
        </div>
      </Card>
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
