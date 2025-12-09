// src/components/UserReport/UserReportPersonalliste.jsx
import React from 'react';
import { ArrowUpDown } from 'lucide-react';

const fmt = (v, digits = 2) =>
  v == null ? '—' : Number(v).toFixed(digits).replace('.', ',');

const Th = ({ label, sortKey, current, dir, onClick, alignRight = false }) => {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onClick(sortKey)}
      className={`px-2 py-1 ${
        alignRight ? 'text-right' : 'text-left'
      } text-[11px] font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`}
        />
        {active && (
          <span className="text-[9px] uppercase text-gray-400 dark:text-gray-500">
            {dir === 'asc' ? 'auf' : 'ab'}
          </span>
        )}
      </span>
    </th>
  );
};

const UserReportPersonalliste = ({
  loading,
  stats,
  selectedUserId,
  setSelectedUserId,
  sortKey,
  sortDir,
  toggleSort,
}) => {
  // 🔹 Nur Mitarbeiter mit Schichtgruppe anzeigen
  const visibleStats = stats.filter((u) => !!u.schichtgruppe);

  return (
    <div className="xl:col-span-2 rounded-2xl border border-gray-300/70 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm flex flex-col">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Übersicht nach Mitarbeiter
        </h2>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          Klick auf eine Zeile für Details
        </span>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-50 dark:bg-gray-800/70 sticky top-0 z-10">
            <tr>
              <Th
                label="Mitarbeiter"
                sortKey="name"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <Th
                label="Gruppe"
                sortKey="gruppe"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
              />
              <Th
                label="Stunden"
                sortKey="stunden"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="Urlaub"
                sortKey="urlaub"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="Nacht Std."
                sortKey="nacht_std"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="So Std."
                sortKey="sonntag"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="Feiertag Std."
                sortKey="feiertag"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="Krank ges."
                sortKey="krank"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="Plan %"
                sortKey="planQuote"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
              <Th
                label="Kurzfristigkeit"
                sortKey="kurzfrist"
                current={sortKey}
                dir={sortDir}
                onClick={toggleSort}
                alignRight
              />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
                >
                  Daten werden geladen …
                </td>
              </tr>
            ) : visibleStats.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
                >
                  Keine Daten im ausgewählten Zeitraum.
                </td>
              </tr>
            ) : (
              visibleStats.map((u) => {
                const name = `${u.nachname || ''} ${u.vorname || ''}`.trim();
                const selected = selectedUserId === u.userId;

                return (
                  <tr
                    key={u.userId}
                    onClick={() =>
                      setSelectedUserId(selected ? null : u.userId)
                    }
                    className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/60 ${
                      selected
                        ? 'bg-indigo-50/80 dark:bg-indigo-900/40'
                        : ''
                    }`}
                  >
                    {/* Mitarbeiter */}
                    <td className="px-2 py-1 whitespace-nowrap text-[11px]">
                      {name || '—'}
                    </td>

                    {/* Gruppe */}
                    <td className="px-2 py-1 whitespace-nowrap text-[11px] text-gray-600 dark:text-gray-300">
                      {u.schichtgruppe || '—'}
                    </td>

                    {/* Stunden / Urlaub */}
                    <td className="px-2 py-1 text-right">
                      {u.stundenText || fmt(u.stundenIst)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {u.urlaubText || fmt(u.urlaubIst)}
                    </td>

                    {/* Nacht / So / Feiertag Std. */}
                    <td className="px-2 py-1 text-right">{fmt(u.hN)}</td>
                    <td className="px-2 py-1 text-right">
                      {fmt(u.sumSonntag)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {fmt(u.sumFeiertag)}
                    </td>

                    {/* Krank gesamt */}
                    <td className="px-2 py-1 text-center">
                      {u.krankGesamt || 0}
                    </td>

                    {/* Planerfüllung */}
                    <td className="px-2 py-1 text-right">
                      {u.planQuote == null
                        ? '—'
                        : `${fmt(u.planQuote, 1)} %`}
                    </td>

                    {/* Kurzfristigkeit gesamt */}
                    <td className="px-2 py-1 text-center">
                      {u.kurzfristTotal || 0}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserReportPersonalliste;
