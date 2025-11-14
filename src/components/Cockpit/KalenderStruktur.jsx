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

  // Auswahl im Kalender
  const [selectedDates, setSelectedDates] = useState(new Set());

  // Anzeige-Modus & Wochenanzahl
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [weekCount, setWeekCount] = useState(1);     // 1–4
  const [weeksInYear, setWeeksInYear] = useState(52);
  const [selectedWeek, setSelectedWeek] = useState(() => dayjs().isoWeek());

  const today = dayjs();
  const aktuelleIsoWeek = today.isoWeek();
  const aktuelleIsoWeekYear = today.isoWeekYear();

  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  // aktuelle User-ID aus Supabase-Session
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error('❌ Fehler beim Laden des aktuellen Users:', error.message || error);
        return;
      }
      const uid = data?.user?.id || null;
      if (!uid) {
        console.warn('⚠️ Keine User-ID in Supabase-Session gefunden.');
      }
      setCurrentUserId(uid);
    };

    loadCurrentUser();
  }, []);

  // Globale Auswahl-Events
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
      new CustomEvent('sp:selectedDates', { detail: { selected: Array.from(next) } })
    );
  };

  // 🆕 User-Settings aus DB_UserSettings laden
  useEffect(() => {
    const loadUserPrefs = async () => {
      if (!currentUserId) return;

      const { data, error } = await supabase
        .from('DB_UserSettings')
        .select('cockpit_view_mode, cockpit_week_count')
        .eq('user_id', currentUserId);

      if (error) {
        console.error('❌ Fehler beim Laden der Cockpit-Settings:', error.message || error);
        return;
      }

      const row = data && data.length > 0 ? data[0] : null;

      // Wenn noch kein Eintrag existiert → mit Defaults anlegen
      if (!row) {
        const { error: insertErr } = await supabase
          .from('DB_UserSettings')
          .insert({
            user_id: currentUserId,
            cockpit_view_mode: 'month',
            cockpit_week_count: 1,
          });

        if (insertErr) {
          console.error('❌ Fehler beim Anlegen der Cockpit-Settings:', insertErr.message || insertErr);
        } else {
          console.log('ℹ️ Cockpit-Settings neu angelegt (Defaults).');
        }
        return;
      }

      console.log('ℹ️ Cockpit-Settings geladen:', row);

      if (row.cockpit_view_mode === 'month' || row.cockpit_view_mode === 'week') {
        setViewMode(row.cockpit_view_mode);
      }
      if (
        typeof row.cockpit_week_count === 'number' &&
        row.cockpit_week_count >= 1 &&
        row.cockpit_week_count <= 4
      ) {
        setWeekCount(row.cockpit_week_count);
      }
    };

    loadUserPrefs();
  }, [currentUserId]);

  // 🆕 User-Settings in DB_UserSettings speichern
  useEffect(() => {
    const saveUserPrefs = async () => {
      if (!currentUserId) return;

      const { error } = await supabase
        .from('DB_UserSettings')
        .upsert({
          user_id: currentUserId,
          cockpit_view_mode: viewMode,
          cockpit_week_count: weekCount,
        }, { onConflict: 'user_id' });

      if (error) {
        console.error('❌ Fehler beim Speichern der Cockpit-Settings:', error.message || error);
      } else {
        console.log('✅ Cockpit-Settings gespeichert:', { viewMode, weekCount });
      }
    };

    if (viewMode === 'month' || viewMode === 'week') {
      saveUserPrefs();
    }
  }, [viewMode, weekCount, currentUserId]);

  // Anzahl Wochen pro Jahr (max 52)
  useEffect(() => {
    const dec28 = dayjs(`${jahr}-12-28`);
    let isoWeeks = dec28.isoWeek(); // 52 oder 53
    if (!isoWeeks || isoWeeks < 1) isoWeeks = 52;
    if (isoWeeks > 52) isoWeeks = 52;
    setWeeksInYear(isoWeeks);
    if (selectedWeek > isoWeeks) setSelectedWeek(isoWeeks);
  }, [jahr, selectedWeek]);

  // Sichtbare Tage + Einträge laden
  useEffect(() => {
    if (!firma || !unit) return;

    const heute = dayjs();
    let startDate, endDate;

    if (viewMode === 'month') {
      startDate = dayjs(new Date(jahr, monat, 1));
      endDate = dayjs(new Date(jahr, monat + 1, 0));
    } else {
      const anyDayInWeek = dayjs().year(jahr).isoWeek(selectedWeek);
      const weekStart = anyDayInWeek.startOf('isoWeek'); // Montag
      const weekEnd = weekStart.add(7 * weekCount - 1, 'day');
      startDate = weekStart;
      endDate = weekEnd;
    }

    // Tage-Array bauen
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

      const { data: feiertage, error: feiertageError } = await supabase
        .from('DB_FeiertageundFerien')
        .select('name, von, bis, farbe')
        .eq('bundesland', bundesland)
        .or(`von.lte.${ende},bis.gte.${start}`);

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

  // sichtbaren Datumsbereich an andere Komponenten schicken
  useEffect(() => {
    if (!tage || tage.length === 0) return;
    const start = tage[0].date;
    const end = tage[tage.length - 1].date;
    window.dispatchEvent(
      new CustomEvent('sp:visibleRange', { detail: { start, end } })
    );
  }, [tage]);

  // Wochen, die bei weekCount mit angezeigt werden (transparentes Blau)
  const visibleWeekSet = (() => {
    if (viewMode !== 'week' || weekCount <= 1 || weeksInYear <= 0) return new Set();
    const s = new Set();
    for (let i = 0; i < weekCount; i++) {
      const w = ((selectedWeek - 1 + i) % weeksInYear) + 1;
      s.add(w);
    }
    return s;
  })();

  return (
    <div className="bg-gray-200 dark:bg-gray-800 pt-2 px-4 pb-1 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700">
      {/* Kopfzeile */}
      <div className="flex items-center justify-left mb-2 flex-wrap gap-2">
        {/* Jahr */}
        {(() => {
          const aktJahr = new Date().getFullYear();
          return (
            <select
              value={jahr}
              onChange={(e) => setJahr(parseInt(e.target.value, 10))}
              className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-3 py-1 rounded-xl"
            >
              {[aktJahr - 1, aktJahr, aktJahr + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          );
        })()}

        {/* Wochenanzahl */}
        {viewMode === 'week' && (
          <select
            value={weekCount}
            onChange={(e) => setWeekCount(parseInt(e.target.value, 10) || 1)}
            className="bg-gray-200 dark:bg-gray-700 text-sm text-black dark:text-white px-3  rounded-xl"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} Woche{n > 1 ? 'n' : ''}
              </option>
            ))}
          </select>
        )}

        {/* Monat / Woche Toggle */}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`px-3  rounded-xl text-sm transition-all duration-150 ${
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

        {/* Monate oder KW-Buttons */}
        {viewMode === 'month' ? (
          <div className="flex gap-2 flex-wrap">
            {monate.map((name, index) => (
              <button
                key={index}
                onClick={() => setMonat(index)}
                className={`px-3 py-1 rounded-xl text-sm transition-all duration-150 ${
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
          <div className="flex gap-2 flex-wrap overflow-x-auto max-w-full">
            {Array.from({ length: weeksInYear }, (_, i) => i + 1).map((kw) => {
              const isActive = kw === selectedWeek;
              const isCurrentWeek =
                jahr === aktuelleIsoWeekYear && kw === aktuelleIsoWeek;
              const isInMultiRange =
                weekCount > 1 && visibleWeekSet.has(kw) && !isActive;

              let baseClasses =
                'px-2 py-1 rounded-xl text-xs transition-all duration-150 border ';

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
        <div className="w-[160px] min-w-[160px] flex-shrink-0"></div>

        <div className="flex gap-[2px] min-w-fit">
          {tage.map((t, index) => {
            const iso = t.date;
            const isSelected = selectedDates.has(iso);
            const hoverLabel = dayjs(iso).format('dddd, DD.MM.YYYY');

            return (
              <div
                key={index}
                title={hoverLabel}
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
