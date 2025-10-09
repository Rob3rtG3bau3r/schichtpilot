// src/components/Dashboard/SchichtDienstAendernForm.jsx
import React, { useEffect, useState, useRef } from 'react';
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

// Soll (Kürzel + ggf. Zeiten) aus DB_SollPlan über Schichtgruppe holen
const ladeSollAusSollPlanFuerUser = async ({ userId, datum, firmaId, unitId }) => {
  const gruppe = await ermittleSchichtgruppe({ userId, datum, firmaId, unitId });
  if (!gruppe) return { kuerzel: '-', start: null, ende: null };

  const { data, error } = await supabase
    .from('DB_SollPlan')
    .select('kuerzel,startzeit,endzeit')
    .eq('schichtgruppe', gruppe)
    .eq('datum', datum)
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .maybeSingle();

  if (error || !data) return { kuerzel: '-', start: null, ende: null };
  return {
    kuerzel: data.kuerzel || '-',
    start: data.startzeit || null,
    ende: data.endzeit || null,
  };
};

/* -------------------------- Component main body --------------------------- */

const SchichtDienstAendernForm = ({
  offen,
  onClose,
  eintrag, // { user, datum, name, ist_schicht (Kürzel), beginn, ende, ... }
  aktualisieren, // (neuesDatum, userId)
  reloadListe,
  onRefresh,
  onRefreshMitarbeiterBedarf,
}) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();

  const [schichtarten, setSchichtarten] = useState([]);
  const [auswahl, setAuswahl] = useState({ kuerzel: '', start: '', ende: '', ignoriertarbeitszeit: false });
  const [sollKuerzel, setSollKuerzel] = useState('-');
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
      timerRef.current = setInterval(() => setElapsedMs(performance.now() - startRef.current), 50);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedMs(0);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [loading]);
  const fmtElapsed = (ms) => `${Math.floor(ms / 1000)}:${String(Math.floor(ms % 1000)).padStart(3, '0')}`;

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
    const w = el.offsetWidth, h = el.offsetHeight, m = 8;
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

  // Schichtarten
  useEffect(() => {
    const run = async () => {
      if (!offen || !firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('*')
        .eq('firma_id', firma)
        .eq('unit_id', unit);
      if (error) { console.error(error); return; }
      const sortiert = (data || []).sort((a, b) => {
        if (a.sollplan_relevant && !b.sollplan_relevant) return -1;
        if (!a.sollplan_relevant && b.sollplan_relevant) return 1;
        return a.kuerzel.localeCompare(b.kuerzel);
      });
      setSchichtarten(sortiert);
    };
    run();
  }, [offen, firma, unit]);

  // Eintrag übernehmen + Soll aus SollPlan
  useEffect(() => {
    if (!eintrag || schichtarten.length === 0) return;

    const schicht = schichtarten.find((s) => s.kuerzel === eintrag.ist_schicht);
    const ignoriert = schicht?.ignoriert_arbeitszeit || false;

    setMehrereTage(false);
    setEnddatum('');
    setAuswahl({
      kuerzel: eintrag.ist_schicht || '',
      start: eintrag.beginn || '06:00',
      ende: eintrag.ende || '14:00',
      ignoriertarbeitszeit: ignoriert,
    });

    (async () => {
      const soll = await ladeSollAusSollPlanFuerUser({
        userId: eintrag.user,
        datum: eintrag.datum,
        firmaId: firma,
        unitId: unit,
      });
      setSollKuerzel(soll.kuerzel || '-');
    })();

    setKommentar(eintrag.kommentar || '');
  }, [eintrag, schichtarten, firma, unit]);

  /* ------------------------------ UI helpers ------------------------------ */

  const handleSchichtwahl = (kuerzel, start, ende, ignoriertArbeitszeit) => {
    setAuswahl((prev) => ({
      ...prev,
      kuerzel,
      ignoriertarbeitszeit: ignoriertArbeitszeit,
      ...(ignoriertArbeitszeit ? {} : { start, ende }),
    }));
  };

  const berechneDauer = () => {
    const s = dayjs(`2024-01-01T${auswahl.start}`);
    const e0 = dayjs(`2024-01-01T${auswahl.ende}`);
    const e = e0.isBefore(s) ? e0.add(1, 'day') : e0;
    return dayjs.duration(e.diff(s)).asHours();
  };

  const dauer = berechneDauer();
  let dauerFarbe = 'bg-green-700', hinweistext = '';
  if (dauer >= 12) { dauerFarbe = 'bg-red-700'; hinweistext = 'Betriebsleitung und Betriebsrat sind zu informieren.'; }
  else if (dauer >= 10) { dauerFarbe = 'bg-orange-600'; hinweistext = 'Max. 10 h nach §3 ArbZG, Ausnahme: §7'; }

  // Sperrlogik
  const diffTage = eintrag ? dayjs().startOf('day').diff(dayjs(eintrag.datum), 'day') : 0;
  const speichernGesperrt =
    (rolle === 'Team_Leader' && diffTage > 3) ||
    ((rolle === 'Planner' || rolle === 'Admin_Dev') && diffTage > 365);

  /* --------------------------------- Save --------------------------------- */

  const handleSpeichern = async (schliessenDanach = false) => {
    if (speichernGesperrt) return;
    setLoading(true);

    const aktuelleFirma = firma;
    const aktuelleUnit = unit;

    const selectedSchicht = schichtarten.find((s) => s.kuerzel === auswahl.kuerzel); // enthält id, startzeit, endzeit, ignoriert_arbeitszeit
    const now = new Date().toISOString();
    const { data: authUser } = await supabase.auth.getUser();
    const createdBy = authUser?.user?.id;
    if (!createdBy) {
      console.error('❌ Kein eingeloggter Benutzer gefunden!');
      setLoading(false);
      return;
    }

    const startDatum = dayjs(eintrag.datum);
    const endDatum = mehrereTage && enddatum ? dayjs(enddatum) : startDatum;

    const dirtyStunden = new Set(); // JSON.stringify({user,jahr,monat,firma,unit})
    const dirtyUrlaub = new Set();  // JSON.stringify({user,jahr,firma,unit})

    for (let datum = startDatum; datum.isSameOrBefore(endDatum); datum = datum.add(1, 'day')) {
      const datumStr = datum.format('YYYY-MM-DD');

      // 1) Vorherigen Eintrag holen (inkl Join, damit wir altes Kürzel kennen)
      const { data: oldRow } = await supabase
        .from('DB_Kampfliste')
        .select(`
          *,
          ist_rel:ist_schicht ( id, kuerzel, startzeit, endzeit )
        `)
        .eq('user', eintrag.user)
        .eq('datum', datumStr)
        .eq('firma_id', aktuelleFirma)
        .eq('unit_id', aktuelleUnit)
        .maybeSingle();

      const oldIstKuerzel = oldRow?.ist_rel?.kuerzel || null;

      // 2) Soll (Kürzel + ggf. Zeiten) via Schichtgruppe am Tag
      const sollPlan = await ladeSollAusSollPlanFuerUser({
        userId: eintrag.user,
        datum: datumStr,
        firmaId: aktuelleFirma,
        unitId: aktuelleUnit
      });
      const sollK = (sollPlan.kuerzel && sollPlan.kuerzel !== '-') ? sollPlan.kuerzel : (oldRow?.soll_schicht ?? null);

      // 3) Dauer_Soll (best effort aus SollPlan-Zeiten)
      let dauerSoll = oldRow?.dauer_soll ?? null;
      if (!dauerSoll && sollPlan.start && sollPlan.ende) {
        const s = dayjs(`2024-01-01T${sollPlan.start}`);
        let e = dayjs(`2024-01-01T${sollPlan.ende}`); if (e.isBefore(s)) e = e.add(1, 'day');
        dauerSoll = dayjs.duration(e.diff(s)).asHours();
      }

      // 4) Start/Ende bestimmen – ignoriert_arbeitszeit beachten
      let aktuelleStart = auswahl.start;
      let aktuelleEnde  = auswahl.ende;
      if (selectedSchicht?.ignoriert_arbeitszeit) {
        aktuelleStart = oldRow?.startzeit_ist
          ?? oldRow?.startzeit
          ?? sollPlan.start
          ?? selectedSchicht?.startzeit
          ?? aktuelleStart;
        aktuelleEnde = oldRow?.endzeit_ist
          ?? oldRow?.endzeit
          ?? sollPlan.ende
          ?? selectedSchicht?.endzeit
          ?? aktuelleEnde;
      }

      // 5) Dauer berechnen/übernehmen
      let aktuelleDauer = null;
      if (aktuelleStart && aktuelleEnde) {
        const s = dayjs(`2024-01-01T${aktuelleStart}`);
        let e = dayjs(`2024-01-01T${aktuelleEnde}`); if (e.isBefore(s)) e = e.add(1, 'day');
        aktuelleDauer = dayjs.duration(e.diff(s)).asHours();
      } else if (selectedSchicht?.ignoriert_arbeitszeit) {
        aktuelleDauer = oldRow?.dauer_ist ?? (dauerSoll ?? null);
      }

      // 6) Urlaub auf freien Tagen überspringen
      if ((sollK === null || sollK === '-') && auswahl.kuerzel === 'U') continue;

      // 7) Dirty-Flags
      const alterDauerIst = oldRow?.dauer_ist ?? null;
      const jahr = datum.year();
      const monat = datum.month() + 1;
      if (!PERF_SKIP_RECALC && alterDauerIst !== aktuelleDauer) {
        dirtyStunden.add(JSON.stringify({ user: eintrag.user, jahr, monat, firma: aktuelleFirma, unit: aktuelleUnit }));
      }
      if (!PERF_SKIP_RECALC && (auswahl.kuerzel === 'U' || oldIstKuerzel === 'U')) {
        dirtyUrlaub.add(JSON.stringify({ user: eintrag.user, jahr, firma: aktuelleFirma, unit: aktuelleUnit }));
      }

      // 8) ALTEN Eintrag in Verlauf archivieren (nur der alte Zustand)
      if (oldRow) {
        await supabase.from('DB_KampflisteVerlauf').insert({
          user: oldRow.user,
          datum: oldRow.datum,
          firma_id: oldRow.firma_id,
          unit_id: oldRow.unit_id,
          ist_schicht: oldRow.ist_schicht,   // BIGINT (FK auf DB_SchichtArt.id)
          soll_schicht: oldRow.soll_schicht, // TEXT (Kürzel)
          startzeit_ist: oldRow.startzeit_ist,
          endzeit_ist: oldRow.endzeit_ist,
          dauer_ist: oldRow.dauer_ist,
          dauer_soll: oldRow.dauer_soll,
          kommentar: oldRow.kommentar,
          change_on: now,
          created_by: createdBy,
          created_at: oldRow.created_at,
          schichtgruppe: oldRow.schichtgruppe,
        });
      }

      // 9) Replace (delete → insert) – KEIN upsert nötig
      await supabase
        .from('DB_Kampfliste')
        .delete()
        .eq('user', eintrag.user)
        .eq('datum', datumStr)
        .eq('firma_id', aktuelleFirma)
        .eq('unit_id', aktuelleUnit);

      const insertRes = await supabase.from('DB_Kampfliste').insert({
        user: eintrag.user,
        datum: datumStr,
        firma_id: aktuelleFirma,
        unit_id: aktuelleUnit,
        soll_schicht: sollK ?? null,                   // TEXT (Kürzel)
        ist_schicht: selectedSchicht?.id ?? null,      // *** BIGINT (ID!) ***
        startzeit_ist: aktuelleStart ?? null,
        endzeit_ist: aktuelleEnde ?? null,
        dauer_ist: aktuelleDauer ?? null,
        dauer_soll: dauerSoll ?? null,
        aenderung:
          ['U', 'K', 'KO'].includes(auswahl.kuerzel)
            ? false
            : !(selectedSchicht?.startzeit === aktuelleStart && selectedSchicht?.endzeit === aktuelleEnde),
        created_at: now,
        created_by: createdBy,
        schichtgruppe: eintrag.schichtgruppe,
        kommentar,
      });

      if (insertRes.error) {
        console.error('❌ Insert DB_Kampfliste fehlgeschlagen:', insertRes.error.message);
      }
    }

    // 10) Batch-Recalc
    if (!PERF_SKIP_RECALC) {
      for (const k of dirtyStunden) {
        const { user, jahr, monat, firma: f, unit: u } = JSON.parse(k);
        await berechneUndSpeichereStunden(user, jahr, monat, f, u);
      }
      for (const k of dirtyUrlaub) {
        const { user, jahr, firma: f, unit: u } = JSON.parse(k);
        await berechneUndSpeichereUrlaub(user, jahr, f, u);
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
    const { data, error } = await supabase
      .from('DB_KampflisteVerlauf')
      .select(`
        id,
        datum,
        ist_schicht,
        soll_schicht,
        startzeit_ist,
        endzeit_ist,
        kommentar,
        change_on,
        created_by,
        ist_schicht_rel:ist_schicht (kuerzel),
        user_rel:created_by (user_id, vorname, nachname)
      `)
      .eq('user', eintrag.user)
      .eq('datum', eintrag.datum)
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .order('change_on', { ascending: false })
      .limit(10);

    if (error) { console.error('Fehler beim Laden des Verlaufs:', error); return; }
    setVerlaufDaten(data || []);
    setVerlaufOffen(true);
  };

  if (!offen || !eintrag) return null;

  const farbeAktuelleSchicht = schichtarten.find((s) => s.kuerzel === auswahl.kuerzel);
  const ladeNeuenTag = (richtung) => {
    const neuesDatum = dayjs(eintrag.datum)[richtung](1, 'day').format('YYYY-MM-DD');
    aktualisieren(neuesDatum, eintrag.user);
  };

  /* --------------------------------- Render -------------------------------- */

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
            <button onMouseDown={startDrag} onTouchStart={startDrag} title="Verschieben" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-move">
              <GripVertical className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">Dienst ändern – {eintrag.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDock((d) => (d === 'left' ? null : 'left'))}
              title={dock === 'left' ? 'Andocken lösen' : 'Links andocken'}
              className={`p-1 rounded ${dock === 'left' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDock((d) => (d === 'right' ? null : 'right'))}
              title={dock === 'right' ? 'Andocken lösen' : 'Rechts andocken'}
              className={`p-1 rounded ${dock === 'right' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <PanelRightOpen className="w-5 h-5" />
            </button>
            <button onClick={() => setInfoOffen(true)} className="p-1 rounded text-blue-500 hover:text-blue-700" title="Infos zum Modul">
              <Info size={20} />
            </button>
          </div>
        </div>

        {/* Save-Meldung */}
        {saveMessage && <div className="mb-2 text-green-600 text-left text-xs font-medium">✅ {saveMessage}</div>}

        {/* Datum / Navigation / Multi-Tage */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="flex items-center gap-2">
              <button onClick={() => ladeNeuenTag('subtract')} className="text-xl hover:text-blue-500" title="Einen Tag zurück">←</button>
              <h2 className="text-lg font-bold">{dayjs(eintrag.datum).format('DD.MM.YYYY')}</h2>
              <button onClick={() => ladeNeuenTag('add')} className="text-xl hover:text-blue-500" title="Einen Tag vor">→</button>
            </div>
            {mehrereTage && (
              <input
                type="date"
                value={enddatum}
                onChange={(e) => setEnddatum(e.target.value)}
                min={eintrag.datum}
                className="ml-4 p-1 rounded bg-gray-100 dark:bg-gray-700 text-center text-sm"
              />
            )}
            <label className="flex items-center gap-1 text-md">
              <input
                type="checkbox"
                checked={mehrereTage}
                onChange={() => {
                  const aktiv = !mehrereTage;
                  setMehrereTage(aktiv);
                  if (aktiv && eintrag?.datum) setEnddatum(dayjs(eintrag.datum).add(1, 'day').format('YYYY-MM-DD'));
                }}
              />
              Über mehrere Tage
            </label>
          </div>
          <div className="flex gap-80 items-center">
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
            <div className="text-sm text-center text-gray-400">
              <div>Soll-Schicht:</div>
              <div className="text-sm font-semibold">{sollKuerzel}</div>
            </div>
          </div>
        </div>

        {/* Zeiten + Dauer */}
        <div className="grid grid-cols-3 gap-4 mb-2 items-end">
          <div>
            <label className="block mb-1">Beginn</label>
            <input
              type="time"
              value={auswahl.start}
              onChange={(e) => setAuswahl({ ...auswahl, start: e.target.value })}
              disabled={auswahl.ignoriertarbeitszeit}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            />
          </div>
          <div>
            <label className="block mb-1">Ende</label>
            <input
              type="time"
              value={auswahl.ende}
              onChange={(e) => setAuswahl({ ...auswahl, ende: e.target.value })}
              disabled={auswahl.ignoriertarbeitszeit}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            />
          </div>
          <div>
            <label className="block mb-1">Dauer</label>
            <div className={`p-2 rounded text-center text-white ${dauerFarbe}`}>{dauer.toFixed(1)} h</div>
          </div>
        </div>
        <div className="text-right text-sm text-yellow-500 mb-3 min-h-[1.5rem]">{hinweistext}</div>

        {/* Schichtarten */}
        <div className="mb-3">
          <label className="block mb-2 text-sm">Schichtart wählen</label>
          <div className="grid grid-cols-4 gap-2">
            {schichtarten.map((s) => (
              <div
                key={s.id}
                className={`rounded p-2 cursor-pointer border text-sm flex justify-between items-center text-center ${
                  auswahl.kuerzel === s.kuerzel ? 'ring-2 ring-white' : ''
                }`}
                style={{ backgroundColor: s.farbe_bg, color: s.farbe_text }}
                onClick={() => handleSchichtwahl(s.kuerzel, s.startzeit, s.endzeit, s.ignoriert_arbeitszeit)}
                title={s.beschreibung}
              >
                <span className="font-semibold mr-1">{s.kuerzel}</span>
                <span className="text-xs">{s.startzeit} - {s.endzeit}</span>
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
            className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 dark:text-white ring-1 ring-gray-300"
            placeholder="Kommentar max. 150 Zeichen"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-between items-start mt-6 gap-3 text-sm text-gray-500 dark:text-gray-400">
          <div>
            <p><strong>Erstellt am:</strong> {eintrag.created_at ? dayjs(eintrag.created_at).format('DD.MM.YYYY HH:mm') : 'Unbekannt'}</p>
            <button onClick={ladeVerlauf} className="text-xs underline text-blue-400 hover:text-blue-200 mt-1">Änderungsverlauf anzeigen</button>
          </div>
          <div className="flex flex-col items-end gap-1 mt-1">
            {loading && <div className="text-xs text-gray-500 dark:text-gray-300">⏱ Laufzeit: {fmtElapsed(elapsedMs)} s</div>}
            <div className="flex gap-3 items-center">
              {loading && <div className="w-5 h-5 border-2 border-t-transparent border-blue-400 rounded-full animate-spin"></div>}
              <button onClick={onClose} className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded transition" disabled={loading}>Schließen</button>
              <button
                onClick={() => handleSpeichern(false)}
                disabled={loading || speichernGesperrt}
                className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition ${loading || speichernGesperrt ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Speichern
              </button>
              <button
                onClick={() => handleSpeichern(true)}
                disabled={loading || speichernGesperrt}
                className={`bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded transition ${loading || speichernGesperrt ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              <li><b>U/K/KO</b> mit <i>ignoriert_arbeitszeit</i> übernehmen alte Zeiten.</li>
              <li>Dauer-Berechnung inkl. Nacht-Übergang.</li>
              <li>Mehrere Tage eintragen möglich.</li>
              <li>Alter Eintrag wird in den Verlauf archiviert.</li>
              <li>Soll kommt aus DB_SollPlan (über die Schichtgruppe).</li>
              <li>Mit ← / → Tage wechseln.</li>
            </ul>
            <div className="text-sm space-y-2">
              <div className="font-semibold text-gray-700 dark:text-gray-300">Bedienung</div>
              <ul className="space-y-2">
                <li className="flex items-start gap-2"><GripVertical className="w-4 h-4 mt-0.5 text-gray-500" /><span><b>Verschieben:</b> Griff gedrückt halten.</span></li>
                <li className="flex items-start gap-2"><PanelLeftOpen className="w-4 h-4 mt-0.5 text-gray-500" /><span><b>Links andocken</b></span></li>
                <li className="flex items-start gap-2"><PanelRightOpen className="w-4 h-4 mt-0.5 text-gray-500" /><span><b>Rechts andocken</b></span></li>
              </ul>
            </div>
            <button onClick={() => setInfoOffen(false)} className="absolute top-2 right-3 text-gray-400 hover:text-white">✕</button>
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
                  <th>Kommentar</th>
                  <th>Geändert am</th>
                  <th>Erstellt von</th>
                </tr>
              </thead>
              <tbody>
                {verlaufDaten.map((v) => (
                  <tr key={v.id}>
                    <td className="p-2">{v.ist_schicht_rel?.kuerzel || '-'}</td>
                    <td>{v.startzeit_ist}</td>
                    <td>{v.endzeit_ist}</td>
                    <td>{v.kommentar || '-'}</td>
                    <td>{dayjs(v.change_on).format('DD.MM.YYYY HH:mm')}</td>
                    <td>{v.user_rel ? `${v.user_rel.vorname || ''} ${v.user_rel.nachname || ''}`.trim() : v.created_by || 'Unbekannt'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right mt-4">
              <button onClick={() => setVerlaufOffen(false)} className="bg-gray-600 text-white px-4 py-2 rounded">Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchichtDienstAendernForm;
