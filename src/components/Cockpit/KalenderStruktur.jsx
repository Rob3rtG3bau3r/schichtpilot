// src/components/Cockpit/KalenderStruktur.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';

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

  const today = dayjs();
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

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

  // Sichtbare Tage + Einträge laden (nur Monatslogik)
  useEffect(() => {
    if (!firma || !unit) return;

    const heute = dayjs();
    const startDate = dayjs(new Date(jahr, monat, 1));
    const endDate = dayjs(new Date(jahr, monat + 1, 0));

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

      // Land + Bundesland der Unit holen
      const { data: unitData, error: unitError } = await supabase
        .from('DB_Unit')
        .select('land, bundesland')
        .eq('id', unit)
        .single();

      if (unitError) {
        console.error('❌ Fehler beim Laden der Unit:', unitError.message);
        return;
      }

      const land = (unitData?.land || '').trim();
      const bundesland = (unitData?.bundesland || '').trim();

      if (!land) {
        console.warn('⚠️ Unit hat kein Land gesetzt (DB_Unit.land). Feiertage/Ferien können nicht geladen werden.');
      }

      // Ferien & Feiertage:
      // - muss zum Land passen
      // - und entweder bundesweit (ist_bundesweit=true) ODER passendes Bundesland
      // - Zeitraum-Overlap: von <= ende UND bis >= start
      // Hinweis: Wir gehen davon aus, dass "bis" immer gesetzt ist (Feiertag: bis=von).
      let feiertage = [];
      if (land) {
        const { data: ff, error: feiertageError } = await supabase
          .from('DB_FeiertageundFerien')
          .select('typ, name, von, bis, farbe, land, bundesland, ist_bundesweit')
          .eq('land', land)
          .or(`ist_bundesweit.eq.true,bundesland.eq.${bundesland}`)
          .lte('von', ende)
          .gte('bis', start);

        if (feiertageError) {
          console.error('❌ Fehler beim Laden Feiertage/Ferien:', feiertageError.message);
          return;
        }
        feiertage = ff || [];
      }

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

      if (termineError || qualisError) {
        console.error(
          '❌ Fehler beim Laden der Einträge:',
          termineError || qualisError
        );
        return;
      }

      const map = {};
      (qualis || []).forEach((q) => {
        map[q.id] = q.qualifikation;
      });
      setQualiMap(map);

      setEintraege({
        feiertage,
        termine: termine || [],
      });
    };

    ladeEintraege();
  }, [jahr, monat, firma, unit]);

  // sichtbaren Datumsbereich an andere Komponenten schicken
  useEffect(() => {
    if (!tage || tage.length === 0) return;

    const start = tage[0].date;
    const end = tage[tage.length - 1].date;

    if (typeof window !== 'undefined') {
      window.__spVisibleRange = { start, end };
    }

    window.dispatchEvent(
      new CustomEvent('sp:visibleRange', {
        detail: { start, end },
      })
    );
  }, [tage]);

  const { feiertage, termine } = eintraege;

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

        {/* Monate */}
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
      </div>

      {/* Kalenderspalten */}
      <div className="flex overflow-x-visible text-center text-sm">
        {/* linke Leerspalte (für Namen, Teams etc. im Cockpit) */}
        <div className="w-[160px] min-w-[160px] flex-shrink-0"></div>

        <div className="flex gap-[2px] min-w-fit">
          {tage.map((t, index) => {
            const iso = t.date;
            const isSelected = selectedDates.has(iso);
            const datumLabel = dayjs(iso).format('dddd, DD.MM.YYYY');

            // --- Ferien & Feiertage für diesen Tag (Bereich von-bis) ---
            const ffHeute = (feiertage || []).filter((f) => {
              const von = dayjs(f.von);
              const bis = dayjs(f.bis || f.von);
              const d = dayjs(iso);
              return (d.isSame(von, 'day') || d.isAfter(von, 'day')) &&
                     (d.isSame(bis, 'day') || d.isBefore(bis, 'day'));
            });

            const ferien = ffHeute.filter((f) =>
              (f.typ || '').toLowerCase().includes('ferien')
            );
            const feiertagTag = ffHeute.filter((f) =>
              (f.typ || '').toLowerCase().includes('feiertag')
            );

            const termineHeute = (termine || []).filter((e) => e.datum === iso);

            const ferienColor = ferien[0]?.farbe || '#10b981';
            const feiertagColor = feiertagTag[0]?.farbe || '#ef4444';
            const terminColor = termineHeute[0]?.farbe || '#3b82f6';

            const ferienTitle = ferien.length
              ? (() => {
                  const f = ferien[0];
                  const von = dayjs(f.von).format('DD.MM.');
                  const bis = dayjs(f.bis || f.von).format('DD.MM.');
                  return `Ferien: ${f.name || ''} (${von} – ${bis})`;
                })()
              : '';

            const feiertagTitle = feiertagTag.length
              ? (() => {
                  const f = feiertagTag[0];
                  const bw = f.ist_bundesweit ? 'bundesweit' : (f.bundesland || '');
                  return `Feiertag: ${f.name || ''}${bw ? ` (${bw})` : ''}`;
                })()
              : '';

            const terminTitle = termineHeute.length
              ? (() => {
                  const t0 = termineHeute[0];
                  let qualiText = '';
                  if (Array.isArray(t0.quali_ids) && t0.quali_ids.length) {
                    const namen = t0.quali_ids
                      .map((id) => qualiMap[id])
                      .filter(Boolean);
                    if (namen.length) {
                      qualiText = ` | Quali: ${namen.join(', ')}`;
                    }
                  }
                  let teamText = '';
                  if (Array.isArray(t0.team) && t0.team.length) {
                    teamText = ` | Team: ${t0.team.join(', ')}`;
                  }
                  const rest =
                    termineHeute.length > 1
                      ? ` + ${termineHeute.length - 1} weitere`
                      : '';
                  return `Termin: ${t0.bezeichnung || ''}${rest}${qualiText}${teamText}`;
                })()
              : '';

            const fullTitle = [
              datumLabel,
              ferienTitle,
              feiertagTitle,
              terminTitle,
            ]
              .filter(Boolean)
              .join(' | ');

            return (
              <div
                key={index}
                title={fullTitle}
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
                {/* Ferien-Balken oben */}
                {ferien.length > 0 && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[4px] rounded-t-[6px]"
                    style={{ backgroundColor: ferienColor }}
                    title={ferienTitle}
                  />
                )}

                {/* Feiertag-Balken unten (statt Punkt) */}
                {feiertagTag.length > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[4px] rounded-b-[6px]"
                    style={{ backgroundColor: feiertagColor }}
                    title={feiertagTitle}
                  />
                )}

                {/* Termin-Ecke unten links */}
                {termineHeute.length > 0 && (
                  <>
                    <div
                      className="absolute bottom-0 left-0 w-0 h-0"
                      style={{
                        borderBottom: '12px solid white',
                        borderRight: '12px solid transparent',
                        zIndex: 5,
                      }}
                    />
                    <div
                      className="absolute bottom-0 left-0 w-0 h-0"
                      style={{
                        borderBottom: `10px solid ${terminColor}`,
                        borderRight: '10px solid transparent',
                        zIndex: 10,
                      }}
                      title={terminTitle}
                    />
                  </>
                )}

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
