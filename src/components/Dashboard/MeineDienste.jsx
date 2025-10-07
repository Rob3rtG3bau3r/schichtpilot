// src/components/Dashboard/MeineDienste.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import { Info, ArrowLeft } from 'lucide-react';

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

  // Tooltips
  const [hoverKey, setHoverKey] = useState(null); // 'c-YYYY-MM-DD-i' | 't-YYYY-MM-DD-i'
  const todayStr = dayjs().format('YYYY-MM-DD');

  // Termine pro Datum
  const [termineByDate, setTermineByDate] = useState({}); // { 'YYYY-MM-DD': [{id, bezeichnung, ziel_typ, farbe}] }

  const changeMonthRel = (delta) => {
    setStartDatum(prev => {
      const neu = dayjs(prev).add(delta, 'month').startOf('month');
      setJahr(neu.year());
      return neu;
    });
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

    await ladeTermineOptional(von, bis);
  };

  // Termine: nur für MAs Gruppe (ziel_typ 'team') + (optional) Quali-Termine
  const ladeTermineOptional = async (von, bis) => {
    try {
      // Gruppe pro Tag aus Zuweisung
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

      // Qualifikationen des Users (mit firma/unit)
      const { data: qRows, error: qErr } = await supabase
        .from('DB_Qualifikation')
        .select('quali')
        .eq('user_id', userId)
      if (qErr) throw qErr;
      const qualiSet = new Set(
        (qRows || []).map(r => Number(r.quali)).filter(n => !Number.isNaN(n))
      );

      // Termindaten: fixe + wiederholende
      const [fix, rep] = await Promise.all([
        supabase
          .from('DB_TerminVerwaltung')
          .select('id, bezeichnung, datum, wiederholend, quali_ids, farbe, team, ziel_typ')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .gte('datum', von)
          .lte('datum', bis),
        supabase
          .from('DB_TerminVerwaltung')
          .select('id, bezeichnung, datum, wiederholend, quali_ids, farbe, team, ziel_typ')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('wiederholend', true),
      ]);

      const fixRows = fix.error ? [] : (fix.data || []);
      const repRows = rep.error ? [] : (rep.data || []);

      // Helper
      const asArray = (x) => Array.isArray(x)
        ? x
        : (typeof x === 'string'
            ? x.split(',').map(s => s.trim()).filter(Boolean)
            : (x == null ? [] : [x]));

      // pro Tag bestimmen
      const map = {};
      let cur = dayjs(von); end = dayjs(bis);
      for (; !cur.isAfter(end, 'day'); cur = cur.add(1, 'day')) {
        const ds = cur.format('YYYY-MM-DD');
        const gruppe = gruppeByDate[ds] || null;

        // Kandidaten zusammenstellen
        const tagged  = fixRows.filter(r => r.datum === ds);
        const repHits = repRows.filter(r => r.datum && dayjs(r.datum).date() === cur.date());

        // Erstes Dedupe nach id (fix vs. rep)
        const byId = new Map();
        [...tagged, ...repHits].forEach(r => byId.set(r.id, r));
        const all = Array.from(byId.values());

        // Filter: nur wenn MA-Gruppe im Termin enthalten (bei ziel_typ 'team')
        // + optional: Quali-Termine, falls Nutzer passende Quali hat
        const hits = all.filter(row => {
          const typ = row.ziel_typ || null;

          if (typ === 'team') {
            if (!gruppe) return false;
            const teams = asArray(row.team);
            return teams.includes(gruppe); // NUR die Gruppe des MAs
          }

          if (typ === 'quali') {
            const ids = (row.quali_ids || []).map(Number).filter(n => !Number.isNaN(n));
            for (const q of ids) if (qualiSet.has(q)) return true;
            return false;
          }

          // „für alle“
          return !typ;
        });

        // Zweites Dedupe: nach Name|Datum (falls derselbe Termin mehrfach für versch. Teams angelegt wurde)
        if (hits.length) {
          const norm = (s) => (s || '').trim().toLowerCase();
          const uniqByName = Array.from(
            new Map(hits.map(h => [ `${norm(h.bezeichnung)}|${ds}`, h ])).values()
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
  }, [userId, firma, unit, startDatum]);

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

              // finaler Dedupe beim Render (Sicherheitsgurt)
              const uniqueTermine = Array.from(
                new Map(
                  termine.map(t => [t.id ?? `${(t.bezeichnung || '').trim().toLowerCase()}|${ds}`, t])
                ).values()
              );

              return (
                <tr
                  key={`${ds}-${i}`}
                  className={`border-b border-gray-300 dark:border-gray-700 hover:bg-gray-300/60 dark:hover:bg-gray-700/60 relative ${
                    istHeute ? 'ring-2 ring-blue-400/70' : ''
                  }`}
                >
                  {/* Datum */}
                  <td className="py-1 align-top">
                    <span className="font-medium">{dayjs(ds).format('DD.MM.YYYY')}</span>
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

                  {/* Info-Spalte: nur Symbole + Tooltip */}
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

                      {/* Termin(e) – nur 1x pro Terminname */}
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
              <li>Info-Spalte: 💬 für Kommentare, 📅 für **Team-/Quali-Termine**, jeweils nur einmal pro Tag.</li>
              <li>Datenquelle: v_tagesplan + DB_SchichtArt; Termine aus DB_TerminVerwaltung.</li>
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
    </div>
  );
};

export default MeineDienste;
