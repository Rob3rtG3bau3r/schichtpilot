// src/components/UnitReports/MonthsCharts.jsx
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell,
  PieChart, Pie,
} from 'recharts';

import { MONTHS, deNumber } from './unitReportsShared';

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

const SmallToggle = ({ value, onChange }) => (
  <div className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
    <button
      type="button"
      onClick={() => onChange('gauge')}
      className={`px-2 py-1 text-xs ${value === 'gauge' ? 'bg-gray-300/60 dark:bg-gray-700' : 'hover:bg-white/10'}`}
      title="Gauge"
    >
      Gauge
    </button>
    <button
      type="button"
      onClick={() => onChange('bullet')}
      className={`px-2 py-1 text-xs ${value === 'bullet' ? 'bg-gray-300/60 dark:bg-gray-700' : 'hover:bg-white/10'}`}
      title="Bullet"
    >
      Bullet
    </button>
  </div>
);

const Modal = ({ open, title, subtitle, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
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

/* ---------------------- A) Gauge (Halbkreis) ---------------------- */
function IstSollGauge({ ist, soll, height = 220 }) {
  const safeSoll = Math.max(0, Number(soll ?? 0));
  const safeIst = Math.max(0, Number(ist ?? 0));

  const ratio = safeSoll > 0 ? safeIst / safeSoll : 0;
  const capped = Math.min(Math.max(ratio, 0), 1);

  const filledPct = Math.round(capped * 1000) / 10; // %
  const mainData = [
    { name: 'Ist', value: filledPct },
    { name: 'Rest', value: 100 - filledPct },
  ];

  // Überhang als dünner Außenring (visuell cap: +100%)
  const overPct = safeSoll > 0 ? Math.min(Math.max((ratio - 1) * 100, 0), 100) : 0;
  const overData = overPct > 0
    ? [{ name: 'Über', value: overPct }, { name: 'Leer', value: 100 - overPct }]
    : null;

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={mainData}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="70%"
            outerRadius="95%"
            paddingAngle={1}
            stroke="none"
          >
            <Cell fill="#10b981" />
            <Cell fill="#374151" />
          </Pie>

          {overData && (
            <Pie
              data={overData}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              innerRadius="97%"
              outerRadius="100%"
              paddingAngle={1}
              stroke="none"
            >
              <Cell fill="#ef4444" />
              <Cell fill="transparent" />
            </Pie>
          )}
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-sm text-gray-500 dark:text-gray-300">Ist / Soll</div>
        <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {safeSoll > 0 ? `${Math.round(ratio * 100)}%` : '–'}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">
          Ist {deNumber(safeIst)} h · Soll {deNumber(safeSoll)} h
        </div>
        {safeIst > safeSoll && (
          <div className="text-xs mt-1 text-red-500">
            +{deNumber(safeIst - safeSoll)} h über Soll
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------- B) Deluxe Bullet ---------------------- */
function IstSollBulletDeluxe({ ist, soll, big = false }) {
  const safeSoll = Math.max(0, Number(soll ?? 0));
  const safeIst = Math.max(0, Number(ist ?? 0));

  const pct = safeSoll > 0 ? (safeIst / safeSoll) * 100 : 0;
  const capped = Math.min(pct, 100);
  const over = Math.max(pct - 100, 0);
  const rest = Math.max(safeSoll - safeIst, 0);
  const h = big ? 34 : 26;

  return (
    <div className="px-1">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-sm text-gray-700 dark:text-gray-200">
          <span className="font-semibold">Ist:</span> {deNumber(safeIst)} h
          <span className="mx-2 text-gray-400">|</span>
          <span className="font-semibold">Soll:</span> {deNumber(safeSoll)} h
        </div>
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {safeSoll > 0 ? `${Math.round(pct)}%` : '–'}
        </div>
      </div>

      <div className="relative rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700" style={{ height: h }}>
        <div className="absolute inset-0 flex">
          <div className="w-[80%] bg-gray-300/70 dark:bg-gray-600/40" />
          <div className="w-[20%] bg-gray-300 dark:bg-gray-600/60" />
        </div>

        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${capped}%`, backgroundColor: '#10b981' }}
        />

        <div className="absolute top-[-8px] right-0 flex flex-col items-end">
          <div className="h-[calc(100%+16px)] w-[2px] bg-gray-900/60 dark:bg-gray-100/50" />
        </div>

        {safeSoll > 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[11px] font-semibold text-gray-900/80 dark:text-white/80">
              {Math.round(pct)}%
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        {safeIst <= safeSoll ? (
          <div className="text-gray-600 dark:text-gray-300">
            Rest bis Soll: <span className="font-semibold">{deNumber(rest)} h</span>
          </div>
        ) : (
          <div className="text-red-500">
            Über Soll: <span className="font-semibold">+{deNumber(safeIst - safeSoll)} h</span>
          </div>
        )}
        {over > 0 ? (
          <div className="text-red-500 font-semibold">⚠</div>
        ) : (
          <div className="text-green-500 font-semibold">✓</div>
        )}
      </div>

      {safeIst > safeSoll && safeSoll > 0 && (
        <div className="mt-2">
          <div className="text-[11px] text-gray-600 dark:text-gray-300 mb-1">
            Überhang (visuell, max +100%)
          </div>
          <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${Math.min(over, 100)}%`, backgroundColor: '#ef4444' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------- Krank als Kuchen ---------------------- */
function KrankPie({ monthK, monthKO, height = 220 }) {
  const k = Math.max(0, Number(monthK ?? 0));
  const ko = Math.max(0, Number(monthKO ?? 0));
  const total = k + ko;

  const data = [
    { name: 'K', value: k, color: '#ef4444' },
    { name: 'KO', value: ko, color: '#f59e0b' },
  ];

  return (
    <div style={{ height }} className="h-full">
      {total <= 0 ? (
        <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-300">
          Keine Krankstunden im Monat.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip formatter={(value, name) => [deNumber(value), `${name} (h)`]} />
            <Legend />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function MonthsCharts({ monthRow, monthTopKuerzel, colorFor, monthK, monthKO }) {
  const [zoom, setZoom] = useState({ open: false, key: null });

  // ✅ Toggle nur für Ist/Soll
  const [istSollMode, setIstSollMode] = useState('gauge'); // 'gauge' | 'bullet'

  const monthName = monthRow ? MONTHS[monthRow.monat - 1] : '–';
  const ist = Number(monthRow?.ist_stunden_sum || 0);
  const soll = Number(monthRow?.soll_stunden_sum || 0);

  const topData = useMemo(() => {
    const safe = Array.isArray(monthTopKuerzel) ? monthTopKuerzel : [];
    return safe.map((r, i) => ({ name: r.k, h: r.v, fill: colorFor(r.k, i) }));
  }, [monthTopKuerzel, colorFor]);

  const ChartBlock = ({ title, children, zoomKey, rightSlot = null }) => (
    <Card>
      <div className="px-3 pt-2 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">{title}</div>
          <div className="flex items-center gap-2">
            {rightSlot}
            <Muted>{monthName}</Muted>
            <IconButton title="Groß anzeigen" onClick={() => setZoom({ open: true, key: zoomKey })} />
          </div>
        </div>
        {children}
      </div>
    </Card>
  );

  return (
    <>
      {/* Ist vs Soll (Monat) – Toggle Gauge/Bullet */}
      <ChartBlock
        title="Ist vs. Soll (Monat)"
        zoomKey="ist_soll"
        rightSlot={<SmallToggle value={istSollMode} onChange={setIstSollMode} />}
      >
        {istSollMode === 'gauge' ? (
          <IstSollGauge ist={ist} soll={soll} height={220} />
        ) : (
          <IstSollBulletDeluxe ist={ist} soll={soll} />
        )}
      </ChartBlock>

      {/* Top-10 Kürzel */}
      <ChartBlock title="Top-10 Kürzel (h) im Monat" zoomKey="top10">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="h" name="Stunden">
                {topData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartBlock>

      {/* Kurzfristigkeit (Monat) */}
      <ChartBlock title="Kurzfristigkeit (Monat)" zoomKey="kurzfrist">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: '≤1 Tag', val: Number(monthRow?.kurzfrist_1d ?? 0) },
                { name: '≤3 Tage', val: Number(monthRow?.kurzfrist_3d ?? 0) },
                { name: '<7 Tage', val: Number(monthRow?.kurzfrist_7d ?? 0) },
                { name: '≥7 Tage', val: Number(monthRow?.kurzfrist_gt7d ?? 0) },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="val" name="Änderungen" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartBlock>

      {/* Krank – Kuchen */}
      <ChartBlock title="Krank (K & KO) Stunden im Monat" zoomKey="krank">
        <KrankPie monthK={monthK} monthKO={monthKO} height={220} />
      </ChartBlock>

      {/* Zoom Modal */}
      <Modal
        open={zoom.open}
        title={
          zoom.key === 'ist_soll'
            ? 'Ist vs. Soll (Monat)'
            : zoom.key === 'top10'
            ? 'Top-10 Kürzel (h) im Monat'
            : zoom.key === 'kurzfrist'
            ? 'Kurzfristigkeit (Monat)'
            : zoom.key === 'krank'
            ? 'Krank (K & KO) Stunden im Monat'
            : 'Diagramm'
        }
        subtitle={monthName}
        onClose={() => setZoom({ open: false, key: null })}
      >
        {zoom.key === 'ist_soll' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-center gap-2">
              <div className="text-sm text-gray-500 dark:text-gray-300">Ansicht:</div>
              <SmallToggle value={istSollMode} onChange={setIstSollMode} />
            </div>

            {istSollMode === 'gauge' ? (
              <IstSollGauge ist={ist} soll={soll} height={520} />
            ) : (
              <div className="max-w-3xl mx-auto">
                <IstSollBulletDeluxe ist={ist} soll={soll} big />
              </div>
            )}
          </div>
        )}

        {zoom.key === 'top10' && (
          <div className="h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="h" name="Stunden">
                  {topData.map((entry, index) => (
                    <Cell key={`cellz-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'kurzfrist' && (
          <div className="h-[520px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: '≤1 Tag', val: Number(monthRow?.kurzfrist_1d ?? 0) },
                  { name: '≤3 Tage', val: Number(monthRow?.kurzfrist_3d ?? 0) },
                  { name: '<7 Tage', val: Number(monthRow?.kurzfrist_7d ?? 0) },
                  { name: '≥7 Tage', val: Number(monthRow?.kurzfrist_gt7d ?? 0) },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="val" name="Änderungen" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {zoom.key === 'krank' && <KrankPie monthK={monthK} monthKO={monthKO} height={520} />}
      </Modal>
    </>
  );
}
