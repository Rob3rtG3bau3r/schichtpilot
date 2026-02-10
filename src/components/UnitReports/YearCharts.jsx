// src/components/UnitReports/YearCharts.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell,
} from 'recharts';
import { deNumber } from './unitReportsShared';

const Card = ({ className = '', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);
const Muted = ({ className = '', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);

const IconButton = ({ title, onClick }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white/10 text-sm"
  >
    ⤢
  </button>
);

const SmallToggle = ({ value, onChange, options }) => (
  <div className="flex items-center gap-0 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
    {options.map((opt) => (
      <button
        key={opt.key}
        type="button"
        onClick={() => onChange(opt.key)}
        className={`px-2 py-1 text-xs ${value === opt.key ? 'bg-gray-300/60 dark:bg-gray-700' : 'hover:bg-white/10'}`}
        title={opt.label}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const Modal = ({ open, title, subtitle, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{title}</div>
            {subtitle ? <div className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-white/10 text-sm"
          >
            Schließen
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
};

// ---- MiniBadge + Picker (wie bei dir, nur hier drin) -----------------------
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
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(
    () => available.filter(k => k.toLowerCase().includes(q.toLowerCase())),
    [available, q]
  );

  const selected = new Set(value);

  const toggle = (k) => {
    const arr = value.includes(k) ? value.filter(v => v !== k) : [...value, k];
    onChange(arr.slice(0, 3));
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-white/10"
      >
        Kürzel wählen ({value.length || 'Top 3'})
        <ChevronDown className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg z-20">
          <div className="p-2 border-b border-gray-200 dark:border-gray-800">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Kürzel suchen…"
              className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1 text-sm outline-none"
            />
          </div>

          <div className="max-h-60 overflow-auto py-1">
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer</div>}
            {filtered.map((k, idx) => (
              <button
                key={k}
                onClick={() => toggle(k)}
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
            <div className="flex flex-wrap gap-1 p-2 border-t border-gray-200 dark:border-gray-800">
              {value.map((k, idx) => (
                <MiniBadge key={k} onClose={() => onChange(value.filter(v => v !== k))}>
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

// ---- Helpers ---------------------------------------------------------------
const shortMonth = (label) => {
  if (!label) return label;
  const s = String(label).trim();
  return s.length <= 3 ? s : s.slice(0, 3);
};

const fmt0 = (v) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v);
const fmt2 = (v) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const pickTitle = (key) => {
  switch (key) {
    case 'monthlyDiff': return 'Monats-Differenz (Ist − Soll)';
    case 'urlaubMonat': return 'Urlaubstage je Monat';
    case 'cumBothIncl': return 'Kumulierte Stunden (Ist inkl. Übernahme & Soll)';
    case 'planChanges': return 'Planänderungen je Monat';
    case 'shortNotice': return 'Kurzfristigkeit je Monat (exklusiv)';
    case 'planerfuellung': return 'Planerfüllungsquote je Monat';
    case 'kuerzelPerMonth': return 'Kürzel (Stunden) je Monat';
    case 'krankYear': return 'Krank (K & KO) in Stunden je Monat';
    case 'langeDienste': return 'Lange Dienste je Monat (Anzahl)';
    default: return 'Diagramm';
  }
};

export default function YearCharts({
  chartVis,
  fullYearRows,
  monthlyDiffSeries,
  cumBothIncl,
  monthlyChangeSeries,
  monthlyShortNotice,
  availableKuerzel,
  customKuerzel,
  setCustomKuerzel,
  chosenKuerzel,
  kuerzelSeriesPerMonth,
  colorFor,
}) {
  // ✅ Zoom wie beim Monat
  const [zoom, setZoom] = useState({ open: false, key: null });

  // ✅ Kumuliert: Linie / Area / Tank (Rest)
  const [cumMode, setCumMode] = useState('line'); // 'line' | 'area' | 'tank'

  // ✅ Monate überall auf 3 Buchstaben kürzen
  const monthlyDiffSeriesShort = useMemo(
    () => (monthlyDiffSeries || []).map(r => ({ ...r, label: shortMonth(r.label) })),
    [monthlyDiffSeries]
  );

  const fullYearRowsShort = useMemo(
    () => (fullYearRows || []).map(r => ({ ...r, label: shortMonth(r.label) })),
    [fullYearRows]
  );

  const cumBothInclShort = useMemo(
    () => (cumBothIncl || []).map(r => ({ ...r, label: shortMonth(r.label) })),
    [cumBothIncl]
  );

  const monthlyChangeSeriesShort = useMemo(
    () => (monthlyChangeSeries || []).map(r => ({ ...r, label: shortMonth(r.label) })),
    [monthlyChangeSeries]
  );

  const monthlyShortNoticeShort = useMemo(
    () => (monthlyShortNotice || []).map(r => ({ ...r, label: shortMonth(r.label) })),
    [monthlyShortNotice]
  );

  const kuerzelSeriesPerMonthShort = useMemo(
    () => (kuerzelSeriesPerMonth || []).map(r => ({ ...r, label: shortMonth(r.label) })),
    [kuerzelSeriesPerMonth]
  );

  // ✅ Tank-Serie: Rest = kumSoll - kumIst (kann negativ werden => Überzug)
  const tankSeries = useMemo(() => {
    return (cumBothInclShort || []).map((r) => {
      const kumIst = Number(r.kumIst ?? 0);
      const kumSoll = Number(r.kumSoll ?? 0);
      const rest = kumSoll - kumIst;
      return {
        ...r,
        rest,
        restPos: rest > 0 ? rest : 0,
        restNeg: rest < 0 ? rest : 0,
      };
    });
  }, [cumBothInclShort]);

  const ChartBlock = ({ title, unit, zoomKey, rightSlot = null, children }) => (
    <Card>
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">{title}</div>
          <div className="flex items-center gap-2">
            {rightSlot}
            <Muted>{unit}</Muted>
            <IconButton title="Groß anzeigen" onClick={() => setZoom({ open: true, key: zoomKey })} />
          </div>
        </div>
        {children}
      </div>
    </Card>
  );

  const renderCumChart = (heightPx = 224) => {
    // heightPx z.B. 224 (h-56) oder 560 im Modal
    if (cumMode === 'tank') {
      return (
        <div style={{ height: heightPx }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tankSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={fmt0} />
              <Tooltip
                formatter={(v, n) => {
                  if (n === 'rest') return [fmt2(v), 'Rest (Soll − Ist)'];
                  if (n === 'kumIst') return [fmt2(v), 'Ist kumuliert'];
                  if (n === 'kumSoll') return [fmt2(v), 'Soll kumuliert'];
                  return [fmt2(v), n];
                }}
              />
              <Legend />
              {/* Rest positiv (Tank noch voll) */}
              <Area
                type="monotone"
                dataKey="restPos"
                name="Rest (Tank)"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.18}
                dot={false}
              />
              {/* Rest negativ (Überzug) */}
              <Area
                type="monotone"
                dataKey="restNeg"
                name="Überzug"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.18}
                dot={false}
              />
              {/* Referenzlinien zusätzlich (optional, aber cool): kumIst / kumSoll */}
              <Line type="monotone" dataKey="kumIst" name="Ist kumuliert" stroke="#fbbf24" dot={false} />
              <Line type="monotone" dataKey="kumSoll" name="Soll kumuliert" stroke="#60a5fa" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (cumMode === 'area') {
      return (
        <div style={{ height: heightPx }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumBothInclShort}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis tickFormatter={fmt0} />
              <Tooltip formatter={(v, n) => [fmt2(v), n]} />
              <Legend />
              <Area type="monotone" dataKey="kumSoll" name="Vorgabe kumuliert" stroke="#60a5fa" fill="#60a5fa" fillOpacity={0.15} />
              <Area type="monotone" dataKey="kumIst" name="Ist kumuliert (inkl. Übernahme)" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.18} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // line
    return (
      <div style={{ height: heightPx }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={cumBothInclShort}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={fmt0} />
            <Tooltip formatter={(v, n) => [fmt2(v), n]} />
            <Legend />
            <Line type="monotone" dataKey="kumIst" name="Ist kumuliert (inkl. Übernahme)" dot={false} stroke="#fbbf24" />
            <Line type="monotone" dataKey="kumSoll" name="Vorgabe kumuliert" dot={false} stroke="#60a5fa" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <>
      {/* 1) Monats-Differenz */}
      {chartVis.monthlyDiff && (
        <ChartBlock title="Monats-Differenz (Ist − Soll)" unit="h" zoomKey="monthlyDiff">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDiffSeriesShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => [fmt2(value), 'Differenz (h)']} />
                <Legend />
                <Bar dataKey="diff" name="Differenz (h)">
                  {monthlyDiffSeriesShort.map((e, i) => (
                    <Cell key={i} fill={e.diff < 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBlock>
      )}

      {/* 2) Urlaubstage */}
      {chartVis.urlaubMonat && (
        <ChartBlock title="Urlaubstage je Monat" unit="Tage" zoomKey="urlaubMonat">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fullYearRowsShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="urlaubstage" name="Urlaubstage" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBlock>
      )}

      {/* 3) Kumulierte Stunden (Linie / Area / Tank) */}
      {chartVis.cumBothIncl && (
        <ChartBlock
          title="Kumulierte Stunden (Ist inkl. Übernahme & Soll) / Tank"
          unit="h"
          zoomKey="cumBothIncl"
          rightSlot={
            <SmallToggle
              value={cumMode}
              onChange={setCumMode}
              options={[
                { key: 'line', label: 'Linie' },
                { key: 'area', label: 'Area' },
                { key: 'tank', label: 'Tank' },
              ]}
            />
          }
        >
          <div className="h-56">
            {renderCumChart(224)}
          </div>
        </ChartBlock>
      )}

      {/* 4) Planänderungen */}
      {chartVis.planChanges && (
        <ChartBlock title="Planänderungen je Monat" unit="Count" zoomKey="planChanges">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChangeSeriesShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Gesamt" fill="#64748b" />
                <Bar dataKey="off" name="Aus dem Rhythmus" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBlock>
      )}

      {/* 5) Kurzfristigkeit */}
      {chartVis.shortNotice && (
        <ChartBlock title="Kurzfristigkeit je Monat (exklusiv)" unit="Count" zoomKey="shortNotice">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyShortNoticeShort} barCategoryGap="20%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="le1" name="≤1 Tag" stackId="stackA" fill="#ef4444" />
                <Bar dataKey="gt1_le3" name=">1–≤3 Tage" stackId="stackA" fill="#d6a022ff" />
                <Bar dataKey="gt3_lt7" name=">3–<7 Tage" stackId="stackA" fill="#fefe00ff" />
                <Bar dataKey="ge7" name="≥7 Tage" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBlock>
      )}

      {/* 6) Planerfüllungsquote */}
      {chartVis.planerfuellung && (
        <ChartBlock title="Planerfüllungsquote je Monat" unit="%" zoomKey="planerfuellung">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChangeSeriesShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v) => [deNumber(v, 2), 'Planerfüllung %']} />
                <Legend />
                <Line type="monotone" dataKey="planQ" name="Planerfüllung (%)" dot={false} stroke="#16a34a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartBlock>
      )}

      {/* 7) Kürzel je Monat */}
      {chartVis.kuerzelPerMonth && (
        <Card>
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Kürzel (Stunden) je Monat</div>
              <div className="flex items-center gap-2">
                <KuerzelPicker
                  available={availableKuerzel}
                  value={customKuerzel}
                  onChange={setCustomKuerzel}
                  colorFor={colorFor}
                />
                <IconButton title="Groß anzeigen" onClick={() => setZoom({ open: true, key: 'kuerzelPerMonth' })} />
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kuerzelSeriesPerMonthShort}>
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
        <ChartBlock title="Krank (K & KO) in Stunden je Monat" unit="h" zoomKey="krankYear">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fullYearRowsShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="krankK" name="K (h)" fill="#ef4444" />
                <Bar dataKey="krankKO" name="KO (h)" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartBlock>
      )}

      {/* 9) Lange Dienste */}
      {chartVis.langeDienste && (
        <ChartBlock title="Lange Dienste je Monat (Anzahl)" unit="Count" zoomKey="langeDienste">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fullYearRowsShort}>
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
        </ChartBlock>
      )}

      {/* ---------------- Zoom Modal (wie Monat) ---------------- */}
      <Modal
        open={zoom.open}
        title={pickTitle(zoom.key)}
        subtitle="Jahr"
        onClose={() => setZoom({ open: false, key: null })}
      >
        {/* Kumuliert hat Toggle im Modal */}
        {zoom.key === 'cumBothIncl' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              <div className="text-sm text-gray-500 dark:text-gray-300">Ansicht:</div>
              <SmallToggle
                value={cumMode}
                onChange={setCumMode}
                options={[
                  { key: 'line', label: 'Linie' },
                  { key: 'area', label: 'Area' },
                  { key: 'tank', label: 'Tank' },
                ]}
              />
            </div>
            {renderCumChart(560)}
          </div>
        )}

        {zoom.key === 'monthlyDiff' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyDiffSeriesShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => [fmt2(value), 'Differenz (h)']} />
                <Legend />
                <Bar dataKey="diff" name="Differenz (h)">
                  {monthlyDiffSeriesShort.map((e, i) => (
                    <Cell key={i} fill={e.diff < 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'urlaubMonat' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fullYearRowsShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="urlaubstage" name="Urlaubstage" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'planChanges' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChangeSeriesShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total" name="Gesamt" fill="#64748b" />
                <Bar dataKey="off" name="Aus dem Rhythmus" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'shortNotice' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyShortNoticeShort} barCategoryGap="20%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="le1" name="≤1 Tag" stackId="stackA" fill="#ef4444" />
                <Bar dataKey="gt1_le3" name=">1–≤3 Tage" stackId="stackA" fill="#d6a022ff" />
                <Bar dataKey="gt3_lt7" name=">3–<7 Tage" stackId="stackA" fill="#fefe00ff" />
                <Bar dataKey="ge7" name="≥7 Tage" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'planerfuellung' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyChangeSeriesShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip formatter={(v) => [deNumber(v, 2), 'Planerfüllung %']} />
                <Legend />
                <Line type="monotone" dataKey="planQ" name="Planerfüllung (%)" dot={false} stroke="#16a34a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'kuerzelPerMonth' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kuerzelSeriesPerMonthShort}>
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
        )}

        {zoom.key === 'krankYear' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fullYearRowsShort}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="krankK" name="K (h)" fill="#ef4444" />
                <Bar dataKey="krankKO" name="KO (h)" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'langeDienste' && (
          <div className="h-[560px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fullYearRowsShort}>
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
        )}
      </Modal>
    </>
  );
}
