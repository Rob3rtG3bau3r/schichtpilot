// src/components/UnitReports/YearCharts.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell,
} from 'recharts';
import { deNumber } from './unitReportsShared';

const Card = ({ className='', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);
const Muted = ({ className='', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);

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
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
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
    const arr = value.includes(k) ? value.filter(v=>v!==k) : [...value, k];
    onChange(arr.slice(0,3));
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
            {filtered.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">Keine Treffer</div>}
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
  return (
    <>
      {/* 1) Monats-Differenz */}
      {chartVis.monthlyDiff && (
        <Card>
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Monats-Differenz (Ist − Soll)</div>
              <Muted>h</Muted>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDiffSeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip formatter={(value)=>[
                    new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value),
                    'Differenz (h)'
                  ]} />
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

      {/* 2) Urlaubstage */}
      {chartVis.urlaubMonat && (
        <Card>
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Urlaubstage je Monat</div>
              <Muted>Tage</Muted>
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Kumulierte Stunden (Ist inkl. Übernahme & Soll)</div>
              <Muted>h</Muted>
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Planänderungen je Monat</div>
              <Muted>Count</Muted>
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Kurzfristigkeit je Monat (exklusiv)</div>
              <Muted>Count</Muted>
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Planerfüllungsquote je Monat</div>
              <Muted>%</Muted>
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Kürzel (Stunden) je Monat</div>
              <KuerzelPicker
                available={availableKuerzel}
                value={customKuerzel}
                onChange={setCustomKuerzel}
                colorFor={colorFor}
              />
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Krank (K & KO) in Stunden je Monat</div>
              <Muted>h</Muted>
            </div>
            <div className="h-56">
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
          <div className="px-3 pt-2 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="font-medium">Lange Dienste je Monat (Anzahl)</div>
              <Muted>Count</Muted>
            </div>
            <div className="h-56">
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
    </>
  );
}
