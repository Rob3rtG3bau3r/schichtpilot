import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import BedarfsAnalyseModal from './BedarfsAnalyseModal';
import { Info } from 'lucide-react';

const MitarbeiterBedarf = ({ jahr, monat, refreshKey = 0 }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [tage, setTage] = useState([]);
  const [bedarfStatus, setBedarfStatus] = useState({ F: {}, S: {}, N: {} });
  const [modalOffen, setModalOffen] = useState(false);
  const [modalDatum, setModalDatum] = useState('');
  const [modalSchicht, setModalSchicht] = useState('');
  const [fehlendeQualis, setFehlendeQualis] = useState([]);
  const [infoOffen, setInfoOffen] = useState(false);
  const [bedarfsLeiste, setBedarfsLeiste] = useState({});

  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const datum = new Date(jahr, monat, tag);
      neueTage.push(dayjs(datum).format('YYYY-MM-DD'));
    }
    setTage(neueTage);
  }, [jahr, monat]);

  const ladeMitarbeiterBedarf = async () => {
    if (!firma || !unit || tage.length === 0) return;

    const ladeDiensteGebatcht = async (alleTage) => {
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < alleTage.length; i += batchSize) {
        const start = alleTage[i];
        const end = alleTage[Math.min(i + batchSize - 1, alleTage.length - 1)];
        batches.push({ start, end });
      }

      let gesamtDienste = [];
      for (const batch of batches) {
        const { data, error } = await supabase
          .from('DB_Kampfliste')
          .select('datum, ist_schicht(kuerzel), user')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .gte('datum', batch.start)
          .lte('datum', batch.end);

        if (data?.length > 0) {
          gesamtDienste.push(...data);
        }
      }
      return gesamtDienste;
    };

    const dienste = await ladeDiensteGebatcht(tage);
    const { data: bedarf } = await supabase
  .from('DB_Bedarf')
  .select('quali_id, anzahl, von, bis, namebedarf, farbe, normalbetrieb')
  .eq('firma_id', firma)
  .eq('unit_id', unit);
    const { data: qualiMatrix } = await supabase.from('DB_Qualifikationsmatrix').select('id, quali_kuerzel, betriebs_relevant, position, qualifikation ');

    const matrixMap = {};
    qualiMatrix?.forEach(q => {
      matrixMap[q.id] = {
        kuerzel: q.quali_kuerzel,
        bezeichnung: q.qualifikation,
        relevant: q.betriebs_relevant,
        position: q.position ?? 999
      };
    });

    const userIds = [...new Set(dienste.map((d) => d.user))];
    const { data: qualis } = await supabase.from('DB_Qualifikation').select('user_id, quali');

    const chunkArray = (array, size) => {
      const result = [];
      for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
      }
      return result;
    };

    let userNameMap = {};
    if (userIds.length > 0) {
      const chunks = chunkArray(userIds, 100);
      for (const batch of chunks) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('user_id, nachname')
          .in('user_id', batch);
        userDaten?.forEach((u) => {
          userNameMap[u.user_id] = u.nachname || `User ${u.user_id}`;
        });
      }
    }

    const status = { F: {}, S: {}, N: {} };

    for (const datum of tage) {
      // Alle Bedarfe an diesem Tag
const bedarfHeuteAlle = bedarf.filter((b) => (!b.von || datum >= b.von) && (!b.bis || datum <= b.bis));

// Gibt es einen nicht-Normalbedarf für diesen Tag? → dann nur diese nehmen
const hatSpezial = bedarfHeuteAlle.some(b => b.normalbetrieb === false);

const bedarfHeute = bedarfHeuteAlle.filter(b => b.normalbetrieb === !hatSpezial);


      for (const schicht of ['F', 'S', 'N']) {
        const aktiveUser = dienste.filter((d) => d.datum === datum && d.ist_schicht?.kuerzel === schicht).map((d) => d.user);

        const userQualiMap = {};
        qualis.filter((q) => aktiveUser.includes(q.user_id)).forEach((q) => {
          if (!userQualiMap[q.user_id]) userQualiMap[q.user_id] = [];
          userQualiMap[q.user_id].push(q.quali);
        });

        const bedarfSortiert = bedarfHeute.map((b) => ({
          ...b,
          position: matrixMap[b.quali_id]?.position ?? 999,
          kuerzel: matrixMap[b.quali_id]?.kuerzel || '???',
          relevant: matrixMap[b.quali_id]?.relevant,
        })).filter((b) => b.relevant).sort((a, b) => a.position - b.position);
        const verwendeteUser = new Set();
        const userSortMap = aktiveUser.map((userId) => {
          const userQualis = userQualiMap[userId] || [];
          const relevantQualis = userQualis.filter((qid) => matrixMap[qid]?.relevant).map((qid) => ({ id: qid, position: matrixMap[qid]?.position ?? 999 }));
          const summePositionen = relevantQualis.reduce((sum, q) => sum + q.position, 0);
          return { userId, qualis: relevantQualis.map((q) => q.id), anzahl: relevantQualis.length, posSumme: summePositionen };
        });
        const userReihenfolge = userSortMap.sort((a, b) => a.anzahl - b.anzahl || a.posSumme - b.posSumme).map((u) => u.userId);
        const abdeckung = {};
        for (const b of bedarfSortiert) {
          abdeckung[b.quali_id] = [];
          for (const userId of userReihenfolge) {
            if (verwendeteUser.has(userId)) continue;
            const userQualis = userQualiMap[userId] || [];
            if (userQualis.includes(b.quali_id)) {
              abdeckung[b.quali_id].push(userId);
              verwendeteUser.add(userId);
              if (abdeckung[b.quali_id].length >= b.anzahl) break;
            }
          }
        }
        let statusfarbe = 'bg-green-500';
        let maxAbweichung = 0;
        const fehlend = [];
        for (const b of bedarfSortiert) {
          const gedeckt = abdeckung[b.quali_id]?.length || 0;
          const benoetigt = b.anzahl;
          if (gedeckt < benoetigt) {
            fehlend.push(b.kuerzel);
            statusfarbe = 'bg-red-500';
          } else {
            const überschuss = gedeckt - benoetigt;
            if (überschuss > maxAbweichung) maxAbweichung = überschuss;
          }
        }
        
let topRight = null;
if (fehlend.length === 0) {
  if (maxAbweichung === 1) topRight = 'blau-1';
  else if (maxAbweichung >= 2) topRight = 'blau-2';
}
const personenZahl = aktiveUser.length;
const gesamtBedarfZahl = bedarfSortiert.reduce((sum, b) => sum + (b.anzahl || 0), 0);

// Debug-Ausgabe:
//console.log(`[${datum} / ${schicht}] Bedarf: ${gesamtBedarfZahl}, Personen: ${personenZahl}, Fehlend: ${fehlend.join(', ')}`);

if (fehlend.length === 0) {
  if (personenZahl === gesamtBedarfZahl + 1) topRight = 'blau-1';
  else if (personenZahl >= gesamtBedarfZahl + 2) topRight = 'blau-2';
}
        const zusatzFehlt = [];
        bedarfHeute.filter((b) => !matrixMap[b.quali_id]?.relevant).forEach((b) => {
          const kuerzel = matrixMap[b.quali_id]?.kuerzel || '???';
          let vorhanden = 0;
          for (const userId of aktiveUser) {
            const qualis = userQualiMap[userId] || [];
            if (qualis.includes(b.quali_id)) vorhanden++;
          }
          if (vorhanden < b.anzahl) zusatzFehlt.push(kuerzel);
        });
        const tooltip = (() => {
          const lines = [];
          lines.push(`👥 Anzahl MA: ${aktiveUser.length}`);
          if (fehlend.length > 0) {
            lines.push('', `❌ Fehlende Quali: ${fehlend.join(', ')}`);
          }
          if (zusatzFehlt.length > 0) {
            lines.push('', `⚠️ Zusatzquali fehlt: ${zusatzFehlt.join(', ')}`);
          }
          if (Object.keys(abdeckung).length > 0) {
            lines.push('', '✔ Eingesetzt:');
            for (const qualiId in abdeckung) {
              const userIds = abdeckung[qualiId];
              const qualiName = matrixMap[qualiId]?.kuerzel || `ID:${qualiId}`;
              const namen = userIds.map((uid) => userNameMap[uid] || `User ${uid}`).join(', ');
              lines.push(`- ${qualiName}: ${namen || 'niemand'}`);
            }
          }
          const nichtVerwendete = aktiveUser.filter((id) => !verwendeteUser.has(id));
          if (nichtVerwendete.length > 0) {
            lines.push('', '🕐 Noch verfügbar:');
            for (const uid of nichtVerwendete) {
              const qualis = (userQualiMap[uid] || []).map((qid) => matrixMap[qid]?.kuerzel || `ID:${qid}`);
              lines.push(`- ${userNameMap[uid] || `User ${uid}`}: ${qualis.join(', ') || 'keine Quali'}`);
            }
          }
          return lines.join('\n');
        })();
        status[schicht][datum] = {
          farbe: statusfarbe,
          tooltip,
          bottom: fehlend.length > 0 ? fehlend[0] + (fehlend.length === 1 ? '' : '+') : null,
          topLeft: zusatzFehlt.length > 0 ? zusatzFehlt[0] : null,
          topRight,
          fehlend,
        };
      }
    }
