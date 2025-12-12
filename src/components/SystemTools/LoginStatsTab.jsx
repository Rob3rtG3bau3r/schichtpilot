// src/components/SystemTools/LoginStatsTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

/* ----------------------- Custom Tooltip fürs Chart ----------------------- */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs shadow-2xl">
      <div className="font-semibold text-gray-100 mb-2">{label}</div>
      <div className="space-y-1">
        {payload
          .filter((p) => p.value && Number(p.value) !== 0)
          .map((p) => (
            <div key={p.dataKey} className="flex justify-between gap-6">
              <span className="text-gray-300">{p.dataKey}</span>
              <span className="font-semibold text-gray-100">{p.value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

export default function LoginStatsTab() {
  const [firmen, setFirmen] = useState([]);
  const [units, setUnits] = useState([]);

  const [firmaId, setFirmaId] = useState(''); // '' = alle
  const [unitId, setUnitId] = useState('');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /* ------------------------------- Loader ------------------------------- */
  const loadFirmen = async () => {
    const { data, error } = await supabase
      .from('DB_Kunden')
      .select('id, firmenname')
      .order('firmenname', { ascending: true });

    if (error) throw error;
    setFirmen(data || []);
  };

  const loadUnits = async (firma) => {
    let q = supabase
      .from('DB_Unit')
      .select('id, unitname, firma')
      .order('unitname', { ascending: true });

    if (firma) q = q.eq('firma', firma);

    const { data, error } = await q;
    if (error) throw error;
    setUnits(data || []);
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      let q = supabase
        .from('v_login_stats_30d')
        .select(`
          firma_id, firmenname,
          unit_id, unitname,
          count_logins_30d,
          admin_dev, planer, team_leader, employee,
          c_06_08, c_08_12, c_12_16, c_16_22, c_22_06
        `)
        .order('count_logins_30d', { ascending: false });

      if (firmaId) q = q.eq('firma_id', Number(firmaId));
      if (unitId) q = q.eq('unit_id', Number(unitId));

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      setErrorMsg(e.message || 'Fehler beim Laden der Login-Statistiken');
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------ Effects ------------------------------ */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadFirmen();
        await loadUnits('');
        await loadStats();
      } catch (e) {
        setErrorMsg(e.message || 'Fehler beim Initialisieren');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setUnitId('');
        await loadUnits(firmaId ? Number(firmaId) : '');
      } catch (e) {
        setErrorMsg(e.message || 'Fehler beim Laden der Units');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmaId]);

  /* ------------------------------ Memos ------------------------------ */
  const total = useMemo(() => {
    return rows.reduce((sum, r) => sum + Number(r.count_logins_30d || 0), 0);
  }, [rows]);

  const chartData = useMemo(() => {
    return rows.map((r) => {
      const firmaText = r.firmenname || (r.firma_id ? `#${r.firma_id}` : '—');
      const unitText = r.unitname || (r.unit_id ? `#${r.unit_id}` : '—');

      return {
        label: `${firmaText} • ${unitText}`, // Tooltip zeigt Firma + Unit
        unitShort: unitText, // X-Achse (kurz)

        '06–07:59': Number(r.c_06_08 || 0),
        '08–11:59': Number(r.c_08_12 || 0),
        '12–15:59': Number(r.c_12_16 || 0),
        '16–21:59': Number(r.c_16_22 || 0),
        '22–05:59': Number(r.c_22_06 || 0),
      };
    });
  }, [rows]);

  // 🔑 Trick gegen "auseinandergezogene Balken":
  // wir geben dem Chart eine Innenbreite abhängig von der Anzahl Einträge
  const chartWidth = useMemo(() => {
    // pro Eintrag ~90px, mindestens 700px
    return Math.max(700, chartData.length * 90);
  }, [chartData.length]);

  /* ------------------------------- UI ------------------------------- */
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold">Login-Statistiken (letzte 30 Tage)</h2>
          <p className="text-xs text-gray-400 mt-1">
            Summe (aktuelle Auswahl): <b className="text-gray-200">{total}</b> Logins
          </p>
        </div>

        <button
          onClick={loadStats}
          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
          disabled={loading}
        >
          Aktualisieren
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300">Firma:</span>
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Alle</option>
            {firmen.map((f) => (
              <option key={f.id} value={String(f.id)}>
                {f.firmenname || `#${f.id}`}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-300">Unit:</span>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Alle</option>
            {units.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.unitname || `#${u.id}`}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setFirmaId('');
            setUnitId('');
          }}
          className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm"
          disabled={loading}
        >
          Filter zurücksetzen
        </button>

        <button
          onClick={loadStats}
          className="px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm"
          disabled={loading}
        >
          Anwenden
        </button>
      </div>

      {errorMsg && <div className="mb-3 text-red-400 text-sm">{errorMsg}</div>}
      {loading && <div className="mb-3 text-sm text-gray-300">Laden…</div>}

      {/* ---------------------------- CHART (scrollbar) ---------------------------- */}
      <div className="rounded-xl border border-gray-800 bg-gray-950 mb-4 p-2 overflow-x-auto">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-400 p-3">Keine Daten für das Chart.</div>
        ) : (
          <div style={{ width: chartWidth }} className="h-[240px]">
            <BarChart
              width={chartWidth}
              height={240}
              data={chartData}
              margin={{ top: 10, right: 20, left: 10, bottom: 30 }}
              barCategoryGap={12}
              barGap={0}
            >
              <XAxis
                dataKey="unitShort"
                interval={0}
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis />

              <Tooltip
                content={<ChartTooltip />}
                labelFormatter={(v, p) => p?.[0]?.payload?.label || v}
              />
              <Legend />

              {/* gestapelte Zeitfenster (maxBarSize verhindert "fette Balken") */}
                <Bar dataKey="06–07:59" stackId="a" fill="#cfd8e7ff" maxBarSize={28} />
                <Bar dataKey="08–11:59" stackId="a" fill="#9daabaff" maxBarSize={28} />
                <Bar dataKey="12–15:59" stackId="a" fill="#858b93ff" maxBarSize={28} />
                <Bar dataKey="16–21:59" stackId="a" fill="#74777eff" maxBarSize={28} />
                <Bar dataKey="22–05:59" stackId="a" fill="#737d8aff" maxBarSize={28} />
            </BarChart>
          </div>
        )}
      </div>

      {/* ---------------------------- TABLE ---------------------------- */}
      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Firma</th>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-right">Logins</th>

              <th className="px-3 py-2 text-right">Admin_Dev</th>
              <th className="px-3 py-2 text-right">Planer</th>
              <th className="px-3 py-2 text-right">Team_Leader</th>
              <th className="px-3 py-2 text-right">Employee</th>

              <th className="px-3 py-2 text-right">06–07:59</th>
              <th className="px-3 py-2 text-right">08–11:59</th>
              <th className="px-3 py-2 text-right">12–15:59</th>
              <th className="px-3 py-2 text-right">16–21:59</th>
              <th className="px-3 py-2 text-right">22–05:59</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800/40">
            {rows.map((r, idx) => (
              <tr key={`${r.firma_id}-${r.unit_id}-${idx}`} className="odd:bg-gray-900 even:bg-gray-800">
                <td className="px-3 py-2">
                  {r.firmenname || (r.firma_id ? `#${r.firma_id}` : '—')}
                </td>
                <td className="px-3 py-2">
                  {r.unitname || (r.unit_id ? `#${r.unit_id}` : '—')}
                </td>

                <td className="px-3 py-2 text-right font-semibold">{Number(r.count_logins_30d || 0)}</td>

                <td className="px-3 py-2 text-right">{Number(r.admin_dev || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.planer || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.team_leader || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.employee || 0)}</td>

                <td className="px-3 py-2 text-right">{Number(r.c_06_08 || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.c_08_12 || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.c_12_16 || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.c_16_22 || 0)}</td>
                <td className="px-3 py-2 text-right">{Number(r.c_22_06 || 0)}</td>
              </tr>
            ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-gray-400">
                  Keine Daten für die aktuelle Auswahl.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-gray-500 mt-3">
        Hinweis: Zeitfenster basieren auf <code>Europe/Berlin</code>. Rollen kommen aus <code>DB_User.rolle</code>.
      </div>
    </div>
  );
}
