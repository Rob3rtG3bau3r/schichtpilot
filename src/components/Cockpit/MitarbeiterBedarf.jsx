// src/components/Dashboard/MitarbeiterBedarf.jsx
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import BedarfsAnalyseModal from './BedarfsAnalyseModal';
import { Info } from 'lucide-react';

const FEATURE_TOOLTIP = 'tooltip_schichtuebersicht';
const FEATURE_ANALYSE = 'bedarf_analyse';

const MitarbeiterBedarf = ({ jahr, monat, refreshKey = 0 }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [tage, setTage] = useState([]);
  const [bedarfStatus, setBedarfStatus] = useState({ F: {}, S: {}, N: {} });
  const [bedarfsLeiste, setBedarfsLeiste] = useState({});

  // Aus Kalender ausgewählte Tage (global)
  const [selectedDates, setSelectedDates] = useState(new Set());
  useEffect(() => {
    const onSel = (e) => setSelectedDates(new Set(e.detail?.selected || []));
    window.addEventListener('sp:selectedDates', onSel);
    return () => window.removeEventListener('sp:selectedDates', onSel);
  }, []);


  // Tooltip-Datenquellen (für sprechende Namen/Bezeichnungen)
  const [userNameMapState, setUserNameMapState] = useState({});
  const [matrixMapState, setMatrixMapState] = useState({});

  // Feature-Flags
  const [allowTooltip, setAllowTooltip] = useState(false);
  const [allowAnalyse, setAllowAnalyse] = useState(false);

  // Analyse-Modal
  const [modalOffen, setModalOffen] = useState(false);
  const [modalDatum, setModalDatum] = useState('');
  const [modalSchicht, setModalSchicht] = useState('');
  const [fehlendeQualis, setFehlendeQualis] = useState([]);

  // Info
  const [infoOffen, setInfoOffen] = useState(false);

  // Heute (YYYY-MM-DD) für gelbe Markierung
  const heutigesDatum = React.useMemo(() => dayjs().format('YYYY-MM-DD'), []);

  // ===== Tooltip infra =====
  const [tipData, setTipData] = useState(null); // { text, top, left, flip, header, width }
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

  const showTipAt = (el, _key, text, header, alignTop = false, width = 280) => {
    if (!allowTooltip || !el || !text) return;
    const rect = el.getBoundingClientRect();
    let left = rect.right + 8;
    let top = alignTop ? rect.top + 8 : rect.top + rect.height / 2 - 12;
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
        try {
          txt = buildFn();
        } catch {
          txt = '';
        }
        if (txt) tooltipCache.current.set(key, txt);
      }
      if (txt) showTipAt(el, key, txt, header, alignTop, width);
    }, 180);
  };

  const scheduleHide = () => {
    clearShowTimer();
    clearHideTimer();
    tipHideTimer.current = setTimeout(() => setTipData(null), 120);
  };

  // Cache leeren bei Kontextwechsel
  useEffect(() => {
    tooltipCache.current = new Map();
  }, [firma, unit, jahr, monat, refreshKey]);

  // Tage des Monats
  useEffect(() => {
    const tageImMonat = new Date(jahr, monat + 1, 0).getDate();
    const arr = [];
    for (let d = 1; d <= tageImMonat; d++) {
      arr.push(dayjs(new Date(jahr, monat, d)).format('YYYY-MM-DD'));
    }
    setTage(arr);
  }, [jahr, monat]);

  // Feature-Flags
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
      } catch {
        if (!alive) return;
        setAllowTooltip(false);
        setAllowAnalyse(false);
      }
    };
    loadFlags();
    return () => {
      alive = false;
    };
  }, [firma, unit]);

  // Utility
  const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

// --- Schicht-Helpers (neu) ---
const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { 'Früh': 0, 'Spät': 1, 'Nacht': 2 };

const schichtInnerhalbGrenzen = (b, datumISO, schLabel) => {
  // Grenzen gelten nur für zeitlich begrenzt
  if (b.normalbetrieb) return true;
  const startLabel = b.start_schicht || 'Früh';
  const endLabel   = b.end_schicht   || 'Nacht';
  const sIdx = SCH_INDEX[schLabel];
  const startIdx = SCH_INDEX[startLabel];
  const endIdx   = SCH_INDEX[endLabel];

  const amStart = b.von && datumISO === b.von;
  const amEnde  = b.bis && datumISO === b.bis;

  if (amStart && amEnde) {
    return sIdx >= startIdx && sIdx <= endIdx;
  } else if (amStart) {
    return sIdx >= startIdx;
  } else if (amEnde) {
    return sIdx <= endIdx;
  }
  return true;
};

