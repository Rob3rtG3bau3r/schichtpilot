'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Calendar, ChevronDown, Download, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react';

// ---- UI primitives ---------------------------------------------------------
const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-200 bg-gray-200 dark:bg-gray-700 p-2 ${className}`} {...rest}>{children}</div>
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
      className="appearance-none rounded-2xl border border-gray-500 px-3 py-2 pr-8 bg-gray-200 dark:bg-gray-700"
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

// ---- component -------------------------------------------------------------
export default function UnitReports({ firmaId, unitId, supabase: supabaseProp, defaultYear }) {
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
  }, [firmaIdState, unitIdState]);

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

  const ytdKrankQuote = useMemo(() => {
    if (!ytdRow || !Number(ytdRow?.ytd_ist)) return null;
    return (Number(ytdRow.krank_stunden_ytd ?? 0) / Number(ytdRow.ytd_ist)) * 100;
  }, [ytdRow]);

  // CSV (Year) – Werte aus db_report_ytd
  const exportCSVYear = () => {
    if (!atLeastOneReady || !ytdRow) return;
    const header = [
      'firma_id','unit_id','jahr','bis_monat',
      'ytd_soll','ytd_ist','ytd_diff',
      'year_soll','year_ist','year_diff',
      'ytd_urlaub','year_urlaub','year_urlaub_soll',
      'krank_stunden_ytd','kranktage_ytd','krank_%_ytd',
      'dauer10_ytd','dauer11_ytd','dauer12_ytd'
    ];
    const csvHeader = header.join(';') + '\n';
    const line = [
      firmaIdState, unitIdState, year, (ytdRow.bis_monat ?? ''),
      (ytdRow.ytd_soll ?? ''), (ytdRow.ytd_ist ?? 0), (ytdRow.ytd_diff ?? ''),
      (ytdRow.year_soll ?? ''), (ytdRow.year_ist ?? 0), (ytdRow.year_diff ?? ''),
      (ytdRow.ytd_urlaub ?? 0), (ytdRow.year_urlaub ?? 0), (ytdRow.year_urlaub_soll ?? ''),
      (ytdRow.krank_stunden_ytd ?? 0), (ytdRow.kranktage_ytd ?? 0), (ytdKrankQuote ?? ''),
      (ytdRow.dauer10_ytd ?? 0), (ytdRow.dauer11_ytd ?? 0), (ytdRow.dauer12_ytd ?? 0),
    ].join(';') + '\n';
    const blob = new Blob([csvHeader + line], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `unit_report_year_${year}.csv`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // --- Monate-Kacheln (fixes 7×2 Raster) -----------------------------------
  const TILE_H = 'h-12';
  const MonthTile = ({ m }) => {
    const ready = !!readyMap[m];
    const selected = selectedMonth === m && !showYear;
    return (
      <button
        onClick={() => ready && (setSelectedMonth(m), setShowYear(false))}
        className={`w-full ${TILE_H} flex items-center justify-between rounded-2xl px-4 border
                    bg-gray-200 dark:bg-gray-600
                    ${ready ? 'hover:bg-gray-500 hover:dark:bg-gray-500 cursor-pointer' : 'opacity-60 cursor-not-allowed'}
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
    return (
      <button
        onClick={() => ready && setShowYear(true)}
        className={`w-full ${TILE_H} flex items-center justify-between rounded-2xl px-4 border
                    bg-gray-200 dark:bg-gray-600
                    ${ready ? 'hover:bg-gray-500 hover:dark:bg-gray-500 cursor-pointer' : 'opacity-60 cursor-not-allowed'}
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
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      {/* Kopfzeile */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <SelectYear value={year} onChange={setYear} years={years} />
          <Button onClick={()=>loadYear(year)}><RefreshCw className='w-4 h-4'/>Aktualisieren</Button>
          <Button onClick={exportCSVYear} disabled={!atLeastOneReady || !ytdRow}><Download className='w-4 h-4'/>CSV Export</Button>
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
          <div className='md:col-span-7 space-y-4'>
            <Card>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center gap-2'><Calendar className='w-4 h-4'/><span className='font-medium'>Monatsübersicht</span></div>
                <Muted>{monthRow ? MONTHS[monthRow.monat-1] + ' ' + year : '–'}</Muted>
              </div>
              {!monthRow && <Muted>Wähle einen fertigen Monat oben aus.</Muted>}
              {monthRow && (
                <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                  {typeof monthRow.soll_stunden_sum === 'number' && (

                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Ist-Stunden</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow.ist_stunden_sum)}</div>
                  </div>
                  )}
                    <div className='rounded-xl border p-3'>
                      <div className='text-sm text-gray-400'>Soll-Stunden</div>
                      <div className='text-lg font-semibold'>{deNumber(monthRow.soll_stunden_sum)}</div>
                    </div>
                  {monthDiff != null && (
                    <div className='rounded-xl border p-3'>
                      <div className='text-sm text-gray-400'>Differenz (Ist−Soll)</div>
                      <div className={`text-lg font-semibold ${colorBySign(monthDiff)}`}>
                        {monthDiff >= 0 ? '+' : '-'}{deNumber(Math.abs(monthDiff))}
                      </div>
                    </div>
                  )}
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Urlaubstage</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow.urlaubstage_sum,0)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Kranktage</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow.kranktage_count,0)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Krank-Stunden</div>
                    <div className='text-lg font-semibold'>{deNumber(monthRow.krank_stunden_sum)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Krank-% (Stundenbasis)</div>
                    <div className='text-lg font-semibold'>
                      {dePercent(
                        (monthRow.ist_stunden_sum ?? 0) > 0
                          ? ((monthRow.krank_stunden_sum ?? 0) / (monthRow.ist_stunden_sum ?? 1)) * 100
                          : null
                      )}
                    </div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>10/11/12 Std Einsätze</div>
                    <div className='text-lg font-semibold'>
                      {(monthRow.dauer10_count ?? 0) + (monthRow.dauer11_count ?? 0) + (monthRow.dauer12_count ?? 0)}
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>
                      10h {monthRow.dauer10_count ?? 0} · 11h {monthRow.dauer11_count ?? 0} · 12h {monthRow.dauer12_count ?? 0}
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
        </div>
      )}

      {/* JAHRESANSICHT – db_report_ytd */}
      {showYear && (
        <div className='grid md:grid-cols-12 gap-4'>
          <div className='md:col-span-7 space-y-4'>
            <Card>
              <div className='flex items-center justify-between mb-3'>
                <div className='flex items-center gap-2'><Calendar className='w-4 h-4'/><span className='font-medium'>Jahresübersicht</span></div>
                <Muted>{year} · bis Monat {ytdRow?.bis_monat ?? '–'}</Muted>
              </div>

              {!atLeastOneReady && <Muted>Noch kein Monat finalisiert.</Muted>}
              {atLeastOneReady && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Stunden – YTD */}
                  <div className="col-span-full mt-1 text-xs uppercase tracking-wide text-gray-500">
                    Stunden · bis Monat {ytdRow?.bis_monat ?? '–'}
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Ist-Stunden (YTD)</div>
                    <div className='text-lg font-semibold'>{deNumber(ytdRow?.ytd_ist ?? 0)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Soll-Stunden (YTD)</div>
                    <div className='text-lg font-semibold'>{ytdRow?.ytd_soll != null ? deNumber(ytdRow.ytd_soll) : '–'}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Differenz (Ist−Soll, YTD)</div>
                    <div className={`text-lg font-semibold ${colorBySign(ytdRow?.ytd_diff ?? 0)}`}>
                      {ytdRow?.ytd_diff == null ? '–'
                        : (ytdRow.ytd_diff >= 0 ? '+' : '-') + deNumber(Math.abs(ytdRow.ytd_diff))}
                    </div>
                  </div>

                  {/* Stunden – Jahr gesamt */}
                  <div className="col-span-full mt-2 text-xs uppercase tracking-wide text-gray-500">Stunden · gesamtes Jahr</div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Ist-Stunden (Jahr)</div>
                    <div className='text-lg font-semibold'>{deNumber(ytdRow?.year_ist ?? 0)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Soll-Stunden (Jahr)</div>
                    <div className='text-lg font-semibold'>{ytdRow?.year_soll != null ? deNumber(ytdRow.year_soll) : '–'}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Differenz (Ist−Soll, Jahr)</div>
                    <div className={`text-lg font-semibold ${colorBySign(ytdRow?.year_diff ?? 0)}`}>
                      {ytdRow?.year_diff == null ? '–'
                        : (ytdRow.year_diff >= 0 ? '+' : '-') + deNumber(Math.abs(ytdRow.year_diff))}
                    </div>
                  </div>

                  {/* Urlaub – YTD */}
                  <div className="col-span-full mt-2 text-xs uppercase tracking-wide text-gray-500">
                    Urlaub · bis Monat {ytdRow?.bis_monat ?? '–'}
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Urlaubstage (YTD)</div>
                    <div className='text-lg font-semibold'>{deNumber(ytdRow?.ytd_urlaub ?? 0, 0)}</div>
                  </div>

                  {/* Urlaub – Jahr gesamt */}
                  <div className="col-span-full mt-2 text-xs uppercase tracking-wide text-gray-500">Urlaub · gesamtes Jahr</div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Urlaubstage (Jahr)</div>
                    <div className='text-lg font-semibold'>{deNumber(ytdRow?.year_urlaub ?? 0, 0)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Urlaubstage-Soll (Jahr)</div>
                    <div className='text-lg font-semibold'>{ytdRow?.year_urlaub_soll != null ? deNumber(ytdRow.year_urlaub_soll, 0) : '–'}</div>
                  </div>

                  {/* Krank (YTD) */}
                  <div className="col-span-full mt-2 text-xs uppercase tracking-wide text-gray-500">Krank · bis Monat {ytdRow?.bis_monat ?? '–'}</div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Kranktage (YTD)</div>
                    <div className='text-lg font-semibold'>{deNumber(ytdRow?.kranktage_ytd ?? 0, 0)}</div>
                  </div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Krank-Stunden (YTD)</div>
                    <div className='text-lg font-semibold'>{deNumber(ytdRow?.krank_stunden_ytd ?? 0)}</div>
                  </div>                  
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>Krank-% (Stundenbasis, YTD)</div>
                    <div className='text-lg font-semibold'>{dePercent(ytdKrankQuote)}</div>
                  </div>
                  {/* >10 Stunden (YTD) */}
                  <div className="col-span-full mt-2 text-xs uppercase tracking-wide text-gray-500">Einsätze über 10 Stunden · bis Monat {ytdRow?.bis_monat ?? '–'}</div>
                  <div className='rounded-xl border p-3'>
                    <div className='text-sm text-gray-400'>10/11/12 Std Einsätze (YTD)</div>
                    <div className='text-lg font-semibold'>
                      {(ytdRow?.dauer10_ytd ?? 0) + (ytdRow?.dauer11_ytd ?? 0) + (ytdRow?.dauer12_ytd ?? 0)}
                    </div>
                    <div className='text-xs font-bold text-gray-200 mt-1'>
                      10h = {ytdRow?.dauer10_ytd ?? 0} 
                    </div>
                    <div className='text-xs font-bold text-gray-200 mt-1'>
                      11h = {ytdRow?.dauer11_ytd ?? 0}
                    </div>
                    <div className='text-xs font-bold text-gray-200 mt-1'>
                      12h = {ytdRow?.dauer12_ytd ?? 0}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Unterkomponente Tabelle ----------------------------------------------
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
            {rows.map(r=> (
              <tr key={r.k} className='hover:bg-white/5'>
                <td className='px-4 py-2 font-mono'>{r.k}</td>
                <td className='px-4 py-2 text-right'>{unit === 'h' ? deNumber(r.v) : deNumber(r.v,0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

