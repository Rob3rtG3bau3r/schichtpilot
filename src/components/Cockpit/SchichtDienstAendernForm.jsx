// src/components/Dashboard/SchichtDienstAendernForm.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useRollen } from '../../context/RollenContext';
import { Info, GripVertical, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { berechneUndSpeichereStunden, berechneUndSpeichereUrlaub } from '../../utils/berechnungen';

dayjs.extend(duration);

// Optional: Tests ohne Recalc via VITE_SP_SKIP_RECALC=1
const PERF_SKIP_RECALC =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_SP_SKIP_RECALC === '1') ||
  false;

/* -------------------------------- Helpers -------------------------------- */

// Rohdauer in Stunden aus Beginn/Ende (mit Nacht-Übergang)
const berechneRohDauerInStunden = (start, ende) => {
  if (!start || !ende) return 0;
  const s = dayjs(`2024-01-01T${start}`);
  let e = dayjs(`2024-01-01T${ende}`);
  if (e.isBefore(s)) e = e.add(1, 'day');
  return dayjs.duration(e.diff(s)).asHours();
};

// Robust: Pause als Stunden interpretieren (wenn >5 vermutlich Minuten)
const toHours = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n > 5 ? n / 60 : n;
};

const formatStunden = (wert) => {
  if (wert == null || Number.isNaN(Number(wert))) return '0,0';
  const rounded = Math.round(Number(wert) * 100) / 100;
  const frac = Math.abs(rounded - Math.trunc(rounded));

  let str;
  if (Math.abs(frac - 0) < 0.001 || Math.abs(frac - 0.5) < 0.001) {
    str = rounded.toFixed(1);
  } else {
    str = rounded.toFixed(2);
  }
  return str.replace('.', ',');
};

const buildDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  return dayjs(`${dateStr}T${timeStr}`);
};

const berechneRuhezeitInStunden = ({ endeVonDatum, endeVonZeit, startZuDatum, startZuZeit }) => {
  const endDT = buildDateTime(endeVonDatum, endeVonZeit);
  const startDT = buildDateTime(startZuDatum, startZuZeit);
  if (!endDT || !startDT) return null;

  // Falls Ende über Mitternacht ging, kann es "vor" Start liegen je nach Datenlage.
  // Hier: Ende ist immer an endeVonDatum gebunden; wir korrigieren nur, wenn Ende "logisch" vor Ende-Start liegt,
  // aber ohne Startzeit der Vortagsschicht können wir nur sicher korrigieren, wenn Ruhezeit negativ wäre:
  let e = endDT;
  let diffH = dayjs.duration(startDT.diff(e)).asHours();
  if (diffH < -0.001) {
    // Ende war vermutlich am nächsten Tag
    e = e.add(1, 'day');
    diffH = dayjs.duration(startDT.diff(e)).asHours();
  }
  return diffH;
};

// Schichtgruppe des Users zum Datum ermitteln (aktive Zuweisung [von..bis])
const ermittleSchichtgruppe = async ({ userId, datum, firmaId, unitId }) => {
  const { data, error } = await supabase
    .from('DB_SchichtZuweisung')
    .select('schichtgruppe, von_datum, bis_datum')
    .eq('user_id', userId)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .lte('von_datum', datum)
    .or(`bis_datum.is.null,bis_datum.gte.${datum}`)
    .order('von_datum', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.schichtgruppe;
};

// Soll (Kürzel + Zeiten + Pause) aus DB_SollPlan über Schichtgruppe holen
const ladeSollAusSollPlanFuerUser = async ({ userId, datum, firmaId, unitId }) => {
  const gruppe = await ermittleSchichtgruppe({ userId, datum, firmaId, unitId });
  if (!gruppe) return { kuerzel: '-', start: null, ende: null, pause: null };

  const { data, error } = await supabase
    .from('DB_SollPlan')
    .select('kuerzel,startzeit,endzeit,pause_dauer')
    .eq('schichtgruppe', gruppe)
    .eq('datum', datum)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (error || !data) return { kuerzel: '-', start: null, ende: null, pause: null };
  return {
    kuerzel: data.kuerzel || '-',
    start: data.startzeit || null,
    ende: data.endzeit || null,
    pause: data.pause_dauer ?? null, // (min oder h) -> später toHours
  };
};

// Ist-/Soll-Schicht (ID) + Zeiten/Pause aus v_tagesplan
const ladeTagesplan = async ({ userId, datum, firmaId, unitId }) => {
  const { data, error } = await supabase
    .from('v_tagesplan')
    .select('ist_schichtart_id, soll_schichtart_id, ist_startzeit, ist_endzeit, soll_startzeit, soll_endzeit, ist_pausen_dauer, soll_pausen_dauer')
    .eq('user_id', userId)
    .eq('datum', datum)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data || null, error: null };
};

const istArbeitsTag = (kuerzel) => !['-', 'U', 'K', 'KO'].includes(kuerzel);

/* -------------------------- Component main body --------------------------- */