const bedarfGiltFuerSchicht = (b, datumISO, schKey) => {
  // Zeitfenster
  if (b.von && datumISO <  b.von) return false;
  if (b.bis && datumISO >  b.bis) return false;

  const schLabel = SCH_LABEL[schKey]; // 'Früh'|'Spät'|'Nacht'

  // Schichtgrenzen beachten (nur ZB)
  if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

  // schichtart: null = ganztägig (alle Schichten), sonst nur diese Schicht
  if (b.schichtart == null) return true;
  return b.schichtart === schLabel;
};

  // ===== Daten laden (Plan + Zuweisung als Basis, Kampfliste überschreibt) =====
  const ladeMitarbeiterBedarf = async () => {
    if (!firma || !unit || tage.length === 0) return;

    const monthStart = tage[0];
    const monthEnd = tage[tage.length - 1];

    // 1) SOLL-PLAN
    const { data: soll } = await supabase
      .from('DB_SollPlan')
      .select('datum, schichtgruppe, kuerzel')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', monthStart)
      .lte('datum', monthEnd);

    const planByDate = new Map(); // date -> Map(group -> kuerzel)
    (soll || []).forEach((r) => {
      const d = r.datum?.slice(0, 10);
      if (!d) return;
      if (!planByDate.has(d)) planByDate.set(d, new Map());
      planByDate.get(d).set(r.schichtgruppe, r.kuerzel);
    });

    // 2) ZUWEISUNGEN (wer gehört an welchem Tag zu welcher Gruppe)
    const { data: zuw } = await supabase
      .from('DB_SchichtZuweisung')
      .select('user_id, schichtgruppe, von_datum, bis_datum')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .lte('von_datum', monthEnd)
      .or(`bis_datum.is.null, bis_datum.gte.${monthStart}`);

    // Pro Tag: Map(userId -> { gruppe, von_datum }) — nur jüngste Zuweisung pro User
    const membersByDate = new Map();
    (tage || []).forEach((d) => membersByDate.set(d, new Map()));
    for (const z of zuw || []) {
      for (const d of tage) {
        if (dayjs(z.von_datum).isAfter(d, 'day')) continue;
        if (z.bis_datum && dayjs(z.bis_datum).isBefore(d, 'day')) continue;
        const map = membersByDate.get(d);
        const prev = map.get(z.user_id);
        if (!prev || dayjs(z.von_datum).isAfter(prev.von_datum, 'day')) {
          map.set(z.user_id, { gruppe: z.schichtgruppe, von_datum: z.von_datum });
        }
      }
    }

    // 3) KAMPFLISTE-OVERLAY (Änderungen)
    const { data: kampf } = await supabase
      .from('DB_Kampfliste')
      .select('datum, user, ist_schicht(kuerzel)')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', monthStart)
      .lte('datum', monthEnd);

    const override = new Map(); // `${d}|${uid}` -> kuerzel
    (kampf || []).forEach((r) => {
      const d = r.datum?.slice(0, 10);
      if (!d) return;
      override.set(`${d}|${r.user}`, r.ist_schicht?.kuerzel || null);
    });

    // 4) FINAL: DIENSTE (liste)
    const dienste = [];
    const allUserIdsSet = new Set();

    for (const d of tage) {
      const planForDay = planByDate.get(d) || new Map();
      const mMap = membersByDate.get(d) || new Map();

      for (const [uid, info] of mMap) {
        const key = `${d}|${uid}`;
        const over = override.get(key);
        const baseKuerzel = planForDay.get(info.gruppe) || null;
        const kuerzel = over ?? baseKuerzel;
        if (!kuerzel) continue;
        dienste.push({ datum: d, user: uid, ist_schicht: { kuerzel } });
        allUserIdsSet.add(uid);
      }
    }

    // 5) Bedarf & Matrix
const { data: bedarf } = await supabase
  .from('DB_Bedarf')
  .select('quali_id, anzahl, von, bis, namebedarf, farbe, normalbetrieb, schichtart, start_schicht, end_schicht')
  .eq('firma_id', firma)
  .eq('unit_id', unit);

    const { data: qualiMatrix } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, quali_kuerzel, betriebs_relevant, position, qualifikation, firma_id, unit_id')
      .eq('firma_id', firma)
      .eq('unit_id', unit);

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

    // 6) Qualis (bis Monatsende) & Namen
// 6) Qualis (gültig nach Matrix; Zeitraum-Check machen wir pro Tag) & Namen
const userIds = Array.from(allUserIdsSet);

let qualis = [];
if (userIds.length > 0) {
  for (const part of chunkArray(userIds, 200)) {
    const { data, error } = await supabase
      .from('DB_Qualifikation')
      .select(`
        user_id,
        quali,
        quali_start,
        quali_endet,
        matrix:DB_Qualifikationsmatrix!inner(
          id,
          firma_id,
          unit_id,
          aktiv
        )
      `)
      .in('user_id', part)
      .eq('matrix.firma_id', firma)
      .eq('matrix.unit_id', unit)
      .eq('matrix.aktiv', true); // nur aktive Matrix-Einträge berücksichtigen
    if (!error && data?.length) qualis.push(...data);
  }
}

    // --- NEU: Ausgrauen-Fenster laden (pro User, monatsübergreifend) ---
    const ausgrauenByUser = new Map(); // uid -> [{von, bis}]
    if (userIds.length > 0) {
      for (const part of chunkArray(userIds, 150)) {
        const { data: ausRows } = await supabase
          .from('DB_Ausgrauen')
          .select('user_id, von, bis')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', part)
          .lte('von', monthEnd) // von <= Monatsende
          .or(`bis.is.null, bis.gte.${monthStart}`); // bis >= Monatsstart oder offen
        for (const r of ausRows || []) {
          const uid = String(r.user_id);
          const arr = ausgrauenByUser.get(uid) || [];
          arr.push({ von: r.von, bis: r.bis || null });
          ausgrauenByUser.set(uid, arr);
        }
      }
      // sortieren
      for (const [, arr] of ausgrauenByUser) {
        arr.sort((a, b) => dayjs(a.von).diff(dayjs(b.von)));
      }
    }

    let userNameMap = {};
    if (userIds.length > 0) {
      for (const part of chunkArray(userIds, 150)) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('user_id, nachname')
          .in('user_id', part);
        userDaten?.forEach((u) => {
          userNameMap[u.user_id] = u.nachname || `User ${u.user_id}`;
        });
      }
    }
    setUserNameMapState(userNameMap);

    // Helper: Ist User an Datum d ausgegraut?
    const isGrey = (uid, dISO) => {
      const arr = ausgrauenByUser.get(String(uid));
      if (!arr || arr.length === 0) return false;
      const d = dayjs(dISO);
      for (const r of arr) {
        const von = dayjs(r.von);
        const bis = r.bis ? dayjs(r.bis) : null;
        if (d.isSameOrAfter(von, 'day') && (!bis || d.isSameOrBefore(bis, 'day'))) return true;
      }
      return false;
    };