const leiste = {};

for (const tag of tage) {
  const tagBedarfe = bedarf.filter(
    (b) =>
      b.farbe &&
      !b.normalbetrieb &&
      (!b.von || tag >= b.von) &&
      (!b.bis || tag <= b.bis)
  );

  if (tagBedarfe.length > 0) {
const eventName = [...new Set(tagBedarfe.map((b) => b.namebedarf))].join(', ');
const tooltipZeilen = [
  `${dayjs(tag).format('DD.MM.YYYY')} – ${eventName}`,
  ...tagBedarfe.map((b) => {
    const kuerzel = matrixMap[b.quali_id]?.bezeichnung || 'Unbekannt';
    const icon = b.anzahl === 1 ? '👤' : '👥';
    return `${icon} ${kuerzel}: ${b.anzahl} ${b.anzahl === 1 ? 'Person' : 'Personen'}`;
  })
];

const farben = tagBedarfe.map(b => b.farbe);
const step = 100 / farben.length;
const gradient = `linear-gradient(to right, ${farben.map((farbe, i) => {
  const start = (i * step).toFixed(0);
  const end = ((i + 1) * step).toFixed(0);
  return `${farbe} ${start}%, ${farbe} ${end}%`;
}).join(', ')})`;

leiste[tag] = {
  gradient,
  tooltip: tooltipZeilen.join('\n')
};
  }
}

