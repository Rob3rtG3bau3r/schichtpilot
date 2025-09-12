import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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

  // ===== Portal-Tooltip-State =====
  const [hoverKey, setHoverKey] = useState(null); // z.B. "F|2025-09-13" oder "BAR|2025-09-13"
  const [tipData, setTipData] = useState(null);   // { text, top, left, flip, header }
  const tipTimer = useRef(null);

  const showTipAt = (el, key, text, header, alignTop = false, width = 280) => {
    if (!el || !text) return;
    if (tipTimer.current) clearTimeout(tipTimer.current);

    const rect = el.getBoundingClientRect();
    let left = rect.right + 8;
    let top  = alignTop ? rect.top + 8 : rect.top + rect.height / 2 - 12;
    let flip = false;

    const vw = window.innerWidth;
    if (left + width + 16 > vw) {
      // nach links flippen, wenn rechts kein Platz
      left = rect.left - 8 - width;
      flip = true;
    }

    // leichte Justage oben/unten, damit nichts am Rand klebt
    const vh = window.innerHeight;
    if (top < 8) top = 8;
    if (top + 140 > vh) top = Math.max(8, vh - 160);

    setHoverKey(key);
    setTipData({ text, top, left, flip, header, width });
  };

  const scheduleHide = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      setHoverKey(null);
      setTipData(null);
    }, 120);
  };

  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const d = new Date(jahr, monat, tag);
      neueTage.push(dayjs(d).format('YYYY-MM-DD'));
    }
    setTage(neueTage);
  }, [jahr, monat]);

  const ladeMitarbeiterBedarf = async () => {
    if (!firma || !unit || tage.length === 0) return;

    // --- Dienste (Kampfliste) in Blöcken laden ---
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
        const { data } = await supabase
          .from('DB_Kampfliste')
          .select('datum, ist_schicht(kuerzel), user')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .gte('datum', batch.start)
          .lte('datum', batch.end);
        if (data?.length) gesamtDienste.push(...data);
      }
      return gesamtDienste;
    };

    const dienste = await ladeDiensteGebatcht(tage);

    // --- Bedarf & Matrix laden ---
    const { data: bedarf } = await supabase
      .from('DB_Bedarf')
      .select('quali_id, anzahl, von, bis, namebedarf, farbe, normalbetrieb')
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    const { data: qualiMatrix } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, quali_kuerzel, betriebs_relevant, position, qualifikation ');

    const matrixMap = {};
    qualiMatrix?.forEach((q) => {
      matrixMap[q.id] = {
        kuerzel: q.quali_kuerzel,
        bezeichnung: q.qualifikation,
        relevant: q.betriebs_relevant,
        position: q.position ?? 999,
      };
    });

    // --- Qualifikationen & User (Sichtbarkeit/Namen) ---
    const userIds = [...new Set(dienste.map((d) => d.user))];

    const { data: qualis } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali, created_at');

    const chunkArray = (arr, size) => {
      const out = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    let userNameMap = {};
    let userVisibleMap = {};
    if (userIds.length > 0) {
      const chunks = chunkArray(userIds, 100);
      for (const batch of chunks) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('user_id, nachname, user_visible')
          .in('user_id', batch);
        userDaten?.forEach((u) => {
          userNameMap[u.user_id] = u.nachname || `User ${u.user_id}`;
          userVisibleMap[u.user_id] = (u.user_visible ?? true); // default sichtbar
        });
      }
    }

    const status = { F: {}, S: {}, N: {} };

    for (const datum of tage) {
      // Bedarfe am Tag (Spezial vs Normalbetrieb)
      const bedarfHeuteAlle = bedarf.filter(
        (b) => (!b.von || datum >= b.von) && (!b.bis || datum <= b.bis)
      );
      const hatSpezial = bedarfHeuteAlle.some((b) => b.normalbetrieb === false);
      const bedarfHeute = bedarfHeuteAlle.filter((b) => b.normalbetrieb === !hatSpezial);

      for (const schicht of ['F', 'S', 'N']) {
        // Aktive User (Schicht/Tag), unsichtbare raus
        const aktiveUserRaw = dienste
          .filter((d) => d.datum === datum && d.ist_schicht?.kuerzel === schicht)
          .map((d) => d.user);
        const aktiveUser = aktiveUserRaw.filter((uid) => userVisibleMap[uid] !== false);

        // Quali-Map nur mit gültigen Qualis ab created_at
        const userQualiMap = {};
        qualis
          .filter((q) => aktiveUser.includes(q.user_id))
          .forEach((q) => {
            const gueltigAb = dayjs(q.created_at);
            const tag = dayjs(datum);
            if (tag.isBefore(gueltigAb, 'day')) return; // am Tag noch nicht gültig
            if (!userQualiMap[q.user_id]) userQualiMap[q.user_id] = [];
            userQualiMap[q.user_id].push(q.quali);
          });

        // Bedarf (nur betriebsrelevant) priorisiert
        const bedarfSortiert = bedarfHeute
          .map((b) => ({
            ...b,
            position: matrixMap[b.quali_id]?.position ?? 999,
            kuerzel: matrixMap[b.quali_id]?.kuerzel || '???',
            relevant: matrixMap[b.quali_id]?.relevant,
          }))
          .filter((b) => b.relevant)
          .sort((a, b) => a.position - b.position);

        // User-Reihenfolge (wenig relevante Qualis zuerst)
        const verwendeteUser = new Set();
        const userSortMap = aktiveUser.map((userId) => {
          const userQualis = userQualiMap[userId] || [];
          const relevantQualis = userQualis
            .filter((qid) => matrixMap[qid]?.relevant)
            .map((qid) => ({ id: qid, position: matrixMap[qid]?.position ?? 999 }));
          const posSum = relevantQualis.reduce((s, q) => s + q.position, 0);
          return {
            userId,
            qualis: relevantQualis.map((q) => q.id),
            anzahl: relevantQualis.length,
            posSumme: posSum,
          };
        });

        const userReihenfolge = userSortMap
          .sort((a, b) => a.anzahl - b.anzahl || a.posSumme - b.posSumme)
          .map((u) => u.userId);

        // Abdeckung pro Quali
        const abdeckung = {};
        for (const b of bedarfSortiert) {
          abdeckung[b.quali_id] = [];
          for (const uid of userReihenfolge) {
            if (verwendeteUser.has(uid)) continue;
            const qualisDesUsers = userQualiMap[uid] || [];
            if (qualisDesUsers.includes(b.quali_id)) {
              abdeckung[b.quali_id].push(uid);
              verwendeteUser.add(uid);
              if (abdeckung[b.quali_id].length >= (b.anzahl || 0)) break;
            }
          }
        }

        // Bewertung
        let statusfarbe = 'bg-green-500';
        let totalMissing = 0;
        const fehlend = [];
        let topMissingKuerzel = null;

        for (const b of bedarfSortiert) {
          const gedeckt = abdeckung[b.quali_id]?.length || 0;
          const benoetigt = b.anzahl || 0;

          if (gedeckt < benoetigt) {
            const missing = benoetigt - gedeckt;
            totalMissing += missing;
            if (!topMissingKuerzel) topMissingKuerzel = matrixMap[b.quali_id]?.kuerzel || b.kuerzel;
            if (!fehlend.includes(b.kuerzel)) fehlend.push(b.kuerzel);
            statusfarbe = 'bg-red-500';
          }
        }

        // Überschuss gesamt
        let topRight = null;
        if (totalMissing === 0 && bedarfSortiert.length > 0) {
          const benoetigtGesamt = bedarfSortiert.reduce((s, b) => s + (b.anzahl || 0), 0);
          const ueberschussGesamt = (aktiveUser?.length || 0) - benoetigtGesamt;
          if (ueberschussGesamt === 1) topRight = 'blau-1';
          else if (ueberschussGesamt >= 2) topRight = 'blau-2';
        }

        // Zusatz-Qualifikationen (nicht betriebsrelevant)
        const zusatzFehlt = [];
        bedarfHeute
          .filter((b) => !matrixMap[b.quali_id]?.relevant)
          .forEach((b) => {
            const kurz = matrixMap[b.quali_id]?.kuerzel || '???';
            let vorhanden = 0;
            for (const uid of aktiveUser) {
              const qlist = userQualiMap[uid] || [];
              if (qlist.includes(b.quali_id)) vorhanden++;
            }
            if (vorhanden < (b.anzahl || 0)) zusatzFehlt.push(kurz);
          });

        // Tooltip-Text
        const tooltip = (() => {
          const lines = [];
          lines.push(`👥 Anzahl MA: ${aktiveUser.length}`);
          if (fehlend.length > 0) lines.push('', `❌ Fehlende Quali: ${fehlend.join(', ')}`);
          if (zusatzFehlt.length > 0) lines.push('', `⚠️ Zusatzquali fehlt: ${zusatzFehlt.join(', ')}`);
          if (Object.keys(abdeckung).length > 0) {
            lines.push('', '✔ Eingesetzt:');
            for (const qualiId in abdeckung) {
              const uids = abdeckung[qualiId];
              const qname = matrixMap[qualiId]?.kuerzel || `ID:${qualiId}`;
              const namen = uids.map((uid) => userNameMap[uid] || `User ${uid}`).join(', ');
              lines.push(`- ${qname}: ${namen || 'niemand'}`);
            }
          }
          const nichtVerwendete = aktiveUser.filter((id) => !verwendeteUser.has(id));
          if (nichtVerwendete.length > 0) {
            lines.push('', '🕐 Noch verfügbar:');
            for (const uid of nichtVerwendete) {
              const qlist = (userQualiMap[uid] || []).map((qid) => matrixMap[qid]?.kuerzel || `ID:${qid}`);
              lines.push(`- ${userNameMap[uid] || `User ${uid}`}: ${qlist.join(', ') || 'keine Quali'}`);
            }
          }
          return lines.join('\n');
        })();

        const bottom = topMissingKuerzel
          ? `${topMissingKuerzel}${totalMissing > 1 ? '+' : ''}`
          : null;

        status[schicht][datum] = {
          farbe: statusfarbe,
          tooltip,
          bottom,
          topLeft: zusatzFehlt.length > 0 ? zusatzFehlt[0] : null,
          topRight,
          fehlend,
        };
      }
    }

    // Farbleiste oben (Sonder-/Zeitbedarfe)
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
            const bez = matrixMap[b.quali_id]?.bezeichnung || 'Unbekannt';
            const icon = b.anzahl === 1 ? '👤' : '👥';
            return `${icon} ${bez}: ${b.anzahl} ${b.anzahl === 1 ? 'Person' : 'Personen'}`;
          }),
        ];

        const farben = tagBedarfe.map((b) => b.farbe);
        const step = 100 / farben.length;
        const gradient = `linear-gradient(to right, ${farben
          .map((farbe, i) => {
            const start = (i * step).toFixed(0);
            const end = ((i + 1) * step).toFixed(0);
            return `${farbe} ${start}%, ${farbe} ${end}%`;
          })
          .join(', ')})`;

        leiste[tag] = {
          gradient,
          tooltip: tooltipZeilen.join('\n'),
        };
      }
    }

    setBedarfsLeiste(leiste);
    setBedarfStatus(status);
  };

  useEffect(() => {
    ladeMitarbeiterBedarf();
  }, [tage, firma, unit, refreshKey]);

  const handleModalOeffnen = (datum, kuerzel) => {
    const status = bedarfStatus[kuerzel]?.[datum];
    setModalDatum(datum);
    setModalSchicht(kuerzel);
    setFehlendeQualis(status?.fehlend || []);
    setModalOffen(true);
  };

  return (
    <div className="overflow-x-auto relative rounded-xl shadow-xl border border-gray-300 dark:border-gray-700" style={{ overflowY: 'visible' }}>
      {/* Info-Button */}
      <button
        className="absolute pr-2 pt-2 top-0 right-0 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
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
            const key = `BAR|${datum}`;
            const header = `${dayjs(datum).format('DD.MM.YYYY')} · Sonderbedarf`;
            return (
              <div
                key={datum}
                className="relative w-[48px] min-w-[48px] h-[6px] rounded-t"
                style={{ background: eintrag?.gradient || (eintrag?.farbe || 'transparent') }}
                onMouseEnter={(e) => eintrag?.tooltip && showTipAt(e.currentTarget, key, eintrag.tooltip, header, true)}
                onMouseLeave={scheduleHide}
              />
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
              const key = `${kuerzel}|${datum}`;
              const header = `${dayjs(datum).format('DD.MM.YYYY')} · ${kuerzel === 'F' ? 'Frühschicht' : kuerzel === 'S' ? 'Spätschicht' : 'Nachtschicht'}`;

              return (
                <div
                  key={datum}
                  onClick={() => handleModalOeffnen(datum, kuerzel)}
                  onMouseEnter={(e) => status?.tooltip && showTipAt(e.currentTarget, key, status.tooltip, header, kuerzel === 'F')}
                  onMouseLeave={scheduleHide}
                  className={`relative cursor-pointer w-[48px] min-w-[48px] text-center text-xs py-[2px] rounded border border-gray-300 dark:border-gray-700 hover:opacity-80 ${status?.farbe || 'bg-gray-200 dark:bg-gray-600'}`}
                >
                  {status?.topLeft && (
                    <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-yellow-300 border-r-[12px] border-r-transparent pointer-events-none" />
                  )}
                  {status?.topRight === 'blau-1' && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-green-300 border-l-[12px] border-l-transparent pointer-events-none" />
                  )}
                  {status?.topRight === 'blau-2' && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-green-700 border-l-[12px] border-l-transparent pointer-events-none" />
                  )}
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

      {/* Portal-Tooltip */}
      {tipData && createPortal(
        <div
          onMouseEnter={() => {
            if (tipTimer.current) clearTimeout(tipTimer.current);
          }}
          onMouseLeave={scheduleHide}
          style={{ position: 'fixed', top: tipData.top, left: tipData.left, zIndex: 100000, pointerEvents: 'auto' }}
        >
          <div
            className="relative px-3 py-2 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10
                       bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 text-xs"
            style={{ width: tipData.width || 280 }}
          >
            {/* Pfeil */}
            <div
              className="absolute w-2 h-2 rotate-45 ring-1 ring-black/10 dark:ring-white/10"
              style={{
                top: '12px',
                ...(tipData.flip
                  ? { right: '-4px', background: 'rgba(17,24,39,0.95)' }   // dark:bg-gray-900/95
                  : { left: '-4px',  background: 'rgba(255,255,255,0.95)' } // bg-white/95
                )
              }}
            />
            {/* Header */}
            {tipData.header && <div className="font-sans font-semibold mb-1">{tipData.header}</div>}
            {/* Inhalt */}
            <pre className="whitespace-pre-wrap font-mono">{tipData.text}</pre>
          </div>
        </div>,
        document.body
      )}

      <BedarfsAnalyseModal
        offen={modalOffen}
        onClose={() => setModalOffen(false)}
        modalDatum={modalDatum}
        modalSchicht={modalSchicht}
        fehlendeQualis={fehlendeQualis}
      />

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-lg max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">Bedarfsbewertung – Legende</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><span className="font-bold text-red-500">Rot</span>: Bedarf nicht gedeckt</li>
              <li><span className="font-bold text-green-300">Grün</span>: Bedarf exakt gedeckt</li>
              <li><span className="font-bold text-yellow-400">Gelbe Ecke</span>: Zusatzquali fehlt</li>
              <li><span className="font-bold text-green-300">Grüne Ecke</span>: +1 Besetzung, Qualifikations unabhängig</li>
              <li><span className="font-bold text-green-700">Dunkelgrün</span>: +2 oder mehr Besetzung, Qualifikations unabhängig</li>
              <li>Hover zeigt fehlende oder erfüllte Qualifikationen</li>
              <li>Im Hover wird auch angezeigt, wer Dienst hat.</li>
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
