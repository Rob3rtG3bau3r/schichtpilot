// src/components/UnitUserStundenPflege/UeberstundenTab.jsx
import React from 'react';

export default function UeberstundenTab({
  rows,
  selectedIds,
  setAllVisibleSelectedUsers,
  toggleSelected,
  fmt,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-0 overflow-hidden">
      <div className="overflow-auto">
        <table className="min-w-[1200px] w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900/40">
            <tr className="text-left text-xs text-gray-600 dark:text-gray-300">
              <th className="p-2 w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.userId))}
                  onChange={(e) => setAllVisibleSelectedUsers(e.target.checked)}
                />
              </th>
              <th className="p-2">Name</th>
              <th className="p-2 text-right">Vorgabe</th>
              <th className="p-2 text-right">Übernahme Vorjahr</th>
              <th className="p-2 text-right">Ist gesamt</th>
              <th className="p-2 text-right">stunden_gesamt</th>
              <th className="p-2 text-right">Diff</th>
              <th className="p-2 text-right">Abzug</th>
              <th className="p-2 text-right">Rest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const positive = r.diff > 0;
              return (
                <tr key={r.userId} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.userId)}
                      onChange={() => toggleSelected(r.userId)}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-semibold text-gray-900 dark:text-gray-100">{r.name}</div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {r.hasRow ? 'Stunden-Datensatz vorhanden' : 'Kein Datensatz in DB_Stunden (Jahr)'}
                    </div>
                  </td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.vorgabe)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.uebernahme)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.ist)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.konto)}</td>
                  <td className={`p-2 text-right tabular-nums font-semibold ${positive ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>
                    {fmt(r.diff)}
                  </td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.abzug)}</td>
                  <td className="p-2 text-right tabular-nums font-semibold">{fmt(r.rest)}</td>
                </tr>
              );
            })}

            {!rows.length && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-gray-600 dark:text-gray-300">
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
