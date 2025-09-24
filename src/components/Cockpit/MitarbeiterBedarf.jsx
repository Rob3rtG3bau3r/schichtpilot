// src/components/Dashboard/MitarbeiterBedarf.jsx (Lazy-Tooltips + Cache)
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import BedarfsAnalyseModal from './BedarfsAnalyseModal';
import { Info } from 'lucide-react';

const FEATURE_TOOLTIP = 'tooltip_schichtuebersicht';
const FEATURE_ANALYSE = 'bedarf_analyse';

const MitarbeiterBedarf = ({ jahr, monat, refreshKey = 0 }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [tage, setTage] = useState([]);
  const [bedarfStatus, setBedarfStatus] = useState({ F: {}, S: {}, N: {} });
  const [bedarfsLeiste, setBedarfsLeiste] = useState({});

  // Globale Maps für Lazy-Tooltip-Builder
  const [userNameMapState, setUserNameMapState] = useState({});
  const [matrixMapState, setMatrixMapState] = useState({});

  // Feature-Flags
  const [allowTooltip, setAllowTooltip] = useState(false);
  const [allowAnalyse, setAllowAnalyse] = useState(false);

  // Modal
  const [modalOffen, setModalOffen] = useState(false);
  const [modalDatum, setModalDatum] = useState('');
  const [modalSchicht, setModalSchicht] = useState('');
  const [fehlendeQualis, setFehlendeQualis] = useState([]);

  // Info
  const [infoOffen, setInfoOffen] = useState(false);

  // ===== Tooltip infra: Cache + Show/Hide Timer =====
  const [tipData, setTipData] = useState(null);   // { text, top, left, flip, header, width }
  const tipHideTimer = useRef(null);
  const tipShowTimer = useRef(null);
  const tooltipCache = useRef(new Map()); // key -> text

  const clearShowTimer = () => {
    if (tipShowTimer.current) {
      clearTimeout(tipShowTimer.current);
      tipShowTimer.current = null;
    }
  };
  const clearHideTimer = () => {
    if (tipHideTimer.current) {
      clearTimeout(tipHideTimer.current);
      tipHideTimer.current = null;
    }
  };

  const showTipAt = (el, key, text, header, alignTop = false, width = 280) => {
    if (!allowTooltip || !el || !text) return;

    const rect = el.getBoundingClientRect();
    let left = rect.right + 8;
    let top  = alignTop ? rect.top + 8 : rect.top + rect.height / 2 - 12;
    let flip = false;

    const vw = window.innerWidth;
    if (left + width + 16 > vw) {
      left = rect.left - 8 - width;
      flip = true;
    }

    const vh = window.innerHeight;
    if (top < 8) top = 8;
    if (top + 140 > vh) top = Math.max(8, vh - 160);

    setTipData({ text, top, left, flip, header, width });
  };

  const scheduleShow = (el, key, buildFn, header, alignTop = false, width = 280) => {
    if (!allowTooltip) return;
    clearShowTimer();
    clearHideTimer();
    tipShowTimer.current = setTimeout(() => {
      let txt = tooltipCache.current.get(key);
      if (!txt) {
        try { txt = buildFn(); } catch { txt = ''; }
        if (txt) tooltipCache.current.set(key, txt);
      }
      if (txt) showTipAt(el, key, txt, header, alignTop, width);
    }, 180); // Show-Delay
  };

  const scheduleHide = () => {
    clearShowTimer();
    clearHideTimer();
    tipHideTimer.current = setTimeout(() => {
      setTipData(null);
    }, 120);
  };

  // Cache bei Kontextwechsel leeren
  useEffect(() => {
    tooltipCache.current = new Map();
  }, [firma, unit, jahr, monat, refreshKey]);

  // Tage aufbauen
  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const neueTage = [];
    for (let tag = 1; tag <= tageImMonat; tag++) {
      const d = new Date(jahr, monat, tag);
      neueTage.push(dayjs(d).format('YYYY-MM-DD'));
    }
    setTage(neueTage);
  }, [jahr, monat]);

  // Feature-Flags laden
  useEffect(() => {
    let alive = true;
    const loadFlags = async () => {
      if (!firma || !unit) return;
      try {
        const [{ data: tip }, { data: ana }] = await Promise.all([
          supabase.rpc('feature_enabled_for_unit', {
            p_kunden_id: firma,
            p_unit_id: unit,
            p_feature_key: FEATURE_TOOLTIP,
          }),
          supabase.rpc('feature_enabled_for_unit', {
            p_kunden_id: firma,
            p_unit_id: unit,
            p_feature_key: FEATURE_ANALYSE,
          }),
        ]);
        if (!alive) return;
        setAllowTooltip(!!tip);
        setAllowAnalyse(!!ana);
      } catch (e) {
        console.error('Feature-Flags laden fehlgeschlagen', e);
        if (!alive) return;
        setAllowTooltip(false);
        setAllowAnalyse(false);
      }
    };
    loadFlags();
    return () => { alive = false; };
  }, [firma, unit]);

  // Daten laden
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
    setMatrixMapState(matrixMap);

    // --- Qualifikationen & User (Sichtbarkeit/Namen) ---
