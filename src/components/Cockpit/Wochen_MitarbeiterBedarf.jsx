// src/components/Cockpit/Wochen_MitarbeiterBedarf.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
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

// --- Schicht-Helpers ---
const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { 'Früh': 0, 'Spät': 1, 'Nacht': 2 };
const isPastDay = (datum) => dayjs(datum).isBefore(dayjs().startOf('day'), 'day');

// Zeit: "HH:mm" | "HH:mm:ss" -> Minuten
const timeToMin = (t) => {
  if (!t) return null;
  const s = String(t).trim();
  if (!s) return null;
  const parts = s.split(':').map((x) => parseInt(x, 10));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
};

// Bereich [start,end] normalisieren; wenn end < start => über Mitternacht
const normalizeRange = (startMin, endMin) => {
  if (startMin == null || endMin == null) return null;
  let s = startMin;
  let e = endMin;
  if (e < s) e += 1440;
  return { s, e };
};

// schneidet Dienstzeit auf Shiftfenster zu
const clampToShift = (r, shift) => {
  if (!r || !shift) return null;
  const s = Math.max(r.s, shift.s);
  const e = Math.min(r.e, shift.e);
  if (e <= s) return null;
  return { s, e };
};

const appliesToBarItem = (it, datumISO, schLabel) => {
  if (it.von && datumISO < it.von) return false;
  if (it.bis && datumISO > it.bis) return false;

  const startLabel = it.start_schicht || 'Früh';
  const endLabel = it.end_schicht || 'Nacht';
  const sIdx = SCH_INDEX[schLabel];
  const start = SCH_INDEX[startLabel];
  const end = SCH_INDEX[endLabel];
  const amStart = it.von && datumISO === it.von;
  const amEnde = it.bis && datumISO === it.bis;

  if (amStart && amEnde) {
    if (sIdx < start || sIdx > end) return false;
  } else if (amStart) {
    if (sIdx < start) return false;
  } else if (amEnde) {
    if (sIdx > end) return false;
  }
  if (it.schichtart == null) return true;
  return it.schichtart === schLabel;
};

const pickItemsForGroup = (items, datumISO, schLabel) => {
  const candidates = (items || []).filter((it) => appliesToBarItem(it, datumISO, schLabel));
  const specific = candidates.filter((it) => it.schichtart === schLabel);
  const fallback = candidates.filter((it) => it.schichtart == null);
  return specific.length > 0 ? specific : fallback;
};

const groupByQualiSum = (items) => {
  const map = new Map();
  for (const it of items || []) {
    const key = String(it.quali_id);
    map.set(key, (map.get(key) || 0) + Number(it.anzahl || 0));
  }
  return map;
};

const iconFor = (n) => (n === 1 ? '👤' : '👥');

// Abdeckungs-Algorithmus (wie Monats-Version) für eine gegebene User-Menge
const calcCoverage = ({ aktiveUser, userQualiMap, bedarfSortiert, matrixMap }) => {
  const verwendeteUser = new Set();

  const userSortMap = (aktiveUser || []).map((userId) => {
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
    }
  }

  const nichtVerwendete = (aktiveUser || []).filter((id) => !verwendeteUser.has(id));

  return { abdeckung, totalMissing, fehlend, topMissingKuerzel, nichtVerwendete };
};