const SchichtDienstAendernForm = ({
  offen,
  onClose,
  eintrag, // { user, datum, name, ist_schicht (Kürzel), beginn, ende, pausen_dauer?, ... }
  aktualisieren, // (neuesDatum, userId)
  reloadListe,
  onRefresh,
  onRefreshMitarbeiterBedarf,
}) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();

  const [schichtarten, setSchichtarten] = useState([]);
  const schichtByKuerzel = useMemo(() => {
    return new Map((schichtarten || []).map((s) => [s.kuerzel, s]));
  }, [schichtarten]);

  const [auswahl, setAuswahl] = useState({
    kuerzel: '',
    start: '',
    ende: '',
    ignoriertarbeitszeit: false,
  });

  // Pause in Stunden (0.5 = 30 Min)
  const [pause, setPause] = useState(0);

  const [sollKuerzel, setSollKuerzel] = useState('-');
  const [vortagKuerzel, setVortagKuerzel] = useState('-');
  const [folgetagKuerzel, setFolgetagKuerzel] = useState('-');

  const [kommentar, setKommentar] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [mehrereTage, setMehrereTage] = useState(false);
  const [enddatum, setEnddatum] = useState('');

  const [infoOffen, setInfoOffen] = useState(false);
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [verlaufDaten, setVerlaufDaten] = useState([]);

  const [loading, setLoading] = useState(false);

  // Ruhezeit
  const [ruhezeitWarnung, setRuhezeitWarnung] = useState('');

  // Laufzeituhr
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  useEffect(() => {
    if (loading) {
      startRef.current = performance.now();
      timerRef.current = setInterval(() => setElapsedMs(performance.now() - startRef.current), 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(0);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [loading]);

  const fmtElapsed = (ms) => (ms / 1000).toFixed(1).replace('.', ',');

  // Drag & Dock
  const modalRef = useRef(null);
  const [dock, setDock] = useState(null); // 'left' | 'right' | null
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!offen) return;
    requestAnimationFrame(() => {
      const el = modalRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const left = Math.max((window.innerWidth - rect.width) / 2, 16);
      const top = Math.max((window.innerHeight - rect.height) / 2, 16);
      setPos({ left, top });
    });
  }, [offen]);

  const startDrag = (e) => {
    if (dock) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    const rect = modalRef.current?.getBoundingClientRect();
    if (cx == null || cy == null || !rect) return;
    setDragging(true);
    setDragOffset({ x: cx - rect.left, y: cy - rect.top });
    e.preventDefault();
  };

  const onDrag = (e) => {
    if (!dragging || dock) return;
    const cx = e.clientX ?? e.touches?.[0]?.clientX;
    const cy = e.clientY ?? e.touches?.[0]?.clientY;
    if (cx == null || cy == null) return;
    const el = modalRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const m = 8;

    const left = Math.min(window.innerWidth - w - m, Math.max(m, cx - dragOffset.x));
    const top = Math.min(window.innerHeight - h - m, Math.max(m, cy - dragOffset.y));
    setPos({ left, top });
  };

  const stopDrag = () => setDragging(false);

  useEffect(() => {
    if (!dragging) return;
    const mv = (ev) => onDrag(ev);
    const up = () => stopDrag();
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    };
  }, [dragging, dock, dragOffset]);

  /* ------------------------------ Data loads ------------------------------ */

  // Schichtarten laden
  useEffect(() => {
    const run = async () => {
      if (!offen || !firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select(
          'id, kuerzel, startzeit, endzeit, farbe_bg, farbe_text, beschreibung, sollplan_relevant, ignoriert_arbeitszeit, pause_aktiv, pause_dauer'
        )
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (error) {
        console.error('Fehler DB_SchichtArt:', error);
        return;
      }

      const sortiert = (data || []).sort((a, b) => {
        if (a.sollplan_relevant && !b.sollplan_relevant) return -1;
        if (!a.sollplan_relevant && b.sollplan_relevant) return 1;
        return (a.kuerzel || '').localeCompare(b.kuerzel || '');
      });

      setSchichtarten(sortiert);
    };

    run();
  }, [offen, firma, unit]);

  // Mini-Cache für SollPlan (Tagwechsel)
  const sollMiniCache = useRef(new Map()); // key: `${userId}|${datum}|${firma}|${unit}`
  const getSollCached = async ({ userId, datum, firmaId, unitId }) => {
    const k = `${userId}|${datum}|${firmaId}|${unitId}`;
    if (sollMiniCache.current.has(k)) return sollMiniCache.current.get(k);
    const v = await ladeSollAusSollPlanFuerUser({ userId, datum, firmaId, unitId });
    sollMiniCache.current.set(k, v);
    return v;
  };

  // Initialwerte laden (Ist/Soll/Zeiten/Pause + Vortag/Folgetag)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!offen || !eintrag || !firma || !unit) return;
      if (!schichtarten.length) return;

      // Reset UI
      setMehrereTage(false);
      setEnddatum('');
      setSaveMessage('');
      setRuhezeitWarnung('');

      // 1) Tagesplan heute (Ist bevorzugt)
      const { data: tpHeute } = await ladeTagesplan({
        userId: eintrag.user,
        datum: eintrag.datum,
        firmaId: firma,
        unitId: unit,
      });

      const istId = tpHeute?.ist_schichtart_id || tpHeute?.soll_schichtart_id || null;
      const istSchicht = istId ? schichtarten.find((s) => s.id === istId) : null;

      const startHeute =
        tpHeute?.ist_startzeit || tpHeute?.soll_startzeit || eintrag?.beginn || istSchicht?.startzeit || '';
      const endeHeute =
        tpHeute?.ist_endzeit || tpHeute?.soll_endzeit || eintrag?.ende || istSchicht?.endzeit || '';

      const kuerzelHeute = istSchicht?.kuerzel || eintrag?.ist_schicht || '';

      const ignoriert = !!istSchicht?.ignoriert_arbeitszeit;

      // Pause initial (robust)
      const pRaw =
        typeof tpHeute?.ist_pausen_dauer === 'number'
          ? tpHeute.ist_pausen_dauer
          : typeof tpHeute?.soll_pausen_dauer === 'number'
          ? tpHeute.soll_pausen_dauer
          : typeof eintrag?.pausen_dauer === 'number'
          ? eintrag.pausen_dauer
          : null;

      let initialPause = 0;
      if (ignoriert) initialPause = 0;
      else if (pRaw != null) initialPause = toHours(pRaw) ?? 0;
      else if (istSchicht?.pause_aktiv && istSchicht.pause_dauer != null) initialPause = Number(istSchicht.pause_dauer) / 60;
      else initialPause = 0;

      if (!alive) return;

      setAuswahl({
        kuerzel: kuerzelHeute,
        start: startHeute,
        ende: endeHeute,
        ignoriertarbeitszeit: ignoriert,
      });
      setPause(ignoriert ? 0 : initialPause);
      setKommentar(eintrag?.kommentar || '');

      // 2) Soll-Kürzel
      const soll = await getSollCached({
        userId: eintrag.user,
        datum: eintrag.datum,
        firmaId: firma,
        unitId: unit,
      });
      if (!alive) return;
      setSollKuerzel(soll?.kuerzel || '-');

      // 3) Vortag/Folgetag Kürzel (aus v_tagesplan via ID)
      const vt = dayjs(eintrag.datum).subtract(1, 'day').format('YYYY-MM-DD');
      const ft = dayjs(eintrag.datum).add(1, 'day').format('YYYY-MM-DD');

      const { data: tpVt } = await ladeTagesplan({
        userId: eintrag.user,
        datum: vt,
        firmaId: firma,
        unitId: unit,
      });
      const vtId = tpVt?.ist_schichtart_id || tpVt?.soll_schichtart_id || null;
      const vtSchicht = vtId ? schichtarten.find((s) => s.id === vtId) : null;

      const { data: tpFt } = await ladeTagesplan({
        userId: eintrag.user,
        datum: ft,
        firmaId: firma,
        unitId: unit,
      });
      const ftId = tpFt?.ist_schichtart_id || tpFt?.soll_schichtart_id || null;
      const ftSchicht = ftId ? schichtarten.find((s) => s.id === ftId) : null;

      if (!alive) return;
      setVortagKuerzel(vtSchicht?.kuerzel || '-');
      setFolgetagKuerzel(ftSchicht?.kuerzel || '-');
    };

    run();

    return () => {
      alive = false;
    };
  }, [offen, eintrag?.user, eintrag?.datum, firma, unit, schichtarten]);

  // UI helper: Schichtwahl
  const handleSchichtwahl = (kuerzel) => {
    const s = schichtByKuerzel.get(kuerzel);
    const ignoriert = !!s?.ignoriert_arbeitszeit;

    setAuswahl((prev) => ({
      ...prev,
      kuerzel,
      ignoriertarbeitszeit: ignoriert,
      ...(ignoriert
        ? {}
        : {
            start: s?.startzeit || prev.start,
            ende: s?.endzeit || prev.ende,
          }),
    }));

    // Pause-Default: wenn ignoriert => 0, sonst aus SchichtArt (Minuten -> Stunden)
    if (ignoriert) {
      setPause(0);
    } else if (s?.pause_aktiv && s.pause_dauer != null) {
      setPause(Number(s.pause_dauer) / 60);
    } else {
      setPause(0);
    }
  };

  // Dauer + Farben + Hinweistext
  const { dauer, rohDauer, dauerFarbe, hinweistext } = useMemo(() => {
    const roh = berechneRohDauerInStunden(auswahl.start, auswahl.ende);
    const schicht = schichtByKuerzel.get(auswahl.kuerzel);
    const pausenPflichtAktiv = !!schicht?.pause_aktiv;

    let minPause = 0;
    if (!auswahl.ignoriertarbeitszeit && pausenPflichtAktiv) {
      if (roh >= 9) minPause = 0.75;
      else if (roh >= 6) minPause = 0.5;
    }

    const effektivePause = auswahl.ignoriertarbeitszeit ? 0 : Math.max(Number(pause) || 0, minPause);
    const netto = Math.max(roh - effektivePause, 0);

    let f = 'bg-green-700';
    let h = '';
    if (netto >= 12) {
      f = 'bg-red-700';
      h = 'Betriebsleitung und Betriebsrat sind zu informieren.';
    } else if (netto >= 10) {
      f = 'bg-orange-600';
      h = 'Max. 10 h nach §3 ArbZG, Ausnahme: §7';
    }
    return { dauer: netto, rohDauer: roh, dauerFarbe: f, hinweistext: h };
  }, [auswahl.start, auswahl.ende, auswahl.ignoriertarbeitszeit, auswahl.kuerzel, pause, schichtByKuerzel]);

  // Mindestpause nach ArbZG automatisch erzwingen (nur wenn pause_aktiv)
  useEffect(() => {
    const schicht = schichtByKuerzel.get(auswahl.kuerzel);
    const pausenPflichtAktiv = !!schicht?.pause_aktiv;

    if (auswahl.ignoriertarbeitszeit) {
      setPause(0);
      return;
    }
    if (!pausenPflichtAktiv) return;

    const roh = berechneRohDauerInStunden(auswahl.start, auswahl.ende);
    let minPause = 0;
    if (roh >= 9) minPause = 0.75;
    else if (roh >= 6) minPause = 0.5;

    setPause((prev) => {
      const p = Number(prev) || 0;
      return p < minPause ? minPause : p;
    });
  }, [auswahl.start, auswahl.ende, auswahl.kuerzel, auswahl.ignoriertarbeitszeit, schichtByKuerzel]);

  // Ruhezeit prüfen (Vortag->Heute und Heute->Folgetag)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!offen || !eintrag || !firma || !unit) return;
      if (!schichtarten.length) return;

      setRuhezeitWarnung('');

      const heute = eintrag.datum;
      const vt = dayjs(heute).subtract(1, 'day').format('YYYY-MM-DD');
      const ft = dayjs(heute).add(1, 'day').format('YYYY-MM-DD');

      const kuerzelHeute = auswahl.kuerzel || '-';

      // Für ignoriert_arbeitszeit keine Ruhezeitprüfung
      if (auswahl.ignoriertarbeitszeit) return;

      // Heute braucht Start (für Ruhezeit vorwärts/rückwärts)
      if (!auswahl.start) return;

      // Tagespläne laden
      const [{ data: tpVt }, { data: tpFt }] = await Promise.all([
        ladeTagesplan({ userId: eintrag.user, datum: vt, firmaId: firma, unitId: unit }),
        ladeTagesplan({ userId: eintrag.user, datum: ft, firmaId: firma, unitId: unit }),
      ]);

      if (!alive) return;

      // Vortag Kürzel (Ist/Soll)
      const vtId = tpVt?.ist_schichtart_id || tpVt?.soll_schichtart_id || null;
      const vtSchicht = vtId ? schichtarten.find((s) => s.id === vtId) : null;
      const kuerzelVt = vtSchicht?.kuerzel || '-';

      // Folgetag Kürzel (Ist/Soll)
      const ftId = tpFt?.ist_schichtart_id || tpFt?.soll_schichtart_id || null;
      const ftSchicht = ftId ? schichtarten.find((s) => s.id === ftId) : null;
      const kuerzelFt = ftSchicht?.kuerzel || '-';

      const warnings = [];

      // A) Vortag -> Heute (Ende Vortag -> Start Heute)
      if (istArbeitsTag(kuerzelHeute) && istArbeitsTag(kuerzelVt)) {
        const endeVt = tpVt?.ist_endzeit || tpVt?.soll_endzeit || null;
        if (endeVt) {
          const diffH = berechneRuhezeitInStunden({
            endeVonDatum: vt,
            endeVonZeit: endeVt,
            startZuDatum: heute,
            startZuZeit: auswahl.start,
          });
          if (diffH != null && diffH < 11) {
            warnings.push(`⚠️ Ruhezeit-Verstoß: nur ${formatStunden(diffH)} h zwischen Vortag & heute (min. 11 h).`);
          }
        }
      }

      // B) Heute -> Folgetag (Ende Heute -> Start Folgetag)
      if (istArbeitsTag(kuerzelHeute) && istArbeitsTag(kuerzelFt) && auswahl.ende) {
        const startFt = tpFt?.ist_startzeit || tpFt?.soll_startzeit || null;
        if (startFt) {
          // Ende heute kann über Mitternacht laufen → wir berechnen Ende-Datum ggf. +1 Tag
          const sToday = buildDateTime(heute, auswahl.start);
          let eToday = buildDateTime(heute, auswahl.ende);
          if (sToday && eToday && eToday.isBefore(sToday)) eToday = eToday.add(1, 'day');

          const sNext = buildDateTime(ft, startFt);
          if (eToday && sNext) {
            const diffH2 = dayjs.duration(sNext.diff(eToday)).asHours();
            if (diffH2 < 11) {
              warnings.push(`⚠️ Ruhezeit-Verstoß: nur ${formatStunden(diffH2)} h zwischen heute & Folgetag (min. 11 h).`);
            }
          }
        }
      }

      if (warnings.length) setRuhezeitWarnung(warnings.join('\n'));
    };

    run();
    return () => {
      alive = false;
    };
  }, [
    offen,
    eintrag?.user,
    eintrag?.datum,
    firma,
    unit,
    schichtarten,
    auswahl.kuerzel,
    auswahl.start,
    auswahl.ende,
    auswahl.ignoriertarbeitszeit,
  ]);

  // Sperrlogik
  const diffTage = eintrag ? dayjs().startOf('day').diff(dayjs(eintrag.datum), 'day') : 0;
  const speichernGesperrt =
    (rolle === 'Team_Leader' && diffTage > 3) || ((rolle === 'Planner' || rolle === 'Admin_Dev') && diffTage > 365);

  /* --------------------------------- Save --------------------------------- */

  const handleSpeichern = async (schliessenDanach = false) => {
    if (speichernGesperrt) return;
    if (!eintrag?.user || !eintrag?.datum || !firma || !unit) return;

    setLoading(true);

    // Auth nur 1x
    const { data: authUser } = await supabase.auth.getUser();
    const createdBy = authUser?.user?.id;
    if (!createdBy) {
      console.error('❌ Kein eingeloggter Benutzer gefunden!');
      setLoading(false);
      return;
    }

    const f = firma;
    const u = unit;

    const selectedSchicht = schichtByKuerzel.get(auswahl.kuerzel) || null;
    const nowIso = new Date().toISOString();

    const startDatum = dayjs(eintrag.datum);
    const endDatum = mehrereTage && enddatum ? dayjs(enddatum) : startDatum;

    // Dateliste
    const dates = [];
    for (let d = startDatum; d.isSameOrBefore(endDatum); d = d.add(1, 'day')) {
      dates.push(d.format('YYYY-MM-DD'));
    }

    // Alte Kampflisten-Zeilen für Zeitraum in 1 Query
    const { data: oldRows, error: oldErr } = await supabase
      .from('DB_Kampfliste')
      .select(
        `
        user, datum, firma_id, unit_id, ist_schicht, soll_schicht,
        startzeit_ist, endzeit_ist, dauer_ist, dauer_soll, kommentar,
        created_at, created_by, schichtgruppe,
        pausen_dauer,
        ist_rel:ist_schicht ( id, kuerzel, startzeit, endzeit )
      `
      )
      .eq('user', eintrag.user)
      .eq('firma_id', f)
      .eq('unit_id', u)
      .in('datum', dates);

    if (oldErr) console.error('Fehler oldRows:', oldErr);

    const oldByDate = new Map((oldRows ?? []).map((r) => [r.datum, r]));

    // Cache für SollPlan
    const sollCache = new Map(); // date -> {kuerzel,start,ende,pause}
    const getSoll = async (dateStr) => {
      if (sollCache.has(dateStr)) return sollCache.get(dateStr);
      const v = await ladeSollAusSollPlanFuerUser({
        userId: eintrag.user,
        datum: dateStr,
        firmaId: f,
        unitId: u,
      });
      sollCache.set(dateStr, v);
      return v;
    };

    const recalcStundenSet = new Set(); // JSON.stringify({user,jahr,monat,firma,unit})
    const recalcUrlaubSet = new Set(); // JSON.stringify({user,jahr,firma,unit})

    const verlaufBatch = [];
    const deleteDates = [];
    const insertBatch = [];

    // Basiszeiten für aenderung (nur Zeitabweichung gegenüber Standard)
    const basisStart = selectedSchicht?.startzeit ?? null;
    const basisEnde = selectedSchicht?.endzeit ?? null;

    for (const datumStr of dates) {
      const dObj = dayjs(datumStr);
      const oldRow = oldByDate.get(datumStr) ?? null;
      const oldIstKuerzel = oldRow?.ist_rel?.kuerzel ?? null;

      const sollPlan = await getSoll(datumStr);

      const sollK =
        sollPlan?.kuerzel && sollPlan.kuerzel !== '-' ? sollPlan.kuerzel : oldRow?.soll_schicht ?? null;

      // Urlaub auf freien Tagen überspringen
      if ((sollK == null || sollK === '-') && auswahl.kuerzel === 'U') {
        continue;
      }

      // Dauer_Soll (nur falls noch nicht vorhanden)
      let dauerSoll = oldRow?.dauer_soll ?? null;
      if (!dauerSoll && sollPlan?.start && sollPlan?.ende) {
        const s = dayjs(`2024-01-01T${sollPlan.start}`);
        let e = dayjs(`2024-01-01T${sollPlan.ende}`);
        if (e.isBefore(s)) e = e.add(1, 'day');
        dauerSoll = dayjs.duration(e.diff(s)).asHours();
      }

      // Start/Ende bestimmen
      let aktuelleStart = auswahl.start;
      let aktuelleEnde = auswahl.ende;

      if (selectedSchicht?.ignoriert_arbeitszeit) {
        aktuelleStart =
          oldRow?.startzeit_ist ??
          sollPlan?.start ??
          selectedSchicht?.startzeit ??
          (aktuelleStart || null);
        aktuelleEnde =
          oldRow?.endzeit_ist ??
          sollPlan?.ende ??
          selectedSchicht?.endzeit ??
          (aktuelleEnde || null);
      }

      // Dauer + Pause
      let aktuelleDauer = null;
      let aktuellePause = 0;

      if (selectedSchicht?.ignoriert_arbeitszeit) {
        aktuelleDauer = oldRow?.dauer_ist ?? dauerSoll ?? null;
        aktuellePause = 0;
      } else if (aktuelleStart && aktuelleEnde) {
        const roh = berechneRohDauerInStunden(aktuelleStart, aktuelleEnde);
        let minPause = 0;
        if (selectedSchicht?.pause_aktiv) {
          if (roh >= 9) minPause = 0.75;
          else if (roh >= 6) minPause = 0.5;
        }
        aktuellePause = Math.max(Number(pause) || 0, minPause);
        aktuelleDauer = Math.max(roh - aktuellePause, 0);
      }

      // Dirty flags (Recalc)
      const alterDauerIst = oldRow?.dauer_ist ?? null;
      const jahr = dObj.year();
      const monat = dObj.month() + 1;

      if (!PERF_SKIP_RECALC && alterDauerIst !== aktuelleDauer) {
        recalcStundenSet.add(JSON.stringify({ user: eintrag.user, jahr, monat, firma: f, unit: u }));
      }
      if (!PERF_SKIP_RECALC && (auswahl.kuerzel === 'U' || oldIstKuerzel === 'U')) {
        recalcUrlaubSet.add(JSON.stringify({ user: eintrag.user, jahr, firma: f, unit: u }));
      }

      // Verlauf: alten Zustand speichern
      if (oldRow) {
        verlaufBatch.push({
          user: oldRow.user,
          datum: oldRow.datum,
          firma_id: oldRow.firma_id,
          unit_id: oldRow.unit_id,
          ist_schicht: oldRow.ist_schicht,
          soll_schicht: oldRow.soll_schicht,
          startzeit_ist: oldRow.startzeit_ist,
          endzeit_ist: oldRow.endzeit_ist,
          dauer_ist: oldRow.dauer_ist,
          dauer_soll: oldRow.dauer_soll,
          kommentar: oldRow.kommentar,
          pausen_dauer: oldRow.pausen_dauer ?? 0,
          change_on: nowIso,
          created_by: oldRow.created_by,
          change_by: createdBy,
          created_at: oldRow.created_at,
          schichtgruppe: oldRow.schichtgruppe,
        });
      }

      // Delete + Insert
      deleteDates.push(datumStr);

      const schichtId = selectedSchicht?.id ?? schichtarten.find((s) => s.kuerzel === auswahl.kuerzel)?.id ?? null;

      const hatAenderung =
        ['U', 'K', 'KO'].includes(auswahl.kuerzel)
          ? false
          : !((basisStart ?? null) === (aktuelleStart ?? null) && (basisEnde ?? null) === (aktuelleEnde ?? null));

      insertBatch.push({
        user: eintrag.user,
        datum: datumStr,
        firma_id: f,
        unit_id: u,
        soll_schicht: sollK ?? null,
        ist_schicht: schichtId,
        startzeit_ist: aktuelleStart ?? null,
        endzeit_ist: aktuelleEnde ?? null,
        dauer_ist: aktuelleDauer ?? null,
        dauer_soll: dauerSoll ?? null,
        pausen_dauer: aktuellePause ?? 0,
        aenderung: hatAenderung,
        created_at: nowIso,
        created_by: createdBy,
        schichtgruppe: eintrag.schichtgruppe,
        kommentar,
      });
    }

    // Batch writes
    if (verlaufBatch.length) {
      const vr = await supabase.from('DB_KampflisteVerlauf').insert(verlaufBatch);
      if (vr.error) console.error('❌ Insert DB_KampflisteVerlauf:', vr.error.message);
    }

    if (deleteDates.length) {
      const dr = await supabase
        .from('DB_Kampfliste')
        .delete()
        .eq('user', eintrag.user)
        .eq('firma_id', f)
        .eq('unit_id', u)
        .in('datum', deleteDates);
      if (dr.error) console.error('❌ Delete DB_Kampfliste:', dr.error.message);
    }

    if (insertBatch.length) {
      const ir = await supabase.from('DB_Kampfliste').insert(insertBatch);
      if (ir.error) console.error('❌ Insert DB_Kampfliste:', ir.error.message);
    }

    // Batch recalc
    if (!PERF_SKIP_RECALC) {
      for (const k of recalcStundenSet) {
        const { user, jahr, monat, firma: ff, unit: uu } = JSON.parse(k);
        await berechneUndSpeichereStunden(user, jahr, monat, ff, uu);
      }
      for (const k of recalcUrlaubSet) {
        const { user, jahr, firma: ff, unit: uu } = JSON.parse(k);
        await berechneUndSpeichereUrlaub(user, jahr, ff, uu);
      }
    }

    setSaveMessage(`${startDatum.format('DD.MM.YYYY')} Erfolgreich gespeichert`);
    setTimeout(() => setSaveMessage(''), 1500);
    setKommentar('');

    aktualisieren?.(eintrag.datum, eintrag.user);
    reloadListe?.();
    onRefresh?.();
    onRefreshMitarbeiterBedarf?.();

    if (schliessenDanach) onClose();

    setLoading(false);
  };

  /* ----------------------------- Verlauf laden ---------------------------- */

  const ladeVerlauf = async () => {
    if (!eintrag?.user || !eintrag?.datum || !firma || !unit) return;

    // 1) Aktueller Zustand
    const { data: cur, error: curErr } = await supabase
      .from('DB_Kampfliste')
      .select(
        `
        id, datum, ist_schicht, soll_schicht, startzeit_ist, endzeit_ist,
        kommentar, pausen_dauer, created_at, created_by,
        ist_schicht_rel:ist_schicht (kuerzel),
        user_rel:created_by (user_id, vorname, nachname)
      `
      )
      .eq('user', eintrag.user)
      .eq('datum', eintrag.datum)
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .maybeSingle();

    if (curErr) console.error('Fehler aktueller Eintrag (DB_Kampfliste):', curErr);

    // 2) Verlauf
    const { data: hist, error: histErr } = await supabase
      .from('DB_KampflisteVerlauf')
      .select(
        `
        id, datum, ist_schicht, soll_schicht, startzeit_ist, endzeit_ist,
        kommentar, pausen_dauer, created_at, change_on, created_by,
        ist_schicht_rel:ist_schicht (kuerzel),
        user_rel:created_by (user_id, vorname, nachname)
      `
      )
      .eq('user', eintrag.user)
      .eq('datum', eintrag.datum)
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .order('created_at', { ascending: false })
      .limit(10);

    if (histErr) {
      console.error('Fehler beim Laden des Verlaufs:', histErr);
      return;
    }

    const top = cur
      ? [
          {
            id: `current-${cur.id}`,
            ...cur,
            _aktuell: true,
          },
        ]
      : [];

    setVerlaufDaten([...(top || []), ...(hist || [])]);
    setVerlaufOffen(true);
  };

  /* --------------------------------- Render -------------------------------- */

  if (!offen || !eintrag) return null;

  const farbeAktuelleSchicht = schichtByKuerzel.get(auswahl.kuerzel);

  const ladeNeuenTag = (richtung) => {
    const neuesDatum = dayjs(eintrag.datum)[richtung](1, 'day').format('YYYY-MM-DD');
    aktualisieren?.(neuesDatum, eintrag.user);
  };

  // Mindestpause für Dropdown (Anzeige)
  const aktuelleSchicht = schichtByKuerzel.get(auswahl.kuerzel);
  const pausenPflichtAktiv = !!aktuelleSchicht?.pause_aktiv;

  const rohDauerLocal = berechneRohDauerInStunden(auswahl.start, auswahl.ende);
  let minPauseByLaw = 0;
  if (!auswahl.ignoriertarbeitszeit && pausenPflichtAktiv) {
    if (rohDauerLocal >= 9) minPauseByLaw = 0.75;
    else if (rohDauerLocal >= 6) minPauseByLaw = 0.5;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div
        ref={modalRef}
        className={`absolute bg-white text-gray-800 dark:bg-gray-900 dark:text-white border border-gray-500 p-6 rounded-xl w-[700px] shadow-lg ${
          dragging ? 'select-none cursor-grabbing' : ''
        } ${dock ? 'h-screen rounded-none' : ''}`}
        style={
          dock === 'left'
            ? { left: 0, top: 0 }
            : dock === 'right'
            ? { right: 0, top: 0 }
            : { left: `${pos.left}px`, top: `${pos.top}px` }
        }
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onMouseDown={startDrag}
              onTouchStart={startDrag}
              title="Verschieben"
              className="p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-move"
            >
              <GripVertical className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">Dienst ändern – {eintrag.name}</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDock((d) => (d === 'left' ? null : 'left'))}
              title={dock === 'left' ? 'Andocken lösen' : 'Links andocken'}
              className={`p-1 rounded-xl ${
                dock === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDock((d) => (d === 'right' ? null : 'right'))}
              title={dock === 'right' ? 'Andocken lösen' : 'Rechts andocken'}
              className={`p-1 rounded-xl ${
                dock === 'right' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <PanelRightOpen className="w-5 h-5" />
            </button>

            <button
              onClick={() => setInfoOffen(true)}
              className="p-1 rounded-xl text-blue-500 hover:text-blue-700"
              title="Infos zum Modul"
            >
              <Info size={20} />
            </button>
          </div>
        </div>

        {/* Save-Meldung */}
        {saveMessage && (
          <div className="mb-2 text-green-600 text-left text-xs font-medium">✅ {saveMessage}</div>
        )}

        {/* Datum / Navigation / Multi-Tage */}
        <div className="mb-4">
          <div className="flex justify-between items-center">
            {/* Links: Datum + Ist-Schicht */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => ladeNeuenTag('subtract')}
                  className="text-xl hover:text-blue-500"
                  title="Einen Tag zurück"
                >
                  ←
                </button>
                <h2 className="text-lg font-bold">{dayjs(eintrag.datum).format('DD.MM.YYYY')}</h2>
                <button onClick={() => ladeNeuenTag('add')} className="text-xl hover:text-blue-500" title="Einen Tag vor">
                  →
                </button>
              </div>
<div className="text-xs text-center text-gray-400 px-2 py-1 border border-gray-700 rounded-lg">
                <div>Vortag:</div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{vortagKuerzel}</div>
              </div>
              <div className="text-sm text-center">
                <div>Ist-Schicht:</div>
                <div
                  className="text-lg font-bold"
                  style={{
                    color: farbeAktuelleSchicht?.farbe_text,
                    backgroundColor: farbeAktuelleSchicht?.farbe_bg,
                    padding: '4px 8px',
                    borderRadius: '8px',
                  }}
                >
                  {auswahl.kuerzel}
                </div>
              </div>
              <div className="text-xs text-center text-gray-400 px-2 py-1 border border-gray-700 rounded-lg">
                <div>Folgetag:</div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{folgetagKuerzel}</div>
              </div>
            </div>

            {/* Rechts: Soll/Vortag/Folgetag */}
            <div className="flex items-center gap-4">
              <div className="text-xs text-center text-gray-400 px-2 py-1 border border-gray-700 rounded-lg">
                <div>Soll-Schicht:</div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{sollKuerzel}</div>
              </div>
                            
            </div>
          </div>

          {/* Multi-Tage */}
          <div className="mt-2 flex items-center gap-3">
            {mehrereTage && (
              <input
                type="date"
                value={enddatum}
                onChange={(e) => setEnddatum(e.target.value)}
                min={eintrag.datum}
                className="p-1 rounded-xl bg-gray-100 dark:bg-gray-700 text-center text-sm"
              />
            )}
            <label className="flex items-center gap-2 text-md">
              <input
                type="checkbox"
                checked={mehrereTage}
                onChange={() => {
                  const aktiv = !mehrereTage;
                  setMehrereTage(aktiv);
                  if (aktiv && eintrag?.datum) {
                    setEnddatum(dayjs(eintrag.datum).add(1, 'day').format('YYYY-MM-DD'));
                  } else {
                    setEnddatum('');
                  }
                }}
              />
              Über mehrere Tage
            </label>
          </div>
        </div>

        {/* Zeiten + Pause + Dauer */}
        {!auswahl.ignoriertarbeitszeit && (
          <div className="grid grid-cols-4 gap-4 mb-2 items-end">
            <div>
              <label className="block mb-1">Beginn</label>
              <input
                type="time"
                value={auswahl.start}
                onChange={(e) => setAuswahl((p) => ({ ...p, start: e.target.value }))}
                className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
              />
            </div>

            <div>
              <label className="block mb-1">Ende</label>
              <input
                type="time"
                value={auswahl.ende}
                onChange={(e) => setAuswahl((p) => ({ ...p, ende: e.target.value }))}
                className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
              />
            </div>

            <div>
              <label className="block mb-1">
                Pause
                <span
                  className="ml-1 p-2 text-lg text-gray-500 dark:text-red-400 cursor-help"
                  title="Faustregel (DE): ab 6h mind. 30 Min, ab 9h mind. 45 Min. Mindestpausen werden nur bei Schichtarten mit pause_aktiv berücksichtigt."
                >
                  ⓘ
                </span>
              </label>
              <select
                value={pause}
                onChange={(e) => setPause(Number(e.target.value))}
                className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
              >
                {(!pausenPflichtAktiv || minPauseByLaw <= 0) && <option value={0}>0 min</option>}
                {(!pausenPflichtAktiv || minPauseByLaw <= 0.25) && <option value={0.25}>15 min</option>}

                {minPauseByLaw <= 0.5 && <option value={0.5}>30 min</option>}
                {minPauseByLaw <= 0.75 && <option value={0.75}>45 min</option>}
                {minPauseByLaw <= 1 && <option value={1}>60 min</option>}
              </select>
            </div>

            <div>
              <label className="block mb-1">Dauer (netto)</label>
              <div className={`p-2 rounded-xl text-md text-center text-white ${dauerFarbe}`}>
                {formatStunden(dauer)} h
                <div className="text-[10px] mt-1 text-gray-200/80">Rohdauer: {formatStunden(rohDauer)} h</div>
              </div>
            </div>
          </div>
        )}

        {auswahl.ignoriertarbeitszeit && (
          <div className="mb-2 text-sm text-yellow-400">
            Diese Schichtart überschreibt die Arbeitszeit (z. B. Urlaub / Krank) – Zeiten &amp; Pause sind deaktiviert.
          </div>
        )}

        <div className="text-right text-sm text-yellow-500 mb-2 min-h-[1.5rem]">{hinweistext}</div>

        {ruhezeitWarnung && (
          <div className="mb-3 rounded-xl border border-red-300 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200 px-3 py-2 text-xs whitespace-pre-line">
            {ruhezeitWarnung}
          </div>
        )}

        {/* Schichtarten */}
        <div className="mb-3">
          <label className="block mb-2 text-sm">Schichtart wählen</label>
          <div className="grid grid-cols-4 gap-2">
            {schichtarten.map((s) => (
              <div
                key={s.id}
                className={`rounded-xl p-2 cursor-pointer border text-sm flex justify-between items-center text-center ${
                  auswahl.kuerzel === s.kuerzel ? 'ring-2 ring-white' : ''
                }`}
                style={{ backgroundColor: s.farbe_bg, color: s.farbe_text }}
                onClick={() => handleSchichtwahl(s.kuerzel)}
                title={s.beschreibung}
              >
                <span className="font-semibold mr-1">{s.kuerzel}</span>
                <span className="text-xs">
                  {s.startzeit} - {s.endzeit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Kommentar */}
        <div className="mb-4">
          <label className="block mb-1">Kommentar (optional)</label>
          <textarea
            maxLength={150}
            rows={2}
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            placeholder="Kommentar max. 150 Zeichen"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-between items-start mt-6 gap-3 text-sm text-gray-500 dark:text-gray-400">
          <div>
            <p>
              <strong>Erstellt am:</strong>{' '}
              {eintrag.created_at ? dayjs(eintrag.created_at).format('DD.MM.YYYY HH:mm') : 'Unbekannt'}
            </p>
            <button onClick={ladeVerlauf} className="text-xs underline text-blue-400 hover:text-blue-200 mt-1">
              Änderungsverlauf anzeigen
            </button>
          </div>

          <div className="flex flex-col items-end gap-1 mt-1">
            {loading && (
              <div className="text-xs text-gray-500 dark:text-gray-300 font-mono tabular-nums">
                ⏱ Laufzeit: {fmtElapsed(elapsedMs)} s
              </div>
            )}

            <div className="flex gap-3 items-center">
              {loading && <div className="w-5 h-5 border-2 border-t-transparent border-blue-400 rounded-full animate-spin" />}

              <button
                onClick={onClose}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition"
                disabled={loading}
              >
                Schließen
              </button>

              <button
                onClick={() => handleSpeichern(false)}
                disabled={loading || speichernGesperrt}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition ${
                  loading || speichernGesperrt ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Speichern
              </button>

              <button
                onClick={() => handleSpeichern(true)}
                disabled={loading || speichernGesperrt}
                className={`bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl transition ${
                  loading || speichernGesperrt ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Speichern &amp; Schließen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Info-Modal */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white rounded-xl p-6 w-[520px] relative">
            <h2 className="text-lg font-bold mb-3">Infos zu diesem Modul</h2>
            <ul className="text-sm list-disc pl-5 space-y-2 mb-4">
              <li>Dienst für Mitarbeitende ändern (Schichtart + Zeiten).</li>
              <li>
                <b>U/K/KO</b> mit <i>ignoriert_arbeitszeit</i> übernehmen alte Zeiten.
              </li>
              <li>Dauer-Berechnung inkl. Nacht-Übergang &amp; Pause.</li>
              <li>Mehrere Tage eintragen möglich.</li>
              <li>Alter Eintrag wird in den Verlauf archiviert.</li>
              <li>Soll kommt aus DB_SollPlan (über die Schichtgruppe).</li>
              <li>Mit ← / → Tage wechseln.</li>
              <li>Ruhezeit-Prüfung: Vortag→Heute und Heute→Folgetag (min. 11h).</li>
            </ul>

            <div className="text-sm space-y-2">
              <div className="font-semibold text-gray-700 dark:text-gray-300">Bedienung</div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <GripVertical className="w-4 h-4 mt-0.5 text-gray-500" />
                  <span>
                    <b>Verschieben:</b> Griff gedrückt halten.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <PanelLeftOpen className="w-4 h-4 mt-0.5 text-gray-500" />
                  <span>
                    <b>Links andocken</b>
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <PanelRightOpen className="w-4 h-4 mt-0.5 text-gray-500" />
                  <span>
                    <b>Rechts andocken</b>
                  </span>
                </li>
              </ul>
            </div>

            <button onClick={() => setInfoOffen(false)} className="absolute top-2 right-3 text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Verlauf-Modal */}
      {verlaufOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl p-6 w-[800px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-3">Letzte Änderungen für {eintrag.name}</h3>

            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 text-left">
                  <th className="p-2">Kürzel</th>
                  <th>Von</th>
                  <th>Bis</th>
                  <th>Pause (h)</th>
                  <th>Kommentar</th>
                  <th>Erstellt am</th>
                  <th>Erstellt von</th>
                </tr>
              </thead>
              <tbody>
                {verlaufDaten.map((v) => (
                  <tr key={v.id}>
                    <td className="p-2">
                      <span>{v.ist_schicht_rel?.kuerzel || '-'}</span>
                      {v._aktuell && (
                        <span className="ml-2 text-[10px] px-2 rounded-full bg-blue-600 text-white align-middle">neu</span>
                      )}
                    </td>
                    <td>{v.startzeit_ist || '-'}</td>
                    <td>{v.endzeit_ist || '-'}</td>
                    <td>{formatStunden(toHours(v.pausen_dauer) ?? 0)}</td>
                    <td>{v.kommentar || '-'}</td>
                    <td>{v.created_at ? dayjs(v.created_at).format('DD.MM.YYYY HH:mm') : '-'}</td>
                    <td>
                      {v.user_rel ? `${v.user_rel.vorname || ''} ${v.user_rel.nachname || ''}`.trim() : v.created_by || 'Unbekannt'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right mt-4">
              <button onClick={() => setVerlaufOffen(false)} className="bg-gray-600 text-white px-4 py-2 rounded-xl">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchichtDienstAendernForm;
