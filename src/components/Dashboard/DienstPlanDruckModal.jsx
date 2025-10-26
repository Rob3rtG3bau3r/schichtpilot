// src/components/Dashboard/DienstPlanDruckModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import { X, Calendar, Printer } from 'lucide-react';

const MONATE = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];

const PrintStyles = () => (
  <style>{`
    @media print {
      .no-print { display: none !important; }
      .print-area { display: block !important; }
      html, body { background: white !important; }
      @page { size: A4 landscape; margin: 10mm; }
      table { page-break-inside: avoid; }
    }
  `}</style>
);

export default function DienstPlanDruckModal({
  onClose,
  defaultYear,
  defaultMonthIndex = dayjs().month()
}) {
  const { userId, sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [tab, setTab] = useState('month'); // 'month' | 'year'
  const [year, setYear] = useState(defaultYear || dayjs().year());
  const [monthIndexes, setMonthIndexes] = useState([defaultMonthIndex]); // multiple for month-print
  const [selectAllMonths, setSelectAllMonths] = useState(false);

  const [eintraegeByMonth, setEintraegeByMonth] = useState({}); // { 'YYYY-MM': [{datum, kuerzel, farbe_bg, farbe_text, von, bis}] }
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  // --- Helpers ---------------------------------------
  const ymKey = (d) => dayjs(d).format('YYYY-MM');

  const toggleMonth = (idx) => {
    if (selectAllMonths) return; // locked when "all"
    setMonthIndexes((prev) =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a,b)=>a-b)
    );
  };

  useEffect(() => {
    if (!userId) return;
    // Nutzername laden (optional)
    (async () => {
      try {
        const { data, error } = await supabase
          .from('DB_User')
          .select('name')
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && data?.name) setUserName(data.name);
      } catch (_) {}
    })();
  }, [userId]);

  // Monate berechnen, die wir laden wollen
  const monthsToLoad = useMemo(() => {
    if (tab === 'year' || selectAllMonths) return [...Array(12).keys()]; // 0..11
    return monthIndexes.length ? monthIndexes : [dayjs().month()];
  }, [tab, selectAllMonths, monthIndexes]);

  // Daten laden: für alle angehakten Monate (oder alle 12 bei "Jahr" oder "Alle Monate")
  useEffect(() => {
    if (!userId || !firma || !unit || !year) return;
    (async () => {
      try {
        setLoading(true);
        const result = {};
        // Wir holen alle angeforderten Monate nacheinander (simpel & robust)
        for (const m of monthsToLoad) {
          const von = dayjs().year(year).month(m).startOf('month').format('YYYY-MM-DD');
          const bis = dayjs().year(year).month(m).endOf('month').format('YYYY-MM-DD');

          const { data: viewRows, error: vErr } = await supabase
            .from('v_tagesplan')
            .select('datum, ist_schichtart_id, ist_startzeit, ist_endzeit')
            .eq('user_id', userId)
            .eq('firma_id', Number(firma))
            .eq('unit_id', Number(unit))
            .gte('datum', von)
            .lte('datum', bis)
            .order('datum', { ascending: true });

          if (vErr) throw vErr;

          const schichtIds = Array.from(
            new Set((viewRows || []).map(r => r.ist_schichtart_id).filter(Boolean))
          );

          let artMap = new Map();
          if (schichtIds.length) {
            const { data: arts, error: aErr } = await supabase
              .from('DB_SchichtArt')
              .select('id, kuerzel, farbe_bg, farbe_text')
              .eq('firma_id', Number(firma))
              .eq('unit_id', Number(unit))
              .in('id', schichtIds);
            if (aErr) throw aErr;
            artMap = new Map((arts || []).map(a => [a.id, a]));
          }

          const rows = (viewRows || []).map(r => {
            const art = r.ist_schichtart_id ? artMap.get(r.ist_schichtart_id) : null;
            return {
              datum: r.datum,
              kuerzel: art?.kuerzel || '-',
              farbe_bg: art?.farbe_bg || '#999',
              farbe_text: art?.farbe_text || '#fff',
              von: r.ist_startzeit || null,
              bis: r.ist_endzeit || null,
            };
          });

          result[`${year}-${String(m+1).padStart(2,'0')}`] = rows;
        }

        setEintraegeByMonth(result);
      } catch (e) {
        console.error('Druckdaten Fehler:', e?.message || e);
        setEintraegeByMonth({});
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, firma, unit, year, monthsToLoad]);

  const handlePrint = () => window.print();

  // --- Render Abschnitte -----------------------------

  const Controls = (
    <div className="no-print">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          <span className="font-semibold">Dienstplan drucken</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Schließen"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          className={`px-3 py-1 rounded ${tab === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
          onClick={() => setTab('month')}
        >Monat</button>
 <button
   className={`px-3 py-1 rounded ${tab === 'year' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
   onClick={() => { setTab('year'); /* nichts vorauswählen */ }}
 >Jahr</button>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm mb-1">Jahr</label>
          <select
            value={year}
            onChange={(e)=>setYear(parseInt(e.target.value,10))}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1"
          >
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {tab === 'month' && (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm mb-1">Monate</label>
              <div className="flex flex-wrap gap-2">
            {MONATE.map((m, idx) => (
              <button
                type="button"
                key={m}
                className={`px-2 py-1 rounded border
                  ${monthIndexes.includes(idx) ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-200 dark:bg-gray-700'}
                  ${selectAllMonths ? 'opacity-50 pointer-events-none' : ''}`}
                onClick={()=>toggleMonth(idx)}
                aria-disabled={selectAllMonths}
               title={selectAllMonths ? 'Alle Monate aktiv' : m}
              >
                {m.slice(0,3)}
              </button>
            ))}
            <label className="flex items-center gap-2 ml-2">
              <input
                type="checkbox"
                checked={selectAllMonths}
                onChange={(e)=>{ setSelectAllMonths(e.target.checked); if (e.target.checked) setMonthIndexes([]); }}
              />
              Alle Monate
            </label>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm opacity-80">
          {tab === 'month'
            ? (selectAllMonths ? 'Druck: Alle Monate des Jahres' : `Druck: ${monthIndexes.map(i=>MONATE[i]).join(', ') || '–'}`)
            : `Druck: Jahresübersicht ${year}`}
        </div>
        <button
          onClick={handlePrint}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
        >
          <Printer className="w-4 h-4" />
          Drucken
        </button>
      </div>
    </div>
  );

  // Monatsdruck – nutzt eine Tabelle je Monat, ähnlich deiner MeineDienste-Tabelle (ohne Tooltip/Icons)
  const MonthPrint = (
    <div className="space-y-6">
      {monthsToLoad.map((m) => {
        const key = `${year}-${String(m+1).padStart(2,'0')}`;
        const rows = eintraegeByMonth[key] || [];
        const daysInMonth = dayjs().year(year).month(m).daysInMonth();

        // Map: datum -> row (für schnelle Zuordnung)
        const byDate = new Map(rows.map(r => [r.datum, r]));

        const list = [];
        for (let d=1; d<=daysInMonth; d++){
          const ds = dayjs().year(year).month(m).date(d).format('YYYY-MM-DD');
          const row = byDate.get(ds);
          list.push({
            datum: ds,
            kuerzel: row?.kuerzel || '-',
            von: row?.von || null,
            bis: row?.bis || null,
          });
        }

        return (
          <div key={key} className="print-area">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold">{MONATE[m]} {year}</div>
              <div className="text-sm opacity-70">{userName ? `Mitarbeiter: ${userName}` : ''}</div>
            </div>
            <table className="w-full text-sm border border-gray-300 dark:border-gray-700">
              <thead className="bg-gray-200 dark:bg-gray-700 text-left">
                <tr>
                  <th className="px-2 py-1 w-[120px]">Datum</th>
                  <th className="px-2 py-1 w-[70px]">Kürzel</th>
                  <th className="px-2 py-1 w-[70px]">von</th>
                  <th className="px-2 py-1 w-[70px]">bis</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.datum} className="border-t border-gray-300 dark:border-gray-700">
                    <td className="px-2 py-1">{dayjs(r.datum).format('dd, DD.MM.YYYY')}</td>
                    <td className="px-2 py-1 font-semibold">{r.kuerzel}</td>
                    <td className="px-2 py-1">{r.von ? r.von.slice(0,5) : '–'}</td>
                    <td className="px-2 py-1">{r.bis ? r.bis.slice(0,5) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );

  // Jahresdruck – kompakte Matrix 12 x 31 (ohne Zeiten)
  const YearPrint = (
    <div className="print-area">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-lg font-bold">{userName || 'Mitarbeiter'}</div>
        <div className="text-lg font-bold">{year}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border border-gray-300 dark:border-gray-700">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="px-2 py-1 text-left w-[110px]">Monat</th>
              {Array.from({length:31},(_,i)=>i+1).map(d => (
                <th key={d} className="px-1 py-1 text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({length:12},(_,m)=>m).map((m) => {
              const key = `${year}-${String(m+1).padStart(2,'0')}`;
              const rows = eintraegeByMonth[key] || [];
              const byDate = new Map(rows.map(r => [r.datum, r]));
              const dim = dayjs().year(year).month(m).daysInMonth();
              return (
                <tr key={key} className="border-t border-gray-300 dark:border-gray-700">
                  <td className="px-2 py-1 font-medium">{MONATE[m]}</td>
                  {Array.from({length:31},(_,i)=>i+1).map(d => {
                    if (d > dim) {
                      return <td key={d} className="px-1 py-1 text-center text-gray-400">–</td>;
                    }
                    const ds = dayjs().year(year).month(m).date(d).format('YYYY-MM-DD');
                    const r = byDate.get(ds);
                    const code = r?.kuerzel || '-';
                    return (
                      <td key={d} className="px-1 py-1 text-center font-semibold">
                        {code}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-xs opacity-70">
        Hinweis: Jahresübersicht zeigt nur **Kürzel** (ohne Zeiten).
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl w-[95%] max-w-6xl max-h-[90vh] overflow-auto p-4">
        <PrintStyles />
        {Controls}
        {loading ? (
          <div className="py-16 text-center opacity-70">Lade Daten…</div>
        ) : (
          <>
            {tab === 'month' ? MonthPrint : YearPrint}
          </>
        )}
      </div>
    </div>
  );
}
