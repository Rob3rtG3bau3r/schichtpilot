// src/components/UnitReports/UnitReports.jsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient } from '../supabaseClient';
import UnitsReportsMenue from '../components/UnitReports/UnitsReportsMenue';
import MonthView from '../components/UnitReports/MonthView';
import YearView from '../components/UnitReports/YearView';
import { MONTHS, FALLBACK_COLORS } from '../components/UnitReports/unitReportsShared';
import { useSearchParams } from 'react-router-dom';


export default function UnitReports({ firmaId, unitId, supabase: supabaseProp, defaultYear }) {
const [searchParams] = useSearchParams();
const urlFirmaId = searchParams.get('firma_id');
const urlUnitId  = searchParams.get('unit_id');
const urlYear    = searchParams.get('jahr');
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
  const [firmaIdState, setFirmaIdState] = useState(
  firmaId ?? (urlFirmaId ? Number(urlFirmaId) : null)
);
const [unitIdState, setUnitIdState] = useState(
  unitId ?? (urlUnitId ? Number(urlUnitId) : null)
);

  const [isCompanyViewer, setIsCompanyViewer] = useState(false);
  const [companyUnits, setCompanyUnits] = useState([]); // [{id, unitname}]

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

    useEffect(() => {
    if (!firmaIdState) return;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;

      // Rolle + Flag laden
      const { data: me, error: meErr } = await supabase
        .from('DB_User')
        .select('rolle, can_see_company_page, firma_id, unit_id')
        .eq('user_id', uid)
        .maybeSingle();

      if (meErr) {
        console.error('DB_User Rollen-Check Fehler:', meErr);
        return;
      }

      const canSeeCompany =
        me?.rolle === 'Org_Admin' ||
        (me?.rolle === 'Admin_Dev' && me?.can_see_company_page === true);

      setIsCompanyViewer(!!canSeeCompany);

      if (!canSeeCompany) return;

      // Units der Firma laden (für Dropdown)
      const { data: units, error: uErr } = await supabase
        .from('DB_Unit')
        .select('id, unitname')
        .eq('firma', firmaIdState)
        .order('unitname');

      if (uErr) {
        console.error('DB_Unit Laden Fehler:', uErr);
        return;
      }

      setCompanyUnits(units || []);

      // Wenn noch keine Unit gesetzt ist → erste Unit nehmen
      if (!unitIdState && (units || []).length > 0) {
        setUnitIdState(units[0].id);
      }
    })();
  }, [firmaIdState, unitIdState, supabase]);

  // Jahr Auswahl
  const now = useMemo(() => new Date(), []);
  const thisYear = now.getFullYear();
  const [year, setYear] = useState(  defaultYear ?? (urlYear ? Number(urlYear) : thisYear));
  const years = useMemo(() => [thisYear-2, thisYear-1, thisYear, thisYear+1].filter(y => y >= 2000), [thisYear]);

  // Daten
  const [months, setMonths] = useState([]);
  const [ytdRow, setYtdRow] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showYear, setShowYear] = useState(false);

  // Sichtbarkeit der Jahres-Charts (Default: wie bei dir)
  const [chartVis, setChartVis] = useState({
    monthlyDiff: true,
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
      .select('kuerzel, farbe_bg, farbe_text')
      .eq('firma_id', firmaIdState)
      .eq('unit_id', unitIdState);

    if (error) {
      console.error('SchichtArt Farben Fehler:', error);
      return;
    }

    const map = {};
    (data || []).forEach(row => {
      if (row.kuerzel && row.farbe_bg) {
        map[row.kuerzel] = {
          bg: row.farbe_bg,
          text: row.farbe_text ?? '#000000',
        };
      }
    });

    setKuerzelColors(map);
  })();
}, [firmaIdState, unitIdState, supabase]);


  const colorFor = (k, idx) =>
  kuerzelColors[k]?.bg || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];


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

    const { data: ytdData } = await supabase
      .from('db_report_ytd')
      .select('*')
      .eq('firma_id', firmaIdState)
      .eq('unit_id', unitIdState)
      .eq('jahr', y)
      .maybeSingle();
    setYtdRow(ytdData ?? null);

    const finalized = (data || []).filter(r => r.finalized_at);
    const last = finalized.length ? finalized[finalized.length - 1].monat : null;
    setSelectedMonth(last);
    setShowYear(false);
    setLoading(false);
  };

  useEffect(() => {
    if (!firmaIdState || !unitIdState) return;
    loadYear(year).catch(e => { setError(e.message ?? 'Fehler beim Laden'); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, firmaIdState, unitIdState]);

  const readyMap = useMemo(() => {
    const m = {};
    months.forEach(r => { m[r.monat] = !!r.finalized_at; });
    return m;
  }, [months]);

  const atLeastOneReady = months.some(r => !!r.finalized_at);

  const monthRow = useMemo(
    () => months.find(r => r.monat === selectedMonth) || null,
    [months, selectedMonth]
  );

  const monthDiff = useMemo(() => {
    if (!monthRow || typeof monthRow.soll_stunden_sum !== 'number') return null;
    return Number(monthRow.ist_stunden_sum || 0) - Number(monthRow.soll_stunden_sum || 0);
  }, [monthRow]);

  const monthK       = useMemo(() => Number(monthRow?.kuerzel_stunden?.K  ?? 0), [monthRow]);
  const monthKO      = useMemo(() => Number(monthRow?.kuerzel_stunden?.KO ?? 0), [monthRow]);
  const monthKCount  = useMemo(() => Number(monthRow?.kuerzel_count?.K    ?? 0), [monthRow]);
  const monthKOCount = useMemo(() => Number(monthRow?.kuerzel_count?.KO   ?? 0), [monthRow]);

  const monthKQuote = useMemo(() => {
    const denom = Number(monthRow?.ist_stunden_sum ?? 0);
    return denom > 0 ? (monthK / denom) * 100 : null;
  }, [monthK, monthRow]);

  const monthKOQuote = useMemo(() => {
    const denom = Number(monthRow?.ist_stunden_sum ?? 0);
    return denom > 0 ? (monthKO / denom) * 100 : null;
  }, [monthKO, monthRow]);

  const monthPlanQuote = useMemo(() => (monthRow?.planerfuellung_quote ?? null), [monthRow]);

  const monthTopKuerzel = useMemo(() => {
    if (!monthRow?.kuerzel_stunden) return [];
    return Object.entries(monthRow.kuerzel_stunden)
      .map(([k,v]) => ({ k, v: Number(v || 0) }))
      .sort((a,b) => b.v - a.v)
      .slice(0, 10);
  }, [monthRow]);

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
        label: MONTHS[m - 1],
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
    return fullYearRows.map(r => ({ label: r.label, diff: Number(r.ist || 0) - Number(r.soll || 0) }));
  }, [fullYearRows]);

  const monthlyShortNotice = useMemo(() => {
    return months.map(r => ({
      label: MONTHS[r.monat - 1],
      le1:     Number(r.kurzfrist_1d   ?? 0),
      gt1_le3: Number(r.kurzfrist_3d   ?? 0),
      gt3_lt7: Number(r.kurzfrist_7d   ?? 0),
      ge7:     Number(r.kurzfrist_gt7d ?? 0),
    }));
  }, [months]);

  // Startwert = Vorjahres-Übernahme (ytdRow.year_uebernahme)
  const cumBothIncl = useMemo(() => {
    let runIst  = Number(ytdRow?.year_uebernahme ?? 0);
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

  const top3Kuerzel = useMemo(() => {
    const totals = {};
    fullYearRows.forEach(r => {
      Object.entries(r.kuerzelStunden || {}).forEach(([k, v]) => {
        totals[k] = (totals[k] || 0) + Number(v || 0);
      });
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unit_report_year_${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto p-4 md:p-6 space-y-4">
            <UnitsReportsMenue
        year={year}
        setYear={setYear}
        years={years}
        onReload={() => loadYear(year)}
        onExport={exportCSVYear}
        exportDisabled={!atLeastOneReady || !ytdRow}
        loading={loading}
        error={error}
        readyMap={readyMap}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        showYear={showYear}
        setShowYear={setShowYear}
        atLeastOneReady={atLeastOneReady}
        chartVis={chartVis}
        setChartVis={setChartVis}
        isCompanyViewer={isCompanyViewer}
        companyUnits={companyUnits}
        unitId={unitIdState}
        setUnitId={setUnitIdState}
      />


      {!showYear && (
        <MonthView
          year={year}
          monthRow={monthRow}
          monthDiff={monthDiff}
          monthK={monthK}
          monthKO={monthKO}
          monthKCount={monthKCount}
          monthKOCount={monthKOCount}
          monthKQuote={monthKQuote}
          monthKOQuote={monthKOQuote}
          monthPlanQuote={monthPlanQuote}
          monthTopKuerzel={monthTopKuerzel}
          colorFor={colorFor}
        />
      )}

      {showYear && (
        <YearView
          year={year}
          ytdRow={ytdRow}
          atLeastOneReady={atLeastOneReady}
          ytdKrankQuote={ytdKrankQuote}
          chartVis={chartVis}
          fullYearRows={fullYearRows}
          monthlyDiffSeries={monthlyDiffSeries}
          cumBothIncl={cumBothIncl}
          monthlyChangeSeries={monthlyChangeSeries}
          monthlyShortNotice={monthlyShortNotice}
          availableKuerzel={availableKuerzel}
          customKuerzel={customKuerzel}
          setCustomKuerzel={setCustomKuerzel}
          chosenKuerzel={chosenKuerzel}
          kuerzelSeriesPerMonth={kuerzelSeriesPerMonth}
          colorFor={colorFor}
        />
      )}
    </div>
  );
}
