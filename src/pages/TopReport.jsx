// src/pages/TopReport.jsx
import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import { ChevronDown, ChevronRight, RotateCw } from 'lucide-react';

const Panel = ({ title, children, right }) => (
  <div className="rounded-2xl border border-gray-700/50 bg-gray-800 text-white p-3">
    <div className="flex items-center justify-between mb-2">
      <h3 className="font-semibold">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const Card = ({ title, items, topN = 5 }) => {
  const [open, setOpen] = useState(false);
  const top = (items?.top ?? []).slice(0, topN);
  const rest = (items?.rest ?? []).slice(0, Math.max(0, 10 - top.length)); // bis 10 gesamt

  const renderRow = (r, key) => {
    const label = r.name ?? r.kuerzel ?? r.monat ?? r.user ?? '—';
    const value = r.stunden ?? r.tage ?? r.wert ?? 0;
    return (
      <li key={key} className="flex items-center justify-between">
        <span className="truncate">{label}</span>
        <span className="font-mono">{value}</span>
      </li>
    );
  };

  return (
    <div className="rounded-xl border border-gray-700/40 bg-gray-700 p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">{title}</div>
        {items ? (
          <div className="text-xs opacity-70">
            {(items.top?.length || 0) + (items.rest?.length || 0)} gesamt
          </div>
        ) : null}
      </div>
      <ol className="mt-2 space-y-1 text-sm">
        {top.map((r, i) => renderRow(r, `t-${i}`))}
      </ol>
      {rest.length > 0 && (
        <>
          <button
            className="mt-2 text-xs text-blue-300 hover:text-white flex items-center gap-1"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {open ? 'Rest ausblenden' : 'Rest anzeigen'}
          </button>
          {open && (
            <ol className="mt-2 space-y-1 text-sm opacity-80">
              {rest.map((r, i) => renderRow(r, `r-${i}`))}
            </ol>
          )}
        </>
      )}
    </div>
  );
};

export default function TopReport() {
  const { sichtUnit: unit } = useRollen();

  const thisYear = dayjs().year();
  const [from, setFrom] = useState(dayjs().year(thisYear).startOf('year').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().year(thisYear).endOf('year').format('YYYY-MM-DD'));
  const [limit, setLimit] = useState(() => Number(localStorage.getItem('top_report_limit') || 5));
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    localStorage.setItem('top_report_limit', String(limit));
  }, [limit]);

  const load = async () => {
    if (!unit) return;
    setLoading(true);
    setError('');
    setPayload(null);
    const { data, error } = await supabase.rpc('top_report', {
      p_unit_id: unit,
      p_from: from,
      p_to: to,
      p_limit: limit,
    });
    if (error) {
      setError(error.message || 'Fehler');
      setLoading(false);
      return;
    }
    setPayload(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const enabled = !!payload?.enabled;

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4">
      <div className="flex items-end justify-between mb-4">
        <h1 className="text-2xl font-bold">Top Report</h1>
        <div className="flex items-end gap-2">
          <div className="text-xs opacity-70">Zeitraum</div>
          <input
            type="date"
            className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <span>–</span>
          <input
            type="date"
            className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <select
            className="px-2 py-1 rounded bg-gray-900 border border-gray-700 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={3}>Top 3</option>
            <option value={5}>Top 5</option>
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm flex items-center gap-1"
          >
            <RotateCw size={14} /> Aktualisieren
          </button>
        </div>
      </div>

      <Panel
        title={`Unit-Report ${dayjs(from).format('DD.MM.YYYY')} – ${dayjs(to).format('DD.MM.YYYY')}`}
        right={
          enabled ? null : (
            <span className="text-xs bg-gray-700/60 rounded px-2 py-0.5">Feature nicht aktiv</span>
          )
        }
      >
        {loading && <div className="text-sm opacity-80">Lade…</div>}
        {error && <div className="text-sm text-red-400">{error}</div>}

        {!loading && !error && enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Card title="Top User – Stunden" items={payload?.top_hours_users} topN={limit} />
            <Card title="Top Frühschicht-Tage (User)" items={payload?.top_days_users?.F} topN={limit} />
            <Card title="Top Spätschicht-Tage (User)" items={payload?.top_days_users?.S} topN={limit} />
            <Card title="Top Nachtschicht-Tage (User)" items={payload?.top_days_users?.N} topN={limit} />
            <Card title="Top Kürzel (Tage)" items={payload?.top_codes} topN={limit} />
            <Card title="Monate mit den meisten Stunden" items={payload?.top_months_hours_high} topN={limit} />
            <Card title="Monate mit den wenigsten Stunden" items={payload?.top_months_hours_low} topN={limit} />
            <Card title="Monate mit dem meisten Urlaub" items={payload?.top_months_leave_high} topN={limit} />
            <Card title="Monate mit dem wenigsten Urlaub" items={payload?.top_months_leave_low} topN={limit} />
          </div>
        )}
      </Panel>
    </div>
  );
}
