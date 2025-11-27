// src/components/Dashboard/SchichtDienstAendernForm.jsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
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
    import.meta.env.VITE_SP_SKIP_RECALC === '1') || false;

/* -------------------------------- Helpers -------------------------------- */

// Rohdauer in Stunden aus Beginn/Ende
const berechneRohDauerInStunden = (start, ende) => {
  if (!start || !ende) return 0;
  const s = dayjs(`2024-01-01T${start}`);
  let e = dayjs(`2024-01-01T${ende}`);
  if (e.isBefore(s)) e = e.add(1, 'day');
  return dayjs.duration(e.diff(s)).asHours();
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

// Soll (Kürzel + ggf. Zeiten + Pause) aus DB_SollPlan über Schichtgruppe holen
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
    pause: data.pause_dauer ?? null, // 🆕 Stunden-Wert aus DB_SollPlan
  };
};
// 8,5 -> "8,5"   8,25 -> "8,25"
const formatStunden = (wert) => {
  if (wert == null || isNaN(wert)) return '0,0';
  const rounded = Math.round(wert * 100) / 100; // auf 2 Nachkommastellen runden
  const frac = Math.abs(rounded - Math.trunc(rounded));

  let str;
  if (Math.abs(frac - 0) < 0.001 || Math.abs(frac - 0.5) < 0.001) {
    str = rounded.toFixed(1); // 0 oder .5 => 1 Nachkommastelle
  } else {
    str = rounded.toFixed(2); // sonst 2 Nachkommastellen
  }
  return str.replace('.', ',');
};

// Ist-/Soll-Schicht des Vortags aus v_tagesplan holen (über Schichtart-ID)
const ladeIstSchichtVortag = async ({ userId, datum, firmaId, unitId }) => {
  const vortag = dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD');

  const { data, error } = await supabase
    .from('v_tagesplan')
    .select('ist_schichtart_id, soll_schichtart_id')
    .eq('user_id', userId)
    .eq('datum', vortag)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (error) {
    console.error('Fehler beim Laden der Vortag-Schicht aus v_tagesplan:', error);
    return null;
  }
  if (!data) return null;

  // Priorität: Ist-Schicht, sonst Soll-Schicht des Vortags
  return data.ist_schichtart_id || data.soll_schichtart_id || null;
};

