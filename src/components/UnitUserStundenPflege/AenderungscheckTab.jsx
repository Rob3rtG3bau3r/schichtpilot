// src/components/UnitUserStundenPflege/AenderungscheckTab.jsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { supabase } from '../../supabaseClient';

dayjs.locale('de');

const T_KAMPF = 'DB_Kampfliste';
const T_USERS = 'DB_User';
const T_SCHICHTART = 'DB_SchichtArt';

const LS_KEY_RANGE = 'sp_aenderungscheck_range_days';
const LS_KEY_YEAR = 'sp_aenderungscheck_year';
const LS_KEY_END = 'sp_aenderungscheck_end_date'; // YYYY-MM-DD

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

const fmtNum = (v, digits = 2) => {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(digits).replace('.', ',');
};

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function csvEscape(v) {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes(',') || s.includes('\n') || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
const yearOptions = () => {
  const now = dayjs().year();
  return [now - 1, now, now + 1];
};
const buildName = (u) => {
  if (!u) return '—';
  const vn = (u.vorname || '').trim();
  const nn = (u.nachname || '').trim();
  const s = `${nn}, ${vn}`.replace(/^,\s*/,'').trim();
  return s || u.email || u.user_id || u.id || '—';
};

export default function AenderungscheckTab({ firma_id, unit_id }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  // Zeitraum
  const [rangeDays, setRangeDays] = useState(() => {
    const raw = localStorage.getItem(LS_KEY_RANGE);
    const v = Number(raw);
    return Number.isFinite(v) && v >= 1 && v <= 30 ? v : 7;
  });

  const [endDate, setEndDate] = useState(() => {
    const raw = localStorage.getItem(LS_KEY_END);
    const d = raw ? dayjs(raw) : dayjs();
    return d.isValid() ? d.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
  });

  const [jahr, setJahr] = useState(() => {
    const raw = localStorage.getItem(LS_KEY_YEAR);
    const v = raw ? Number(raw) : NaN;
    if (Number.isFinite(v) && v >= 2000 && v <= 2100) return v;
    return dayjs().year();
  });

  useEffect(() => localStorage.setItem(LS_KEY_RANGE, String(rangeDays)), [rangeDays]);
  useEffect(() => localStorage.setItem(LS_KEY_END, String(endDate)), [endDate]);
  useEffect(() => {
    if (Number.isFinite(jahr) && jahr >= 2000 && jahr <= 2100) {
      localStorage.setItem(LS_KEY_YEAR, String(jahr));
    }
  }, [jahr]);

  const startDate = useMemo(() => {
    return dayjs(endDate).subtract(Math.max(1, rangeDays) - 1, 'day').format('YYYY-MM-DD');
  }, [endDate, rangeDays]);

  // Suche / Filter
  const [searchUser, setSearchUser] = useState('');       // Name vom "User" (r.user)
  const [searchCreator, setSearchCreator] = useState(''); // Name von "geändert durch"
  const [filterUserId, setFilterUserId] = useState('ALL');
  const [filterCreatorId, setFilterCreatorId] = useState('ALL');
  const [filterDatum, setFilterDatum] = useState('');

  // Sort
  const [sortBy, setSortBy] = useState({ key: 'created_at', dir: 'desc' });
  const toggleSort = (key) => {
    setSortBy((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  };

  // Data
  const [rowsRaw, setRowsRaw] = useState([]);
  const [userMap, setUserMap] = useState(new Map());
  const [creatorMap, setCreatorMap] = useState(new Map());
  const [schichtMap, setSchichtMap] = useState(new Map());

  const loadData = async () => {
    if (!firma_id || !unit_id) return;
    setLoading(true);
    setMsg(null);

    try {
      const yStart = `${jahr}-01-01`;
      const yEnd = `${jahr}-12-31`;

      const caFrom = dayjs(startDate).startOf('day').toISOString();
      const caTo = dayjs(endDate).endOf('day').toISOString();

      const { data: kData, error: kErr } = await supabase
        .from(T_KAMPF)
        .select(`
          id, created_at, created_by, aenderung,
          startzeit_ist, endzeit_ist, datum, dauer_ist,
          ist_schicht, kommentar, schichtgruppe,
          user, firma_id, unit_id, pausen_dauer
        `)
        .eq('firma_id', firma_id)
        .eq('unit_id', unit_id)
        .gte('datum', yStart)
        .lte('datum', yEnd)
        .gte('created_at', caFrom)
        .lte('created_at', caTo)
        .order('created_at', { ascending: false })
        .limit(5000);

      if (kErr) throw kErr;

      const list = kData || [];
      setRowsRaw(list);

      // IDs sammeln (user + created_by)
      const ids = new Set();
      list.forEach((r) => {
        if (r.user) ids.add(String(r.user));
        if (r.created_by) ids.add(String(r.created_by));
      });

      // SchichtArt IDs sammeln
      const schichtIds = new Set();
      list.forEach((r) => {
        if (r.ist_schicht != null) schichtIds.add(String(r.ist_schicht));
      });

      // Users holen
      if (ids.size) {
        const { data: uData, error: uErr } = await supabase
          .from(T_USERS)
          .select('user_id, vorname, nachname, email')
          .in('user_id', Array.from(ids));

        if (uErr) throw uErr;

        const m = new Map();
        (uData || []).forEach((u) => m.set(String(u.user_id), u));
        setUserMap(m);
        setCreatorMap(m);
      } else {
        setUserMap(new Map());
        setCreatorMap(new Map());
      }

      // Schichtarten holen
      if (schichtIds.size) {
        const { data: sData, error: sErr } = await supabase
          .from(T_SCHICHTART)
          .select('id, kuerzel, beschreibung')
          .eq('firma_id', firma_id)
          .eq('unit_id', unit_id)
          .in('id', Array.from(schichtIds).map((x) => Number(x)));

        if (sErr) throw sErr;

        const sm = new Map();
        (sData || []).forEach((s) => sm.set(String(s.id), s));
        setSchichtMap(sm);
      } else {
        setSchichtMap(new Map());
      }
    } catch (e) {
      setMsg({ type: 'err', text: e?.message || 'Fehler beim Laden.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma_id, unit_id, jahr, startDate, endDate]);

  const userOptions = useMemo(() => {
    const set = new Set();
    (rowsRaw || []).forEach((r) => r.user && set.add(String(r.user)));
    return Array.from(set)
      .map((id) => ({ id, label: buildName(userMap.get(id)) || id }))
      .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'de'));
  }, [rowsRaw, userMap]);

  const creatorOptions = useMemo(() => {
    const set = new Set();
    (rowsRaw || []).forEach((r) => r.created_by && set.add(String(r.created_by)));
    return Array.from(set)
      .map((id) => ({ id, label: buildName(creatorMap.get(id)) || id }))
      .sort((a, b) => (a.label || '').localeCompare(b.label || '', 'de'));
  }, [rowsRaw, creatorMap]);

  const filtered = useMemo(() => {
    const qU = searchUser.trim().toLowerCase();
    const qC = searchCreator.trim().toLowerCase();

    return (rowsRaw || []).filter((r) => {
      if (filterUserId !== 'ALL' && String(r.user) !== String(filterUserId)) return false;
      if (filterCreatorId !== 'ALL' && String(r.created_by) !== String(filterCreatorId)) return false;
      if (filterDatum && dayjs(r.datum).format('YYYY-MM-DD') !== filterDatum) return false;

      if (qU) {
        const name = (buildName(userMap.get(String(r.user))) || '').toLowerCase();
        if (!name.includes(qU)) return false;
      }

      if (qC) {
        const name = (buildName(creatorMap.get(String(r.created_by))) || '').toLowerCase();
        if (!name.includes(qC)) return false;
      }

      return true;
    });
  }, [rowsRaw, filterUserId, filterCreatorId, filterDatum, searchUser, searchCreator, userMap, creatorMap]);

  const sorted = useMemo(() => {
    const dir = sortBy.dir === 'asc' ? 1 : -1;
    const key = sortBy.key;

    const getVal = (r) => {
      switch (key) {
        case 'created_at': return dayjs(r.created_at).valueOf();
        case 'user': return (buildName(userMap.get(String(r.user))) || '').toLowerCase();
        case 'datum': return dayjs(r.datum).valueOf();
        case 'schicht': {
          const s = schichtMap.get(String(r.ist_schicht));
          return ((s?.kuerzel || '') + ' ' + (s?.beschreibung || '')).toLowerCase();
        }
        case 'start': return (r.startzeit_ist || '');
        case 'ende': return (r.endzeit_ist || '');
        case 'dauer': return Number(r.dauer_ist ?? -Infinity);
        case 'pause': return Number(r.pausen_dauer ?? -Infinity);
        case 'created_by': return (buildName(creatorMap.get(String(r.created_by))) || '').toLowerCase();
        default:
          return (r[key] ?? '');
      }
    };

    return [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortBy, userMap, creatorMap, schichtMap]);

  const exportCsvVisible = () => {
    const header = [
      'geaendert_am',
      'user_name',
      'datum',
      'schicht',
      'start',
      'ende',
      'stunden',
      'pause',
      'geaendert_durch',
    ];
    const lines = [header.join(';')];

    sorted.forEach((r) => {
      const userName = buildName(userMap.get(String(r.user)));
      const creatorName = buildName(creatorMap.get(String(r.created_by)));

      const s = schichtMap.get(String(r.ist_schicht));
      const schicht = s ? `${s.kuerzel || ''}`.trim() : (r.ist_schicht != null ? String(r.ist_schicht) : '');

      const row = [
        dayjs(r.created_at).format('DD.MM.YYYY HH:mm'),
        userName,
        dayjs(r.datum).format('DD.MM.YYYY'),
        schicht,
        r.startzeit_ist ?? '',
        r.endzeit_ist ?? '',
        r.dauer_ist == null ? '' : String(r.dauer_ist).replace('.', ','),
        r.pausen_dauer == null ? '' : String(r.pausen_dauer).replace('.', ','),
        creatorName,
      ].map(csvEscape);

      lines.push(row.join(';'));
    });

    const filename = `schichtpilot_aenderungscheck_${unit_id}_${jahr}_${startDate}_bis_${endDate}.csv`;
    downloadTextFile(filename, lines.join('\n'));
  };

  const shiftWindow = (days) => {
    const newEnd = dayjs(endDate).add(days, 'day');
    setEndDate(newEnd.format('YYYY-MM-DD'));
  };
  const resetToday = () => setEndDate(dayjs().format('YYYY-MM-DD'));

  return (
    <div className="space-y-3">
      {/* Controls */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 items-end">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Kampflisten-Jahr (Datum)</div>
            <Select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
              {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Änderungszeitraum (created_at): Ende</div>
            <div className="flex gap-2">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <Btn onClick={resetToday} title="Ende auf heute setzen">Heute</Btn>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Spanne (Tage)</div>
            <Select value={String(rangeDays)} onChange={(e) => setRangeDays(Math.min(30, Math.max(1, Number(e.target.value))))}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>{d} Tage</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
            <Btn onClick={() => shiftWindow(-1)} title="Fenster 1 Tag zurück">
              <ChevronLeft className="w-4 h-4" /> Tag
            </Btn>
            <Btn onClick={() => shiftWindow(+1)} title="Fenster 1 Tag vor">
              Tag <ChevronRight className="w-4 h-4" />
            </Btn>
            <Btn onClick={loadData} disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </Btn>
            <Btn onClick={exportCsvVisible} disabled={!sorted.length}>
              <Download className="w-4 h-4" />
              CSV Export (sichtbar)
            </Btn>
          </div>
        </div>

        <div className="text-xs text-gray-600 dark:text-gray-300">
          Zeitraum: <b>{dayjs(startDate).format('DD.MM.YYYY')}</b> bis <b>{dayjs(endDate).format('DD.MM.YYYY')}</b> · Treffer: <b>{sorted.length}</b>
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

      {/* Filters */}
      <Card className="p-3 space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Suche User (Name)</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input value={searchUser} onChange={(e) => setSearchUser(e.target.value)} placeholder="z.B. Müller" className="pl-9" />
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Suche geändert durch (Name)</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <Input value={searchCreator} onChange={(e) => setSearchCreator(e.target.value)} placeholder="z.B. Admin" className="pl-9" />
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Filter User</div>
            <Select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
              <option value="ALL">Alle</option>
              {userOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Filter geändert durch</div>
            <Select value={filterCreatorId} onChange={(e) => setFilterCreatorId(e.target.value)}>
              <option value="ALL">Alle</option>
              {creatorOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">Filter Datum (Kampfliste)</div>
            <Input type="date" value={filterDatum} onChange={(e) => setFilterDatum(e.target.value)} />
          </div>
          <div className="lg:col-span-3 text-xs text-gray-600 dark:text-gray-300 flex items-end">
            Tipp: Sortierung per Klick auf Tabellenkopf.
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-900/40">
              <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                  geändert (created_at) {sortBy.key === 'created_at' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('user')}>
                  user {sortBy.key === 'user' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('datum')}>
                  datum {sortBy.key === 'datum' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('schicht')}>
                  schicht {sortBy.key === 'schicht' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('start')}>
                  start {sortBy.key === 'start' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('ende')}>
                  ende {sortBy.key === 'ende' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('dauer')}>
                  std. {sortBy.key === 'dauer' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 text-right cursor-pointer select-none" onClick={() => toggleSort('pause')}>
                  pause {sortBy.key === 'pause' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('created_by')}>
                  geändert durch {sortBy.key === 'created_by' ? (sortBy.dir === 'asc' ? '▲' : '▼') : ''}
                </th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((r) => {
                const userName = buildName(userMap.get(String(r.user)));
                const creatorName = buildName(creatorMap.get(String(r.created_by)));

                const s = schichtMap.get(String(r.ist_schicht));
                const schicht = s ? (s.kuerzel || s.beschreibung || '—') : (r.ist_schicht != null ? String(r.ist_schicht) : '—');

                return (
                  <tr key={r.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                    <td className="p-2 tabular-nums">{dayjs(r.created_at).format('DD.MM.YYYY HH:mm')}</td>
                    <td className="p-2">{userName}</td>
                    <td className="p-2 tabular-nums">{r.datum ? dayjs(r.datum).format('DD.MM.YYYY') : '—'}</td>
                    <td className="p-2">{schicht}</td>
                    <td className="p-2 tabular-nums">{r.startzeit_ist ?? '—'}</td>
                    <td className="p-2 tabular-nums">{r.endzeit_ist ?? '—'}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(r.dauer_ist)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(r.pausen_dauer)}</td>
                    <td className="p-2">{creatorName}</td>
                  </tr>
                );
              })}

              {!sorted.length && (
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
    </div>
  );
}
