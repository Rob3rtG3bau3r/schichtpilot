'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient } from '../supabaseClient';
import { Calendar, ChevronDown, Download, CheckCircle2, Circle, AlertCircle, RefreshCw, Check, X } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

// ---- UI primitives ---------------------------------------------------------
const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-400 dark:border-bg-gray-200 dark:bg-gray-800 p-2 ${className}`} {...rest}>{children}</div>
);
const Muted = ({ className = '', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);
const Button = ({ className = '', children, ...rest }) => (
  <button className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 hover:bg-gray-500 active:scale-[.99] ${className}`} {...rest}>{children}</button>
);
const SelectYear = ({ value, onChange, years }) => (
  <div className="relative inline-flex items-center">
    <select
      value={value}
      onChange={(e)=>onChange(parseInt(e.target.value))}
      className="appearance-none rounded-2xl border border-gray-500 px-3 py-2 pr-8 bg-gray-200 dark:bg-gray-800"
    >
      {years.map(y=> <option key={y} value={y}>{y}</option>)}
    </select>
    <ChevronDown className="w-4 h-4 -ml-6 pointer-events-none text-gray-500" />
  </div>
);

// ---- helpers ---------------------------------------------------------------
const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const deNumber = (n, digits = 2) => {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
};
const dePercent = (n) => (n == null ? '–' : deNumber(n, 2) + ' %');
const colorBySign = (n) =>
  n > 0 ? 'text-emerald-600 dark:text-emerald-400'
: n < 0 ? 'text-red-600 dark:text-red-400'
        : 'text-gray-900 dark:text-gray-100';

// Fallback-Farbpalette für Kürzel
const FALLBACK_COLORS = ['#60a5fa','#f472b6','#34d399','#f59e0b','#a78bfa','#f87171','#4ade80','#fb7185'];

// ---- Charts-Menü -----------------------------------------------------------
const ChartsMenu = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const labels = {
    monthlyDiff: 'Monats-Differenz (Ist − Soll)',
    cumBothIncl: 'Kumulierte Stunden (inkl. Übernahme)',
    urlaubMonat: 'Urlaubstage je Monat',
    planChanges: 'Planänderungen je Monat',
    shortNotice: 'Kurzfristigkeit je Monat',
    planerfuellung: 'Planerfüllungsquote je Monat',
    kuerzelPerMonth: 'Kürzel (Stunden) je Monat',
    krankYear: 'Krank (K & KO) je Monat',
    langeDienste: 'Lange Dienste je Monat',
  };

  const toggle = (k) => onChange({ ...value, [k]: !value[k] });
  const selectAll = () => {
    const allTrue = Object.fromEntries(Object.keys(value).map(k => [k, true]));
    onChange(allTrue);
  };
  const selectNone = () => {
    const allFalse = Object.fromEntries(Object.keys(value).map(k => [k, false]));
    allFalse.monthlyDiff = true; // Monats-Differenz bleibt an
    onChange(allFalse);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={()=>setOpen(v=>!v)}
        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 hover:bg-gray-500"
        title="Charts ein-/ausblenden"
      >
        Jahres Charts wählen
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-72 right-0 rounded-xl border bg-white dark:bg-gray-800 shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-sm font-medium">Sichtbarkeit</span>
            <div className="flex gap-2">
              <button className="text-xs underline" onClick={selectAll}>Alle</button>
              <button className="text-xs underline" onClick={selectNone}>Keine</button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto p-1">
            {Object.keys(labels).map((k) => (
              <label key={k} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!value[k]}
                  onChange={()=>toggle(k)}
                  className="w-4 h-4"
                />
                <span className="text-sm">{labels[k]}</span>
              </label>
            ))}
          </div>
          <div className="px-3 py-2 text-xs text-gray-500 border-t">
            Tipp: „Keine“ lässt die <b>Monats-Differenz</b> automatisch aktiv.
          </div>
        </div>
      )}
    </div>
  );
};