// --- Qualifikationen & User (Sichtbarkeit/Namen) ---
const userIds = [...new Set(dienste.map((d) => d.user))];

// Monatsende als obere Grenze (Quali gilt ab created_at; keine Untergrenze nötig)
const monatsEndeIso = dayjs(new Date(jahr, monat + 1, 0)).endOf('day').toISOString();

// Helper hast du weiter unten bereits; falls nicht vorhanden, belassen wir ihn wie bei DB_User
const chunkArray = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// Serverseitig gefilterte Qualis (nur relevante User bis Monatsende)
let qualis = [];
if (userIds.length > 0) {
  const qualChunks = chunkArray(userIds, 200); // 100–200 ist gut
  for (const batch of qualChunks) {
    const { data, error } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali, created_at')
      .in('user_id', batch)
      .lte('created_at', monatsEndeIso);

    if (error) {
      console.error('Qualis laden (gefiltert) fehlgeschlagen', error);
      continue;
    }
    if (data?.length) qualis.push(...data);
  }
}
// Hinweis: Falls userIds leer ist, bleibt qualis = []


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
          userVisibleMap[u.user_id] = (u.user_visible ?? true);
        });
      }
    }
    setUserNameMapState(userNameMap);

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

        // Quali-Map nur mit gültigen Qualis ab created_at (pro Zelle speichern → lazy Tooltip)
        const userQualiMap = {};
        const tag = dayjs(datum);
        qualis
          .filter((q) => aktiveUser.includes(q.user_id))
          .forEach((q) => {
            const gueltigAb = dayjs(q.created_at);
            if (tag.isBefore(gueltigAb, 'day')) return;
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

        // User-Reihenfolge
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

        const nichtVerwendete = aktiveUser.filter((id) => !verwendeteUser.has(id));

        // Kein Tooltip-String mehr speichern → nur strukturierte Meta-Daten
        const bottom = topMissingKuerzel
          ? `${topMissingKuerzel}${totalMissing > 1 ? '+' : ''}`
          : null;

        status[schicht][datum] = {
          farbe: statusfarbe,
          bottom,
          topLeft: zusatzFehlt.length > 0 ? zusatzFehlt[0] : null,
          topRight,
          fehlend,
          meta: {
            aktiveUserIds: aktiveUser,
            abdeckung,                   // quali_id -> [userIds]
            nichtVerwendeteIds: nichtVerwendete,
            userQualiMap,                // user_id -> [qualiIds]
            zusatzFehltKuerzel: zusatzFehlt,
          },
        };
      }
    }

    // Farbleiste oben (Sonder-/Zeitbedarfe) – Lazy-Tooltip Daten
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
          eventName,
          items: tagBedarfe.map((b) => ({ quali_id: b.quali_id, anzahl: b.anzahl })),
        };
      }
    }

    setBedarfsLeiste(leiste);
    setBedarfStatus(status);
  };

  useEffect(() => {
    ladeMitarbeiterBedarf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tage, firma, unit, refreshKey]);

  // Tooltip-Builder (Cell)
  const buildCellTooltip = (kuerzel, datum, cell) => {
    if (!cell?.meta) return '';
    const { aktiveUserIds = [], abdeckung = {}, nichtVerwendeteIds = [], userQualiMap = {}, zusatzFehltKuerzel = [] } = cell.meta;

    const lines = [];
    lines.push(`👥 Anzahl MA: ${aktiveUserIds.length}`);

    if (cell.fehlend?.length) lines.push('', `❌ Fehlende Quali: ${cell.fehlend.join(', ')}`);
    if (zusatzFehltKuerzel.length) lines.push('', `⚠️ Zusatzquali fehlt: ${zusatzFehltKuerzel.join(', ')}`);

    const abdeckungKeys = Object.keys(abdeckung);
    if (abdeckungKeys.length) {
      lines.push('', '✔ Eingesetzt:');
      for (const qualiId of abdeckungKeys) {
        const uids = abdeckung[qualiId] || [];
        const qname = matrixMapState[qualiId]?.kuerzel || `ID:${qualiId}`;
        const namen = uids.map((uid) => userNameMapState[uid] || `User ${uid}`).join(', ');
        lines.push(`- ${qname}: ${namen || 'niemand'}`);
      }
    }

    if (nichtVerwendeteIds.length) {
      lines.push('', '🕐 Noch verfügbar:');
      for (const uid of nichtVerwendeteIds) {
        const qlist = (userQualiMap[uid] || []).map((qid) => matrixMapState[qid]?.kuerzel || `ID:${qid}`);
        lines.push(`- ${userNameMapState[uid] || `User ${uid}`}: ${qlist.join(', ') || 'keine Quali'}`);
      }
    }
    return lines.join('\n');
  };

  // Tooltip-Builder (Bar)
  const buildBarTooltip = (datum, entry) => {
    if (!entry) return '';
    const lines = [];
    lines.push(`${dayjs(datum).format('DD.MM.YYYY')} – ${entry.eventName}`);
    for (const it of entry.items || []) {
      const bez = matrixMapState[it.quali_id]?.bezeichnung || 'Unbekannt';
      const icon = it.anzahl === 1 ? '👤' : '👥';
      lines.push(`${icon} ${bez}: ${it.anzahl} ${it.anzahl === 1 ? 'Person' : 'Personen'}`);
    }
    return lines.join('\n');
  };

  // Modal öffnen (Feature-Gate)
  const handleModalOeffnen = (datum, kuerzel) => {
    if (!allowAnalyse) return;
    const cell = bedarfStatus[kuerzel]?.[datum];
    setModalDatum(datum);
    setModalSchicht(kuerzel);
    setFehlendeQualis(cell?.fehlend || []);
    setModalOffen(true);
  };

  return (
    <div
      className="overflow-x-visible relative rounded-xl shadow-xl border border-gray-300 dark:border-gray-700"
      style={{ overflowY: 'visible' }}
    >
      {/* Info-Button */}
      <button
        className="absolute pr-2 pt-2 top-0 right-0 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
        onClick={() => setInfoOffen(true)}
        title="Legende"
      >
        <Info size={20} />
      </button>

      {/* Farbleiste ganz oben */}
      <div className="flex w-full">
        <div className="w-[176px] min-w-[176px]"></div>
        <div className="flex gap-[2px] min-w-fit">
          {tage.map((datum) => {
            const eintrag = bedarfsLeiste[datum];
            const key = `BAR|${datum}`;
            const header = `${dayjs(datum).format('DD.MM.YYYY')} · Sonderbedarf`;
            return (
              <div
                key={datum}
                className="relative w-[48px] min-w-[48px] h-[6px] rounded-t"
                style={{ background: eintrag?.gradient || (eintrag?.farbe || 'transparent') }}
                onMouseEnter={(e) =>
                  allowTooltip && eintrag &&
                  scheduleShow(e.currentTarget, key, () => buildBarTooltip(datum, eintrag), header, true)
                }
                onMouseLeave={allowTooltip ? scheduleHide : undefined}
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
          <div className="flex gap-[2px] min-w-fit">
            {tage.map((datum) => {
              const cell = bedarfStatus[kuerzel]?.[datum];
              const key = `${kuerzel}|${datum}`;
              const header = `${dayjs(datum).format('DD.MM.YYYY')} · ${
                kuerzel === 'F' ? 'Frühschicht' : kuerzel === 'S' ? 'Spätschicht' : 'Nachtschicht'
              }`;

              return (
                <div
                  key={datum}
                  onClick={allowAnalyse ? () => handleModalOeffnen(datum, kuerzel) : undefined}
                  onMouseEnter={(e) =>
                    allowTooltip && cell &&
                    scheduleShow(e.currentTarget, key, () => buildCellTooltip(kuerzel, datum, cell), header, kuerzel === 'F')
                  }
                  onMouseLeave={allowTooltip ? scheduleHide : undefined}
                  className={`relative ${
                    allowAnalyse ? 'cursor-pointer' : 'cursor-default'
                  } w-[48px] min-w-[48px] text-center text-xs py-[2px] rounded border border-gray-300 dark:border-gray-700 hover:opacity-80 ${
                    cell?.farbe || 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  {cell?.topLeft && (
                    <div className="absolute top-0 left-0 w-0 h-0 border-t-[12px] border-t-yellow-300 border-r-[12px] border-r-transparent pointer-events-none" />
                  )}
                  {cell?.topRight === 'blau-1' && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-green-300 border-l-[12px] border-l-transparent pointer-events-none" />
                  )}
                  {cell?.topRight === 'blau-2' && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-t-[12px] border-t-green-700 border-l-[12px] border-l-transparent pointer-events-none" />
                  )}
                  {cell?.bottom && (
                    <div className="absolute bottom-0 left-0 w-full text-[9px] text-gray-900 dark:text-white">
                      {cell.bottom}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Tooltip-Portal nur, wenn Feature aktiv */}
      {allowTooltip &&
        tipData &&
        createPortal(
          <div
            onMouseEnter={() => { clearHideTimer(); }}
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
                    ? { right: '-4px', background: 'rgba(17,24,39,0.95)' }
                    : { left: '-4px', background: 'rgba(255,255,255,0.95)' }),
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

      {/* Analyse-Modal nur, wenn Feature aktiv */}
      {allowAnalyse && (
        <BedarfsAnalyseModal
          offen={modalOffen}
          onClose={() => setModalOffen(false)}
          modalDatum={modalDatum}
          modalSchicht={modalSchicht}
          fehlendeQualis={fehlendeQualis}
        />
      )}

      {/* Legende */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-lg max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">Bedarfsbewertung – Legende</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li><span className="font-bold text-red-500">Rot</span>: Bedarf nicht gedeckt</li>
              <li><span className="font-bold text-green-300">Grün</span>: Bedarf exakt gedeckt</li>
              <li><span className="font-bold text-yellow-400">Gelbe Ecke</span>: Zusatzquali fehlt</li>
              <li><span className="font-bold text-green-300">Grüne Ecke</span>: +1 Besetzung (qualifikationsunabhängig)</li>
              <li><span className="font-bold text-green-700">Dunkelgrün</span>: +2 oder mehr Besetzung (qualifikationsunabhängig)</li>
              <li>Hover zeigt fehlende/erfüllte Qualifikationen sowie eingesetzte Personen.</li>
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
