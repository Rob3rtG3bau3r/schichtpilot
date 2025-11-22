// src/components/Dashboard/Sollplan.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const Sollplan = ({ jahr, monat }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [eintraege, setEintraege] = useState([]);
  const [schichtarten, setSchichtarten] = useState([]);
  const [schichtgruppen, setSchichtgruppen] = useState([]);

  // sichtbarer Datumsbereich (Monat oder Wochenbereich) aus KalenderStruktur
  const [rangeStart, setRangeStart] = useState(null); // 'YYYY-MM-DD'
  const [rangeEnd, setRangeEnd] = useState(null);     // 'YYYY-MM-DD'

  // 📡 Listener für sichtbaren Bereich (kommt aus KalenderStruktur)
  useEffect(() => {
    const handler = (e) => {
      const { start, end } = e.detail || {};
      setRangeStart(start || null);
      setRangeEnd(end || null);
    };

    window.addEventListener('sp:visibleRange', handler);
    return () => window.removeEventListener('sp:visibleRange', handler);
  }, []);

  // Schichtgruppen laden
  useEffect(() => {
    const ladeSchichtgruppen = async () => {
      if (!unit) return;
      const { data, error } = await supabase
        .from('DB_Unit')
        .select('schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
        .eq('id', unit)
        .single();

      if (error) {
        console.error('Fehler beim Laden der Schichtgruppen:', error.message);
        return;
      }

      const gruppen = [
        data.schichtname1,
        data.schichtname2,
        data.schichtname3,
        data.schichtname4,
        data.schichtname5,
        data.schichtname6,
      ].filter(Boolean);

      setSchichtgruppen(gruppen);
    };

    ladeSchichtgruppen();
  }, [unit]);

  // SollPlan & Schichtarten laden (abhängig von sichtbarem Zeitraum)
  useEffect(() => {
    const fetchData = async () => {
      if (!firma || !unit) return;

      const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
      let startDatum;
      let endDatum;

      if (rangeStart && rangeEnd) {
        // Wochen-/Bereichsansicht → genau dieser Bereich (monatsübergreifend möglich)
        startDatum = rangeStart;
        endDatum = rangeEnd;
      } else {
        // Fallback: kompletter Monat
        startDatum = `${jahr}-${String(monat + 1).padStart(2, '0')}-01`;
        endDatum = `${jahr}-${String(monat + 1).padStart(2, '0')}-${tageImMonat}`;
      }

      const { data: eintraegeData, error: eintraegeErr } = await supabase
        .from('DB_SollPlan')
        .select('*')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .gte('datum', startDatum)
        .lte('datum', endDatum);

      if (eintraegeErr) {
        console.error('Fehler beim Laden des SollPlans:', eintraegeErr.message);
      }

      const { data: schichtartenData, error: schichtartenErr } = await supabase
        .from('DB_SchichtArt')
        .select('*');

      if (schichtartenErr) {
        console.error('Fehler beim Laden der Schichtarten:', schichtartenErr.message);
      }

      setEintraege(eintraegeData || []);
      setSchichtarten(schichtartenData || []);
    };

    fetchData();
  }, [firma, unit, jahr, monat, rangeStart, rangeEnd]);

  // Sichtbare Tage-Liste (für Spalten) – entweder Bereich oder kompletter Monat
  const tageImMonat = new Date(jahr, monat + 1, 0).getDate();

  const tage = (() => {
    const result = [];

    if (rangeStart && rangeEnd) {
      // Wochen-/Bereichsansicht → von rangeStart bis rangeEnd
      let current = new Date(rangeStart + 'T12:00:00');
      const end = new Date(rangeEnd + 'T12:00:00');

      while (current <= end) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1;
        const day = current.getDate();
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        const wochentag = current.toLocaleDateString('de-DE', { weekday: 'short' });

        result.push({
          date: iso,
          tag: day,
          wochentag,
        });

        current.setDate(current.getDate() + 1);
      }
    } else {
      // Fallback: kompletter Monat (1..tageImMonat)
      for (let tag = 1; tag <= tageImMonat; tag++) {
        const year = jahr;
        const month = monat + 1;
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
        const d = new Date(`${iso}T12:00:00`);
        const wochentag = d.toLocaleDateString('de-DE', { weekday: 'short' });

        result.push({
          date: iso,
          tag,
          wochentag,
        });
      }
    }

    return result;
  })();

  const cellBase = "w-[48px] min-w-[48px] flex items-center justify-center text-sm border border-gray-700";
  const cellNiedrig = "h-[20px]"; // Höhe für Sollplan-Zellen

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 py-1 px-4 rounded-xl shadow-xl w-full">
      <div className="flex flex-col gap-1">
        {schichtgruppen.map((gruppe) => {
          const daten = eintraege.filter(e => e.schichtgruppe === gruppe);

          // Map: datumISO -> Schichtinfo
          const tageMap = {};
          daten.forEach((e) => {
            const datumIso = e.datum; // 'YYYY-MM-DD'
            const schichtart = schichtarten.find(sa => sa.id === e.schichtart_id);
            tageMap[datumIso] = {
              kuerzel: schichtart?.kuerzel || '???',
              bg: schichtart?.farbe_bg || '#999',
              text: schichtart?.farbe_text || '#000',
              dauer: e.dauer || 0,
            };
          });

          const monatsstunden = daten.reduce((sum, e) => sum + (e.dauer || 0), 0);

          return (
            <div key={gruppe} className="flex">
              {/* linke Spalte: Schichtgruppe + Stunden */}
              <div className="w-[160px] min-w-[160px] pr-2 text-gray-900 dark:text-gray-200 text-sm flex justify-between">
                <span>{gruppe}</span>
                <span className="text-gray-400">{monatsstunden} h</span>
              </div>

              {/* rechte Spalten: Tage im sichtbaren Bereich */}
              <div className="flex gap-[2px] overflow-x-visible min-w-fit">
                {tage.map((t) => {
                  const iso = t.date;
                  const eintrag = tageMap[iso];

                  return (
                    <div
                      key={iso}
                      className={`${cellBase} ${cellNiedrig} rounded`}
                      style={{ backgroundColor: eintrag?.bg || '#333', color: eintrag?.text || '#ccc' }}
                      title={iso} // optional: Datum als Tooltip
                    >
                      {eintrag ? (
                        <div
                          className="w-[40px] h-[14px] flex items-center font-semibold justify-center rounded"
                          style={{
                            backgroundColor: eintrag.bg,
                            color: eintrag.text,
                            fontSize: '0.60rem',
                            lineHeight: '1',
                            padding: '1px',
                          }}
                        >
                          <span>{eintrag.kuerzel}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-gray-400">leer</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sollplan;