// ---- component -------------------------------------------------------------
export default function UnitReports({ firmaId, unitId, supabase: supabaseProp, defaultYear }) {
  const supabase = supabaseProp ?? supabaseClient;

  // Scrollbar fix nur hier (keine globalen Änderungen)
  useEffect(() => {
    const root = document.documentElement;
    const prevOverflow = root.style.overflowY;
    const prevGutter = root.style.scrollbarGutter;
    root.style.overflowY = 'scroll';
    root.style.scrollbarGutter = 'stable both-edges';
    return () => { root.style.overflowY = prevOverflow; root.style.scrollbarGutter = prevGutter; };
  }, []);

  // Firma/Unit ermitteln
  const [firmaIdState, setFirmaIdState] = useState(firmaId ?? null);
  const [unitIdState, setUnitIdState] = useState(unitId ?? null);
  useEffect(() => {
    if (firmaIdState && unitIdState) return;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('DB_User')
        .select('firma_id, unit_id')
        .eq('user_id', uid)
        .maybeSingle();
      if (data) { setFirmaIdState(data.firma_id); setUnitIdState(data.unit_id); }
    })();
  }, [firmaIdState, unitIdState, supabase]);

  // State / Daten
  const now = useMemo(()=> new Date(), []);
  const thisYear = now.getFullYear();
  const [year, setYear] = useState(defaultYear ?? thisYear);
  const years = useMemo(()=> [thisYear-2, thisYear-1, thisYear, thisYear+1].filter(y=>y>=2000), [thisYear]);

  const [months, setMonths] = useState([]);
  const [ytdRow, setYtdRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showYear, setShowYear] = useState(false);

  // Sichtbarkeit der Jahres-Charts (Default: nur Monats-Differenz an)
  const [chartVis, setChartVis] = useState({
    monthlyDiff: true,   // vorab aktiviert
    cumBothIncl: false,
    urlaubMonat: true,
    planChanges: false,
    shortNotice: false,
    planerfuellung: true,
    kuerzelPerMonth: false,
    krankYear: false,
    langeDienste: false,
  });

  // Kürzel-Farben aus DB_SchichtArt
  const [kuerzelColors, setKuerzelColors] = useState({}); // { KU: '#hex' }
  useEffect(() => {
    if (!firmaIdState || !unitIdState) return;
    (async () => {
      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('kuerzel, farbe, color, color_hex, hex')
        .eq('firma_id', firmaIdState)
        .eq('unit_id', unitIdState);
      if (error) return; // still graceful fallback
      const map = {};
      (data || []).forEach(row => {
        const c = row.farbe || row.color || row.color_hex || row.hex;
        if (row.kuerzel && c) map[row.kuerzel] = c;
      });
      setKuerzelColors(map);
    })();
  }, [firmaIdState, unitIdState, supabase]);

  const loadYear = async (y) => {
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from('db_report_monthly')
      .select('*')
      .eq('firma_id', firmaIdState)
      .eq('unit_id', unitIdState)
      .eq('jahr', y)
      .order('monat', { ascending: true });
    if (error) throw error;
    setMonths(data || []);

    // YTD-/Jahreswerte aus db_report_ytd holen
    const { data: ytdData } = await supabase
      .from('db_report_ytd')
      .select('*')
      .eq('firma_id', firmaIdState)
      .eq('unit_id', unitIdState)
      .eq('jahr', y)
      .maybeSingle();
    setYtdRow(ytdData ?? null);

    const finalized = (data || []).filter(r => r.finalized_at);
    const last = finalized.length ? finalized[finalized.length-1].monat : null;
    setSelectedMonth(last);
    setShowYear(false);
    setLoading(false);
  };

  useEffect(()=>{
    if (!firmaIdState || !unitIdState) return;
    loadYear(year).catch(e=>{ setError(e.message ?? 'Fehler beim Laden'); setLoading(false); });
  }, [year, firmaIdState, unitIdState]); // eslint-disable-line react-hooks/exhaustive-deps

  const readyMap = useMemo(()=>{
    const m = {}; months.forEach(r => { m[r.monat] = !!r.finalized_at; }); return m;
  }, [months]);

  const monthRow = useMemo(()=> months.find(r => r.monat === selectedMonth) || null, [months, selectedMonth]);
  const atLeastOneReady = months.some(r => !!r.finalized_at);

  const monthDiff = useMemo(() => {
    if (!monthRow || typeof monthRow.soll_stunden_sum !== 'number') return null;
    return Number(monthRow.ist_stunden_sum || 0) - Number(monthRow.soll_stunden_sum || 0);
  }, [monthRow]);

  const monthK       = useMemo(() => Number(monthRow?.kuerzel_stunden?.K  ?? 0), [monthRow]);
  const monthKO      = useMemo(() => Number(monthRow?.kuerzel_stunden?.KO ?? 0), [monthRow]);
  const monthKCount  = useMemo(() => Number(monthRow?.kuerzel_count?.K    ?? 0), [monthRow]);
  const monthKOCount = useMemo(() => Number(monthRow?.kuerzel_count?.KO   ?? 0), [monthRow]);
  const monthKQuote  = useMemo(() => {
    const denom = Number(monthRow?.ist_stunden_sum ?? 0);
    return denom > 0 ? (monthK / denom) * 100 : null;
  }, [monthK, monthRow]);
  const monthKOQuote = useMemo(() => {
    const denom = Number(monthRow?.ist_stunden_sum ?? 0);
    return denom > 0 ? (monthKO / denom) * 100 : null;
  }, [monthKO, monthRow]);

  const monthPlanQuote = useMemo(
    () => (monthRow?.planerfuellung_quote ?? null),
    [monthRow]
  );

  const monthlyChangeSeries = useMemo(() => {
    return months.map(r => ({
      label: MONTHS[r.monat - 1],
      total: Number(r.planchg_total ?? 0),
      off:   Number(r.planchg_off_rhythm ?? 0),
      planQ: (r.planerfuellung_quote ?? null),
    }));
  }, [months]);

  const ytdKrankQuote = useMemo(() => {
    if (!ytdRow || !Number(ytdRow?.ytd_ist)) return null;
    return (Number(ytdRow.krank_stunden_ytd ?? 0) / Number(ytdRow.ytd_ist)) * 100;
  }, [ytdRow]);

  // ---------- Jahresdatensätze für Diagramme ----------
  const fullYearRows = useMemo(() => {
    const byMonth = new Map(months.map(r => [r.monat, r]));
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const r = byMonth.get(m) || { monat: m };
      const kStunden  = Number(r?.kuerzel_stunden?.K  ?? 0);
      const koStunden = Number(r?.kuerzel_stunden?.KO ?? 0);
      return {
        monat: m,
        label: MONTHS[m-1],
        urlaubstage: Number(r.urlaubstage_sum ?? 0),
        ist: Number(r.ist_stunden_sum ?? 0),
        soll: Number(r.soll_stunden_sum ?? 0),
        krankK: kStunden,
        krankKO: koStunden,
        krankStdKO: kStunden + koStunden,
        dauer10: Number(r.dauer10_count ?? 0),
        dauer11: Number(r.dauer11_count ?? 0),
        dauer12: Number(r.dauer12_count ?? 0),
        kuerzelStunden: r.kuerzel_stunden || {},
      };
    });
  }, [months]);

  const monthlyDiffSeries = useMemo(() => {
    return fullYearRows.map(r => ({
      label: r.label,
      diff: Number(r.ist || 0) - Number(r.soll || 0),
    }));
  }, [fullYearRows]);

  const monthlyShortNotice = useMemo(() => {
    return months.map(r => ({
      label: MONTHS[r.monat - 1],
      le1:     Number(r.kurzfrist_1d   ?? 0), // ≤1
      gt1_le3: Number(r.kurzfrist_3d   ?? 0), // >1..≤3
      gt3_lt7: Number(r.kurzfrist_7d   ?? 0), // >3..<7
      ge7:     Number(r.kurzfrist_gt7d ?? 0), // ≥7
    }));
  }, [months]);

  // Startwert = Vorjahres-Übernahme (ytdRow.year_uebernahme)
  const cumBothIncl = useMemo(() => {
    let runIst  = Number(ytdRow?.year_uebernahme ?? 0); // ← Start mit Übernahme
    let runSoll = 0;
    return fullYearRows.map(row => {
      runIst  += Number(row.ist  || 0);
      runSoll += Number(row.soll || 0);
      return { label: row.label, kumIst: runIst, kumSoll: runSoll };
    });
  }, [fullYearRows, ytdRow]);

  const availableKuerzel = useMemo(() => {
    const set = new Set();
    fullYearRows.forEach(r => Object.keys(r.kuerzelStunden || {}).forEach(k => set.add(k)));
    return Array.from(set).sort();
  }, [fullYearRows]);

  // Top-3 Kürzel über das Jahr (nach Gesamtsumme)
  const top3Kuerzel = useMemo(() => {
    const totals = {};
    fullYearRows.forEach(r => {
      Object.entries(r.kuerzelStunden || {}).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + Number(v || 0);
      });
    });
    return Object.entries(totals)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
  }, [fullYearRows]);

  const [customKuerzel, setCustomKuerzel] = useState([]);
  const chosenKuerzel = (customKuerzel.length ? customKuerzel : top3Kuerzel).slice(0, 3);

  const kuerzelSeriesPerMonth = useMemo(() => {
    return fullYearRows.map(r => {
      const base = { label: r.label };
      chosenKuerzel.forEach(k => { base[k] = Number(r.kuerzelStunden?.[k] ?? 0); });
      return base;
    });
  }, [fullYearRows, chosenKuerzel]);

  // Farben zugewiesen (DB_SchichtArt -> Fallback)
  const colorFor = (k, idx) => kuerzelColors[k] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];

  // --- Monatsdiagramm-Daten (rechts neben Monatsübersicht) ---
  const monthTopKuerzel = useMemo(() => {
    if (!monthRow?.kuerzel_stunden) return [];
    const arr = Object.entries(monthRow.kuerzel_stunden)
      .map(([k,v])=>({k, v: Number(v||0)}))
      .sort((a,b)=>b.v-a.v)
      .slice(0,10);
    return arr;
  }, [monthRow]);

  const monthKrankKO = useMemo(()=> Number((monthRow?.kuerzel_stunden?.K || 0) + (monthRow?.kuerzel_stunden?.KO || 0)), [monthRow]);

  // CSV (Year) – Werte aus db_report_ytd
  const exportCSVYear = () => {
    if (!atLeastOneReady || !ytdRow) return;
    const header = [
      'firma_id','unit_id','jahr','bis_monat',
      'ytd_soll','ytd_ist','ytd_diff',
      'year_soll','year_ist','year_diff',
      'ytd_urlaub','year_urlaub','year_urlaub_soll',
      'krank_stunden_ytd','kranktage_ytd','krank_%_ytd',
      'dauer10_ytd','dauer11_ytd','dauer12_ytd',
      'planchg_total_ytd','planchg_off_rhythm_ytd','planerfuellung_ytd',
      'kurzfrist_1d_ytd','kurzfrist_3d_ytd','kurzfrist_7d_ytd','kurzfrist_gt7d_ytd'
    ];
    const csvHeader = header.join(';') + '\n';
    const line = [
      firmaIdState, unitIdState, year, (ytdRow?.bis_monat ?? ''),
      (ytdRow?.ytd_soll ?? ''), (ytdRow?.ytd_ist ?? 0), (ytdRow?.ytd_diff ?? ''),
      (ytdRow?.year_soll ?? ''), (ytdRow?.year_ist ?? 0), (ytdRow?.year_diff ?? ''),
      (ytdRow?.ytd_urlaub ?? 0), (ytdRow?.year_urlaub ?? 0), (ytdRow?.year_urlaub_soll ?? ''),
      (ytdRow?.krank_stunden_ytd ?? 0), (ytdRow?.kranktage_ytd ?? 0),
      (((ytdRow?.krank_stunden_ytd ?? 0)/(ytdRow?.ytd_ist || 1))*100).toFixed(2),
      (ytdRow?.dauer10_ytd ?? 0), (ytdRow?.dauer11_ytd ?? 0), (ytdRow?.dauer12_ytd ?? 0),
      (ytdRow?.planchg_total_ytd ?? 0), (ytdRow?.planchg_off_rhythm_ytd ?? 0), (ytdRow?.planerfuellung_ytd ?? ''),
      (ytdRow?.kurzfrist_1d_ytd ?? 0), (ytdRow?.kurzfrist_3d_ytd ?? 0), (ytdRow?.kurzfrist_7d_ytd ?? 0), (ytdRow?.kurzfrist_gt7d_ytd ?? 0),
    ].join(';') + '\n';

    const blob = new Blob([csvHeader + line], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `unit_report_year_${year}.csv`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // --- Monate-Kacheln (fixes 7×2 Raster) -----------------------------------
  const TILE_H = 'h-8';
  const MonthTile = ({ m }) => {
    const ready = !!readyMap[m];
    const selected = selectedMonth === m && !showYear;
    return (
      <button
        onClick={() => ready && (setSelectedMonth(m), setShowYear(false))}
        className={`w-full ${TILE_H} flex items-center justify-between rounded-2xl px-4 border border-gray-400 dark:border-gray-500
                    bg-gray-300 dark:bg-gray-700
                    ${ready ? 'hover:bg-gray-400 hover:dark:bg-gray-500 cursor-pointer' : 'opacity-60 cursor-not-allowed'}
                    ${selected && ready ? 'ring-2 ring-blue-500' : 'ring-0'}
                    leading-none transition-colors`}
        disabled={!ready}
        title={ready ? 'Fertiger Monatsreport' : 'Noch nicht finalisiert'}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex w-5 justify-center">
            {ready ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4" />}
          </span>
          <span className="font-medium whitespace-nowrap truncate">{MONTHS[m - 1]}</span>
        </div>
      </button>
    );
  };

  const YearTile = () => {
    const ready = atLeastOneReady;
    const selected = showYear && ready;
    return (
      <button
        onClick={() => ready && setShowYear(true)}
        className={`w-full ${TILE_H} flex items-center justify-between rounded-2xl px-4 border border-gray-400 dark:border-gray-500
                    bg-gray-300 dark:bg-gray-700
                    ${ready ? 'hover:bg-gray-400 hover:dark:bg-gray-500 cursor-pointer' : 'opacity-60 cursor-not-allowed'}
                    ${selected ? 'ring-2 ring-blue-500' : 'ring-0'}
                    leading-none transition-colors`}
        disabled={!ready}
        title={ready ? 'Jahresbericht anzeigen' : 'Noch kein Monat finalisiert'}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex w-5 justify-center">
            {ready ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4" />}
          </span>
          <span className="font-medium whitespace-nowrap truncate">Jahr</span>
        </div>
      </button>
    );
  };

  // --- Render ---------------------------------------------------------------
  return (
    <div className=" mx-auto p-4 md:p-6 space-y-4">
      {/* Kopfzeile */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <SelectYear value={year} onChange={setYear} years={years} />
          <Button onClick={()=>loadYear(year)}><RefreshCw className='w-4 h-4'/>Aktualisieren</Button>
          <Button onClick={exportCSVYear} disabled={!atLeastOneReady || !ytdRow}><Download className='w-4 h-4'/>CSV Export</Button>
          {/* Charts-Menü */}
          <ChartsMenu value={chartVis} onChange={setChartVis} />
        </div>
      </div>

      {/* fixes Raster: 7 Spalten, 2 Reihen */}
      <Card>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 12 }, (_, i) => (
            <MonthTile key={i+1} m={i+1} />
          ))}
          <YearTile />
          <div className={`${TILE_H} rounded-2xl opacity-0`}></div>
        </div>
        {loading && (
          <div className='mt-3 text-sm text-gray-500 flex items-center gap-2'>
            <RefreshCw className='w-4 h-4 animate-spin'/>Lade…
          </div>
        )}
      </Card>

      {error && (
        <Card className='border-red-200 bg-red-50'>
          <div className='flex items-center gap-2 text-red-700'><AlertCircle className='w-4 h-4'/> {error}</div>
        </Card>
      )}

      {/* MONATSANSICHT */}
      {!showYear && (
        <div className='grid md:grid-cols-12 gap-4'>
          {/* Links: 6/12 */}
          <div className='md:col-span-6 space-y-4'>
            <Card>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center gap-2'>
                  <Calendar className='w-4 h-4'/><span className='font-medium'>Monatsübersicht</span>
                </div>
                <Muted>{monthRow ? MONTHS[monthRow.monat-1] + ' ' + year : '–'}</Muted>
              </div>

              {!monthRow && <Muted>Wähle einen fertigen Monat oben aus.</Muted>}
              {monthRow && (
                <div className='grid grid-cols-2  md:grid-cols-3 gap-3'>
                  {/* Ist/Soll/Diff */}
                  {typeof monthRow.soll_stunden_sum === 'number' && (
                    <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                      <div className='text-sm text-gray-400'>Ist-Stunden</div>
                      <div className='text-lg font-semibold'>{deNumber(monthRow.ist_stunden_sum)}</div>
                    </div>
                  )}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>Soll-Stunden</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow.soll_stunden_sum)}</div>
                  </div>
                  {monthDiff != null && (
                    <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                      <div className='text-sm text-gray-400'>Differenz (Ist−Soll)</div>
                      <div className={`text-lg font-semibold ${colorBySign(monthDiff)}`}>
                        {monthDiff >= 0 ? '+' : '-'}{deNumber(Math.abs(monthDiff))}
                      </div>
                    </div>
                  )}

                  {/* Urlaub */}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>Urlaubstage</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow.urlaubstage_sum,0)}</div>
                  </div>

                  {/* Krank getrennt: Tage */}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>K-Tage</div>
                    <div className='text-lg font-semibold'>{deNumber(monthKCount,0)}</div>
                  </div>
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>KO-Tage</div>
                    <div className='text-lg font-semibold'>{deNumber(monthKOCount,0)}</div>
                  </div>

                  {/* Krank getrennt: Stunden */}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>K-Stunden</div>
                    <div className='text-lg font-semibold'>{deNumber(monthK)}</div>
                  </div>
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>KO-Stunden</div>
                    <div className='text-lg font-semibold'>{deNumber(monthKO)}</div>
                  </div>

                  {/* Krank % separat */}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>K-% (Stundenbasis)</div>
                    <div className='text-lg font-semibold'>{dePercent(monthKQuote)}</div>
                  </div>
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>KO-% (Stundenbasis)</div>
                    <div className='text-lg font-semibold'>{dePercent(monthKOQuote)}</div>
                  </div>

                  {/* 10/11/12h */}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>10/11/12 Std Einsätze</div>
                    <div className='text-lg font-semibold'>
                      {(monthRow.dauer10_count ?? 0) + (monthRow.dauer11_count ?? 0) + (monthRow.dauer12_count ?? 0)}
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>
                      10h {monthRow.dauer10_count ?? 0} · 11h {monthRow.dauer11_count ?? 0} · 12h {monthRow.dauer12_count ?? 0}
                    </div>
                  </div>

                  {/* Planänderungen + Planerfüllung + Kurzfristigkeit */}
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>Planänderungen gesamt</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow?.planchg_total ?? 0, 0)}</div>
                  </div>
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>Planänderungen (aus dem Rhythmus)</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow?.planchg_off_rhythm ?? 0, 0)}</div>
                  </div>
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>Planerfüllung</div>
                    <div className='text-lg font-semibold'>{dePercent(monthPlanQuote)}</div>
                  </div>
                  <div className='rounded-xl border border-gray-400 dark:border-gray-700 p-3 shadow'>
                    <div className='text-sm text-gray-400'>Kurzfristigkeit ≤1 / 2–≤3 / 4–6 / ≥7 Tage</div>
                    <div className='text-lg font-semibold'>
                      {(monthRow?.kurzfrist_1d ?? 0)} / {(monthRow?.kurzfrist_3d ?? 0)} / {(monthRow?.kurzfrist_7d ?? 0)} / {(monthRow?.kurzfrist_gt7d ?? 0)}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Kürzel-Tabellen */}
            <div className='grid md:grid-cols-2 gap-4'>
              <KuerzelTable title='Kürzel – Counts' data={monthRow?.kuerzel_count ?? null} unit='count' />
              <KuerzelTable title='Kürzel – Stunden' data={monthRow?.kuerzel_stunden ?? null} unit='h' />
            </div>
          </div>

          {/* Rechts: 6/12 */}
          <div className='md:col-span-6 space-y-4'>
            {/* Ist vs Soll (Balken) */}
            <Card>
              <div className='px-3 pt-2 pb-3'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='font-medium'>Ist vs. Soll (Monat)</div>
                  <Muted>{monthRow ? MONTHS[monthRow.monat-1] : '–'}</Muted>
                </div>
                <div className='h-56'>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          name: 'Monat',
                          Ist: Number(monthRow?.ist_stunden_sum || 0),
                          Soll: Number(monthRow?.soll_stunden_sum || 0),
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis
                        tickFormatter={(v) =>
                          new Intl.NumberFormat('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(v)
                        }
                      />
                      <Tooltip
                        formatter={(value, name) => [
                          new Intl.NumberFormat('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(value),
                          name,
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="Ist" name="Ist (h)" fill="#10b981" />
                      <Bar dataKey="Soll" name="Soll (h)" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Top-10 Kürzel (Stunden) im Monat */}
            <Card>
              <div className='px-3 pt-2 pb-3'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='font-medium'>Top-10 Kürzel (h) im Monat</div>
                  <Muted>{monthRow ? MONTHS[monthRow.monat-1] : '–'}</Muted>
                </div>
                <div className='h-56'>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthTopKuerzel.map((r,i)=>({ name: r.k, h: r.v, fill: colorFor(r.k,i) }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="h" name="Stunden">
                        {monthTopKuerzel.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colorFor(entry.k,index)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Kurzfristigkeit (Monat) */}
            <Card>
              <div className='px-3 pt-2 pb-3'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='font-medium'>Kurzfristigkeit (Monat)</div>
                  <Muted>{monthRow ? MONTHS[monthRow.monat-1] : '–'}</Muted>
                </div>
                <div className='h-56'>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: '≤1 Tag',  val: Number(monthRow?.kurzfrist_1d   ?? 0) },
                      { name: '≤3 Tage', val: Number(monthRow?.kurzfrist_3d   ?? 0) },
                      { name: '<7 Tage', val: Number(monthRow?.kurzfrist_7d   ?? 0) },
                      { name: '≥7 Tage', val: Number(monthRow?.kurzfrist_gt7d ?? 0) },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
                      <Bar dataKey="val" name="Änderungen" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            {/* Krank getrennt: K & KO (Stunden) im Monat */}
            <Card>
              <div className='px-3 pt-2 pb-3'>
                <div className='flex items-center justify-between mb-2'>
                  <div className='font-medium'>Krank (K & KO) Stunden im Monat</div>
                  <Muted>{monthRow ? MONTHS[monthRow.monat-1] : '–'}</Muted>
                </div>
                <div className='h-56'>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Monat', K: monthK, KO: monthKO }]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="K"  name="K (h)"  fill="#ef4444" />
                      <Bar dataKey="KO" name="KO (h)" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* JAHRESANSICHT – kompakt & gleich groß */}
      {showYear && (
        <div className='grid md:grid-cols-12 gap-4'>
          {/* Linke Hauptkarte: 6/12 */}
          <div className='md:col-span-6 space-y-4'>
            <Card className="min-h-[14rem]">
              <div className='flex items-center justify-between px-3 pt-2 pb-2'>
                <div className='flex items-center gap-2'>
                  <Calendar className='w-4 h-4'/><span className='font-medium'>Jahresübersicht</span>
                </div>
                <Muted>{year} · bis Monat {ytdRow?.bis_monat ?? '–'}</Muted>
              </div>

              {!atLeastOneReady ? (
                <Muted className="px-3 pb-3">Noch kein Monat finalisiert.</Muted>
              ) : (
                <div className="h-[calc(100%-2.5rem)] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    {/* Stunden – YTD */}
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Stunden · bis Monat {ytdRow?.bis_monat ?? '–'}
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Ist-Stunden (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.ytd_ist ?? 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Soll-Stunden (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>
                        {ytdRow?.ytd_soll != null ? deNumber(ytdRow.ytd_soll) : '–'}
                      </div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Differenz (Ist−Soll, YTD)</div>
                      <div className={`text-base font-semibold leading-tight ${colorBySign(ytdRow?.ytd_diff ?? 0)}`}>
                        {ytdRow?.ytd_diff == null ? '–'
                          : (ytdRow.ytd_diff >= 0 ? '+' : '-') + deNumber(Math.abs(ytdRow.ytd_diff))}
                      </div>
                    </div>

                    {/* Stunden – Jahr gesamt */}
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Stunden · gesamtes Jahr
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Ist-Stunden (Jahr)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.year_ist ?? 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Soll-Stunden (Jahr)</div>
                      <div className='text-base font-semibold leading-tight'>
                        {ytdRow?.year_soll != null ? deNumber(ytdRow.year_soll) : '–'}
                      </div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Differenz (Ist−Soll, Jahr)</div>
                      <div className={`text-base font-semibold leading-tight ${colorBySign(ytdRow?.year_diff ?? 0)}`}>
                        {ytdRow?.year_diff == null ? '–'
                          : (ytdRow.year_diff >= 0 ? '+' : '-') + deNumber(Math.abs(ytdRow.year_diff))}
                      </div>
                    </div>

                    {/* Übernahme & inkl. Übernahme */}
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Vorjahresstunden (Übernahme)</div>
                      <div className='text-base font-semibold leading-tight'>
                        {deNumber(ytdRow?.year_uebernahme ?? 0)}
                      </div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Ist-Stunden inkl. Übernahme (Jahr)</div>
                      <div className='text-base font-semibold leading-tight'>
                        {deNumber(ytdRow?.year_ist_incl ?? ( (ytdRow?.year_ist ?? 0) + (ytdRow?.year_uebernahme ?? 0) ))}
                      </div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Differenz inkl. Übernahme (Ist+Übernahme − Soll)</div>
                      <div className={`text-base font-semibold leading-tight ${colorBySign(
                        (ytdRow?.year_diff_incl ??
                          ((ytdRow?.year_ist ?? 0) + (ytdRow?.year_uebernahme ?? 0) - (ytdRow?.year_soll ?? 0)))
                      )}`}>
                        {(() => {
                          const v = (ytdRow?.year_diff_incl ??
                                     ((ytdRow?.year_ist ?? 0) + (ytdRow?.year_uebernahme ?? 0) - (ytdRow?.year_soll ?? 0)));
                          return (v >= 0 ? '+' : '-') + deNumber(Math.abs(v));
                        })()}
                      </div>
                    </div>

                    {/* Urlaub – YTD & Jahr */}
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Urlaub · bis Monat {ytdRow?.bis_monat ?? '–'}
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Urlaubstage (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.ytd_urlaub ?? 0, 0)}</div>
                    </div>
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Urlaub · gesamtes Jahr
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Urlaubstage (Jahr)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.year_urlaub ?? 0, 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Urlaubstage-Soll (Jahr)</div>
                      <div className='text-base font-semibold leading-tight'>
                        {ytdRow?.year_urlaub_soll != null ? deNumber(ytdRow.year_urlaub_soll, 0) : '–'}
                      </div>
                    </div>

                    {/* Krank (YTD) */}
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Krank · bis Monat {ytdRow?.bis_monat ?? '–'}
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Kranktage (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.kranktage_ytd ?? 0, 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Krank-Stunden (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.krank_stunden_ytd ?? 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Krank-% (Stundenbasis, YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{dePercent(ytdKrankQuote)}</div>
                    </div>

                    {/* Einsätze >10h (YTD) */}
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Einsätze über 10 Stunden · bis Monat {ytdRow?.bis_monat ?? '–'}
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>10/11/12 Std Einsätze (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>
                        {(ytdRow?.dauer10_ytd ?? 0) + (ytdRow?.dauer11_ytd ?? 0) + (ytdRow?.dauer12_ytd ?? 0)}
                      </div>
                      <div className='text-[11px] text-gray-500 mt-1'>
                        10h {ytdRow?.dauer10_ytd ?? 0} · 11h {ytdRow?.dauer11_ytd ?? 0} · 12h {ytdRow?.dauer12_ytd ?? 0}
                      </div>
                    </div>

                    {/* Planänderungen YTD */}
                    <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                      Planänderungen · bis Monat {ytdRow?.bis_monat ?? '–'}
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Gesamt (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.planchg_total_ytd ?? 0, 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Aus dem Rhythmus (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{deNumber(ytdRow?.planchg_off_rhythm_ytd ?? 0, 0)}</div>
                    </div>
                    <div className='rounded-lg border border-gray-300 p-2 bg-gray-200/60 dark:bg-gray-800/50'>
                      <div className='text-xs text-gray-500'>Planerfüllung (YTD)</div>
                      <div className='text-base font-semibold leading-tight'>{dePercent(ytdRow?.planerfuellung_ytd)}</div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Rechte Spalte: 6/12 – Charts nach Menü */}
          <div className='md:col-span-6 space-y-4'>

            {/* 1) Monats-Differenz (immer ganz oben, per Toggle) */}
            {chartVis.monthlyDiff && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Monats-Differenz (Ist − Soll)</div>
                    <Muted>h</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyDiffSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip formatter={(value)=>[
                          new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value),
                          'Differenz (h)'
                        ]}/>
                        <Legend />
                        <Bar dataKey="diff" name="Differenz (h)">
                          {monthlyDiffSeries.map((e, i) => (
                            <Cell key={i} fill={e.diff >= 0 ? '#10b981' : '#ef4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 2) Urlaubstage je Monat */}
            {chartVis.urlaubMonat && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Urlaubstage je Monat</div>
                    <Muted>Tage</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fullYearRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="urlaubstage" name="Urlaubstage" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 3) Kumulierte Stunden */}
            {chartVis.cumBothIncl && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Kumulierte Stunden (Ist inkl. Übernahme & Soll)</div>
                    <Muted>h</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cumBothIncl}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis tickFormatter={(v)=>new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(v)} />
                        <Tooltip formatter={(v,n)=>[new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v), n]} />
                        <Legend />
                        <Line type="monotone" dataKey="kumIst"  name="Ist kumuliert (inkl. Übernahme)" dot={false} stroke="#fbbf24" />
                        <Line type="monotone" dataKey="kumSoll" name="Vorgabe kumuliert"             dot={false} stroke="#60a5fa" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 4) Planänderungen */}
            {chartVis.planChanges && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Planänderungen je Monat</div>
                    <Muted>Count</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChangeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" /><YAxis /><Tooltip /><Legend />
                        <Bar dataKey="total" name="Gesamt" fill="#64748b" />
                        <Bar dataKey="off"   name="Aus dem Rhythmus" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 5) Kurzfristigkeit */}
            {chartVis.shortNotice && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Kurzfristigkeit je Monat (exklusiv)</div>
                    <Muted>Count</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyShortNotice} barCategoryGap="20%" barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="le1"     name="≤1 Tag"      stackId="stackA" fill="#ef4444" />
                        <Bar dataKey="gt1_le3" name=">1–≤3 Tage"  stackId="stackA" fill="#d6a022ff" />
                        <Bar dataKey="gt3_lt7" name=">3–<7 Tage"  stackId="stackA" fill="#fefe00ff" />
                        <Bar dataKey="ge7"     name="≥7 Tage"                   fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 6) Planerfüllungsquote */}
            {chartVis.planerfuellung && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Planerfüllungsquote je Monat</div>
                    <Muted>%</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyChangeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip formatter={(v)=>[deNumber(v,2),'Planerfüllung %']} />
                        <Legend />
                        <Line type="monotone" dataKey="planQ" name="Planerfüllung (%)" dot={false} stroke="#16a34a" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 7) Kürzel je Monat */}
            {chartVis.kuerzelPerMonth && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Kürzel (Stunden) je Monat</div>
                    <KuerzelPicker
                      available={availableKuerzel}
                      value={customKuerzel}
                      onChange={setCustomKuerzel}
                      colorFor={colorFor}
                    />
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={kuerzelSeriesPerMonth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {chosenKuerzel.map((k, idx) => (
                          <Bar key={k} dataKey={k} name={`${k} (h)`} fill={colorFor(k, idx)} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 8) Krank (K & KO) */}
            {chartVis.krankYear && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Krank (K & KO) in Stunden je Monat</div>
                    <Muted>h</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fullYearRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="krankK"  name="K (h)"  fill="#ef4444" />
                        <Bar dataKey="krankKO" name="KO (h)" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}

            {/* 9) Lange Dienste */}
            {chartVis.langeDienste && (
              <Card>
                <div className='px-3 pt-2 pb-3'>
                  <div className='flex items-center justify-between mb-2'>
                    <div className='font-medium'>Lange Dienste je Monat (Anzahl)</div>
                    <Muted>Count</Muted>
                  </div>
                  <div className='h-56'>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fullYearRows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="label" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="dauer10" name=">10h" fill="#fbbf24" />
                        <Bar dataKey="dauer11" name=">11h" fill="#f59e0b" />
                        <Bar dataKey="dauer12" name="≥12h" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Unterkomponenten ------------------------------------------------------
const KuerzelTable = ({ title, data, unit })=>{
  const rows = Object.entries(data ?? {}).map(([k,v])=>({k, v})).sort((a,b)=> (b.v ?? 0) - (a.v ?? 0));
  return (
    <Card className='p-0 overflow-hidden'>
      <div className='px-4 pt-3 pb-2 border-b flex items-center gap-2'>
        <Calendar className='w-4 h-4'/><span className='font-medium'>{title}</span>
      </div>
      <div className='max-h-72 overflow-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-left sticky top-0 bg-white/10'>
              <th className='px-4 py-2'>Kürzel</th>
              <th className='px-4 py-2 text-right'>Wert</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className='px-4 py-3 text-gray-500' colSpan={2}>Keine Daten</td></tr>
            )}
            {rows.map((r, idx)=> (
              <tr key={r.k} className='hover:bg-white/5'>
                <td className='px-4 py-2 font-mono flex items-center gap-2'>
                  <span className='inline-block w-3 h-3 rounded' style={{ backgroundColor: FALLBACK_COLORS[idx % FALLBACK_COLORS.length] }} />
                  {r.k}
                </td>
                <td className='px-4 py-2 text-right'>{unit === 'h' ? deNumber(r.v) : deNumber(r.v,0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

// ---- Simple Badge (statt shadcn Badge)
const MiniBadge = ({ children, onClose }) => (
  <span className="inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600">
    {children}
    {onClose && (
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100">
        <X className="w-3 h-3" />
      </button>
    )}
  </span>
);

const KuerzelPicker = ({ available, value, onChange, colorFor }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = React.useRef(null);

  // click outside, um den Popover zu schließen
  useEffect(() => {
    const onDoc = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = available.filter(k => k.toLowerCase().includes(q.toLowerCase()));
  const selected = new Set(value);
  const toggle = (k) => {
    const arr = value.includes(k) ? value.filter(v=>v!==k) : [...value, k];
    onChange(arr.slice(0,3)); // max 3 beibehalten
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={()=>setOpen(v=>!v)}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm hover:bg-gray-500"
      >
        Kürzel wählen ({value.length || 'Top 3'})
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-white dark:bg-gray-800 shadow-lg z-20">
          <div className="p-2 border-b">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Kürzel suchen…"
              className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1 text-sm outline-none"
            />
          </div>

          <div className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer</div>
            )}
            {filtered.map((k, idx) => (
              <button
                key={k}
                onClick={()=>toggle(k)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
              >
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: colorFor(k, idx) }} />
                <span className="font-mono">{k}</span>
                <span className="ml-auto">
                  {selected.has(k) ? <Check className="w-4 h-4" /> : <span className="inline-block w-4 h-4" />}
                </span>
              </button>
            ))}
          </div>

          {value.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 border-t">
              {value.map((k, idx) => (
                <MiniBadge key={k} onClose={() => onChange(value.filter(v=>v!==k))}>
                  <span className="inline-block w-2.5 h-2.5 rounded" style={{ backgroundColor: colorFor(k, idx) }} />
                  <span className="font-mono">{k}</span>
                </MiniBadge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
