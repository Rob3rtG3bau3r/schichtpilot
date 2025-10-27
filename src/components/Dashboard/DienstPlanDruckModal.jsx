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

export default function DienstPlanDruckModal({
  onClose,
  defaultYear,
  defaultMonthIndex = dayjs().month()
}) {
  const { userId, sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [tab, setTab] = useState('month'); // 'month' | 'year'
  const [year, setYear] = useState(defaultYear || dayjs().year());
  const [monthIndexes, setMonthIndexes] = useState([defaultMonthIndex]); // Mehrfachauswahl
  const [selectAllMonths, setSelectAllMonths] = useState(false);

  const [eintraegeByMonth, setEintraegeByMonth] = useState({}); // { 'YYYY-MM': [{datum, kuerzel, von, bis}] }
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');

  // Monate, die wir anzeigen/drucken
  const monthsToLoad = useMemo(() => {
    if (tab === 'year' || selectAllMonths) return [...Array(12).keys()]; // 0..11
    return monthIndexes.length ? monthIndexes : [dayjs().month()];
  }, [tab, selectAllMonths, monthIndexes]);

  // Name aus DB_User (vorname + nachname), Fallback Auth-E-Mail
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const authEmail = authData?.user?.email || '';
        const { data, error } = await supabase
          .from('DB_User')
          .select('vorname, nachname')
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && data) {
          const full = [data.vorname, data.nachname].filter(Boolean).join(' ').trim();
          setUserName(full || authEmail || '');
        } else {
          setUserName(authEmail || '');
        }
      } catch {/* ignore */}
    })();
  }, [userId]);

  // Daten laden
  useEffect(() => {
    if (!userId || !firma || !unit || !year) return;
    (async () => {
      try {
        setLoading(true);
        const result = {};
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

          const schichtIds = Array.from(new Set((viewRows || []).map(r => r.ist_schichtart_id).filter(Boolean)));
          let artMap = new Map();
          if (schichtIds.length) {
            const { data: arts, error: aErr } = await supabase
              .from('DB_SchichtArt')
              .select('id, kuerzel')
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

  // UI-Helper
  const toggleMonth = (idx) => {
    if (selectAllMonths) return;
    setMonthIndexes(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx].sort((a,b)=>a-b)
    );
  };

  // ---------- DRUCK: in unsichtbares IFRAME (keine Duplikate, kein Modal-Müll) ----------
  const buildMonthHTML = () => {
    const style = `
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; }
        .month { page-break-after: always; }
        .month:last-child { page-break-after: auto; }
        .head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; font-size:12px; }
        .head .title { font-weight:700; font-size:14px; }
        table { width:100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 2px 4px; font-size: 11px; line-height: 1.15; }
        thead th { background:#e5e7eb; text-align:left; }
        th.w1 { width:118px; } th.w2 { width:64px; } th.w3 { width:64px; } th.w4 { width:64px; }
      </style>
    `;

    const sections = monthsToLoad.map((m) => {
      const key = `${year}-${String(m+1).padStart(2,'0')}`;
      const rows = eintraegeByMonth[key] || [];
      const daysInMonth = dayjs().year(year).month(m).daysInMonth();

      const byDate = new Map(rows.map(r => [r.datum, r]));
      const list = [];
      for (let d=1; d<=daysInMonth; d++) {
        const ds = dayjs().year(year).month(m).date(d).format('YYYY-MM-DD');
        const row = byDate.get(ds);
        list.push({
          datum: ds,
          kuerzel: row?.kuerzel || '-',
          von: row?.von ? row.von.slice(0,5) : '–',
          bis: row?.bis ? row.bis.slice(0,5) : '–',
        });
      }

      const bodyRows = list.map(r => `
        <tr>
          <td>${dayjs(r.datum).format('dd, DD.MM.YYYY')}</td>
          <td style="font-weight:600">${r.kuerzel}</td>
          <td>${r.von}</td>
          <td>${r.bis}</td>
        </tr>
      `).join('');

      return `
        <section class="month">
          <div class="head">
            <div class="title">${MONATE[m]} ${year}</div>
            <div>${userName ? `Mitarbeiter: ${userName}` : ''}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th class="w1">Datum</th>
                <th class="w2">Kürzel</th>
                <th class="w3">von</th>
                <th class="w4">bis</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </section>
      `;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8" />${style}</head><body>${sections}</body></html>`;
  };

  const buildYearHTML = () => {
    const style = `
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        * { box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; }
        .head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; }
        .head .l, .head .r { font-weight:700; font-size:16px; }
        table { width:100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 2px 4px; font-size: 11px; line-height: 1.1; }
        thead th { background:#e5e7eb; }
        td.x { color:#9ca3af; text-align:center; }
        td.c { text-align:center; font-weight:600; }
        th.month { text-align:left; width:110px; }
      </style>
    `;
    const headerDays = Array.from({length:31},(_,i)=>`<th>${i+1}</th>`).join('');
    const body = Array.from({length:12},(_,m)=> {
      const key = `${year}-${String(m+1).padStart(2,'0')}`;
      const rows = eintraegeByMonth[key] || [];
      const byDate = new Map(rows.map(r => [r.datum, r]));
      const dim = dayjs().year(year).month(m).daysInMonth();
      const cells = Array.from({length:31},(_,i)=> {
        const d = i+1;
        if (d > dim) return `<td class="x">–</td>`;
        const ds = dayjs().year(year).month(m).date(d).format('YYYY-MM-DD');
        const code = byDate.get(ds)?.kuerzel || '-';
        return `<td class="c">${code}</td>`;
      }).join('');
      return `<tr><td class="month">${MONATE[m]}</td>${cells}</tr>`;
    }).join('');

    return `
      <!DOCTYPE html><html><head><meta charset="utf-8" />${style}</head>
      <body>
        <div class="head"><div class="l">${userName || 'Mitarbeiter'}</div><div class="r">${year}</div></div>
        <table>
          <thead><tr><th class="month">Monat</th>${headerDays}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body></html>
    `;
  };

  const printViaIframe = (html) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        document.body.removeChild(iframe);
      }, 50);
    };
  };

  const handlePrint = () => {
    const html = tab === 'year' ? buildYearHTML() : buildMonthHTML();
    printViaIframe(html);
  };

  // ---------------- UI ----------------
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-xl shadow-2xl w-[95%] max-w-6xl max-h-[90vh] overflow-auto p-4">
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
            onClick={() => setTab('year')}
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
          )}
        </div>

        <div className="flex items-center justify-between mb-1">
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

        {/* kleine Vorschau-Info */}
        <div className="mt-3 text-sm opacity-70">
          {tab === 'year'
            ? 'Jahresübersicht: 1 Seite quer, nur Kürzel.'
            : 'Monatsdruck: jeder ausgewählte Monat auf 1 Seite (hochkant).'}
        </div>
      </div>
    </div>
  );
}
