// src/components/UnitUserStundenPflege/VorgabeurlaubTab.jsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { Search, RefreshCw, Download } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { downloadTextFile } from '../../utils/spCsv';

dayjs.locale('de');

const T_USERS = 'DB_User';
const T_URLAUB = 'DB_Urlaub';
const T_WAZ = 'DB_WochenArbeitsZeit';

/* ---------------- UI Helpers ---------------- */
const Card = ({ className = '', children }) => (
  <div
    className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}
  >
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

const ActionBtn = ({ active = true, className = '', children, ...props }) => (
  <button
    {...props}
    className={`
      inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold
      transition-all
      disabled:opacity-50 disabled:cursor-not-allowed
      ${
        active
          ? 'bg-green-700 text-white hover:bg-green-500 dark:hover:bg-green-900 shadow-md ring-2 ring-gray-900/30'
          : 'bg-gray-100 text-gray-900 border border-gray-300 hover:bg-gray-200 dark:bg-gray-900/40 dark:hover:bg-gray-900/70 dark:border-gray-700 dark:text-gray-100'
      }
      ${className}
    `}
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

const SortIcon = ({ aktiv, richtung }) => {
  if (!aktiv) return <span className="opacity-20">↕</span>;
  return richtung === 'asc' ? <span>▲</span> : <span>▼</span>;
};

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

function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/* ---------------- Component ---------------- */

export default function VorgabeurlaubTab({ firma_id, unit_id }) {
  const [jahr, setJahr] = useState(dayjs().year());
  const jahrNext = jahr + 1;

  // Suche + Filter
  const [search, setSearch] = useState('');
  const [onlyWithWAZ, setOnlyWithWAZ] = useState(true);
  const [wazFilter, setWazFilter] = useState('ALL');

  // Daten
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [urlaubRows, setUrlaubRows] = useState([]);
  const [wazRows, setWazRows] = useState([]);

  // Auswahl + Msg
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [msg, setMsg] = useState(null);

  // Aktionen
  const [manualSoll, setManualSoll] = useState('');

  // Sorting
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const hasSelection = selectedIds.size > 0;
  const manualSollNumber = Number(String(manualSoll).replace(',', '.'));
  const manualSollAktiv = hasSelection && Number.isFinite(manualSollNumber);

  // Maps
  const urlaubByUserYear = useMemo(() => {
    const m = new Map();
    (urlaubRows || []).forEach((r) => m.set(`${r.user_id}__${r.jahr}`, r));
    return m;
  }, [urlaubRows]);

  const wazByUser = useMemo(() => {
    const m = new Map();
    (wazRows || []).forEach((r) => {
      const uid = String(r.user_id);
      if (!m.has(uid)) m.set(uid, []);
      m.get(uid).push(r);
    });

    for (const [, arr] of m.entries()) {
      arr.sort((a, b) => String(a.gueltig_ab).localeCompare(String(b.gueltig_ab)));
    }
    return m;
  }, [wazRows]);

  const getWazForDate = (userId, isoDate) => {
    const arr = wazByUser.get(String(userId)) || [];
    if (!arr.length) return null;

    let val = null;
    for (const r of arr) {
      if (String(r.gueltig_ab) <= isoDate) val = r.wochenstunden;
      else break;
    }
    return val;
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

      // WAZ bis Ende Zieljahr
      const wazTo = `${jahrNext}-12-31`;
      const { data: wazData, error: wazErr } = await supabase
        .from(T_WAZ)
        .select('user_id, gueltig_ab, wochenstunden, firma_id, unit_id')
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .lte('gueltig_ab', wazTo)
        .order('gueltig_ab', { ascending: true });

      if (wazErr) throw wazErr;
      setWazRows(wazData || []);

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

  // Basisdaten aufbauen
  const baseRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (users || [])
      .map((u) => {
        const userId = u.user_id || u.id;

        const cur = urlaubByUserYear.get(`${userId}__${jahr}`) || {};
        const next = urlaubByUserYear.get(`${userId}__${jahrNext}`) || {};

        const wazAktuell = getWazForDate(userId, `${jahr}-12-31`);
        const wazNext = getWazForDate(userId, `${jahrNext}-12-31`);

        // Aktuell
        const soll = Number(cur.urlaub_soll ?? 0);
        const genommen = Number(cur.summe_jahr ?? 0);
        const uebernahme = Number(cur.uebernahme_vorjahr ?? 0);
        const korrektur = Number(cur.korrektur ?? 0);

        const gesamt =
          cur.urlaub_gesamt != null ? Number(cur.urlaub_gesamt ?? 0) : soll + uebernahme + korrektur;

        const resturlaub = gesamt - genommen;

        // Zieljahr
        const sollNext = Number(next.urlaub_soll ?? 0);
        const uebernahmeNext = Number(next.uebernahme_vorjahr ?? 0);

        const name = buildDisplayName(u);

        return {
          userId,
          name,
          nachname: u.nachname,
          vorname: u.vorname,
          personalnummer: u.personal_nummer,

          wazAktuell,
          wazNext,

          sollAktuell: soll,
          genommenAktuell: genommen,
          gesamtAktuell: gesamt,
          resturlaubAktuell: resturlaub,

          sollNext,
          uebernahmeNext,

          hasCur: !!cur?.id,
          hasNext: !!next?.id,

          _searchName: name.toLowerCase(),
        };
      })
      .filter((r) => {
        if (q && !r._searchName.includes(q)) return false;
        return true;
      });
  }, [users, urlaubByUserYear, wazByUser, jahr, jahrNext, search]);

  // WAZ-Options wie in VorgabestundenTab (auf Basis der aktuell sichtbaren Suche)
  const wazOptions = useMemo(() => {
    const set = new Set();
    (baseRows || []).forEach((r) => {
      if (r.wazNext != null) set.add(Number(r.wazNext));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [baseRows]);

  // Filter anwenden
  const filteredRows = useMemo(() => {
    return (baseRows || []).filter((r) => {
      if (onlyWithWAZ && r.wazNext == null) return false;

      if (wazFilter !== 'ALL') {
        const w = Number(String(wazFilter).replace(',', '.'));
        if (Number(r.wazNext) !== w) return false;
      }

      return true;
    });
  }, [baseRows, onlyWithWAZ, wazFilter]);

  // Sortierung anwenden
  const vorgabeRows = useMemo(() => {
    const rows = [...(filteredRows || [])];

    const dir = sortDir === 'asc' ? 1 : -1;

    const cmpNum = (a, b) => {
      const na = a == null ? Number.NEGATIVE_INFINITY : Number(a);
      const nb = b == null ? Number.NEGATIVE_INFINITY : Number(b);
      if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
      if (Number.isNaN(na)) return -1;
      if (Number.isNaN(nb)) return 1;
      return na === nb ? 0 : na > nb ? 1 : -1;
    };

    const cmpStr = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'de');

    rows.sort((ra, rb) => {
      let res = 0;

      switch (sortKey) {
        case 'name':
          // stabil nach Nachname/Vorname
          res = cmpStr(ra.nachname, rb.nachname) || cmpStr(ra.vorname, rb.vorname) || cmpStr(ra.name, rb.name);
          break;

        case 'wazAktuell':
          res = cmpNum(ra.wazAktuell, rb.wazAktuell);
          break;

        case 'wazNext':
          res = cmpNum(ra.wazNext, rb.wazNext);
          break;

        case 'sollAktuell':
          res = cmpNum(ra.sollAktuell, rb.sollAktuell);
          break;

        case 'genommenAktuell':
          res = cmpNum(ra.genommenAktuell, rb.genommenAktuell);
          break;

        case 'resturlaubAktuell':
          res = cmpNum(ra.resturlaubAktuell, rb.resturlaubAktuell);
          break;

        case 'sollNext':
          res = cmpNum(ra.sollNext, rb.sollNext);
          break;

        case 'uebernahmeNext':
          res = cmpNum(ra.uebernahmeNext, rb.uebernahmeNext);
          break;

        default:
          res = 0;
      }

      return res * dir;
    });

    return rows;
  }, [filteredRows, sortKey, sortDir]);

  const toggleSort = (key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
  };

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

  // 2) Aus Vorjahr übernehmen + Resturlaub
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

        const gesamt =
          cur.urlaub_gesamt != null ? Number(cur.urlaub_gesamt ?? 0) : soll + uebernahme + korrektur;

        const resturlaub = gesamt - genommen;

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
      'waz_zieljahr',
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
        String(r.wazNext ?? '').replace('.', ','),

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
      'waz_zieljahr',
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
        String(r.wazNext ?? '').replace('.', ','),

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

  /* ---------------- Render ---------------- */

  return (
    <div className="space-y-3">
      {/* Controls */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 items-end">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Jahr</div>
            <Select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
              {yearOptions().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
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
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Zieljahr: {jahrNext}
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={!!onlyWithWAZ}
              onChange={(e) => setOnlyWithWAZ(e.target.checked)}
            />
            Nur MA mit WAZ (Zieljahr)
          </label>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-200">WAZ:</span>
            <Select className="w-44" value={wazFilter} onChange={(e) => setWazFilter(e.target.value)}>
              <option value="ALL">Alle</option>
              {(wazOptions || []).map((w) => (
                <option key={w} value={String(w)}>
                  {String(w).replace('.', ',')}
                </option>
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
          <div className={`rounded-xl border p-2 text-sm ${triMsgClass(msg.type)}`}>{msg.text}</div>
        )}
      </Card>

      {/* Aktionen */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <ActionBtn active={hasSelection} onClick={bulkCopyCurrentToNextSoll} disabled={loading || !hasSelection}>
            Aus Vorjahr übernehmen (Soll)
          </ActionBtn>

          <ActionBtn
            active={hasSelection}
            onClick={bulkCopyCurrentToNextSollWithResturlaub}
            disabled={loading || !hasSelection}
          >
            Aus Vorjahr übernehmen mit Resturlaub
          </ActionBtn>

          <div className="flex items-center gap-2">
            <Input
              className="w-44"
              placeholder="manuell Soll (z.B. 33)"
              value={manualSoll || ''}
              onChange={(e) => setManualSoll(e.target.value)}
            />

            <ActionBtn
              active={manualSollAktiv}
              onClick={bulkSetManualSollNextYear}
              disabled={loading || !manualSollAktiv}
            >
              Manuell setzen (Soll)
            </ActionBtn>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300 ml-auto">
            Zieljahr: <b>{jahrNext}</b>
          </div>
        </div>
      </Card>

      {/* Tabelle */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-900/40">
              <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => setAllVisibleSelected(e.target.checked)}
                  />
                </th>

                <th className="p-2">
                  <button className="inline-flex items-center gap-2 hover:underline" onClick={() => toggleSort('name')}>
                    Name <SortIcon aktiv={sortKey === 'name'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('wazAktuell')}
                  >
                    WAZ ({jahr}) <SortIcon aktiv={sortKey === 'wazAktuell'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('wazNext')}
                  >
                    WAZ ({jahrNext}) <SortIcon aktiv={sortKey === 'wazNext'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('sollAktuell')}
                  >
                    Urlaub Soll ({jahr}) <SortIcon aktiv={sortKey === 'sollAktuell'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('genommenAktuell')}
                  >
                    Genommen ({jahr}) <SortIcon aktiv={sortKey === 'genommenAktuell'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('resturlaubAktuell')}
                  >
                    Resturlaub ({jahr}) <SortIcon aktiv={sortKey === 'resturlaubAktuell'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('sollNext')}
                  >
                    Urlaub Soll ({jahrNext}) <SortIcon aktiv={sortKey === 'sollNext'} richtung={sortDir} />
                  </button>
                </th>

                <th className="p-2 text-right">
                  <button
                    className="inline-flex items-center gap-2 hover:underline"
                    onClick={() => toggleSort('uebernahmeNext')}
                  >
                    Übernahme ({jahrNext}) <SortIcon aktiv={sortKey === 'uebernahmeNext'} richtung={sortDir} />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody>
              {vorgabeRows.map((r) => (
                <tr
                  key={r.userId}
                  className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30"
                >
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

                  <td className="p-2 text-right tabular-nums">{fmt(r.wazAktuell)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.wazNext)}</td>

                  <td className="p-2 text-right tabular-nums">{fmt(r.sollAktuell)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.genommenAktuell)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.resturlaubAktuell)}</td>

                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.sollNext)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.uebernahmeNext)}</td>
                </tr>
              ))}

              {!vorgabeRows.length && (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-600 dark:text-gray-300">
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
            Export enthält: WAZ (Zieljahr), Soll, Genommen (summe_jahr), Resturlaub und Zieljahr-Felder.
          </div>
        </div>

        <div className="text-[11px] text-gray-600 dark:text-gray-300">
          Hinweis: Resturlaub wird berechnet als <b>(urlaub_soll + uebernahme_vorjahr + korrektur) - summe_jahr</b>.
        </div>
      </Card>
    </div>
  );
}
