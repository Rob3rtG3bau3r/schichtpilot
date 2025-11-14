import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const Sollplan = ({ jahr, monat }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [eintraege, setEintraege] = useState([]);
  const [schichtarten, setSchichtarten] = useState([]);
  const [schichtgruppen, setSchichtgruppen] = useState([]);

  // Lade Schichtgruppen
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

  // Lade SollPlan & Schichtarten
  useEffect(() => {
    const fetchData = async () => {
      const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
      const startDatum = `${jahr}-${String(monat + 1).padStart(2, '0')}-01`;
      const endDatum = `${jahr}-${String(monat + 1).padStart(2, '0')}-${tageImMonat}`;

      const { data: eintraegeData } = await supabase
        .from('DB_SollPlan')
        .select('*')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .gte('datum', startDatum)
        .lte('datum', endDatum);

      const { data: schichtartenData } = await supabase
        .from('DB_SchichtArt')
        .select('*');

      setEintraege(eintraegeData || []);
      setSchichtarten(schichtartenData || []);
    };

    fetchData();
  }, [firma, unit, jahr, monat]);

  const tageImMonat = new Date(jahr, monat + 1, 0).getDate();


  const cellBase = "w-[48px] min-w-[48px] flex items-center justify-center text-sm border border-gray-700";
  const cellNiedrig = "h-[20px]"; // Anpassbare Höhe für Sollplan-Zellen

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 py-1 px-4 rounded-xl shadow-xl w-full">
      <div className="flex flex-col gap-1">
        {schichtgruppen.map((gruppe) => {
          const daten = eintraege.filter(e => e.schichtgruppe === gruppe);
          const tageMap = {};

          daten.forEach((e) => {
            const tagNummer = new Date(e.datum + 'T12:00:00').getDate();
            const schichtart = schichtarten.find(sa => sa.id === e.schichtart_id);
            tageMap[tagNummer] = {
              kuerzel: schichtart?.kuerzel || '???',
              bg: schichtart?.farbe_bg || '#999',
              text: schichtart?.farbe_text || '#000',
            };
          });

          const monatsstunden = daten.reduce((sum, e) => sum + (e.dauer || 0), 0);

          return (
            <div key={gruppe} className="flex">
              <div className="w-[160px] min-w-[160px] pr-2 text-gray-900 dark:text-gray-200 text-sm flex justify-between">
                <span>{gruppe}</span>
                <span className="text-gray-400">{monatsstunden} h</span>
              </div>

              <div className="flex gap-[2px] overflow-x-visible min-w-fit">
                {Array.from({ length: tageImMonat }, (_, i) => {
                  const tag = i + 1;
                  const eintrag = tageMap[tag];

                  return (
                    <div
                      key={tag}
                      className={`${cellBase} ${cellNiedrig} rounded`}
                      style={{ backgroundColor: eintrag?.bg || '#333', color: eintrag?.text || '#ccc' }}
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