// src/components/UnitReports/UnitsReportsMenue.jsx
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, RefreshCw, AlertCircle, CheckCircle2, Circle } from 'lucide-react';
import { MONTHS } from './unitReportsShared';

const Card = ({ className='', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-400 dark:border-bg-gray-200 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);
const Button = ({ className='', children, ...rest }) => (
  <button className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 hover:bg-gray-500 active:scale-[.99] ${className}`} {...rest}>
    {children}
  </button>
);
const Muted = ({ className='', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);
const SelectYear = ({ value, onChange, years }) => (
  <div className="relative inline-flex items-center">
    <select
      value={value}
      onChange={(e)=>onChange(parseInt(e.target.value))}
      className="appearance-none rounded-2xl border border-gray-500 px-3 py-2 pr-8 bg-gray-200 dark:bg-gray-800"
    >
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
    <ChevronDown className="w-4 h-4 -ml-6 pointer-events-none text-gray-500" />
  </div>
);

// ---- Charts-Menü (wie bei dir) --------------------------------------------
const ChartsMenu = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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
  const selectAll = () => onChange(Object.fromEntries(Object.keys(value).map(k => [k, true])));
  const selectNone = () => {
    const allFalse = Object.fromEntries(Object.keys(value).map(k => [k, false]));
    allFalse.monthlyDiff = true;
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

// ---- Tiles ---------------------------------------------------------------
export default function UnitsReportsMenue({
  year, setYear, years,
  onReload, onExport, exportDisabled,
  loading, error,
  readyMap, selectedMonth, setSelectedMonth,
  showYear, setShowYear,
  atLeastOneReady,
  chartVis, setChartVis
}) {
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

  return (
    <div className="space-y-4">
      {/* Kopfzeile */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <SelectYear value={year} onChange={setYear} years={years} />
          <Button onClick={onReload}><RefreshCw className="w-4 h-4" />Aktualisieren</Button>
          <Button onClick={onExport} disabled={exportDisabled}><Download className="w-4 h-4" />CSV Export</Button>
          <ChartsMenu value={chartVis} onChange={setChartVis} />
        </div>
      </div>

      {/* fixes Raster: 7 Spalten, 2 Reihen */}
      <Card>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 12 }, (_, i) => (<MonthTile key={i+1} m={i+1} />))}
          <YearTile />
          <div className={`${TILE_H} rounded-2xl opacity-0`} />
        </div>

        {loading && (
          <div className="mt-3 text-sm text-gray-500 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Lade…
          </div>
        )}
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        </Card>
      )}
    </div>
  );
}