const Wochen_MitarbeiterBedarf = ({ refreshKey = 0 }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [tage, setTage] = useState([]); // ['YYYY-MM-DD', ...] – aus visibleRange
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);

  const [bedarfStatus, setBedarfStatus] = useState({ F: {}, S: {}, N: {} });
  const [bedarfsLeiste, setBedarfsLeiste] = useState({});

  // Aus Kalender ausgewählte Tage (global)
  const [selectedDates, setSelectedDates] = useState(new Set());
  useEffect(() => {
    const onSel = (e) => setSelectedDates(new Set(e.detail?.selected || []));
    window.addEventListener('sp:selectedDates', onSel);
    return () => window.removeEventListener('sp:selectedDates', onSel);
  }, []);

  // Tooltip-Datenquellen
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

  // Heute (YYYY-MM-DD)
  const heutigesDatum = useMemo(() => dayjs().format('YYYY-MM-DD'), []);

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

  // Cache leeren
  useEffect(() => {
    tooltipCache.current = new Map();
  }, [firma, unit, rangeStart, rangeEnd, refreshKey]);

  // ===== Tage aus sichtbarem Bereich (sp:visibleRange) =====
  useEffect(() => {
    const onRange = (e) => {
      const { start, end } = e.detail || {};
      if (!start || !end) return;

      setRangeStart(start);
      setRangeEnd(end);

      const startD = dayjs(start);
      const endD = dayjs(end);
      const arr = [];
      for (
        let d = startD;
        d.isSame(endD, 'day') || d.isBefore(endD, 'day');
        d = d.add(1, 'day')
      ) {
        arr.push(d.format('YYYY-MM-DD'));
      }
      setTage(arr);
    };

    window.addEventListener('sp:visibleRange', onRange);

    if (typeof window !== 'undefined' && window.__spVisibleRange) {
      const { start, end } = window.__spVisibleRange;
      if (start && end) onRange({ detail: { start, end } });
    }

    return () => window.removeEventListener('sp:visibleRange', onRange);
  }, []);

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

  const chunkArray = (arr, size) => {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const schichtInnerhalbGrenzen = (b, datumISO, schLabel) => {
    if (b.normalbetrieb) return true;
    const startLabel = b.start_schicht || 'Früh';
    const endLabel = b.end_schicht || 'Nacht';
    const sIdx = SCH_INDEX[schLabel];
    const startIdx = SCH_INDEX[startLabel];
    const endIdx = SCH_INDEX[endLabel];

    const amStart = b.von && datumISO === b.von;
    const amEnde = b.bis && datumISO === b.bis;

    if (amStart && amEnde) return sIdx >= startIdx && sIdx <= endIdx;
    if (amStart) return sIdx >= startIdx;
    if (amEnde) return sIdx <= endIdx;
    return true;
  };

  const bedarfGiltFuerSchicht = (b, datumISO, schKey) => {
    if (b.von && datumISO < b.von) return false;
    if (b.bis && datumISO > b.bis) return false;

    const schLabel = SCH_LABEL[schKey];

    // Wochenbetrieb-Logik (nur Normalbetrieb)
    if (b.normalbetrieb && b.betriebsmodus === 'wochenbetrieb') {
      const weekday = dayjs(datumISO).day(); // 0=So ... 6=Sa
      switch (b.wochen_tage) {
        case 'MO_FR':
          if (weekday < 1 || weekday > 5) return false;
          break;
        case 'MO_SA_ALL':
          if (weekday < 1 || weekday > 6) return false;
          break;
        case 'MO_FR_SA_F':
          if (weekday === 0) return false;
          if (weekday === 6 && schLabel !== 'Früh') return false;
          if (weekday < 1 || weekday > 6) return false;
          break;
        case 'MO_FR_SA_FS':
          if (weekday === 0) return false;
          if (weekday === 6 && schLabel === 'Nacht') return false;
          if (weekday < 1 || weekday > 6) return false;
          break;
        case 'SO_FR_ALL':
          if (weekday === 0) {
            if (schLabel !== 'Nacht') return false;
          } else if (weekday >= 1 && weekday <= 4) {
            // ok
          } else if (weekday === 5) {
            if (schLabel === 'Nacht') return false;
          } else {
            return false;
          }
          break;
        default:
          break; // 24/7
      }
    }

    if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

    if (b.schichtart == null) return true;
    return b.schichtart === schLabel;
  };

  // ===== Daten laden =====
  const ladeMitarbeiterBedarf = async () => {
    if (!firma || !unit || tage.length === 0) return;

    const rangeStartISO = tage[0];
    const rangeEndISO = tage[tage.length - 1];

    // 0) Schichtzeiten (für Zeit-Prüfung)
    const shiftTimes = {}; // F|S|N -> {s,e}
    try {
      const { data: schichtarten } = await supabase
        .from('DB_SchichtArt')
        .select('kuerzel, startzeit, endzeit')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('kuerzel', ['F', 'S', 'N']);

      (schichtarten || []).forEach((sa) => {
        const s = timeToMin(sa.startzeit);
        const e = timeToMin(sa.endzeit);
        const r = normalizeRange(s, e);
        if (r) shiftTimes[sa.kuerzel] = r;
      });
    } catch {
      // ok
    }

    // 1) SOLL-PLAN
    const { data: soll } = await supabase
      .from('DB_SollPlan')
      .select('datum, schichtgruppe, kuerzel')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', rangeStartISO)
      .lte('datum', rangeEndISO);

    const planByDate = new Map();
    (soll || []).forEach((r) => {
      const d = r.datum?.slice(0, 10);
      if (!d) return;
      if (!planByDate.has(d)) planByDate.set(d, new Map());
      planByDate.get(d).set(r.schichtgruppe, r.kuerzel);
    });

    // 2) ZUWEISUNGEN
    const { data: zuw } = await supabase
      .from('DB_SchichtZuweisung')
      .select('user_id, schichtgruppe, von_datum, bis_datum')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .lte('von_datum', rangeEndISO)
      .or(`bis_datum.is.null, bis_datum.gte.${rangeStartISO}`);

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

    // 3) KAMPFLISTE-OVERLAY (Änderungen + Zeiten + aenderung)
    const { data: kampf } = await supabase
      .from('DB_Kampfliste')
      .select('datum, user, aenderung, startzeit_ist, endzeit_ist, ist_schicht(kuerzel)')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .gte('datum', rangeStartISO)
      .lte('datum', rangeEndISO);

    const override = new Map(); // `${d}|${uid}` -> {kuerzel,start,end,aenderung}
    (kampf || []).forEach((r) => {
      const d = r.datum?.slice(0, 10);
      if (!d) return;
      override.set(`${d}|${r.user}`, {
        kuerzel: r.ist_schicht?.kuerzel || null,
        start: r.startzeit_ist || null,
        end: r.endzeit_ist || null,
        aenderung: !!r.aenderung,
      });
    });

    // 4) FINAL: DIENSTE
    const dienste = [];
    const allUserIdsSet = new Set();

    for (const d of tage) {
      const planForDay = planByDate.get(d) || new Map();
      const mMap = membersByDate.get(d) || new Map();

      for (const [uid, info] of mMap) {
        const key = `${d}|${uid}`;
        const over = override.get(key);
        const baseKuerzel = planForDay.get(info.gruppe) || null;

        const kuerzel = (over?.kuerzel ?? baseKuerzel) || null;
        if (!kuerzel) continue;

        dienste.push({
          datum: d,
          user: uid,
          ist_schicht: { kuerzel },
          start: over?.start ?? null,
          end: over?.end ?? null,
          aenderung: !!over?.aenderung,
        });

        allUserIdsSet.add(uid);
      }
    }

    // 5) Bedarf & Matrix
    const { data: bedarf } = await supabase
      .from('DB_Bedarf')
      .select(
        'quali_id, anzahl, von, bis, namebedarf, farbe, normalbetrieb, schichtart, start_schicht, end_schicht, betriebsmodus, wochen_tage'
      )
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

    // 6) Qualis & Namen
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
          .eq('matrix.aktiv', true);
        if (!error && data?.length) qualis.push(...data);
      }
    }

    // Ausgrauen
    const ausgrauenByUser = new Map();
    if (userIds.length > 0) {
      for (const part of chunkArray(userIds, 150)) {
        const { data: ausRows } = await supabase
          .from('DB_Ausgrauen')
          .select('user_id, von, bis')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', part)
          .lte('von', rangeEndISO)
          .or(`bis.is.null, bis.gte.${rangeStartISO}`);
        for (const r of ausRows || []) {
          const uid = String(r.user_id);
          const arr = ausgrauenByUser.get(uid) || [];
          arr.push({ von: r.von, bis: r.bis || null });
          ausgrauenByUser.set(uid, arr);
        }
      }
      for (const [, arr] of ausgrauenByUser) {
        arr.sort((a, b) => dayjs(a.von).diff(dayjs(b.von)));
      }
    }

    let userNameMap = {};
    if (userIds.length > 0) {
      for (const part of chunkArray(userIds, 150)) {
        const { data: userDaten } = await supabase.from('DB_User').select('user_id, nachname').in('user_id', part);
        userDaten?.forEach((u) => {
          userNameMap[u.user_id] = u.nachname || `User ${u.user_id}`;
        });
      }
    }
    setUserNameMapState(userNameMap);

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

    // 7) Bewertung/Status inkl. Zeitlogik
    const status = { F: {}, S: {}, N: {} };

    for (const datum of tage) {
      for (const schicht of ['F', 'S', 'N']) {
        const bedarfTag = (bedarf || []).filter((b) => (!b.von || datum >= b.von) && (!b.bis || datum <= b.bis));
        const bedarfTagSchicht = bedarfTag.filter((b) => bedarfGiltFuerSchicht(b, datum, schicht));

        const hatZeitlich = bedarfTagSchicht.some((b) => b.normalbetrieb === false);
        const bedarfHeute = bedarfTagSchicht.filter((b) => b.normalbetrieb === !hatZeitlich);

        // --- Dienste am Tag (nicht ausgegraut) ---
        const dayDienste = dienste.filter((d) => d.datum === datum).filter((d) => !isGrey(d.user, datum));
        const shift = shiftTimes[schicht] || null;

        // Basis: Leute der Schicht
        const baseShiftDienste = dayDienste.filter((d) => d.ist_schicht?.kuerzel === schicht);

        // Helfer: andere Schichten, aber nur wenn aenderung=true
        const helperDienste = shift
          ? dayDienste.filter((d) => d.ist_schicht?.kuerzel !== schicht && d.aenderung)
          : [];

        // uid -> clipped interval im Shiftfenster
        const intervalsInThisShift = new Map();

        if (shift) {
          // Basis-Schicht: default volle Schicht, außer aenderung dann echte Zeiten
          for (const d of baseShiftDienste) {
            let r = { s: shift.s, e: shift.e };
            if (d.aenderung) {
              const s = timeToMin(d.start);
              const e = timeToMin(d.end);
              const nr = normalizeRange(s, e);
              if (nr) r = nr;
            }
            const clipped = clampToShift(r, shift);
            intervalsInThisShift.set(String(d.user), clipped || null);
          }

          // Helfer: echte Zeit muss ins Fenster reinragen
          for (const d of helperDienste) {
            const s = timeToMin(d.start);
            const e = timeToMin(d.end);
            const nr = normalizeRange(s, e);
            if (!nr) continue;

            const clipped = clampToShift(nr, shift);
            if (!clipped) continue;

            intervalsInThisShift.set(String(d.user), clipped);
          }
        } else {
          // Kein Schichtfenster verfügbar: fallback -> nur Basis-Schicht zählt
          for (const d of baseShiftDienste) intervalsInThisShift.set(String(d.user), { s: 0, e: 1 });
        }

        const aktiveUser = Array.from(intervalsInThisShift.entries())
          .filter(([, r]) => !!r)
          .map(([uid]) => uid);

        const aktiveDienste = dayDienste.filter((d) => aktiveUser.includes(String(d.user)));

        // --- Bedarf sortieren ---
        const bedarfSortiert = bedarfHeute
          .map((b) => ({
            ...b,
            position: matrixMap[b.quali_id]?.position ?? 999,
            kuerzel: matrixMap[b.quali_id]?.kuerzel || '???',
            relevant: matrixMap[b.quali_id]?.relevant,
          }))
          .filter((b) => b.relevant)
          .sort((a, b) => a.position - b.position);

        if (bedarfSortiert.length === 0) {
          status[schicht][datum] = {
            farbe: null,
            bottom: null,
            topLeft: null,
            topRight: null,
            fehlend: [],
            meta: {
              aktiveUserIds: aktiveUser,
              abdeckung: {},
              nichtVerwendeteIds: aktiveUser,
              userQualiMap: {},
              zusatzFehltKuerzel: [],
              changedUsers: [],
              timeIssues: [],
              timeIssue: false,
              timeIssueCount: 0,
            },
          };
          continue;
        }

        // --- Qualis am Tag ---
        const userQualiMap = {};
        const tag = dayjs(datum);
        for (const q of qualis) {
          if (!aktiveUser.includes(q.user_id)) continue;
          const startOk = !q.quali_start || dayjs(q.quali_start).isSameOrBefore(tag, 'day');
          const endOk = !q.quali_endet || dayjs(q.quali_endet).isSameOrAfter(tag, 'day');
          if (startOk && endOk) {
            if (!userQualiMap[q.user_id]) userQualiMap[q.user_id] = [];
            userQualiMap[q.user_id].push(q.quali);
          }
        }

        // --- Zusatzquali fehlt ---
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

        // --- Basis-Abdeckung ---
        const base = calcCoverage({ aktiveUser, userQualiMap, bedarfSortiert, matrixMap });

        const baseIsGreen = base.totalMissing <= 0;
        let statusfarbe = baseIsGreen ? 'bg-green-500' : 'bg-red-500';
        const fehlend = base.fehlend || [];
        const bottom = base.topMissingKuerzel ? `${base.topMissingKuerzel}${base.totalMissing > 1 ? '+' : ''}` : null;

        // ⏱ Zeit-Prüfung nur wenn:
        // - mindestens ein Dienst aenderung=true
        // - und Shiftfenster existiert
        const changedUsers = aktiveDienste
          .filter((d) => d.aenderung)
          .map((d) => ({ user: d.user, start: d.start, end: d.end }));

        const doTimeCheck = changedUsers.length > 0 && !!shiftTimes[schicht] && !!shift;

        // --- Überbesetzung ---
        let topRight = null;
        const benoetigtGesamt = bedarfSortiert.reduce((s, b) => s + (b.anzahl || 0), 0);

        if (doTimeCheck) {
          const pts = Array.from(
            new Set([
              shift.s,
              shift.e,
              ...Array.from(intervalsInThisShift.values())
                .filter(Boolean)
                .flatMap((r) => [r.s, r.e]),
            ])
          ).sort((a, b) => a - b);

          let maxUeberschuss = -999;
          for (let i = 0; i < pts.length - 1; i++) {
            const mid = (pts[i] + pts[i + 1]) / 2;
            const segUsers = [];
            for (const uid of intervalsInThisShift.keys()) {
              const r = intervalsInThisShift.get(String(uid));
              if (!r) continue;
              if (mid >= r.s && mid < r.e) segUsers.push(uid);
            }
            const segUeberschuss = segUsers.length - benoetigtGesamt;
            if (segUeberschuss > maxUeberschuss) maxUeberschuss = segUeberschuss;
          }

          if (maxUeberschuss === 1) topRight = 'blau-1';
          else if (maxUeberschuss >= 2) topRight = 'blau-2';
        } else {
          const ueberschussGesamt = (aktiveUser?.length || 0) - benoetigtGesamt;
          if (ueberschussGesamt === 1) topRight = 'blau-1';
          else if (ueberschussGesamt >= 2) topRight = 'blau-2';
        }

        // --- Zeit-Unterdeckung (Segmentweise) ---
        const timeIssues = [];
        if (doTimeCheck) {
          const points = new Set([shift.s, shift.e]);
          for (const [, r] of intervalsInThisShift.entries()) {
            if (!r) continue;
            points.add(r.s);
            points.add(r.e);
          }
          const pts = Array.from(points).sort((a, b) => a - b);

          const fmtMin = (m) => {
            const mm = ((m % 1440) + 1440) % 1440;
            const hh = Math.floor(mm / 60);
            const mi = mm % 60;
            return `${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
          };

          for (let i = 0; i < pts.length - 1; i++) {
            const segStart = pts[i];
            const segEnd = pts[i + 1];
            if (segEnd <= segStart) continue;

            const mid = (segStart + segEnd) / 2;
            const segUsers = [];
            for (const uid of aktiveUser) {
              const r = intervalsInThisShift.get(String(uid));
              if (!r) continue;
              if (mid >= r.s && mid < r.e) segUsers.push(uid);
            }

            const seg = calcCoverage({ aktiveUser: segUsers, userQualiMap, bedarfSortiert, matrixMap });
            if (seg.totalMissing > 0) {
              const missingK = seg.topMissingKuerzel || (seg.fehlend?.[0] || null);
              timeIssues.push({
                from: fmtMin(segStart),
                to: fmtMin(segEnd),
                missingTotal: seg.totalMissing,
                missingKuerzel: missingK,
                missingList: seg.fehlend || [],
              });
            }
          }
        }

        const timeIssue = timeIssues.length > 0;
        const timeIssueCount = timeIssues.length;

        status[schicht][datum] = {
          farbe: statusfarbe,
          bottom,
          topLeft: zusatzFehlt.length > 0 ? zusatzFehlt[0] : null,
          topRight,
          fehlend,
          meta: {
            aktiveUserIds: aktiveUser,
            abdeckung: base.abdeckung,
            nichtVerwendeteIds: base.nichtVerwendete,
            userQualiMap,
            zusatzFehltKuerzel: zusatzFehlt,
            changedUsers,
            timeIssues,
            timeIssue,
            timeIssueCount,
          },
        };
      }
    }

    // 8) Farbleiste
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
            start_schicht: b.start_schicht,
            end_schicht: b.end_schicht,
            schichtart: b.schichtart,
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
      timeIssues = [],
      changedUsers = [],
    } = cell.meta;

    const changedSet = new Set((changedUsers || []).map((x) => String(x.user)));
    const clockName = (uid) => `${changedSet.has(String(uid)) ? '⏱ ' : ''}${userNameMapState[uid] || `User ${uid}`}`;

    const lines = [];
    lines.push(`👥 Anzahl MA: ${aktiveUserIds.length}`);

    if (changedUsers?.length) {
      lines.push('', `⏱ Geänderte Zeiten: ${changedUsers.length}`);
    }

    if (timeIssues?.length) {
      lines.push('', '⛔ Zeit-Unterdeckung:');
      for (const it of timeIssues.slice(0, 3)) {
        const k = it.missingKuerzel ? ` · fehlt: ${it.missingKuerzel}${it.missingTotal > 1 ? '+' : ''}` : '';
        lines.push(`- ${it.from}–${it.to}${k}`);
      }
      if (timeIssues.length > 3) lines.push(`- … +${timeIssues.length - 3} weitere Segmente`);
    }

    if (cell.fehlend?.length) lines.push('', `❌ Fehlende Quali: ${cell.fehlend.join(', ')}`);
    if (zusatzFehltKuerzel.length) lines.push('', `⚠️ Zusatzquali fehlt: ${zusatzFehltKuerzel.join(', ')}`);

    const abdeckungKeys = Object.keys(abdeckung);
    if (abdeckungKeys.length) {
      lines.push('', '✔ Eingesetzt:');
      for (const qualiId of abdeckungKeys) {
        const uids = abdeckung[qualiId] || [];
        const qname = matrixMapState[qualiId]?.kuerzel || `ID:${qualiId}`;
        const namen = uids.map((uid) => clockName(uid)).join(', ');
        lines.push(`- ${qname}: ${namen || '???'}`);
      }
    }

    if (nichtVerwendeteIds.length) {
      lines.push('', '🕐 Noch verfügbar:');
      for (const uid of nichtVerwendeteIds) {
        const qlist = (userQualiMap[uid] || []).map((qid) => matrixMapState[qid]?.kuerzel || `ID:${qid}`);
        lines.push(`- ${clockName(uid)}: ${qlist.join(', ') || 'keine Quali'}`);
      }
    }
    return lines.join('\n');
  };

  const buildBarHeader = (entry) => {
    if (!entry || !entry.items?.length) return 'Sonderbedarf';
    const fmt = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

    let minVon = null,
      maxBis = null,
      startSchicht = 'Früh',
      endSchicht = 'Nacht';

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
    const end = fmt(maxBis);

    return `Beginnt am ${start} in der ${startSchicht}-Schicht\nEndet am ${end} in der ${endSchicht}-Schicht`;
  };

  // Tooltip-Builder (Bar)
  const buildBarTooltip = (datum, entry) => {
    if (!entry) return '';
    const lines = [];
    lines.push(`${dayjs(datum).format('DD.MM.YYYY')} – ${entry.eventName || 'Sonderbedarf'}`);

    const gruppen = [
      { key: 'Früh', label: 'Früh' },
      { key: 'Spät', label: 'Spät' },
      { key: 'Nacht', label: 'Nacht' },
    ];

    let anyGroup = false;

    for (const g of gruppen) {
      const chosen = pickItemsForGroup(entry.items, datum, g.key);
      if (chosen.length === 0) continue;

      const sums = groupByQualiSum(chosen);
      if (sums.size === 0) continue;

      anyGroup = true;
      lines.push('');
      lines.push(`${g.label}:`);

      const rows = [];
      for (const [qualiId, total] of sums.entries()) {
        const pos = matrixMapState[qualiId]?.position ?? 9999;
        const bez =
          matrixMapState[qualiId]?.bezeichnung || matrixMapState[qualiId]?.kuerzel || `ID:${qualiId}`;
        rows.push({ pos, bez, total });
      }
      rows.sort((a, b) => a.pos - b.pos || a.bez.localeCompare(b.bez, 'de'));

      for (const r of rows) {
        lines.push(`- ${iconFor(r.total)} ${r.bez}: ${r.total} ${r.total === 1 ? 'Person' : 'Personen'}`);
      }
    }

    if (!anyGroup) lines.push('', '– Kein Bedarf für diese Schicht an diesem Tag –');
    return lines.join('\n');
  };

  const handleModalOeffnen = (datum, kuerzel) => {
    if (!allowAnalyse) return;
    if (isPastDay(datum)) return; // ✅ wie Monatsansicht
    const cell = bedarfStatus[kuerzel]?.[datum];
    setModalDatum(datum);
    setModalSchicht(kuerzel);
    setFehlendeQualis(cell?.fehlend || []);
    setModalOffen(true);
  };

  return (
    <div className="overflow-x-visible relative rounded-xl shadow-xl border border-gray-300 dark:border-gray-700" style={{ overflowY: 'visible' }}>
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
                  allowTooltip && eintrag && scheduleShow(e.currentTarget, key, () => buildBarTooltip(datum, eintrag), header, true)
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
              const past = isPastDay(datum);

              const key = `${kuerzel}|${datum}`;
              const header = `${dayjs(datum).format('DD.MM.YYYY')} · ${
                kuerzel === 'F' ? 'Frühschicht' : kuerzel === 'S' ? 'Spätschicht' : 'Nachtschicht'
              }`;

              const timeIssue = !!cell?.meta?.timeIssue;
              const baseIsGreen = String(cell?.farbe || '').includes('bg-green');
              const splitBg = timeIssue && baseIsGreen;

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
                  style={
                    splitBg
                      ? {
                          backgroundImage:
                            'linear-gradient(to bottom, rgba(34,197,94,1) 0%, rgba(34,197,94,1) 45%, rgba(239,68,68,1) 55%, rgba(239,68,68,1) 100%)',
                        }
                      : undefined
                  }
                  className={`relative ${allowAnalyse ? 'cursor-pointer' : 'cursor-default'}
                    w-[48px] min-w-[48px] text-center text-xs py-[2px] border
                    ${past ? '' : 'hover:opacity-80'}
                    ${cell?.farbe || 'bg-gray-300/20 dark:bg-gray-700/20'}
                    ${datum === heutigesDatum ? 'ring-1 ring-yellow-400' : ''}
                    ${selectedDates.has(datum) ? 'outline outline-1 outline-orange-400' : ''}
                    border-gray-300 dark:border-gray-700
                  `}
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
                <span className="font-bold text-green-700">Dunkelgrün</span>: +2 oder mehr Besetzung (qualifikationsunabhängig)
              </li>
              <li>
                Ein <span className="font-bold text-green-400">Halb Grünes</span> und ein{' '}
                <span className="font-bold text-red-500">halb Rotes</span> Feld zeigt eine Zeitliche Unterdeckung.
              </li>
              <li>Bedarfsanalyse Modal öffnet sich nicht in der Vergangenheit.</li>
              <li>Hover zeigt fehlende/erfüllte Qualifikationen sowie eingesetzte Personen.</li>
              <li>⏱ Wenn in der Kampfliste <b>aenderung = true</b>, wird zusätzlich eine Zeit-Unterdeckung geprüft.</li>
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

export default Wochen_MitarbeiterBedarf;