// Pause aus v_tagesplan holen (Ist + Soll)
const ladePauseAusTagesplan = async ({ userId, datum, firmaId, unitId }) => {
  const { data, error } = await supabase
    .from('v_tagesplan')
    .select('ist_pausen_dauer, soll_pausen_dauer')
    .eq('user_id', userId)
    .eq('datum', datum)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (error) {
    console.error('Fehler beim Laden der Pause aus v_tagesplan:', error);
    return { istPause: null, sollPause: null };
  }

  if (!data) return { istPause: null, sollPause: null };

  return {
    istPause:
      typeof data.ist_pausen_dauer === 'number'
        ? data.ist_pausen_dauer
        : null,
    sollPause:
      typeof data.soll_pausen_dauer === 'number'
        ? data.soll_pausen_dauer
        : null,
  };
};

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
  const [auswahl, setAuswahl] = useState({
    kuerzel: '',
    start: '',
    ende: '',
    ignoriertarbeitszeit: false,
  });

  // 🔁 NEU: Pause in Stunden (0.5 = 30 Min)
  const [pause, setPause] = useState(0);

  const [sollKuerzel, setSollKuerzel] = useState('-');
  const [vortagKuerzel, setVortagKuerzel] = useState('-'); // Anzeige Schicht Vortag

  const [kommentar, setKommentar] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [mehrereTage, setMehrereTage] = useState(false);
  const [enddatum, setEnddatum] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const [verlaufDaten, setVerlaufDaten] = useState([]);
  const [loading, setLoading] = useState(false);

  // Laufzeituhr
  const [elapsedMs, setElapsedMs] = useState(0);
  const timerRef = useRef(null);
  const startRef = useRef(0);
  useEffect(() => {
    if (loading) {
      startRef.current = performance.now();
      timerRef.current = setInterval(
        () => setElapsedMs(performance.now() - startRef.current),
        100
      );
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(0);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [loading]);

  const fmtElapsed = (ms) => {
    const sek = ms / 1000;
    return sek.toFixed(1).replace('.', ',');
  };

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
    const rect = modalRef.current.getBoundingClientRect();
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
    const w = el.offsetWidth,
      h = el.offsetHeight,
      m = 8;
    let left = Math.min(window.innerWidth - w - m, Math.max(m, cx - dragOffset.x));
    let top = Math.min(window.innerHeight - h - m, Math.max(m, cy - dragOffset.y));
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

  // Schichtarten (inkl. Pause-Felder)
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
        console.error(error);
        return;
      }
      const sortiert = (data || []).sort((a, b) => {
        if (a.sollplan_relevant && !b.sollplan_relevant) return -1;
        if (!a.sollplan_relevant && b.sollplan_relevant) return 1;
        return a.kuerzel.localeCompare(b.kuerzel);
      });
      setSchichtarten(sortiert);
    };
    run();
  }, [offen, firma, unit]);

  // Lookup-Map für O(1)-Zugriff
  const schichtByKuerzel = useMemo(() => {
    const m = new Map();
    schichtarten.forEach((s) => m.set(s.kuerzel, s));
    return m;
  }, [schichtarten]);

  // Mini-Cache für Soll (reduziert Roundtrips beim Navigieren)
  const sollMiniCache = useRef(new Map()); // key: `${userId}|${datum}|${firma}|${unit}`
  const ladeSollAusSollPlanFuerUser_cached = async (p) => {
    const k = `${p.userId}|${p.datum}|${p.firmaId}|${p.unitId}`;
    if (sollMiniCache.current.has(k)) return sollMiniCache.current.get(k);
    const v = await ladeSollAusSollPlanFuerUser(p);
    sollMiniCache.current.set(k, v);
    return v;
  };

  // Eintrag übernehmen + Soll aus SollPlan + Pause + Vortag
  useEffect(() => {
    if (!eintrag || schichtarten.length === 0) return;

    const schicht = schichtByKuerzel.get(eintrag.ist_schicht);
    const ignoriert = schicht?.ignoriert_arbeitszeit || false;

    setMehrereTage(false);
    setEnddatum('');
    setAuswahl({
      kuerzel: eintrag.ist_schicht || '',
      start: eintrag.beginn || schicht?.startzeit || '06:00',
      ende: eintrag.ende || schicht?.endzeit || '14:00',
      ignoriertarbeitszeit: ignoriert,
    });

      (async () => {
      // 1) Soll-Schicht aus SollPlan (für Anzeige & ggf. Zeiten)
      const soll = await ladeSollAusSollPlanFuerUser_cached({
        userId: eintrag.user,
        datum: eintrag.datum,
        firmaId: firma,
        unitId: unit,
      });
      setSollKuerzel(soll.kuerzel || '-');

      // 2) Pause aus v_tagesplan holen
      const { istPause, sollPause } = await ladePauseAusTagesplan({
        userId: eintrag.user,
        datum: eintrag.datum,
        firmaId: firma,
        unitId: unit,
      });

      // 🔁 Initiale Pause bestimmen:
      // Reihenfolge:
      //  - wenn Schichtart ignoriert_arbeitszeit => 0
      //  - sonst: Ist-Pause aus v_tagesplan
      //  - sonst: pausen_dauer aus Eintrag (Kampfliste)
      //  - sonst: Soll-Pause aus v_tagesplan
      //  - sonst: Default aus SchichtArt (Minuten -> Stunden, wenn pause_aktiv)
      let initialPause = 0;

      if (ignoriert) {
        initialPause = 0;
      } else if (typeof istPause === 'number') {
        initialPause = istPause;
      } else if (typeof eintrag.pausen_dauer === 'number') {
        initialPause = Number(eintrag.pausen_dauer);
      } else if (typeof sollPause === 'number') {
        initialPause = sollPause;
      } else if (schicht?.pause_aktiv && schicht.pause_dauer != null) {
        initialPause = Number(schicht.pause_dauer) / 60;
      } else {
        initialPause = 0;
      }

      setPause(initialPause);

      // 3) Vortag aus v_tagesplan (ist / soll)
      const vtId = await ladeIstSchichtVortag({
        userId: eintrag.user,
        datum: eintrag.datum,
        firmaId: firma,
        unitId: unit,
      });

      if (vtId) {
        const vtSchicht = schichtarten.find((s) => s.id === vtId);
        setVortagKuerzel(vtSchicht?.kuerzel || '-');
      } else {
        setVortagKuerzel('-');
      }
    })();

    setKommentar(eintrag.kommentar || '');

  }, [eintrag, schichtarten, firma, unit, schichtByKuerzel]);

  // Pausen-Minimum nach ArbZG, aber nur wenn die Schichtart eine explizite Pause hat
  useEffect(() => {
    const schicht = schichtByKuerzel.get(auswahl.kuerzel);
    const pausenPflichtAktiv = !!schicht?.pause_aktiv;

    if (!auswahl.start || !auswahl.ende || auswahl.ignoriertarbeitszeit) {
      if (!pausenPflichtAktiv) setPause(0); // bei nicht-aktiven Pausen darf 0 sein
      return;
    }

    const roh = berechneRohDauerInStunden(auswahl.start, auswahl.ende);

    let minPause = 0;
    if (pausenPflichtAktiv) {
      if (roh >= 9) minPause = 0.75;   // > 9 h -> 45 min
      else if (roh >= 6) minPause = 0.5; // > 6 h -> 30 min
    }

    setPause((prevRaw) => {
      const prev = isNaN(prevRaw) ? 0 : prevRaw;
      return prev < minPause ? minPause : prev;
    });
  }, [
    auswahl.start,
    auswahl.ende,
    auswahl.ignoriertarbeitszeit,
    auswahl.kuerzel,
    schichtByKuerzel,
  ]);
  /* ------------------------------ UI helpers ------------------------------ */
  const handleSchichtwahl = (kuerzel, start, ende, ignoriertArbeitszeit) => {
    const s = schichtarten.find((x) => x.kuerzel === kuerzel);

    setAuswahl((prev) => ({
      ...prev,
      kuerzel,
      ignoriertarbeitszeit: ignoriertArbeitszeit,
      ...(ignoriertArbeitszeit
        ? {}
        : {
            start: start || prev.start,
            ende: ende || prev.ende,
          }),
    }));

    // Pause-Default aus SchichtArt
    let newPause = 0;
    if (s?.pause_aktiv && s.pause_dauer != null && !ignoriertArbeitszeit) {
      newPause = Number(s.pause_dauer) / 60;
    }
    setPause(newPause);
  };

  const { dauer, rohDauer, dauerFarbe, hinweistext } = useMemo(() => {
    const roh = berechneRohDauerInStunden(auswahl.start, auswahl.ende);

    const schicht = schichtByKuerzel.get(auswahl.kuerzel);
    const pausenPflichtAktiv = !!schicht?.pause_aktiv;

    let minPause = 0;
    if (!auswahl.ignoriertarbeitszeit && pausenPflichtAktiv) {
      if (roh >= 9) minPause = 0.75;
      else if (roh >= 6) minPause = 0.5;
    }

    const effektivePause = auswahl.ignoriertarbeitszeit
      ? 0
      : Math.max(pause || 0, minPause);

    const netto = Math.max(roh - effektivePause, 0);

    let f = 'bg-green-700',
      h = '';
    if (netto >= 12) {
      f = 'bg-red-700';
      h = 'Betriebsleitung und Betriebsrat sind zu informieren.';
    } else if (netto >= 10) {
      f = 'bg-orange-600';
      h = 'Max. 10 h nach §3 ArbZG, Ausnahme: §7';
    }
    return { dauer: netto, rohDauer: roh, dauerFarbe: f, hinweistext: h };
  }, [auswahl.start, auswahl.ende, auswahl.ignoriertarbeitszeit, pause, auswahl.kuerzel, schichtByKuerzel]);

  // Sperrlogik
  const diffTage = eintrag
    ? dayjs().startOf('day').diff(dayjs(eintrag.datum), 'day')
    : 0;
  const speichernGesperrt =
    (rolle === 'Team_Leader' && diffTage > 3) ||
    ((rolle === 'Planner' || rolle === 'Admin_Dev') && diffTage > 365);

  /* --------------------------------- Save --------------------------------- */

  const handleSpeichern = async (schliessenDanach = false) => {
    if (speichernGesperrt) return;
    setLoading(true);

    const f = firma;
    const u = unit;

    // Auth nur 1x
    const { data: authUser } = await supabase.auth.getUser();
    const createdBy = authUser?.user?.id;
    if (!createdBy) {
      console.error('❌ Kein eingeloggter Benutzer gefunden!');
      setLoading(false);
      return;
    }

    const selectedSchicht = schichtByKuerzel.get(auswahl.kuerzel); // enthält id, startzeit, endzeit, pause_aktiv, pause_dauer, ignoriert_arbeitszeit
    const now = new Date().toISOString();

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
      .select(`
        user, datum, firma_id, unit_id, ist_schicht, soll_schicht,
        startzeit_ist, endzeit_ist, dauer_ist, dauer_soll, kommentar,
        created_at, created_by, schichtgruppe,
        pausen_dauer,
        ist_rel:ist_schicht ( id, kuerzel, startzeit, endzeit )
      `)
      .eq('user', eintrag.user)
      .eq('firma_id', f)
      .eq('unit_id', u)
      .in('datum', dates);

    if (oldErr) console.error(oldErr);
    const oldByDate = new Map((oldRows ?? []).map((r) => [r.datum, r]));

    // Caches (verhindert doppelte Roundtrips beim Zeitraum)
    const sollCache = new Map(); // date -> {kuerzel,start,ende}

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

    for (const datumStr of dates) {
      const dObj = dayjs(datumStr);
      const oldRow = oldByDate.get(datumStr) ?? null;
      const oldIstKuerzel = oldRow?.ist_rel?.kuerzel ?? null;

      // Soll (Kürzel + ggf. Zeiten) via Schichtgruppe am Tag
      const sollPlan = await getSoll(datumStr);
      const sollK =
        sollPlan.kuerzel && sollPlan.kuerzel !== '-'
          ? sollPlan.kuerzel
          : oldRow?.soll_schicht ?? null;

      // Dauer_Soll (nur falls noch nicht vorhanden)
      let dauerSoll = oldRow?.dauer_soll ?? null;
      if (!dauerSoll && sollPlan.start && sollPlan.ende) {
        const s = dayjs(`2024-01-01T${sollPlan.start}`);
        let e = dayjs(`2024-01-01T${sollPlan.ende}`);
        if (e.isBefore(s)) e = e.add(1, 'day');
        dauerSoll = dayjs.duration(e.diff(s)).asHours();
      }

      // Start/Ende bestimmen – ignoriert_arbeitszeit beachten
      let aktuelleStart = auswahl.start;
      let aktuelleEnde = auswahl.ende;
      if (selectedSchicht?.ignoriert_arbeitszeit) {
        aktuelleStart =
          oldRow?.startzeit_ist ??
          oldRow?.startzeit ??
          sollPlan.start ??
          selectedSchicht?.startzeit ??
          aktuelleStart;
        aktuelleEnde =
          oldRow?.endzeit_ist ??
          oldRow?.endzeit ??
          sollPlan.ende ??
          selectedSchicht?.endzeit ??
          aktuelleEnde;
      }
      const schichtDef = selectedSchicht; // nur Alias

      // Dauer + Pause berechnen
      let aktuelleDauer = null;
      let aktuellePause = 0;

      if (schichtDef?.ignoriert_arbeitszeit) {
        aktuelleDauer = oldRow?.dauer_ist ?? dauerSoll ?? null;
        aktuellePause = 0;
      } else if (aktuelleStart && aktuelleEnde) {
        const roh = berechneRohDauerInStunden(aktuelleStart, aktuelleEnde);

        let minPause = 0;
        if (schichtDef?.pause_aktiv) {
          if (roh >= 9) minPause = 0.75;
          else if (roh >= 6) minPause = 0.5;
        }

        aktuellePause = Math.max(pause || 0, minPause);
        aktuelleDauer = Math.max(roh - aktuellePause, 0);
      }


      // Urlaub auf freien Tagen überspringen
      if ((sollK === null || sollK === '-') && auswahl.kuerzel === 'U') {
        continue;
      }

      // Dirty-Flags
      const alterDauerIst = oldRow?.dauer_ist ?? null;
      const jahr = dObj.year();
      const monat = dObj.month() + 1;
      if (!PERF_SKIP_RECALC && alterDauerIst !== aktuelleDauer) {
        recalcStundenSet.add(
          JSON.stringify({ user: eintrag.user, jahr, monat, firma: f, unit: u })
        );
      }
      if (
        !PERF_SKIP_RECALC &&
        (auswahl.kuerzel === 'U' || oldIstKuerzel === 'U')
      ) {
        recalcUrlaubSet.add(
          JSON.stringify({ user: eintrag.user, jahr, firma: f, unit: u })
        );
      }

      // ALTEN Eintrag in Verlauf archivieren (nur alter Zustand)
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
          change_on: now,
          created_by: oldRow.created_by, // ursprünglicher Ersteller
          change_by: createdBy, // aktueller Ändernder
          created_at: oldRow.created_at,
          schichtgruppe: oldRow.schichtgruppe,
        });
      }

      // Delete + Insert sammeln
      deleteDates.push(datumStr);
      const schichtId =
        schichtarten.find((s) => s.kuerzel === auswahl.kuerzel)?.id ?? null;

      insertBatch.push({
        user: eintrag.user,
        datum: datumStr,
        firma_id: f,
        unit_id: u,
        soll_schicht: sollK ?? null,
        ist_schicht: schichtId, // ID abspeichern
        startzeit_ist: aktuelleStart ?? null,
        endzeit_ist: aktuelleEnde ?? null,
        dauer_ist: aktuelleDauer ?? null,
        dauer_soll: dauerSoll ?? null,
        pausen_dauer: aktuellePause ?? 0,
        aenderung:
          ['U', 'K', 'KO'].includes(auswahl.kuerzel)
            ? false
            : !(
                schichtarten.find((s) => s.kuerzel === auswahl.kuerzel)
                  ?.startzeit === aktuelleStart &&
                schichtarten.find((s) => s.kuerzel === auswahl.kuerzel)
                  ?.endzeit === aktuelleEnde
              ),
        created_at: now,
        created_by: createdBy,
        schichtgruppe: eintrag.schichtgruppe,
        kommentar,
      });
    }

    // Batch-Writes
    if (verlaufBatch.length) {
      const vr = await supabase.from('DB_KampflisteVerlauf').insert(verlaufBatch);
      if (vr.error)
        console.error(
          '❌ Insert DB_KampflisteVerlauf fehlgeschlagen:',
          vr.error.message
        );
    }
    if (deleteDates.length) {
      const dr = await supabase
        .from('DB_Kampfliste')
        .delete()
        .eq('user', eintrag.user)
        .eq('firma_id', f)
        .eq('unit_id', u)
        .in('datum', deleteDates);
      if (dr.error)
        console.error(
          '❌ Delete DB_Kampfliste fehlgeschlagen:',
          dr.error.message
        );
    }
    if (insertBatch.length) {
      const ir = await supabase.from('DB_Kampfliste').insert(insertBatch);
      if (ir.error)
        console.error(
          '❌ Insert DB_Kampfliste fehlgeschlagen:',
          ir.error.message
        );
    }

    // Batch-Recalc (dedupliziert)
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
    onRefreshMitarbeiterBedarf?.();
    if (schliessenDanach) onClose();
    setLoading(false);
  };

  /* ----------------------------- Verlauf laden ---------------------------- */

  const ladeVerlauf = async () => {
    // 1) Aktuellen Zustand aus DB_Kampfliste holen
    const { data: cur, error: curErr } = await supabase
      .from('DB_Kampfliste')
      .select(`
      id,
      datum,
      ist_schicht,
      soll_schicht,
      startzeit_ist,
      endzeit_ist,
      kommentar,
      pausen_dauer,
      created_at,
      created_by,
      ist_schicht_rel:ist_schicht (kuerzel),
      user_rel:created_by (user_id, vorname, nachname)
    `)
      .eq('user', eintrag.user)
      .eq('datum', eintrag.datum)
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .maybeSingle();

    if (curErr) {
      console.error('Fehler aktueller Eintrag (DB_Kampfliste):', curErr);
    }

    // 2) Verlauf aus DB_KampflisteVerlauf holen (absteigend)
    const { data: hist, error: histErr } = await supabase
      .from('DB_KampflisteVerlauf')
      .select(`
      id,
      datum,
      ist_schicht,
      soll_schicht,
      startzeit_ist,
      endzeit_ist,
      kommentar,
      pausen_dauer,
      created_at,
      change_on,
      created_by,
      ist_schicht_rel:ist_schicht (kuerzel),
      user_rel:created_by (user_id, vorname, nachname)
    `)
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

    // 3) Aktuelle Zeile als „synthetischen“ Verlaufseintrag oben einsetzen
    const top = cur
      ? [
          {
            id: `current-${cur.id}`,
            datum: cur.datum,
            ist_schicht: cur.ist_schicht,
            soll_schicht: cur.soll_schicht,
            startzeit_ist: cur.startzeit_ist,
            endzeit_ist: cur.endzeit_ist,
            kommentar: cur.kommentar,
            pausen_dauer: cur.pausen_dauer ?? 0,
            created_at: cur.created_at,
            created_by: cur.created_by,
            ist_schicht_rel: cur.ist_schicht_rel,
            user_rel: cur.user_rel,
            _aktuell: true,
          },
        ]
      : [];

    setVerlaufDaten([...(top || []), ...(hist || [])]);
    setVerlaufOffen(true);
  };

  if (!offen || !eintrag) return null;

  const farbeAktuelleSchicht = schichtarten.find(
    (s) => s.kuerzel === auswahl.kuerzel
  );
  const ladeNeuenTag = (richtung) => {
    const neuesDatum = dayjs(eintrag.datum)[richtung](1, 'day').format(
      'YYYY-MM-DD'
    );
    aktualisieren(neuesDatum, eintrag.user);
  };

    // Gesetzliche Mindestpause für die Anzeige im Dropdown
  const aktuelleSchicht = schichtByKuerzel.get(auswahl.kuerzel);
  const pausenPflichtAktiv = !!aktuelleSchicht?.pause_aktiv;

  let minPauseByLaw = 0;
  if (!auswahl.ignoriertarbeitszeit && pausenPflichtAktiv) {
    if (rohDauer >= 9) {
      minPauseByLaw = 0.75; // 45 min
    } else if (rohDauer >= 6) {
      minPauseByLaw = 0.5; // 30 min
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50">
      <div
        ref={modalRef}
        className={`absolute bg-white text-gray-800 dark:bg-gray-900 dark:text-white border border-gray-500 p-6 rounded-xl w-[700px] shadow-lg ${
          dragging ? 'select-none cursor-grabbing' : ''
        } ${dock ? 'h-screen rounded-xl-none' : ''}`}
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
            <h2 className="text-xl font-bold">
              Dienst ändern – {eintrag.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDock((d) => (d === 'left' ? null : 'left'))}
              title={dock === 'left' ? 'Andocken lösen' : 'Links andocken'}
              className={`p-1 rounded-xl ${
                dock === 'left'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDock((d) => (d === 'right' ? null : 'right'))}
              title={dock === 'right' ? 'Andocken lösen' : 'Rechts andocken'}
              className={`p-1 rounded-xl ${
                dock === 'right'
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
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
          <div className="mb-2 text-green-600 text-left text-xs font-medium">
            ✅ {saveMessage}
          </div>
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
        <h2 className="text-lg font-bold">
          {dayjs(eintrag.datum).format('DD.MM.YYYY')}
        </h2>
        <button
          onClick={() => ladeNeuenTag('add')}
          className="text-xl hover:text-blue-500"
          title="Einen Tag vor"
        >
          →
        </button>
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
    </div>

    {/* Rechts: Soll-Schicht + Vortag */}
    <div className="flex items-center gap-8">
      <div className="text-sm text-center text-gray-400">
        <div>Soll-Schicht:</div>
        <div className="text-sm font-semibold">{sollKuerzel}</div>
      </div>
      <div className="text-sm text-center text-gray-400">
        <div>Vortag:</div>
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          {vortagKuerzel}
        </div>
      </div>
    </div>
  </div>

  {/* Multi-Tage + Enddatum unter der linken Seite */}
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
    <label className="flex items-center gap-1 text-md">
      <input
        type="checkbox"
        checked={mehrereTage}
        onChange={() => {
          const aktiv = !mehrereTage;
          setMehrereTage(aktiv);
          if (aktiv && eintrag?.datum) {
            setEnddatum(
              dayjs(eintrag.datum).add(1, 'day').format('YYYY-MM-DD')
            );
          }
        }}
      />
      Über mehrere Tage
    </label>
  </div>
</div>

        {/* Zeiten + Pause + Dauer */}
        {!auswahl.ignoriertarbeitszeit && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-2 items-end">
              <div>
                <label className="block mb-1">Beginn</label>
                <input
                  type="time"
                  value={auswahl.start}
                  onChange={(e) =>
                    setAuswahl({ ...auswahl, start: e.target.value })
                  }
                  className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
                />
              </div>
              <div>
                <label className="block mb-1">Ende</label>
                <input
                  type="time"
                  value={auswahl.ende}
                  onChange={(e) =>
                    setAuswahl({ ...auswahl, ende: e.target.value })
                  }
                  className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
                />
              </div>
              <div>
  <label className="block mb-1">
    Pause
    <span
      className="ml-1 p-2 text-lg ptext-gray-500 dark:text-red-400 cursor-help"
      title="Rechtliche Faustregel in Deutschland: Ab 6 Stunden Arbeitszeit sind mindestens 30 Minuten Pause erforderlich, ab 9 Stunden mindestens 45 Minuten. Diese Mindestpausen werden nur für Schichtarten berücksichtigt bei denen Rechtlich keine Pause zwingend ist."
    >
      ⓘ
    </span>
  </label>
  <select
    value={pause}
    onChange={(e) => setPause(Number(e.target.value))}
    className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
  >
    {/* Werte in Stunden – gefiltert nach gesetzlicher Mindestpause */}
    {/* 0 min & 15 min nur erlaubt, wenn es keine gesetzliche Mindestpause gibt */}
    {(!pausenPflichtAktiv || minPauseByLaw <= 0) && (
      <option value={0}>0 min</option>
    )}
    {(!pausenPflichtAktiv || minPauseByLaw <= 0.25) && (
      <option value={0.25}>15 min</option>
    )}

    {/* Ab hier sind wir im gesetzlichen Bereich */}
    {minPauseByLaw <= 0.5 && <option value={0.5}>30 min</option>}
    {minPauseByLaw <= 0.75 && <option value={0.75}>45 min</option>}
    {minPauseByLaw <= 1 && <option value={1}>60 min</option>}
  </select>
</div>

              <div>
  <label className="block mb-1">Dauer (netto)</label>
  <div className={`p-2 rounded-xl text-md text-center text-white ${dauerFarbe}`}>
    {formatStunden(dauer)} h
      <div className="text-[10px] mt-1 text-gray-500 dark:text-gray-400">
    Rohdauer: {formatStunden(rohDauer)} h
  </div>
  </div>
</div>
            </div>
          </>
        )}

        {auswahl.ignoriertarbeitszeit && (
          <div className="mb-2 text-sm text-yellow-400">
            Diese Schichtart überschreibt die Arbeitszeit (z. B. Urlaub /
            Krank) – Zeiten &amp; Pause sind hier deaktiviert.
          </div>
        )}

        <div className="text-right text-sm text-yellow-500 mb-3 min-h-[1.5rem]">
          {hinweistext}
        </div>

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
                onClick={() =>
                  handleSchichtwahl(
                    s.kuerzel,
                    s.startzeit,
                    s.endzeit,
                    s.ignoriert_arbeitszeit
                  )
                }
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
              {eintrag.created_at
                ? dayjs(eintrag.created_at).format('DD.MM.YYYY HH:mm')
                : 'Unbekannt'}
            </p>
            <button
              onClick={ladeVerlauf}
              className="text-xs underline text-blue-400 hover:text-blue-200 mt-1"
            >
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
              {loading && (
                <div className="w-5 h-5 border-2 border-t-transparent border-blue-400 rounded-xl-full animate-spin"></div>
              )}
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
                  loading || speichernGesperrt
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                Speichern
              </button>
              <button
                onClick={() => handleSpeichern(true)}
                disabled={loading || speichernGesperrt}
                className={`bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl transition ${
                  loading || speichernGesperrt
                    ? 'opacity-50 cursor-not-allowed'
                    : ''
                }`}
              >
                Speichern & Schließen
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
                <b>U/K/KO</b> mit <i>ignoriert_arbeitszeit</i> übernehmen alte
                Zeiten.
              </li>
              <li>Dauer-Berechnung inkl. Nacht-Übergang &amp; Pause.</li>
              <li>Mehrere Tage eintragen möglich.</li>
              <li>Alter Eintrag wird in den Verlauf archiviert.</li>
              <li>Soll kommt aus DB_SollPlan (über die Schichtgruppe).</li>
              <li>Mit ← / → Tage wechseln.</li>
              <li>
                Pause &lt; 30 Min ist nur bei Arbeitszeit &lt; 6 h möglich
                (gesetzliche Ruhepausen).
              </li>
            </ul>
            <div className="text-sm space-y-2">
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                Bedienung
              </div>
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
            <button
              onClick={() => setInfoOffen(false)}
              className="absolute top-2 right-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Verlauf-Modal */}
      {verlaufOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl p-6 w-[800px] max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-3">
              Letzte Änderungen für {eintrag.name}
            </h3>
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
                        <span className="ml-2 text-[10px] px-2 rounded-full bg-blue-600 text-white align-middle">
                          neu
                        </span>
                      )}
                    </td>
                    <td>{v.startzeit_ist}</td>
                    <td>{v.endzeit_ist}</td>
                    <td>{formatStunden(v.pausen_dauer ?? 0)}</td>
                    <td>{v.kommentar || '-'}</td>
                    <td>
                      {dayjs(v.created_at).format('DD.MM.YYYY HH:mm')}
                    </td>
                    <td>
                      {v.user_rel
                        ? `${v.user_rel.vorname || ''} ${
                            v.user_rel.nachname || ''
                          }`.trim()
                        : v.created_by || 'Unbekannt'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-4">
              <button
                onClick={() => setVerlaufOffen(false)}
                className="bg-gray-600 text-white px-4 py-2 rounded-xl"
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

export default SchichtDienstAendernForm;
