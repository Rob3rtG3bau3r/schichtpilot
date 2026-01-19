import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import 'dayjs/locale/de';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

dayjs.extend(isoWeek);
dayjs.locale('de');

const getWeekStart = (year, kw) => {
  // Jan 4 ist in KW 1
  const jan4 = dayjs(`${year}-01-04`);
  const week1Start = jan4.startOf('week'); // bei de-Locale ist "week" i.d.R. Montag-basiert
  return week1Start.add(kw - 1, 'week');
};

const Wochen_KalenderStruktur = ({ jahr, setJahr, monat, setMonat, wochenAnzahl }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const heute = dayjs();
  const aktuelleKw = heute.isoWeek();
  const aktuellesJahr = heute.year();

  const [selectedStartKw, setSelectedStartKw] = useState(
    jahr === aktuellesJahr ? aktuelleKw : 1
  );

  const [visibleStart, setVisibleStart] = useState(null);
  const [visibleEnd, setVisibleEnd] = useState(null);

  // 🔎 Unit-Location: Land + Bundesland (NEU)
  const [unitLoc, setUnitLoc] = useState({ land: null, bundesland: null });

  const [termineByDate, setTermineByDate] = useState({});
  const [ferienByDate, setFerienByDate] = useState({});
  const [feiertagByDate, setFeiertagByDate] = useState({});

  // ✅ Auswahl-Set wie im Monatskalender
  const [selectedDates, setSelectedDates] = useState(new Set());

  // Globale Auswahl-Events abonnieren
  useEffect(() => {
    const onSel = (e) => {
      setSelectedDates(new Set(e.detail?.selected || []));
    };
    window.addEventListener('sp:selectedDates', onSel);
    return () => window.removeEventListener('sp:selectedDates', onSel);
  }, []);

  const toggleSelectedDate = (iso) => {
    const next = new Set(selectedDates);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);
    setSelectedDates(next);

    window.dispatchEvent(
      new CustomEvent('sp:selectedDates', {
        detail: { selected: Array.from(next) },
      })
    );
  };

  // 🔎 Land + Bundesland laden
  useEffect(() => {
    const ladeUnitLoc = async () => {
      if (!unit) return;
      const { data, error } = await supabase
        .from('DB_Unit')
        .select('land, bundesland')
        .eq('id', unit)
        .single();

      if (error) {
        console.error('❌ Fehler beim Laden der Unit-Location:', error.message || error);
        setUnitLoc({ land: null, bundesland: null });
        return;
      }
      setUnitLoc({
        land: (data?.land || null),
        bundesland: (data?.bundesland || null),
      });
    };

    ladeUnitLoc();
  }, [unit]);

  // Wenn Jahr wechselt → sinnvolle default-KW
  useEffect(() => {
    if (jahr === aktuellesJahr) {
      setSelectedStartKw(aktuelleKw);
    } else {
      setSelectedStartKw(1);
    }
  }, [jahr, aktuellesJahr, aktuelleKw]);

  // Sichtbaren Zeitraum aus Start-KW + Wochenanzahl berechnen + ONLY visibleRange senden
  useEffect(() => {
    if (!selectedStartKw) return;

    const start = getWeekStart(jahr, selectedStartKw).startOf('day');
    const end = start.add(wochenAnzahl * 7 - 1, 'day');

    setVisibleStart(start);
    setVisibleEnd(end);

    if (typeof window !== 'undefined') {
      const detail = {
        start: start.format('YYYY-MM-DD'),
        end: end.format('YYYY-MM-DD'),
      };

      window.__spVisibleRange = detail;

      // ❌ KEIN automatisches sp:selectedDates hier
      window.dispatchEvent(
        new CustomEvent('sp:visibleRange', {
          detail,
        })
      );
    }
  }, [jahr, selectedStartKw, wochenAnzahl]);

  // 🔎 Termine + Ferien/Feiertage für sichtbaren Bereich
  useEffect(() => {
    const ladeKalenderDaten = async () => {
      if (!firma || !unit || !visibleStart || !visibleEnd) return;

      const startIso = visibleStart.format('YYYY-MM-DD');
      const endIso = visibleEnd.format('YYYY-MM-DD');

      // Termine
      const { data: termine, error: termErr } = await supabase
        .from('DB_TerminVerwaltung')
        .select('id, bezeichnung, datum, farbe')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .gte('datum', startIso)
        .lte('datum', endIso);

      if (termErr) {
        console.error('❌ Fehler beim Laden der Termine (Woche):', termErr.message || termErr);
      }

      const tMap = {};
      for (const t of termine || []) {
        const d = t.datum;
        if (!tMap[d]) tMap[d] = [];
        tMap[d].push(t);
      }

      // Ferien / Feiertage (NEU: Land + (bundesweit oder BL))
      let fMap = {};
      let hMap = {};

      const land = (unitLoc?.land || '').trim();
      const bundesland = (unitLoc?.bundesland || '').trim();

      if (land) {
        const { data: ff, error: ffErr } = await supabase
          .from('DB_FeiertageundFerien')
          .select('id, typ, name, von, bis, jahr, farbe, land, bundesland, ist_bundesweit')
          .eq('land', land)
          .or(`ist_bundesweit.eq.true,bundesland.eq.${bundesland}`)
          .lte('von', endIso)
          .gte('bis', startIso);

        if (ffErr) {
          console.error('❌ Fehler Ferien/Feiertage (Woche):', ffErr.message || ffErr);
        } else {
          const startBound = visibleStart;
          const endBound = visibleEnd;

          fMap = {};
          hMap = {};

          for (const row of ff || []) {
            const typ = (row.typ || '').toLowerCase();
            const color = row.farbe || '#10b981';
            const name = row.name || '';
            const von = dayjs(row.von);
            const bis = row.bis ? dayjs(row.bis) : von;

            let cur = von.isBefore(startBound, 'day') ? startBound : von;
            const last = bis.isAfter(endBound, 'day') ? endBound : bis;

            while (cur.isSame(last, 'day') || cur.isBefore(last, 'day')) {
              const dIso = cur.format('YYYY-MM-DD');

              const obj = {
                ...row,
                farbe: color,
                name,
              };

              if (typ.includes('ferien')) {
                if (!fMap[dIso]) fMap[dIso] = [];
                fMap[dIso].push(obj);
              } else if (typ.includes('feiertag')) {
                if (!hMap[dIso]) hMap[dIso] = [];
                hMap[dIso].push(obj);
              }

              cur = cur.add(1, 'day');
            }
          }
        }
      } else {
        // Land fehlt → Hinweis in Console
        if (unit) {
          console.warn('⚠️ Unit hat kein Land (DB_Unit.land). Ferien/Feiertage werden nicht geladen.');
        }
      }

      setTermineByDate(tMap);
      setFerienByDate(fMap);
      setFeiertagByDate(hMap);
    };

    ladeKalenderDaten();
  }, [firma, unit, unitLoc, visibleStart, visibleEnd]);

  // Liste aller Tage im sichtbaren Bereich
  const tage = useMemo(() => {
    if (!visibleStart || !visibleEnd) return [];

    const arr = [];
    let d = visibleStart;
    while (d.isSame(visibleEnd, 'day') || d.isBefore(visibleEnd, 'day')) {
      arr.push(d);
      d = d.add(1, 'day');
    }
    return arr;
  }, [visibleStart, visibleEnd]);

  const kwChipClass = (kw) => {
    const istAusgewaehlt = kw === selectedStartKw;
    const istHeuteKw = jahr === aktuellesJahr && kw === aktuelleKw;

    let base =
      'px-3 py-1 rounded-full border text-xs cursor-pointer transition-colors ';

    if (istAusgewaehlt) {
      base += 'bg-blue-500 text-white border-blue-600 ';
    } else {
      base += 'bg-gray-300 dark:bg-gray-700 border-gray-400 text-gray-800 dark:text-gray-100 ';
    }

    if (istHeuteKw) {
      base += 'ring-2 ring-yellow-400 ';
    }

    return base;
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 pt-2 px-4 pb-1 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700 mb-3">
      {/* Kopfzeile: Jahr & KW-Auswahl – optisch wie KalenderStruktur */}
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        {/* Jahr-Dropdown wie im Monatskalender */}
        {(() => {
          const aktJahr = new Date().getFullYear();
          return (
            <select
              value={jahr}
              onChange={(e) => setJahr(parseInt(e.target.value, 10))}
              className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-3 py-1 rounded-xl"
            >
              {[aktJahr - 1, aktJahr, aktJahr + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          );
        })()}

        {/* KW 1–52 */}
        <div className="flex flex-wrap items-center gap-1">
          {Array.from({ length: 52 }, (_, i) => i + 1).map((kw) => (
            <button
              key={kw}
              type="button"
              className={kwChipClass(kw)}
              onClick={() => setSelectedStartKw(kw)}
            >
              KW {kw}
            </button>
          ))}
        </div>
      </div>

      {/* Kopfzeile über der Kampfliste */}
      <div className="flex min-w-fit">
        {/* Platzhalter Namensspalte */}
        <div className="w-[176px] min-w-[176px]" />

        {/* Rechte Seite: KW Label + Tageszeile */}
        <div className="flex flex-col gap-[2px]">
          {/* KW-Beschriftung (nur auf Montagen) */}
          <div className="flex gap-[2px]">
            {tage.map((d) => {
              const iso = d.format('YYYY-MM-DD');
              const isMonday = d.day() === 1;
              return (
                <div
                  key={`kwlabel-${iso}`}
                  className="w-[48px] min-w-[48px] h-[14px] flex items-center justify-center text-[10px] text-gray-400 dark:text-gray-500"
                >
                  {isMonday ? `KW ${d.isoWeek()}` : ''}
                </div>
              );
            })}
          </div>

          {/* Tageszeile */}
          <div className="flex gap-[2px]">
            {tage.map((d) => {
              const iso = d.format('YYYY-MM-DD');
              const isToday = d.isSame(heute, 'day');
              const weekday = d.day(); // 0=So, 6=Sa

              const termine = termineByDate[iso] || [];
              const ferien = ferienByDate[iso] || [];
              const feiertage = feiertagByDate[iso] || [];

              const terminColor = termine[0]?.farbe || '#3b82f6';
              const ferienColor = ferien[0]?.farbe || '#10b981';
              const feiertagColor = feiertage[0]?.farbe || '#ef4444';

              const terminTitle =
                termine.length === 0
                  ? ''
                  : termine.length === 1
                  ? `Termin: ${termine[0].bezeichnung || ''}`
                  : `Termine: ${termine[0].bezeichnung || ''} + ${termine.length - 1} weitere`;

              const ferienTitle =
                ferien.length === 0
                  ? ''
                  : (() => {
                      const f = ferien[0];
                      const von = dayjs(f.von).format('DD.MM.');
                      const bis = dayjs(f.bis || f.von).format('DD.MM.');
                      return `Ferien: ${f.name || ''} (${von} – ${bis})`;
                    })();

              const feiertagTitle =
                feiertage.length === 0
                  ? ''
                  : (() => {
                      const f = feiertage[0];
                      const bw = f.ist_bundesweit ? 'bundesweit' : (f.bundesland || '');
                      return `Feiertag: ${f.name || ''}${bw ? ` (${bw})` : ''}`;
                    })();

              const combinedTitle = [ferienTitle, feiertagTitle, terminTitle]
                .filter(Boolean)
                .join(' | ');

              return (
                <div
                  key={iso}
                  className={`relative w-[48px] min-w-[48px] h-[36px] flex flex-col items-center justify-center rounded-md border text-[12px]
                    border-gray-300 dark:border-gray-700
                    ${
                      weekday === 0
                        ? 'bg-red-600 text-white'
                        : weekday === 6
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white'
                    }
                    ${isToday ? 'ring-2 ring-yellow-400' : ''}
                    ${selectedDates.has(iso) ? 'outline outline-2 outline-orange-400' : ''}
                  `}
                  title={combinedTitle}
                  onClick={() => toggleSelectedDate(iso)}
                >
                  {/* Ferien-Balken oben */}
                  {ferien.length > 0 && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[4px]"
                      style={{ backgroundColor: ferienColor }}
                      title={ferienTitle}
                    />
                  )}

                  {/* Feiertag-Balken unten (statt Punkt) */}
                  {feiertage.length > 0 && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[4px]"
                      style={{ backgroundColor: feiertagColor }}
                      title={feiertagTitle}
                    />
                  )}

                  {/* Termine-Ecke unten links */}
                  {termine.length > 0 && (
                    <>
                      <div
                        className="absolute bottom-0 left-0 w-0 h-0"
                        style={{
                          borderBottom: '10px solid white',
                          borderRight: '10px solid transparent',
                          zIndex: 5,
                        }}
                      />
                      <div
                        className="absolute bottom-0 left-0 w-0 h-0"
                        style={{
                          borderBottom: `8px solid ${terminColor}`,
                          borderRight: '8px solid transparent',
                          zIndex: 10,
                        }}
                        title={terminTitle}
                      />
                    </>
                  )}

                  <span className="leading-none">{d.format('dd')}</span>
                  <span className="leading-none text-[11px] font-semibold">
                    {d.format('DD.MM.')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wochen_KalenderStruktur;
