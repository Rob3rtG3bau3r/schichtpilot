// src/components/Dashboard/MeineDienste.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import { Info, ArrowLeft, Printer } from 'lucide-react';
import DienstPlanDruckModal from './DienstPlanDruckModal';

const monate = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];

const Tooltip = ({ children }) => (
  <div
    className="absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2
               w-64 px-3 py-2 rounded-xl shadow-2xl text-xs
               bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
               ring-1 ring-black/10 dark:ring-white/10"
    role="tooltip"
  >
    {children}
  </div>
);

const MeineDienste = () => {
  const { userId, sichtFirma: firma, sichtUnit: unit } = useRollen();

  // Navigation
  const [startDatum, setStartDatum] = useState(dayjs().startOf('month'));
  const [jahr, setJahr] = useState(dayjs().year());
  const aktuelleJahre = [jahr - 1, jahr, jahr + 1];

  // Daten
  const [eintraege, setEintraege] = useState([]);
  const [infoOffen, setInfoOffen] = useState(false);
  const [druckOffen, setDruckOffen] = useState(false);

  // Tooltips
  const [hoverKey, setHoverKey] = useState(null); // 'c-YYYY-MM-DD-i' | 't-YYYY-MM-DD-i' | 'd-YYYY-MM-DD-i'
  const todayStr = dayjs().format('YYYY-MM-DD');

  // Termine pro Datum
  const [termineByDate, setTermineByDate] = useState({});

  // Feiertage/Ferien pro Datum
  const [ffByDate, setFfByDate] = useState({}); // { 'YYYY-MM-DD': [{id, typ, name, farbe, von, bis}] }

  // Unit-Location
  const [unitLoc, setUnitLoc] = useState({ land: null, bundesland: null });

  const changeMonthRel = (delta) => {
    setStartDatum(prev => {
      const neu = dayjs(prev).add(delta, 'month').startOf('month');
      setJahr(neu.year());
      return neu;
    });
  };

  // Unit-Location laden (Land + Bundesland)
  useEffect(() => {
    const loadUnitLoc = async () => {
      if (!unit) return;
      const { data, error } = await supabase
        .from('DB_Unit')
        .select('land, bundesland')
        .eq('id', unit)
        .single();

      if (error) {
        console.error('❌ DB_Unit Location Fehler:', error.message || error);
        setUnitLoc({ land: null, bundesland: null });
        return;
      }
      setUnitLoc({
        land: (data?.land || null),
        bundesland: (data?.bundesland || null),
      });
    };

    loadUnitLoc();
  }, [unit]);

  // Feiertage/Ferien laden (Land + (bundesweit oder BL))
  const ladeFeiertageFerienOptional = async (von, bis) => {
    try {
      const land = (unitLoc?.land || '').trim();
      const bundesland = (unitLoc?.bundesland || '').trim();

      if (!land) {
        setFfByDate({});
        return;
      }

      const { data: rows, error } = await supabase
        .from('DB_FeiertageundFerien')
        .select('id, typ, name, von, bis, farbe, land, bundesland, ist_bundesweit')
        .eq('land', land)
        .or(`ist_bundesweit.eq.true,bundesland.eq.${bundesland}`)
        .lte('von', bis)
        .or(`bis.is.null, bis.gte.${von}`);

      if (error) {
        console.error('❌ DB_FeiertageundFerien Fehler:', error.message || error);
        setFfByDate({});
        return;
      }

      const map = {};
      const startBound = dayjs(von);
      const endBound = dayjs(bis);

      for (const r of rows || []) {
        const typ = (r.typ || '').toLowerCase();
        const color = r.farbe || (typ.includes('ferien') ? '#10b981' : '#ef4444');
        const name = r.name || '';

        const rVon = dayjs(r.von);
        const rBis = r.bis ? dayjs(r.bis) : rVon;

        let cur = rVon.isBefore(startBound, 'day') ? startBound : rVon;
        const last = rBis.isAfter(endBound, 'day') ? endBound : rBis;

        while (cur.isSame(last, 'day') || cur.isBefore(last, 'day')) {
          const ds = cur.format('YYYY-MM-DD');
          if (!map[ds]) map[ds] = [];
          map[ds].push({
            id: r.id,
            typ: r.typ,
            name,
            farbe: color,
            von: r.von,
            bis: r.bis,
            ist_bundesweit: !!r.ist_bundesweit,
            bundesland: r.bundesland || null,
          });
          cur = cur.add(1, 'day');
        }
      }

      setFfByDate(map);
    } catch (e) {
      console.warn('Feiertage/Ferien konnten nicht ermittelt werden:', e?.message || e);
      setFfByDate({});
    }
  };

  // Dienste laden (v_tagesplan + SchichtArt)
  const ladeDienste = async () => {
    if (!userId || !startDatum) return;

    const von = startDatum.startOf('month').format('YYYY-MM-DD');
    const bis = startDatum.endOf('month').format('YYYY-MM-DD');

    const { data: viewRows, error: vErr } = await supabase
      .from('v_tagesplan')
      .select('datum, ist_schichtart_id, ist_startzeit, ist_endzeit, kommentar')
      .eq('user_id', userId)
      .eq('firma_id', Number(firma))
      .eq('unit_id', Number(unit))
      .gte('datum', von)
      .lte('datum', bis)
      .order('datum', { ascending: true });

    if (vErr) {
      console.error('❌ v_tagesplan Fehler:', vErr.message || vErr);
      setEintraege([]);
    } else {
      const schichtIds = Array.from(new Set((viewRows || []).map(r => r.ist_schichtart_id).filter(Boolean)));
      let artMap = new Map();
      if (schichtIds.length) {
        const { data: arts, error: aErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, farbe_bg, farbe_text')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .in('id', schichtIds);
        if (aErr) {
          console.error('❌ DB_SchichtArt Fehler:', aErr.message || aErr);
        } else {
          artMap = new Map((arts || []).map(a => [a.id, a]));
        }
      }

      const mapped = (viewRows || []).map(r => {
        const art = r.ist_schichtart_id ? artMap.get(r.ist_schichtart_id) : null;
        return {
          datum: r.datum,
          ist_schicht: art
            ? { kuerzel: art.kuerzel, farbe_bg: art.farbe_bg, farbe_text: art.farbe_text }
            : { kuerzel: '-', farbe_bg: '#999', farbe_text: '#fff' },
          startzeit_ist: r.ist_startzeit || null,
          endzeit_ist: r.ist_endzeit || null,
          kommentar: (r.kommentar || '')?.trim() || null,
        };
      });

      setEintraege(mapped);
    }

    await Promise.all([
      ladeTermineOptional(von, bis),
      ladeFeiertageFerienOptional(von, bis),
    ]);
  };

  // Termine (dein bestehender Code unverändert)
  const ladeTermineOptional = async (von, bis) => {
    try {
      const { data: zuw, error: zErr } = await supabase
        .from('DB_SchichtZuweisung')
        .select('schichtgruppe, von_datum, bis_datum')
        .eq('firma_id', Number(firma))
        .eq('unit_id', Number(unit))
        .eq('user_id', userId)
        .lte('von_datum', bis)
        .or(`bis_datum.is.null, bis_datum.gte.${von}`);
      if (zErr) throw zErr;

      const gruppeByDate = {};
      let d = dayjs(von), end = dayjs(bis);
      for (; !d.isAfter(end, 'day'); d = d.add(1, 'day')) {
        const ds = d.format('YYYY-MM-DD');
        const hit = (zuw || []).find(r =>
          dayjs(r.von_datum).isSameOrBefore(ds, 'day') &&
          (!r.bis_datum || dayjs(r.bis_datum).isSameOrAfter(ds, 'day'))
        );
        gruppeByDate[ds] = hit?.schichtgruppe || null;
      }

      const { data: qRows, error: qErr } = await supabase
        .from('DB_Qualifikation')
        .select('quali')
        .eq('user_id', userId);
      if (qErr) throw qErr;
      const qualiSet = new Set(
        (qRows || []).map(r => Number(r.quali)).filter(n => !Number.isNaN(n))
      );

      const [fix, rep] = await Promise.all([
        supabase
          .from('DB_TerminVerwaltung')
          .select('id, bezeichnung, datum, wiederholend, quali_ids, farbe, team, ziel_typ, wiederholung_typ, wiederholung_intervall')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .gte('datum', von)
          .lte('datum', bis),
              ]);

      if (fix.error) console.error('❌ Termine FIX Fehler:', fix.error.message || fix.error);
      if (rep.error) console.error('❌ Termine REP Fehler:', rep.error.message || rep.error);

      const fixRows = fix.error ? [] : (fix.data || []);
      const repRows = rep.error ? [] : (rep.data || []);

      const asArray = (x) => Array.isArray(x)
        ? x
        : (typeof x === 'string'
            ? x.split(',').map(s => s.trim()).filter(Boolean)
            : (x == null ? [] : [x]));

      const getRepeatTyp = (row) => (row?.wiederholung_typ || '').toString().trim().toLowerCase();
      const getRepeatEvery = (row) => {
        const n = Number(row?.wiederholung_intervall);
        return Number.isFinite(n) && n > 0 ? n : 1;
      };

      const occursOnDate = (row, ds) => {
        if (!row?.wiederholend) return row?.datum === ds;

        const start = row?.datum ? dayjs(row.datum).startOf('day') : null;
        const cur = dayjs(ds).startOf('day');
        if (!start) return false;
        if (cur.isBefore(start, 'day')) return false;

        const typ = getRepeatTyp(row);
        const every = getRepeatEvery(row);

        if (!typ) return cur.isSame(start, 'day');

        if (typ === 'taeglich' || typ === 'daily') {
          const diffDays = cur.diff(start, 'day');
          return diffDays % every === 0;
        }
        if (typ === 'woechentlich' || typ === 'weekly') {
          if (cur.day() !== start.day()) return false;
          const diffWeeks = cur.diff(start, 'week');
          return diffWeeks % every === 0;
        }
        if (typ === 'monatlich' || typ === 'monthly') {
          if (cur.date() !== start.date()) return false;
          const diffMonths = cur.diff(start, 'month');
          return diffMonths % every === 0;
        }
        return false;
      };

      const map = {};
      let cur = dayjs(von); end = dayjs(bis);
      for (; !cur.isAfter(end, 'day'); cur = cur.add(1, 'day')) {
        const ds = cur.format('YYYY-MM-DD');
        const gruppe = gruppeByDate[ds] || null;

        const tagged = fixRows.filter(r => r.datum === ds);
        const repHits = repRows.filter(r => occursOnDate(r, ds));

        const byId = new Map();
        [...tagged, ...repHits].forEach(r => byId.set(r.id, r));
        const all = Array.from(byId.values());

        const hits = all.filter(row => {
          const typ = row.ziel_typ || null;

          if (typ === 'team') {
            if (!gruppe) return false;
            const teams = asArray(row.team);
            return teams.includes(gruppe);
          }

          if (typ === 'quali') {
            const ids = (row.quali_ids || []).map(Number).filter(n => !Number.isNaN(n));
            for (const q of ids) if (qualiSet.has(q)) return true;
            return false;
          }

          return !typ;
        });

        if (hits.length) {
          const norm = (s) => (s || '').trim().toLowerCase();
          const uniqByName = Array.from(
            new Map(hits.map(h => [`${norm(h.bezeichnung)}|${ds}`, h])).values()
          );

          map[ds] = uniqByName.map(h => ({
            id: h.id,
            bezeichnung: h.bezeichnung || 'Termin',
            ziel_typ: h.ziel_typ || null,
            farbe: h.farbe || null,
          }));
        }
      }

      setTermineByDate(map);
    } catch (e) {
      console.warn('Termine konnten nicht ermittelt werden:', e?.message || e);
      setTermineByDate({});
    }
  };

  useEffect(() => {
    ladeDienste();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, firma, unit, startDatum, unitLoc.land, unitLoc.bundesland]);

  const zurueckZuHeute = () => {
    const heute = dayjs();
    setJahr(heute.year());
    setStartDatum(heute.startOf('month'));
  };

  const changeMonth = (e) => {
    const idx = monate.indexOf(e.target.value);
    if (idx >= 0) {
      const neu = startDatum.set('month', idx).startOf('month');
      setStartDatum(neu);
      setJahr(neu.year());
    }
  };

  const changeYear = (e) => {
    const y = parseInt(e.target.value, 10);
    if (!Number.isNaN(y)) {
      const neu = startDatum.set('year', y).startOf('month');
      setJahr(y);
      setStartDatum(neu);
    }
  };

  // Helper: Datum-Zellenstyle nach Ferien/Feiertag
  const getDateCellStyle = (ds) => {
    const ff = ffByDate[ds] || [];
    if (!ff.length) return null;

    const ferien = ff.filter(x => ((x.typ || '').toLowerCase().includes('ferien')));
    const feiertage = ff.filter(x => ((x.typ || '').toLowerCase().includes('feiertag')));

    // Priorität: Feiertag > Ferien
    const pick = (feiertage[0] || ferien[0]) || null;
    if (!pick) return null;

    return {
      backgroundColor: pick.farbe || '#ef4444',
      color: '#111827', // dunkel lesbar
      borderRadius: '8px',
      padding: '2px 6px',
      display: 'inline-block',
      fontWeight: 600,
    };
  };

  const getDateTitle = (ds) => {
    const ff = ffByDate[ds] || [];
    if (!ff.length) return '';

    const ferien = ff.filter(x => ((x.typ || '').toLowerCase().includes('ferien')));
    const feiertage = ff.filter(x => ((x.typ || '').toLowerCase().includes('feiertag')));

    const lines = [];

    if (feiertage.length) {
      const h0 = feiertage[0];
      lines.push(`Feiertag: ${h0.name || ''}`);
      if (feiertage.length > 1) lines.push(`+ ${feiertage.length - 1} weitere`);
      // wichtig: wenn Feiertag da ist, Ferien NICHT anzeigen (dein Ranking)
      return lines.join(' | ');
    }

    if (ferien.length) {
      const f0 = ferien[0];
      const von = dayjs(f0.von).format('DD.MM.');
      const bis = dayjs(f0.bis || f0.von).format('DD.MM.');
      lines.push(`Ferien: ${f0.name || ''} (${von} – ${bis})`);
      if (ferien.length > 1) lines.push(`+ ${ferien.length - 1} weitere`);
    }

    return lines.join(' | ');
  };

  return (
    <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-gray-300 dark:border-gray-700 relative">
      {/* Kopf */}
      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 className="text-md font-semibold">🗓️ Meine Dienste</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={zurueckZuHeute}
            title="Zurück zu Heute"
            className="p-1 rounded hover:bg-gray-300/60 dark:hover:bg-gray-700/60"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>

          {/* – Monat + */}
          <button
            onClick={() => changeMonthRel(-1)}
            className="px-2 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-sm"
            title="Vorheriger Monat"
          >–</button>

          <select
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
            value={monate[startDatum.month()]}
            onChange={changeMonth}
          >
            {monate.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button
            onClick={() => changeMonthRel(1)}
            className="px-2 py-1 rounded bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-sm"
            title="Nächster Monat"
          >+</button>

          {/* Jahr */}
          <select
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
            value={jahr}
            onChange={changeYear}
          >
            {aktuelleJahre.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button
            onClick={() => setInfoOffen(true)}
            title="Info"
            className="px-2 py-1 rounded hover:bg-gray-300/60 dark:hover:bg-gray-700/60"
          >
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-300" />
          </button>

          <button
            onClick={() => setDruckOffen(true)}
            title="Dienstplan drucken"
            className="px-2 py-1 rounded hover:bg-gray-300/60 dark:hover:bg-gray-700/60"
          >
            <Printer className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <table className="w-full text-sm">
        <thead className="text-left text-gray-900 bg-gray-300 dark:bg-gray-700 dark:text-gray-300">
          <tr>
            {['Datum', 'Kürzel', 'von', 'bis', 'Dauer', 'Info'].map(h => (
              <th key={h} className="py-2 px-1">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {eintraege.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-gray-400 py-4">
                Mehr Dienste sind in der Planung noch nicht eingepflegt.
              </td>
            </tr>
          ) : (
            eintraege.map((e, i) => {
              const start = e.startzeit_ist ? dayjs(`2000-01-01T${e.startzeit_ist}`) : null;
              let ende = e.endzeit_ist ? dayjs(`2000-01-01T${e.endzeit_ist}`) : null;
              if (start && ende && ende.isBefore(start)) ende = ende.add(1, 'day');

              const dauerMin = start && ende ? ende.diff(start, 'minute') : 0;
              const stunden = Math.floor(dauerMin / 60);
              const minuten = dauerMin % 60;

              const ds = e.datum;
              const istHeute = ds === todayStr;

              const hatKommentar = !!(e.kommentar && e.kommentar.trim().length > 0);
              const termine = termineByDate[ds] || [];

              const uniqueTermine = Array.from(
                new Map(
                  termine.map(t => [t.id ?? `${(t.bezeichnung || '').trim().toLowerCase()}|${ds}`, t])
                ).values()
              );

              const dateStyle = getDateCellStyle(ds);
              const dateTitle = getDateTitle(ds);

              return (
                <tr
                  key={`${ds}-${i}`}
                  className={`border-b border-gray-300 dark:border-gray-700 hover:bg-gray-300/60 dark:hover:bg-gray-700/60 relative ${
                    istHeute ? 'ring-2 ring-blue-400/70' : ''
                  }`}
                >
                  {/* Datum (hier einfärben) */}
                  <td className="py-1 align-top">
                    <span
                      className="font-medium"
                      style={dateStyle || undefined}
                      title={dateTitle || undefined}
                      onMouseEnter={() => dateTitle ? setHoverKey(`d-${ds}-${i}`) : null}
                      onMouseLeave={() => hoverKey?.startsWith(`d-${ds}-${i}`) ? setHoverKey(null) : null}
                    >
                      {dayjs(ds).format('DD.MM.YYYY')}
                    </span>

                    {/* Optional Tooltip (nur wenn Titel vorhanden) */}
                    {dateTitle && hoverKey === `d-${ds}-${i}` && (
                      <Tooltip>
                        <div className="font-semibold mb-1">
                          {dayjs(ds).format('dddd, DD.MM.YYYY')}
                        </div>
                        <div>{dateTitle}</div>
                      </Tooltip>
                    )}
                  </td>

                  {/* Kürzel */}
                  <td className="align-top">
                    <span
                      className="inline-block min-w-[2.5rem] text-center font-semibold rounded-lg text-xs"
                      style={{
                        backgroundColor: e.ist_schicht?.farbe_bg || '#999',
                        color: e.ist_schicht?.farbe_text || '#fff'
                      }}
                    >
                      {e.ist_schicht?.kuerzel || '-'}
                    </span>
                  </td>

                  {/* Zeiten + Dauer */}
                  <td className="align-top">{start ? start.format('HH:mm') : '–'}</td>
                  <td className="align-top">{ende ? ende.format('HH:mm') : '–'}</td>
                  <td className="align-top">{dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}</td>

                  {/* Info */}
                  <td className="align-top">
                    <div className="flex items-center gap-2 relative">
                      {/* Kommentar */}
                      {hatKommentar && (
                        <span
                          className="relative cursor-default inline-flex items-center"
                          onMouseEnter={() => setHoverKey(`c-${ds}-${i}`)}
                          onMouseLeave={() => setHoverKey(null)}
                        >
                          <span>💬</span>
                          {hoverKey === `c-${ds}-${i}` && (
                            <Tooltip>
                              <div className="font-semibold mb-1">
                                {dayjs(ds).format('dddd, DD.MM.YYYY')}
                              </div>
                              <div className="whitespace-pre-wrap break-words">{e.kommentar}</div>
                            </Tooltip>
                          )}
                        </span>
                      )}

                      {/* Termin(e) */}
                      {uniqueTermine.length > 0 && (
                        <span
                          className="relative cursor-default inline-flex items-center"
                          onMouseEnter={() => setHoverKey(`t-${ds}-${i}`)}
                          onMouseLeave={() => setHoverKey(null)}
                        >
                          <span>📅</span>
                          {hoverKey === `t-${ds}-${i}` && (
                            <Tooltip>
                              <div className="font-semibold mb-1">
                                {dayjs(ds).format('dddd, DD.MM.YYYY')}
                              </div>
                              {uniqueTermine.map((t, idx) => (
                                <div key={`${t.id ?? t.bezeichnung}-${ds}-${idx}`} className="mb-1">
                                  {t.farbe && <span className="mr-1">●</span>}
                                  <span className="font-medium">{t.bezeichnung}</span>
                                  {t.ziel_typ && <span className="opacity-70"> • {t.ziel_typ}</span>}
                                </div>
                              ))}
                            </Tooltip>
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 text-black dark:text-white rounded-xl p-6 w-[90%] max-w-lg shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Funktionen erklärt</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Monatswechsel: – / + direkt neben der Monatsauswahl.</li>
              <li>„Zurück zu heute“ setzt auf den aktuellen Monatsanfang.</li>
              <li>Heutiger Tag ist blau markiert.</li>
              <li>Datum wird eingefärbt: Feiertag &gt; Ferien (Feiertag überdeckt Ferien).</li>
              <li>Info-Spalte: 💬 Kommentar, 📅 Team-/Quali-Termine.</li>
              <li>Datenquelle: v_tagesplan + DB_SchichtArt; Feiertage/Ferien aus DB_FeiertageundFerien.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {druckOffen && (
        <DienstPlanDruckModal
          onClose={() => setDruckOffen(false)}
          defaultYear={jahr}
          defaultMonthIndex={startDatum.month()}
        />
      )}
    </div>
  );
};

export default MeineDienste;
