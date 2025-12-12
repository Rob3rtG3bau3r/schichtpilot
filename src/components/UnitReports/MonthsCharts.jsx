// src/components/UnitReports/MonthsCharts.jsx
import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell,
} from 'recharts';

import { MONTHS } from './unitReportsShared';

const Card = ({ className='', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-400 dark:border-bg-gray-200 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);
const Muted = ({ className='', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);

export default function MonthsCharts({ monthRow, monthTopKuerzel, colorFor, monthK, monthKO }) {
  return (
    <>
      {/* Ist vs Soll */}
      <Card>
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Ist vs. Soll (Monat)</div>
            <Muted>{monthRow ? MONTHS[monthRow.monat - 1] : '–'}</Muted>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[{
                  name: 'Monat',
                  Ist: Number(monthRow?.ist_stunden_sum || 0),
                  Soll: Number(monthRow?.soll_stunden_sum || 0),
                }]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v)=> new Intl.NumberFormat('de-DE',{ minimumFractionDigits:2, maximumFractionDigits:2 }).format(v)} />
                <Tooltip
                  formatter={(value, name) => [
                    new Intl.NumberFormat('de-DE',{ minimumFractionDigits:2, maximumFractionDigits:2 }).format(value),
                    name
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

      {/* Top-10 Kürzel */}
      <Card>
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Top-10 Kürzel (h) im Monat</div>
            <Muted>{monthRow ? MONTHS[monthRow.monat - 1] : '–'}</Muted>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthTopKuerzel.map((r,i)=>({ name: r.k, h: r.v, fill: colorFor(r.k,i) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="h" name="Stunden">
                  {monthTopKuerzel.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colorFor(entry.k, index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>

      {/* Kurzfristigkeit (Monat) */}
      <Card>
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Kurzfristigkeit (Monat)</div>
            <Muted>{monthRow ? MONTHS[monthRow.monat - 1] : '–'}</Muted>
          </div>

          <div className="h-56">
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

      {/* Krank K/KO */}
      <Card>
        <div className="px-3 pt-2 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Krank (K & KO) Stunden im Monat</div>
            <Muted>{monthRow ? MONTHS[monthRow.monat - 1] : '–'}</Muted>
          </div>

          <div className="h-56">
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
    </>
  );
}
