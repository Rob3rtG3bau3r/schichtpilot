// src/components/Cockpit/KalenderStruktur.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

const monate = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const KalenderStruktur = ({ jahr, setJahr, monat, setMonat }) => {
  const [tage, setTage] = useState([]);
  const [eintraege, setEintraege] = useState({ feiertage: [], termine: [] });
  const [qualiMap, setQualiMap] = useState({});

  // Ausgewählte Tage (global per CustomEvent geteilt)
  const [selectedDates, setSelectedDates] = useState(new Set());

  // Anzeige-Modus: Monat oder Woche
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [weekCount, setWeekCount] = useState(1);     // 1–4 Wochen
  const [weeksInYear, setWeeksInYear] = useState(52);
  const [selectedWeek, setSelectedWeek] = useState(() => dayjs().isoWeek());

  const today = dayjs();
  const aktuelleIsoWeek = today.isoWeek();
  const aktuelleIsoWeekYear = today.isoWeekYear();

  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  // Auf globale Änderungen (Auswahl) hören
  useEffect(() => {
    const onSel = (e) => {
      setSelectedDates(new Set(e.detail?.selected || []));
    };
    window.addEventListener('sp:selectedDates', onSel);
    return () => window.removeEventListener('sp:selectedDates', onSel);
  }, []);

  // Helper: Tage toggeln + global broadcasten
  const toggleSelectedDate = (iso) => {
    const next = new Set(selectedDates);
    if (next.has(iso)) next.delete(iso);
    else next.add(iso);

    setSelectedDates(next);
    window.dispatchEvent(
      new CustomEvent('sp:selectedDates', { detail: { selected: Array.from(next) } })
    );
  };

  // Anzahl Wochen pro Jahr – MAX 52
  useEffect(() => {
    const dec28 = dayjs(`${jahr}-12-28`);
    let isoWeeks = dec28.isoWeek(); // 52 oder 53
    if (!isoWeeks || isoWeeks < 1) isoWeeks = 52;
    if (isoWeeks > 52) isoWeeks = 52;
    setWeeksInYear(isoWeeks);
    if (selectedWeek > isoWeeks) {
      setSelectedWeek(isoWeeks);
    }
  }, [jahr]);

  // Sichtbare Tage + Einträge laden (Monat oder Wochenbereich)
  useEffect(() => {
    if (!firma || !unit) return;

    const heute = dayjs();

    let startDate;
    let endDate;

    if (viewMode === 'month') {
      // kompletter Monat
      startDate = dayjs(new Date(jahr, monat, 1));
      endDate = dayjs(new Date(jahr, monat + 1, 0));
    } else {
      // Wochenansicht: ISO-Woche(n) Montag–Sonntag
      const anyDayInWeek = dayjs().year(jahr).isoWeek(selectedWeek);
      const weekStart = anyDayInWeek.startOf('isoWeek'); // Montag
      const weekEnd = weekStart.add(7 * weekCount - 1, 'day'); // 1–4 Wochen

      startDate = weekStart;
      endDate = weekEnd;
    }

    // Tage-Array bauen (darf monatsübergreifend sein)
    const neueTage = [];
    for (
      let d = startDate;
      d.isSame(endDate, 'day') || d.isBefore(endDate, 'day');
      d = d.add(1, 'day')
    ) {
      const tagNummer = d.day(); // 0 = So, 6 = Sa

      neueTage.push({
        date: d.format('YYYY-MM-DD'),
        tag: d.date(),
        wochentag: d.toDate().toLocaleDateString('de-DE', { weekday: 'short' }),
        isHeute: d.isSame(heute, 'day'),
        isSonntag: tagNummer === 0,
        isSamstag: tagNummer === 6,
      });
    }

    setTage(neueTage);

    const ladeEintraege = async () => {
      const start = startDate.format('YYYY-MM-DD');
      const ende = endDate.format('YYYY-MM-DD');

      // 1. Bundesland aus Unit
      const { data: unitData, error: unitError } = await supabase
        .from('DB_Unit')
        .select('bundesland')
        .eq('id', unit)
        .single();

      if (unitError) {
        console.error('❌ Fehler beim Laden der Unit:', unitError.message);
        return;
      }

      const bundesland = unitData?.bundesland;

      // 2. Feiertage / Ferien im Zeitraum
      const { data: feiertage, error: feiertageError } = await supabase
        .from('DB_FeiertageundFerien')
        .select('name, von, bis, farbe')
        .eq('bundesland', bundesland)
        .or(`von.lte.${ende},bis.gte.${start}`);

      // 3. Termine & Qualis im Zeitraum
      const [
        { data: termine, error: termineError },
        { data: qualis, error: qualisError },
      ] = await Promise.all([
        supabase
          .from('DB_TerminVerwaltung')
          .select('datum, bezeichnung, farbe, quali_ids, team')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .gte('datum', start)
          .lte('datum', ende),
        supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation'),
      ]);

      if (feiertageError || termineError || qualisError) {
        console.error(
          '❌ Fehler beim Laden der Einträge:',
          feiertageError || termineError || qualisError
        );
        return;
      }

      const map = {};
      (qualis || []).forEach((q) => {
        map[q.id] = q.qualifikation;
      });
      setQualiMap(map);

      setEintraege({
        feiertage: feiertage || [],
        termine: termine || [],
      });
    };

    ladeEintraege();
  }, [jahr, monat, viewMode, selectedWeek, weekCount, firma, unit]);

  // 🔔 Sichtbaren Datumsbereich als Event an KampfListe + MitarbeiterBedarf schicken
  useEffect(() => {
    if (!tage || tage.length === 0) return;

    const start = tage[0].date;
    const end = tage[tage.length - 1].date;

    window.dispatchEvent(
      new CustomEvent('sp:visibleRange', {
        detail: { start, end },
      })
    );
  }, [tage]);

  // 🔍 Set für alle Wochen, die bei weekCount angezeigt werden (mit Wrap)
  const visibleWeekSet = (() => {
    if (viewMode !== 'week' || weekCount <= 1 || weeksInYear <= 0) return new Set();
    const s = new Set();
    for (let i = 0; i < weekCount; i++) {
      const w = ((selectedWeek - 1 + i) % weeksInYear) + 1; // Wrap 52→1
      s.add(w);
    }
    return s;
  })();

  return (
    <div className="bg-gray-200 dark:bg-gray-800 pt-2 px-4 pb-1 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700">
      {/* Kopfzeile: Jahr, Wochenanzahl (bei Woche), Modus, Monate / Wochen */}
      <div className="flex items-center justify-left mb-2 flex-wrap gap-2">
        {/* Jahr-Auswahl */}
        {(() => {
          const aktJahr = new Date().getFullYear();
          return (
            <select
              value={jahr}
              onChange={(e) => setJahr(parseInt(e.target.value, 10))}
              className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-3 rounded-xl"
            >
              {[aktJahr - 1, aktJahr, aktJahr + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          );
        })()}

        {/* Wochenanzahl nur in Wochenansicht */}
        {viewMode === 'week' && (
          <select
            value={weekCount}
            onChange={(e) => setWeekCount(parseInt(e.target.value, 10) || 1)}
            className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-3 rounded-xl"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} Woche{n > 1 ? 'n' : ''}
              </option>
            ))}
          </select>
        )}

        {/* Umschalter Monat / Woche */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3 rounded-xl text-sm transition-all duration-150 ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Monat
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`px-3 rounded-xl text-sm transition-all duration-150 ${
              viewMode === 'week'
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            Woche
          </button>
        </div>

        {/* Auswahl: Monate ODER Wochen */}
        {viewMode === 'month' ? (
          <div className="flex gap-2 flex-wrap">
            {monate.map((name, index) => (
              <button
                key={index}
                onClick={() => setMonat(index)}
                className={`px-3 rounded-xl text-sm transition-all duration-150 ${
                  index === monat
                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                    : 'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-1 flex-wrap overflow-x-auto max-w-full">
            {Array.from({ length: weeksInYear }, (_, i) => i + 1).map((kw) => {
              const isActive = kw === selectedWeek;
              const isCurrentWeek =
                jahr === aktuelleIsoWeekYear && kw === aktuelleIsoWeek;

              const isInMultiRange =
                weekCount > 1 && visibleWeekSet.has(kw) && !isActive;

              let baseClasses =
                'px-2  rounded-xl text-sm transition-all duration-150 border ';

              if (isActive) {
                baseClasses +=
                  'bg-blue-600 text-white dark:bg-blue-500 border-blue-700 dark:border-blue-300';
              } else if (isInMultiRange) {
                baseClasses +=
                  'bg-blue-500/40 text-gray-900 dark:text-gray-100 border-blue-400/60';
              } else {
                baseClasses +=
                  'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200 border-transparent';
              }

              if (isCurrentWeek) {
                baseClasses += ' border-2 border-yellow-400';
              }

              return (
                <button
                  key={kw}
                  type="button"
                  onClick={() => setSelectedWeek(kw)}
                  className={baseClasses}
                >
                  KW {kw}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Kalenderspalten */}
      <div className="flex overflow-x-visible text-center text-sm">
        {/* Platz links für Kopfzeilen in KampfListe/MitarbeiterBedarf */}
        <div className="w-[160px] min-w-[160px] flex-shrink-0"></div>

        <div className="flex gap-[2px] min-w-fit">
          {tage.map((t, index) => {
            const iso = t.date;
            const isSelected = selectedDates.has(iso);
            const hoverLabel = dayjs(iso).format('dddd, DD.MM.YYYY'); // <- NEU

            return (
              <div
                key={index}
                title={hoverLabel}         // <- NEU: Browser-Tooltip mit vollem Datum
                className={`relative flex flex-col items-center justify-center h-[42px] w-[48px] min-w-[48px] rounded
                ${t.isSonntag ? 'bg-red-600 text-white' : ''}
                ${t.isSamstag ? 'bg-orange-500 text-white' : ''}
                ${
                  !t.isSonntag && !t.isSamstag
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white'
                    : ''
                }
                ${t.isHeute ? 'border-2 border-yellow-400' : ''}
                ${isSelected ? 'outline outline-2 outline-orange-400' : ''}
              `}
                onClick={() => toggleSelectedDate(iso)}
              >
                {/* Feiertage/Ferien-Balken */}
                {eintraege?.feiertage
                  ?.filter((e) => {
                    const tagDate = t.date;
                    const von = dayjs(e.von).format('YYYY-MM-DD');
                    const bis = dayjs(e.bis).format('YYYY-MM-DD');
                    return tagDate >= von && tagDate <= bis;
                  })
                  .map((e, idx) => (
                    <div
                      key={'f-' + idx}
                      className="w-[80%] h-[5px] rounded-t bg-opacity-80"
                      style={{ backgroundColor: e.farbe }}
                      title={e.name}
                    />
                  ))}

                {/* Termine als kleines Dreieck unten links */}
                {eintraege?.termine
                  ?.filter(
                    (e) => dayjs(e.datum).format('YYYY-MM-DD') === t.date
                  )
                  .map((e, idx) => {
                    const tooltip =
                      `📅 ${dayjs(e.datum).format('DD.MM.YYYY')}\n📝 ${e.bezeichnung}` +
                      (e.quali_ids?.length
                        ? `\n- Qualifikationen: ${e.quali_ids
                            .map((id) => qualiMap[id] || id)
                            .join(', ')}`
                        : '') +
                      (e.team?.length
                        ? `\n- Teams: ${e.team.join(', ')}`
                        : '');

                    return (
                      <div
                        key={'t-' + idx}
                        className="absolute bottom-0 left-0"
                      >
                        {/* weißes Hintergrund-Dreieck */}
                        <div
                          className="absolute bottom-0 left-0 w-0 h-0 pointer-events-none"
                          style={{
                            borderLeft: '14px solid transparent',
                            borderTop: '14px solid #fff',
                            transform: 'rotate(180deg)',
                            zIndex: 5,
                          }}
                          aria-hidden
                        />
                        {/* farbiges Dreieck */}
                        <div
                          className="absolute bottom-0 left-0 w-0 h-0"
                          style={{
                            borderLeft: '12px solid transparent',
                            borderTop: `12px solid ${e.farbe}`,
                            transform: 'rotate(180deg)',
                            zIndex: 10,
                          }}
                          title={tooltip}
                        />
                      </div>
                    );
                  })}

                <span className="text-[12px] leading-none">
                  {t.wochentag}
                </span>
                <span className="font-semibold text-sm leading-none">
                  {t.tag}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default KalenderStruktur;