// 7) Bewertung/Status
const status = { F: {}, S: {}, N: {} };

for (const datum of tage) {
  for (const schicht of ['F', 'S', 'N']) {
    // 1) Kandidaten (Zeitfenster)
    const bedarfTag = (bedarf || []).filter(
      (b) => (!b.von || datum >= b.von) && (!b.bis || datum <= b.bis)
    );

    // 2) Nur Bedarfe, die für diese Schicht gelten
    const bedarfTagSchicht = bedarfTag.filter((b) =>
      bedarfGiltFuerSchicht(b, datum, schicht)
    );

    // 3) Override-Regel pro Schicht
    const hatZeitlich = bedarfTagSchicht.some((b) => b.normalbetrieb === false);
    const bedarfHeute = bedarfTagSchicht.filter(
      (b) => b.normalbetrieb === !hatZeitlich
    );

    // --- aktive User (nur nicht-ausgegraut) ---
    const aktiveUserRaw = dienste
      .filter((d) => d.datum === datum && d.ist_schicht?.kuerzel === schicht)
      .map((d) => d.user);
    const aktiveUser = [...new Set(aktiveUserRaw)].filter((uid) => !isGrey(uid, datum));

    // --- Qualis am Tag ---
    const userQualiMap = {};
    const tag = dayjs(datum);
    for (const q of qualis) {
      if (!aktiveUser.includes(q.user_id)) continue;
      const startOk = !q.quali_start || dayjs(q.quali_start).isSameOrBefore(tag, 'day');
      const endOk   = !q.quali_endet || dayjs(q.quali_endet).isSameOrAfter(tag, 'day');
      if (startOk && endOk) {
        if (!userQualiMap[q.user_id]) userQualiMap[q.user_id] = [];
        userQualiMap[q.user_id].push(q.quali);
      }
    }

    // --- Bedarf sortieren ---
    const bedarfSortiert = bedarfHeute
      .map((b) => ({
        ...b,
        position: matrixMap[b.quali_id]?.position ?? 999,
        kuerzel:  matrixMap[b.quali_id]?.kuerzel  || '???',
        relevant: matrixMap[b.quali_id]?.relevant,
      }))
      .filter((b) => b.relevant)
      .sort((a, b) => a.position - b.position);

    // --- Zuweisung (jede Person deckt max. 1 Quali) ---
    const verwendeteUser = new Set();
    const userSortMap = aktiveUser.map((userId) => {
      const userQualis = userQualiMap[userId] || [];
      const relevantQualis = userQualis
        .filter((qid) => matrixMap[qid]?.relevant)
        .map((qid) => ({ id: qid, position: matrixMap[qid]?.position ?? 999 }));
      const posSum = relevantQualis.reduce((s, q) => s + q.position, 0);
      return { userId, qualis: relevantQualis.map((q) => q.id), anzahl: relevantQualis.length, posSumme: posSum };
    });
    const userReihenfolge = userSortMap
      .sort((a, b) => a.anzahl - b.anzahl || a.posSumme - b.posSumme)
      .map((u) => u.userId);

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

    // --- Statusindikatoren ---
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

    let topRight = null;
    if (bedarfSortiert.length > 0) {
      const benoetigtGesamt = bedarfSortiert.reduce((s, b) => s + (b.anzahl || 0), 0);
      const ueberschussGesamt = (aktiveUser?.length || 0) - benoetigtGesamt;
      if (ueberschussGesamt === 1) topRight = 'blau-1';
      else if (ueberschussGesamt >= 2) topRight = 'blau-2';
    }

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
    const bottom = topMissingKuerzel ? `${topMissingKuerzel}${totalMissing > 1 ? '+' : ''}` : null;

    status[schicht][datum] = {
      farbe: statusfarbe,
      bottom,
      topLeft: zusatzFehlt.length > 0 ? zusatzFehlt[0] : null,
      topRight,
      fehlend,
      meta: {
        aktiveUserIds: aktiveUser,
        abdeckung,
        nichtVerwendeteIds: nichtVerwendete,
        userQualiMap,
        zusatzFehltKuerzel: zusatzFehlt,
      },
    };
  }
}

    // 8) Farbleiste (Sonder-/Zeitbedarfe)
    const leiste = {};
    for (const tag of tage) {
      const tagBedarfe = (bedarf || []).filter(
        (b) => b.farbe && !b.normalbetrieb && (!b.von || tag >= b.von) && (!b.bis || tag <= b.bis)
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
          items: tagBedarfe.map((b) => ({
            quali_id: b.quali_id,
            anzahl: b.anzahl,
            name: b.namebedarf,
            von: b.von,
            bis: b.bis,
            start_schicht: b.start_schicht, // 'Früh' | 'Spät' | 'Nacht' | null
            end_schicht: b.end_schicht      // dito
          })),
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

  // Tooltip-Builder (Zelle)
  const buildCellTooltip = (_kuerzel, _datum, cell) => {
    if (!cell?.meta) return '';
    const {
      aktiveUserIds = [],
      abdeckung = {},
      nichtVerwendeteIds = [],
      userQualiMap = {},
      zusatzFehltKuerzel = [],
    } = cell.meta;

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
        lines.push(`- ${qname}: ${namen || '???'}`);
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

const buildBarHeader = (entry) => {
  if (!entry || !entry.items?.length) return 'Sonderbedarf';

  const fmt = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

  // Min(von), Max(bis) + passende Start/End-Schicht ermitteln
  let minVon = null, maxBis = null, startSchicht = 'Früh', endSchicht = 'Nacht';

  for (const it of entry.items) {
    if (it.von && (!minVon || dayjs(it.von).isBefore(minVon, 'day'))) {
      minVon = dayjs(it.von);
      startSchicht = it.start_schicht || 'Früh';
    }
    if (it.bis && (!maxBis || dayjs(it.bis).isAfter(maxBis, 'day'))) {
      maxBis = dayjs(it.bis);
      endSchicht = it.end_schicht || 'Nacht';
    }
  }

  const start = fmt(minVon);
  const end   = fmt(maxBis);

  return `Beginnt am ${start} in der ${startSchicht}-Schicht\nEndet am ${end} in der ${endSchicht}-Schicht`;
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

      {/* Farbleiste oben */}
      <div className="flex w-full">
        <div className="w-[176px] min-w-[176px]" />
        <div className="flex gap-[2px] min-w-fit">
          {tage.map((datum) => {
            const eintrag = bedarfsLeiste[datum];
            const key = `BAR|${datum}`;
            const header = buildBarHeader(eintrag);
            return (
              <div
                key={datum}
                className="relative w-[48px] min-w-[48px] h-[6px] rounded-t"
                style={{ background: eintrag?.gradient || (eintrag?.farbe || 'transparent') }}
                onMouseEnter={(e) =>
                  allowTooltip &&
                  eintrag &&
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
          <div className="w-[176px] min-w-[176px] text-gray-900 dark:text-gray-300 text-left px-2 text-xs">
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
                    allowTooltip &&
                    cell &&
                    scheduleShow(e.currentTarget, key, () => buildCellTooltip(kuerzel, datum, cell), header, kuerzel === 'F')
                  }
                  onMouseLeave={allowTooltip ? scheduleHide : undefined}
                  className={`relative ${
                    allowAnalyse ? 'cursor-pointer' : 'cursor-default'
                  } w-[48px] min-w-[48px] text-center text-xs py-[2px] rounded border border-gray-300 dark:border-gray-700 hover:opacity-80 ${
                    cell?.farbe || 'bg-gray-200 dark:bg-gray-600'
                  } ${datum === heutigesDatum ? 'ring-1 ring-yellow-400' : ''} ${selectedDates.has(datum) ? 'outline outline-1 outline-orange-400' : ''}`}
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

      {/* Tooltip-Portal */}
      {allowTooltip &&
        tipData &&
        createPortal(
          <div
            onMouseEnter={() => {
              clearHideTimer();
            }}
            onMouseLeave={scheduleHide}
            style={{ position: 'fixed', top: tipData.top, left: tipData.left, zIndex: 100000, pointerEvents: 'auto' }}
          >
            <div
              className="relative px-3 py-2 rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10
                         bg-white/95 dark:bg-gray-900/95 text-gray-900 dark:text-gray-100 text-xs"
              style={{ width: tipData.width || 280 }}
            >
              <div
                className="absolute w-2 h-2 rotate-45 ring-1 ring-black/10 dark:ring-white/10"
                style={{
                  top: '12px',
                  ...(tipData.flip
                    ? { right: '-4px', background: 'rgba(17,24,39,0.95)' }
                    : { left: '-4px', background: 'rgba(255,255,255,0.95)' }),
                }}
              />
              {tipData.header && <div className="font-sans font-semibold mb-1">{tipData.header}</div>}
              <pre className="whitespace-pre-wrap font-mono">{tipData.text}</pre>
            </div>
          </div>,
          document.body
        )}

      {/* Analyse-Modal */}
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
              <li>
                <span className="font-bold text-red-500">Rot</span>: Bedarf nicht gedeckt
              </li>
              <li>
                <span className="font-bold text-green-300">Grün</span>: Bedarf exakt gedeckt
              </li>
              <li>
                <span className="font-bold text-yellow-400">Gelbe Ecke</span>: Zusatzquali fehlt
              </li>
              <li>
                <span className="font-bold text-green-300">Grüne Ecke</span>: +1 Besetzung (qualifikationsunabhängig)
              </li>
              <li>
                <span className="font-bold text-green-700">Dunkelgrün</span>: +2 oder mehr Besetzung
                (qualifikationsunabhängig)
              </li>
              <li>Hover zeigt fehlende/erfüllte Qualifikationen sowie eingesetzte Personen.</li>
            </ul>
            <div className="text-right mt-4">
              <button onClick={() => setInfoOffen(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
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
