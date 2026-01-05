// src/components/UnitUserStundenPflege/VorgabeurlaubTab.jsx
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { Search, RefreshCw, Download } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { downloadTextFile } from '../../utils/spCsv';

dayjs.locale('de');

const T_USERS = 'DB_User';
const T_URLAUB = 'DB_Urlaub';

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

const triMsgClass = (type) =>
  type === 'ok'
    ? 'border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100'
    : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-100';

export default function VorgabeurlaubTab({ firma_id, unit_id }) {
  const [jahr, setJahr] = useState(dayjs().year());
  const jahrNext = jahr + 1;

  // Suche
  const [search, setSearch] = useState('');

  // Daten
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [urlaubRows, setUrlaubRows] = useState([]);

  // Auswahl + Msg
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [msg, setMsg] = useState(null);

  // Aktionen: manuell (urlaub_soll für Zieljahr)
  const [manualSoll, setManualSoll] = useState('');

  // Maps
  const urlaubByUserYear = useMemo(() => {
    const m = new Map();
    (urlaubRows || []).forEach((r) => m.set(`${r.user_id}__${r.jahr}`, r));
    return m;
  }, [urlaubRows]);

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

      // Urlaub (jahr + jahrNext)
      const yearsToLoad = Array.from(new Set([jahr, jahrNext]));
      const { data: urData, error: urErr } = await supabase
        .from(T_URLAUB)
        .select('*')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .in('jahr', yearsToLoad);

      if (urErr) throw urErr;
      setUrlaubRows(urData || []);

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

      const cur = urlaubByUserYear.get(`${userId}__${jahr}`) || {};
      const next = urlaubByUserYear.get(`${userId}__${jahrNext}`) || {};

      // Aktuell
      const soll = Number(cur.urlaub_soll ?? 0);
      const genommen = Number(cur.summe_jahr ?? 0);
      const uebernahme = Number(cur.uebernahme_vorjahr ?? 0);
      const korrektur = Number(cur.korrektur ?? 0);

      const gesamt = (cur.urlaub_gesamt != null)
        ? Number(cur.urlaub_gesamt ?? 0)
        : (soll + uebernahme + korrektur);

      const resturlaub = gesamt - genommen;

      // Zieljahr
      const sollNext = Number(next.urlaub_soll ?? 0);
      const uebernahmeNext = Number(next.uebernahme_vorjahr ?? 0);

      return {
        userId,
        name: buildDisplayName(u),
        nachname: u.nachname,
        vorname: u.vorname,
        personalnummer: u.personal_nummer,

        sollAktuell: soll,
        genommenAktuell: genommen,
        gesamtAktuell: gesamt,
        resturlaubAktuell: resturlaub,

        sollNext,
        uebernahmeNext,

        hasCur: !!cur?.id,
        hasNext: !!next?.id,
      };
    });

    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, urlaubByUserYear, jahr, jahrNext, search]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      const k = String(id);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const setAllVisibleSelected = (on) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      (vorgabeRows || []).forEach((r) => {
        const k = String(r.userId);
        if (on) n.add(k);
        else n.delete(k);
      });
      return n;
    });
  };

  const allVisibleSelected = useMemo(() => {
    if (!vorgabeRows.length) return false;
    return vorgabeRows.every((r) => selectedIds.has(String(r.userId)));
  }, [vorgabeRows, selectedIds]);

  /* ---------------- Aktionen ---------------- */

  // 1) Aus Vorjahr übernehmen: urlaub_soll (Zieljahr) = urlaub_soll (aktuelles Jahr)
  const bulkCopyCurrentToNextSoll = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const cur = urlaubByUserYear.get(`${uid}__${jahr}`) || {};
        const soll = Number(cur.urlaub_soll ?? 0);

        const { error } = await supabase
          .from(T_URLAUB)
          .upsert(
            {
              user_id: uid,
              firma_id,
              unit_id,
              jahr: jahrNext,
              urlaub_soll: soll,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,jahr,firma_id,unit_id' }
          );

        if (error) throw error;
      }

      setMsg({ type: 'ok', text: `Urlaub-Soll ${jahr} → ${jahrNext} übernommen (${ids.length} MA).` });
      setManualSoll('');
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Übernahme fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  // 2) Aus Vorjahr übernehmen + Resturlaub:
  // Zieljahr: urlaub_soll = aktuelles urlaub_soll
  //          uebernahme_vorjahr = Resturlaub (gesamt - genommen) aus aktuellem Jahr
  const bulkCopyCurrentToNextSollWithResturlaub = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const cur = urlaubByUserYear.get(`${uid}__${jahr}`) || {};

        const soll = Number(cur.urlaub_soll ?? 0);
        const genommen = Number(cur.summe_jahr ?? 0);
        const uebernahme = Number(cur.uebernahme_vorjahr ?? 0);
        const korrektur = Number(cur.korrektur ?? 0);

        const gesamt = (cur.urlaub_gesamt != null)
          ? Number(cur.urlaub_gesamt ?? 0)
          : (soll + uebernahme + korrektur);

        const resturlaub = gesamt - genommen; // kann auch negativ sein

        const { error } = await supabase
          .from(T_URLAUB)
          .upsert(
            {
              user_id: uid,
              firma_id,
              unit_id,
              jahr: jahrNext,
              urlaub_soll: soll,
              uebernahme_vorjahr: resturlaub,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,jahr,firma_id,unit_id' }
          );

        if (error) throw error;
      }

      setMsg({ type: 'ok', text: `Urlaub-Soll ${jahr} → ${jahrNext} + Resturlaub übernommen (${ids.length} MA).` });
      setManualSoll('');
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Übernahme mit Resturlaub fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  // 3) Manuell setzen: urlaub_soll (Zieljahr) = X
  const bulkSetManualSollNextYear = async () => {
    const ids = Array.from(selectedIds);
    const v = Number(String(manualSoll).replace(',', '.'));

    if (!ids.length) return setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
    if (!Number.isFinite(v)) return setMsg({ type: 'err', text: 'Bitte eine gültige Zahl eingeben (z.B. 33).' });

    setLoading(true);
    setMsg(null);

    try {
      for (const uid of ids) {
        const { error } = await supabase
          .from(T_URLAUB)
          .upsert(
            {
              user_id: uid,
              firma_id,
              unit_id,
              jahr: jahrNext,
              urlaub_soll: v,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,jahr,firma_id,unit_id' }
          );

        if (error) throw error;
      }

      setMsg({ type: 'ok', text: `Urlaub-Soll ${jahrNext} manuell gesetzt (${ids.length} MA).` });
      setManualSoll('');
      await loadAll();
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Manuelles Setzen fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- CSV Export ---------------- */

  const rowById = useMemo(() => {
    const m = new Map();
    (vorgabeRows || []).forEach((r) => m.set(String(r.userId), r));
    return m;
  }, [vorgabeRows]);

  const exportCsvSync = () => {
    const ids = Array.from(selectedIds || []);
    if (!ids.length) {
      setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
      return;
    }

    const header = [
      'sp_user_id',
      'nachname',
      'vorname',
      'personalnummer',

      'jahr',
      'urlaub_soll',
      'genommen_summe_jahr',
      'resturlaub',

      'zieljahr',
      'zieljahr_urlaub_soll',
      'zieljahr_uebernahme_vorjahr',
    ];

    const lines = [header.join(';')];

    ids.forEach((id) => {
      const r = rowById.get(String(id));
      if (!r) return;

      const row = [
        String(r.userId),
        r.nachname ?? '',
        r.vorname ?? '',
        r.personalnummer ?? '',

        String(jahr),
        String(r.sollAktuell ?? '').replace('.', ','),
        String(r.genommenAktuell ?? '').replace('.', ','),
        String(r.resturlaubAktuell ?? '').replace('.', ','),

        String(jahrNext),
        String(r.sollNext ?? '').replace('.', ','),
        String(r.uebernahmeNext ?? '').replace('.', ','),
      ].map(csvEscape);

      lines.push(row.join(';'));
    });

    const filename = `schichtpilot_sync_urlaub_${unit_id}_${jahrNext}_${dayjs().format('YYYY-MM-DD')}.csv`;
    downloadTextFile(filename, lines.join('\n'));
  };

  const exportCsvExcel = () => {
    const ids = Array.from(selectedIds || []);
    if (!ids.length) {
      setMsg({ type: 'err', text: 'Bitte mindestens einen Mitarbeiter auswählen.' });
      return;
    }

    const header = [
      'nachname',
      'vorname',
      'personalnummer',

      'jahr',
      'urlaub_soll',
      'genommen_summe_jahr',
      'resturlaub',

      'zieljahr',
      'zieljahr_urlaub_soll',
      'zieljahr_uebernahme_vorjahr',
    ];

    const lines = [header.join(';')];

    ids.forEach((id) => {
      const r = rowById.get(String(id));
      if (!r) return;

      const row = [
        r.nachname ?? '',
        r.vorname ?? '',
        r.personalnummer ?? '',

        String(jahr),
        String(r.sollAktuell ?? '').replace('.', ','),
        String(r.genommenAktuell ?? '').replace('.', ','),
        String(r.resturlaubAktuell ?? '').replace('.', ','),

        String(jahrNext),
        String(r.sollNext ?? '').replace('.', ','),
        String(r.uebernahmeNext ?? '').replace('.', ','),
      ].map(csvEscape);

      lines.push(row.join(';'));
    });

    const filename = `schichtpilot_excel_urlaub_${unit_id}_${jahrNext}_${dayjs().format('YYYY-MM-DD')}.csv`;
    downloadTextFile(filename, lines.join('\n'));
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

        <div className="flex flex-wrap gap-2 items-center">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Zieljahr: {jahrNext}
          </div>

          <Btn onClick={() => setAllVisibleSelected(true)} disabled={!vorgabeRows.length}>
            Alle sichtbaren
          </Btn>
          <Btn onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>
            Auswahl leeren
          </Btn>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Treffer: <b>{vorgabeRows.length}</b> · Ausgewählt: <b>{selectedIds.size}</b>
          </div>
        </div>

        {msg && (
          <div className={`rounded-xl border p-2 text-sm ${triMsgClass(msg.type)}`}>
            {msg.text}
          </div>
        )}
      </Card>

      {/* Aktionen */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <BtnPrimary onClick={bulkCopyCurrentToNextSoll} disabled={loading || !selectedIds.size}>
            Aus Vorjahr übernehmen (Soll)
          </BtnPrimary>

          <Btn onClick={bulkCopyCurrentToNextSollWithResturlaub} disabled={loading || !selectedIds.size}>
            Aus Vorjahr übernehmen mit Resturlaub
          </Btn>

          <div className="flex items-center gap-2">
            <Input
              className="w-44"
              placeholder="manuell Soll (z.B. 33)"
              value={manualSoll || ''}
              onChange={(e) => setManualSoll(e.target.value)}
            />
            <Btn onClick={bulkSetManualSollNextYear} disabled={loading || !selectedIds.size}>
              Manuell setzen (Soll)
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
          <table className="min-w-[1100px] w-full text-sm">
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
                <th className="p-2 text-right">Urlaub Soll ({jahr})</th>
                <th className="p-2 text-right">Genommen ({jahr})</th>
                <th className="p-2 text-right">Resturlaub ({jahr})</th>
                <th className="p-2 text-right">Urlaub Soll ({jahrNext})</th>
                <th className="p-2 text-right">Übernahme ({jahrNext})</th>
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
                      {r.hasCur ? `Urlaub-Datensatz vorhanden (${jahr})` : `Kein Datensatz in DB_Urlaub (${jahr})`}
                      {r.hasNext ? ` · Zieljahr vorhanden` : ` · Zieljahr fehlt`}
                    </div>
                  </td>

                  <td className="p-2 text-right tabular-nums">{fmt(r.sollAktuell)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.genommenAktuell)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.resturlaubAktuell)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.sollNext)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.uebernahmeNext)}</td>
                </tr>
              ))}

              {!vorgabeRows.length && (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-gray-600 dark:text-gray-300">
                    Keine Einträge gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CSV */}
      <Card className="p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <Btn onClick={exportCsvSync} disabled={loading || !selectedIds.size}>
            <Download className="w-4 h-4" />
            CSV (für Import/Sync)
          </Btn>

          <Btn onClick={exportCsvExcel} disabled={loading || !selectedIds.size}>
            <Download className="w-4 h-4" />
            CSV (für Menschen/Excel)
          </Btn>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Export enthält: Soll, Genommen (summe_jahr), Resturlaub und Zieljahr-Felder.
          </div>
        </div>

        <div className="text-[11px] text-gray-600 dark:text-gray-300">
          Hinweis: Resturlaub wird berechnet als <b>(urlaub_soll + uebernahme_vorjahr + korrektur) - summe_jahr</b>.
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
