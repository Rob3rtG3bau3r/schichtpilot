// src/components/UnitReports/MonthView.jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import MonthsCharts from './MonthsCharts';
import { MONTHS, deNumber, dePercent, colorBySign, FALLBACK_COLORS } from './unitReportsShared';

const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);

const Muted = ({ className = '', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>
    {children}
  </span>
);

const SectionTitle = ({ children }) => (
  <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
    {children}
  </div>
);

const StatCard = ({ label, value, sub, valueClass = '' }) => (
  <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
    <div className="text-xs text-gray-500">{label}</div>
    <div className={`text-base font-semibold leading-tight ${valueClass}`}>{value}</div>
    {sub ? <div className="text-[11px] text-gray-500 mt-1">{sub}</div> : null}
  </div>
);

const KuerzelTable = ({ title, data, unit, kuerzelColors, colorFor }) => {
  const rows = Object.entries(data ?? {})
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => (b.v ?? 0) - (a.v ?? 0));

  const getBg = (k, idx) => {
    const db = kuerzelColors?.[k]?.bg;
    if (db) return db;

    const cf = typeof colorFor === 'function' ? colorFor(k, idx) : null;
    if (cf) return cf;

    return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  };

  const getText = (k) => kuerzelColors?.[k]?.text || '#000000';

  return (
    <Card className="min-h-[14rem]">
      <div className="px-4 pt-3 pb-2 border-b flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        <span className="font-medium">{title}</span>
      </div>

      {/* ✅ mehr Platz: Option A */}
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left sticky top-0 bg-white/10">
              <th className="px-4 py-2">Kürzel</th>
              <th className="px-4 py-2 text-right">Wert</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-gray-500" colSpan={2}>
                  Keine Daten
                </td>
              </tr>
            )}

            {rows.map((r, idx) => (
              <tr key={r.k} className="hover:bg-white/5">
                {/* ✅ Kürzel im farbigen Feld, kein extra Text */}
                <td className="px-4 py-2">
                  <span
                    className="inline-flex items-center justify-center font-mono text-sm font-semibold rounded-md px-2 py-1"
                    style={{ backgroundColor: getBg(r.k, idx), color: getText(r.k) }}
                    title={r.k}
                  >
                    {r.k}
                  </span>
                </td>

                <td className="px-4 py-2 text-right">
                  {unit === 'h' ? deNumber(r.v) : deNumber(r.v, 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default function MonthView({
  year,
  monthRow,
  monthDiff,
  monthK,
  monthKO,
  monthKCount,
  monthKOCount,
  monthKQuote,
  monthKOQuote,
  monthPlanQuote,
  monthTopKuerzel,
  colorFor,
  kuerzelColors,
}) {
  return (
    <div className="grid md:grid-cols-12 gap-4">
      {/* Links */}
      <div className="md:col-span-6 space-y-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Monatsübersicht</span>
            </div>
            <Muted>{monthRow ? MONTHS[monthRow.monat - 1] + ' ' + year : '–'}</Muted>
          </div>

          {!monthRow && <Muted>Wähle einen fertigen Monat oben aus.</Muted>}

          {monthRow && (
            <div className="h-[calc(100%-2.5rem)] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <SectionTitle>Stunden</SectionTitle>
                {typeof monthRow.soll_stunden_sum === 'number' && (
                  <StatCard label="Ist-Stunden" value={deNumber(monthRow.ist_stunden_sum)} />
                )}
                <StatCard label="Soll-Stunden" value={deNumber(monthRow.soll_stunden_sum)} />
                {monthDiff != null && (
                  <StatCard
                    label="Differenz (Ist−Soll)"
                    value={`${monthDiff >= 0 ? '+' : '-'}${deNumber(Math.abs(monthDiff))}`}
                    valueClass={colorBySign(monthDiff)}
                  />
                )}

                <SectionTitle>Urlaub</SectionTitle>
                <StatCard label="Urlaubstage" value={deNumber(monthRow.urlaubstage_sum, 0)} />

                <SectionTitle>Krank</SectionTitle>
                <StatCard label="K-Tage" value={deNumber(monthKCount, 0)} />
                <StatCard label="KO-Tage" value={deNumber(monthKOCount, 0)} />
                <StatCard label="K-Stunden" value={deNumber(monthK)} />
                <StatCard label="KO-Stunden" value={deNumber(monthKO)} />
                <StatCard label="K-% (Stundenbasis)" value={dePercent(monthKQuote)} />
                <StatCard label="KO-% (Stundenbasis)" value={dePercent(monthKOQuote)} />

                <SectionTitle>Plan & Kurzfristigkeit</SectionTitle>
                <StatCard label="Planänderungen gesamt" value={deNumber(monthRow?.planchg_total ?? 0, 0)} />
                <StatCard
                  label="Planänderungen (aus dem Rhythmus)"
                  value={deNumber(monthRow?.planchg_off_rhythm ?? 0, 0)}
                />
                <StatCard label="Planerfüllung" value={dePercent(monthPlanQuote)} />
                <StatCard
                  label="Kurzfristigkeit ≤1 / 2–≤3 / 4–6 / ≥7"
                  value={`${monthRow?.kurzfrist_1d ?? 0} / ${monthRow?.kurzfrist_3d ?? 0} / ${
                    monthRow?.kurzfrist_7d ?? 0
                  } / ${monthRow?.kurzfrist_gt7d ?? 0}`}
                />

                <SectionTitle>Lange Dienste</SectionTitle>
                <StatCard
                  label="10/11/12 Std Einsätze"
                  value={(monthRow.dauer10_count ?? 0) + (monthRow.dauer11_count ?? 0) + (monthRow.dauer12_count ?? 0)}
                  sub={`10h ${monthRow.dauer10_count ?? 0} · 11h ${monthRow.dauer11_count ?? 0} · 12h ${
                    monthRow.dauer12_count ?? 0
                  }`}
                />
              </div>
            </div>
          )}
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <KuerzelTable
            title="Kürzel – Counts"
            data={monthRow?.kuerzel_count ?? null}
            unit="count"
            kuerzelColors={kuerzelColors}
            colorFor={colorFor}
          />
          <KuerzelTable
            title="Kürzel – Stunden"
            data={monthRow?.kuerzel_stunden ?? null}
            unit="h"
            kuerzelColors={kuerzelColors}
            colorFor={colorFor}
          />
        </div>
      </div>

      {/* Rechts */}
      <div className="md:col-span-6 space-y-4">
        <MonthsCharts
          monthRow={monthRow}
          monthTopKuerzel={monthTopKuerzel}
          colorFor={colorFor}
          monthK={monthK}
          monthKO={monthKO}
        />
      </div>
    </div>
  );
}
