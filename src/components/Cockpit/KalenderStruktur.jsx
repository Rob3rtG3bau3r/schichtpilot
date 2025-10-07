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
  
  const { sichtFirma: firma, sichtUnit: unit } = useRollen(); // ✅ Richtig platziert!

  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];
    const heute = new Date();

    for (let tag = 1; tag <= tageImMonat; tag++) {
      const datum = new Date(jahr, monat, tag);
      const wochentag = datum.toLocaleDateString('de-DE', { weekday: 'short' });
      const isHeute = datum.toDateString() === heute.toDateString();
      const tagNummer = datum.getDay();

      neueTage.push({
        tag,
        wochentag,
        isHeute,
        isSonntag: tagNummer === 0,
        isSamstag: tagNummer === 6,
      });
    }

    setTage(neueTage);

    const ladeEintraege = async () => {
  const start = dayjs(new Date(jahr, monat, 1)).format('YYYY-MM-DD');
  const ende = dayjs(new Date(jahr, monat + 1, 0)).format('YYYY-MM-DD');


  // 1. Bundesland der Unit laden
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

  // 2. Feiertage für dieses Bundesland laden
  const { data: feiertage, error: feiertageError } = await supabase
    .from('DB_FeiertageundFerien')
    .select('name, von, bis, farbe')
    .eq('bundesland', bundesland)
    .or(`von.lte.${ende},bis.gte.${start}`);

  // 3. Termine & Qualis laden
  const [{ data: termine, error: termineError }, { data: qualis, error: qualisError }] = await Promise.all([
    supabase
      .from('DB_TerminVerwaltung')
      .select('datum, bezeichnung, farbe, quali_ids, team')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', start)
      .lte('datum', ende),
    supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, qualifikation')
  ]);

  if (feiertageError || termineError || qualisError) {
    console.error('❌ Fehler beim Laden der Einträge:', feiertageError || termineError || qualisError);
    return;
  }

  const map = {};
  qualis.forEach(q => {
    map[q.id] = q.qualifikation;
  });
  setQualiMap(map);

  setEintraege({
    feiertage,
    termine,
  });
};
    ladeEintraege(); // ← ⬅️⬅️ Das hat gefehlt!
  }, [jahr, monat]);
  return (
    <div className="bg-gray-200 dark:bg-gray-800 pt-2 px-4 pb-1 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-left mb-2 flex-wrap gap-2">
        {(() => {
          const aktJahr = new Date().getFullYear();
          return (
            <select
              value={jahr}
              onChange={(e) => setJahr(parseInt(e.target.value))}
              className="bg-gray-200 dark:bg-gray-700 text-black dark:text-white px-3 py-1 rounded"
            >
              {[aktJahr - 1, aktJahr, aktJahr + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          );
        })()}

        <div className="flex gap-2 flex-wrap">
          {monate.map((name, index) => (
            <button
              key={index}
              onClick={() => setMonat(index)}
              className={`px-3 py-1 rounded text-sm transition-all duration-150 ${
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

      <div className="flex overflow-x-visible text-center text-sm">
        <div className="w-[160px] min-w-[160px] flex-shrink-0"></div>
        <div className="flex gap-[2px] min-w-fit">
          {tage.map((t, index) => (
            <div
              key={index}
              className={`relative flex flex-col items-center justify-center h-[42px] w-[48px] min-w-[48px] rounded 
                ${t.isSonntag ? 'bg-red-600 text-white' : ''}
                ${t.isSamstag ? 'bg-orange-500 text-white' : ''}
                ${!t.isSonntag && !t.isSamstag ? 'bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-white' : ''}
                ${t.isHeute ? 'border-2 border-yellow-400' : ''}
              `}
            >
              {/* Feiertage/Ferien */}
              {eintraege?.feiertage
                ?.filter(e => {
                  const tagDate = dayjs(new Date(jahr, monat, t.tag)).format('YYYY-MM-DD');
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

              {/* Termine als Dreieck unten links */}
              {eintraege?.termine
                ?.filter(e => dayjs(e.datum).date() === t.tag)
                .map((e, idx) => {
                  const tooltip = `📅 ${dayjs(e.datum).format('DD.MM.YYYY')}\n📝 ${e.bezeichnung}\n👥 Für:` +
                    (e.quali_ids?.length ? `\n- Qualifikationen: ${e.quali_ids.map(id => qualiMap[id] || id).join(', ')}` : '') +
                    (e.team?.length ? `\n- Teams: ${e.team.join(', ')}` : '');

return (
  <div key={'t-' + idx} className="absolute bottom-0 left-0">
    {/* Weißes „Hintergrund“-Dreieck (etwas größer) */}
    <div
      className="absolute bottom-0 left-0 w-0 h-0 pointer-events-none"
      style={{
        borderLeft: '14px solid transparent',   // +2px größer
        borderTop:  '14px solid #fff',           // weißer Rand
        transform:  'rotate(180deg)',
        zIndex: 5,
      }}
      aria-hidden
    />
    {/* Farbiges Dreieck (dein bisheriges) */}
    <div
      className="absolute bottom-0 left-0 w-0 h-0"
      style={{
        borderLeft: '12px solid transparent',
        borderTop:  `12px solid ${e.farbe}`,
        transform:  'rotate(180deg)',
        zIndex: 10,
      }}
      title={tooltip}
    />
  </div>
);
                })}

              <span className="text-[12px] leading-none">{t.wochentag}</span>
              <span className="font-semibold text-sm leading-none">{t.tag}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KalenderStruktur;