setBedarfsLeiste(leiste);
    setBedarfStatus(status);
  };

  useEffect(() => {
    ladeMitarbeiterBedarf();
  }, [tage, firma, unit,refreshKey ]);


const handleModalOeffnen = (datum, kuerzel) => {
  const status = bedarfStatus[kuerzel]?.[datum];
  setModalDatum(datum);
  setModalSchicht(kuerzel);
  setFehlendeQualis(status?.fehlend || []);
  setModalOffen(true);
};

   return (
    <div className="overflow-x-auto relative rounded-xl shadow-xl border border-gray-300 dark:border-gray-700">
      {/* Info-Button */}
      <button
        className="absolute  pr-2 pt-2 top-0 right-0 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
        onClick={() => setInfoOffen(true)}
      >
        <Info size={20} />
      </button>
{/* Farbleiste ganz oben */}
<div className="flex w-full">
  <div className="w-[176px] min-w-[176px]"></div>
  <div className="flex gap-[2px]">
    {tage.map((datum) => {
      const eintrag = bedarfsLeiste[datum];
      return (
        <div
          key={datum}
          className="w-[48px] min-w-[48px] h-[6px] rounded-t"
          title={eintrag?.tooltip || ''}
          style={{
            background: eintrag?.gradient || (eintrag?.farbe || 'transparent')
          }}  
        ></div>
        
      );
    })}
  </div>
</div>
      {['F', 'S', 'N'].map((kuerzel) => (
        <div key={kuerzel} className="flex w-full">
          <div className="w-[176px] min-w-[176px] text-gray-900 dark:text-gray-300 text-left px-2 py text-xs">
            {kuerzel === 'F' ? 'Frühschicht' : kuerzel === 'S' ? 'Spätschicht' : 'Nachtschicht'}
          </div>
          <div className="flex gap-[2px]">
            {tage.map((datum) => {
              const status = bedarfStatus[kuerzel]?.[datum];
              return (
                <div
                  key={datum}
                  onClick={() => handleModalOeffnen(datum, kuerzel)}
                  className={`relative cursor-pointer w-[48px] min-w-[48px] text-center text-xs py-[2px] rounded border border-gray-300 dark:border-gray-700 hover:opacity-80 ${status?.farbe || 'bg-gray-200 dark:bg-gray-600'}`}
                  title={status?.tooltip || 'Keine Daten'}
                >
                  {status?.topLeft && (
                    <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-yellow-300 border-r-[12px] border-r-transparent pointer-events-none" />
                  )}
                  {status?.topRight === 'blau-1' && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-blue-400 border-l-[12px] border-l-transparent pointer-events-none" />
                  )}
                  {status?.topRight === 'blau-2' && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-blue-700 border-l-[12px] border-l-transparent pointer-events-none" />
                  )}
                  <div className="text-sm"></div>
                  {status?.bottom && (
                    <div className="absolute bottom-0 left-0 w-full text-[9px] text-gray-900 dark:text-white">
                      {status.bottom}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

<BedarfsAnalyseModal
  offen={modalOffen}
  onClose={() => setModalOffen(false)}
  modalDatum={modalDatum}
  modalSchicht={modalSchicht}
  fehlendeQualis={fehlendeQualis} // ✅ DAS FEHLTE!
/>

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-lg max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">Bedarfsbewertung – Legende</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><span className="font-bold text-red-500">Rot</span>: Bedarf nicht gedeckt</li>
              <li><span className="font-bold text-green-300">Grün</span>: Bedarf exakt gedeckt</li>
              <li><span className="font-bold text-green-400">Grün+</span>: +1 Person</li>
              <li><span className="font-bold text-green-500">Grün++</span>: +2 oder mehr</li>
              <li><span className="font-bold text-yellow-400">Gelbe Ecke</span>: Zusatzquali fehlt</li>
              <li><span className="font-bold text-blue-400">Blaue Ecke</span>: +1 Besetzung, Qualifikations unabhängig</li>
              <li><span className="font-bold text-blue-700">Dunkelblau</span>: +2 oder mehr Besetzung, Qualifikations unabhängig</li>
              <li>Hover zeigt fehlende oder erfüllte Qualifikationen</li><li>Im Hover wird auch angezeigt wer Dienst hat.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setInfoOffen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
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

export default MitarbeiterBedarf;