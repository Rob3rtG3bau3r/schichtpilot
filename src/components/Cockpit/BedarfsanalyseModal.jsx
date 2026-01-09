// src/components/Dashboard/BedarfsAnalyseModal.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import duration from 'dayjs/plugin/duration';
dayjs.extend(duration);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

import { useRollen } from '../../context/RollenContext';
import { berechneUndSpeichereStunden } from '../../utils/berechnungen';

import { BAM_UI, BAM_InfoModal } from './BAM_UI';
import BAM_MitarbeiterimDienst from './BAM_MitarbeiterimDienst';
import BAM_SchichtTausch from './BAM_SchichtTausch';
import BAM_VerfuegbareMitarbeiter from './BAM_VerfuegbareMitarbeiter';

const BedarfsAnalyseModal = ({ offen, onClose, modalDatum, modalSchicht, fehlendeQualis = [], onSaved }) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();

  const [mitarbeiter, setMitarbeiter] = useState([]);           // im Dienst (Ziel-Schicht)
  const [freieMitarbeiter, setFreieMitarbeiter] = useState([]); // Kandidatenliste T-3..T+3
  const [userNameById, setUserNameById] = useState({});
  const [kollidiertAktiv, setKollidiertAktiv] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  const [notizByUser, setNotizByUser] = useState(new Map()); // uid -> row
  const [selected, setSelected] = useState(null);             // { uid, name, tel1, tel2 }
  const [notizText, setNotizText] = useState('');

  const [tauschQuelle, setTauschQuelle] = useState(''); // 'F'|'S'|'N'
  const [shiftUserIds, setShiftUserIds] = useState({ F: [], S: [], N: [] }); // sichtbare im Tag pro Schicht
  const [tauschChecks, setTauschChecks] = useState(new Map()); // uid -> { ok, text }
  const [deckungBasis, setDeckungBasis] = useState(null); // Snapshot fürs prüfen

  const [tauschAutoLoading, setTauschAutoLoading] = useState(false);
  const [tauschShowAll, setTauschShowAll] = useState(false);
  const [tauschOkIds, setTauschOkIds] = useState([]);

  // Bedarf / Überbesetzung
  const [deckungByShift, setDeckungByShift] = useState(null); // {F,S,N}
  const [overByShift, setOverByShift] = useState({ F: false, S: false, N: false });

  // Schichttausch
  const [tauschAktiv, setTauschAktiv] = useState(false);

  // ✅ NEU: Fensteranzeige ±3 für ALLE sichtbaren User (für Tauschliste + Kandidaten)
  const [dienstFensterByUserId, setDienstFensterByUserId] = useState({}); // { [uid]: {vor3..nach3 + helperKeys} }

  const [flags, setFlags] = useState({
    macht_schicht: false,
    kann_heute_nicht: false,
    kann_keine_frueh: false,
    kann_keine_spaet: false,
    kann_keine_nacht: false,
    kann_nur_frueh: false,
    kann_nur_spaet: false,
    kann_nur_nacht: false,
  });

  const [saving, setSaving] = useState(false);

  const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
  const SCH_INDEX = { 'Früh': 0, 'Spät': 1, 'Nacht': 2 };

  const sch = String(modalSchicht || '').toUpperCase(); // 'F' | 'S' | 'N'

  const maskForEmployee = (kuerzel) => {
    if (rolle === 'Employee' && (kuerzel === 'K' || kuerzel === 'KO')) return '-';
    return kuerzel || '-';
  };

  // ===== Bedarf-Logik (an MitarbeiterBedarf angelehnt) =====
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

    if (b.normalbetrieb && b.betriebsmodus === 'wochenbetrieb') {
      const weekday = dayjs(datumISO).day(); // 0=So..6=Sa
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
            // Mo–Do alle
          } else if (weekday === 5) {
            if (schLabel === 'Nacht') return false;
          } else {
            return false; // Sa kein Bedarf
          }
          break;
        default:
          break;
      }
    }

    if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

    if (b.schichtart == null) return true;
    return b.schichtart === schLabel;
  };

  const flagsSummary = (n) => {
    if (!n) return '';
    const arr = [];
    if (n.kann_heute_nicht) arr.push('🚫 kann heute nicht');
    if (n.kann_keine_frueh) arr.push('keine Früh');
    if (n.kann_keine_spaet) arr.push('keine Spät');
    if (n.kann_keine_nacht) arr.push('keine Nacht');
    if (n.kann_nur_frueh) arr.push('Kann Früh');
    if (n.kann_nur_spaet) arr.push('Kann Spät');
    if (n.kann_nur_nacht) arr.push('Kann Nacht');
    if (n.macht_schicht) arr.push('✅ macht Schicht');
    return arr.length ? arr.join(', ') : '';
  };

  // ===== Checkbox-Regeln =====
  const toggleFlag = (key) => {
    setFlags((prev) => {
      const next = { ...prev, [key]: !prev[key] };

      if (key === 'kann_heute_nicht') {
        const v = !prev.kann_heute_nicht;
        next.kann_heute_nicht = v;
        next.kann_keine_frueh = v;
        next.kann_keine_spaet = v;
        next.kann_keine_nacht = v;
        if (v) {
          next.kann_nur_frueh = false;
          next.kann_nur_spaet = false;
          next.kann_nur_nacht = false;
        }
        return next;
      }

      const pairMap = {
        kann_keine_frueh: 'kann_nur_frueh',
        kann_nur_frueh: 'kann_keine_frueh',
        kann_keine_spaet: 'kann_nur_spaet',
        kann_nur_spaet: 'kann_keine_spaet',
        kann_keine_nacht: 'kann_nur_nacht',
        kann_nur_nacht: 'kann_keine_nacht',
      };
      const opposite = pairMap[key];
      if (opposite && !prev[key]) next[opposite] = false;

      if ((key === 'kann_nur_frueh' || key === 'kann_nur_spaet' || key === 'kann_nur_nacht') && !prev[key]) {
        next.kann_heute_nicht = false;
      }

      return next;
    });
  };

  // ===== Speichern =====
  const handleDecision = async () => {
    if (!selected?.uid) return;
    setSaving(true);

    try {
      const createdBy = (await supabase.auth.getUser()).data?.user?.id ?? null;

      const payloadNotiz = {
        firma_id: firma,
        unit_id: unit,
        user_id: selected.uid,
        datum: modalDatum,
        created_by: createdBy,
        notiz: notizText || null,
        ...flags,
      };

      const { error: upErr } = await supabase
        .from('DB_Gespraechsnotiz')
        .upsert(payloadNotiz, { onConflict: 'firma_id,unit_id,user_id,datum' });

      if (upErr) {
        console.error(upErr);
        alert('Notiz konnte nicht gespeichert werden.');
        return;
      }

      if (flags.macht_schicht) {
        const { data: sRow, error: sErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, startzeit, endzeit, pause_aktiv')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('kuerzel', sch)
          .single();

        if (sErr || !sRow?.id) {
          console.error('DB_SchichtArt:', sErr);
          alert('SchichtArt nicht gefunden (F/S/N).');
          return;
        }

        const start = sRow.startzeit || null;
        const ende = sRow.endzeit || null;

        const rohDauer = (() => {
          if (!start || !ende) return null;
          const s = dayjs(`2024-01-01T${start}`);
          let e = dayjs(`2024-01-01T${ende}`);
          if (e.isBefore(s)) e = e.add(1, 'day');
          return dayjs.duration(e.diff(s)).asHours();
        })();

        let pause = 0;
        if (rohDauer != null && sRow.pause_aktiv) {
          if (rohDauer >= 9) pause = 0.75;
          else if (rohDauer >= 6) pause = 0.5;
        }
        const dauerIst = rohDauer != null ? Math.max(rohDauer - pause, 0) : null;

        const { data: oldRow } = await supabase
          .from('DB_Kampfliste')
          .select('*')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('datum', modalDatum)
          .eq('user', selected.uid)
          .maybeSingle();

        const now = new Date().toISOString();

        if (oldRow) {
          await supabase.from('DB_KampflisteVerlauf').insert([{
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
            created_by: oldRow.created_by,
            change_by: createdBy,
            created_at: oldRow.created_at,
            schichtgruppe: oldRow.schichtgruppe,
          }]);

          await supabase
            .from('DB_Kampfliste')
            .delete()
            .eq('firma_id', firma)
            .eq('unit_id', unit)
            .eq('datum', modalDatum)
            .eq('user', selected.uid);
        }

        const kommentarFinal =
          (notizText && String(notizText).trim().length > 0)
            ? String(notizText).trim()
            : null;

        await supabase.from('DB_Kampfliste').insert([{
          firma_id: firma,
          unit_id: unit,
          datum: modalDatum,
          user: selected.uid,
          ist_schicht: sRow.id,
          startzeit_ist: start,
          endzeit_ist: ende,
          dauer_ist: dauerIst,
          pausen_dauer: pause,
          aenderung: false,
          kommentar: kommentarFinal,
          created_at: now,
          created_by: createdBy,
        }]);

        await berechneUndSpeichereStunden(
          selected.uid,
          dayjs(modalDatum).year(),
          dayjs(modalDatum).month() + 1,
          firma,
          unit
        );
      }

      if (typeof onSaved === 'function') {
        await onSaved({
          datum: modalDatum,
          firma_id: firma,
          unit_id: unit,
          user_id: selected.uid,
          macht_schicht: !!flags.macht_schicht,
        });
      }

      setNotizByUser((prev) => {
        const m = new Map(prev);
        m.set(String(selected.uid), { ...payloadNotiz, created_at: new Date().toISOString() });
        return m;
      });

      setSelected(null);
      setNotizText('');
      setFlags({
        macht_schicht: false,
        kann_heute_nicht: false,
        kann_keine_frueh: false,
        kann_keine_spaet: false,
        kann_keine_nacht: false,
        kann_nur_frueh: false,
        kann_nur_spaet: false,
        kann_nur_nacht: false,
      });
    } finally {
      setSaving(false);
    }
  };

  // ===== Bewertungs-Logik (bestehend) =====
  const getBewertungsStufe = (f) => {
    const frei = (v) => v === '-';
    const freiOderF = (v) => v === '-' || v === 'F';
    const nichtFrei = (v) => v !== '-';

    if (
      f.vorvortag === 'U' &&
      f.folgetagplus === 'U' &&
      (
        (frei(f.vorher) && frei(f.heute)) ||
        (frei(f.vorher) && frei(f.nachher)) ||
        (frei(f.heute) && frei(f.nachher))
      )
    ) return 'rot';

    if (modalSchicht === 'F') {
      if (f.nachher === 'U' || f.vorvortag === 'U' || f.vorher === 'N' || f.vorher === 'U') return 'rot';
      if (
        (f.vorher === '-' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
        (f.vorher === 'F' && f.vorvortag === '-' && freiOderF(f.nachher) && f.folgetagplus === 'F') ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === 'S' && f.folgetagplus === '-') ||
        (f.vorvortag === 'K' && f.vorher === 'K' && f.nachher === '-' && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'S' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F')
      ) return 'grün';

      if (f.vorher === '-' && f.vorvortag === 'N') return 'gelb';
      if (
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'U') ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'S' && f.folgetagplus === 'F')
      ) return 'gelb';

      if (f.vorher === 'S') return 'amber';
      if (nichtFrei(f.vorvortag) && nichtFrei(f.vorher) && f.nachher === 'F' && f.folgetagplus === 'F') return 'amber';
    }

    if (modalSchicht === 'N') {
      if (f.vorher === 'U') return 'rot';
      if (['KO', 'K', 'U', 'F'].includes(f.nachher)) return 'rot';
      if (
        (f.vorvortag === 'N' && f.vorher === 'N' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === '-' && f.vorher === '-' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === 'N' && f.vorher === '-' && nichtFrei(f.nachher) && nichtFrei(f.folgetagplus)) ||
        (f.vorvortag === 'N' && f.vorher === '-' && nichtFrei(f.nachher) && frei(f.folgetagplus))
      ) return 'rot';

      if (
        (f.vorher === 'N' && f.nachher === 'N') ||
        (f.vorher === 'N' && frei(f.nachher) && frei(f.folgetagplus)) ||
        (f.vorvortag === 'N' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === '-')
      ) return 'grün';

      if (
        f.nachher === 'S' ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === 'U') ||
        (f.vorvortag === 'U' && f.vorher === '-' && f.nachher === '-' && f.folgetagplus === '-')
      ) return 'amber';

      if (
        (frei(f.nachher) && f.folgetagplus === 'F') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && frei(f.nachher) && f.folgetagplus === 'S') ||
        (f.vorvortag === 'K' && f.vorher === 'K' && frei(f.nachher) && f.folgetagplus === 'S') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && frei(f.nachher) && nichtFrei(f.folgetagplus))
      ) return 'gelb';
    }

    if (modalSchicht === 'S') {
      if (f.vorvortag === 'S' && frei(f.vorher) && frei(f.heute) && f.nachher === 'F' && f.folgetagplus === 'F') {
        return 'amber';
      }
      if (f.vorher === 'U') return 'rot';

      if (
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === '-') ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === '-' && f.vorher === 'N' && f.nachher === '-' && f.folgetagplus === '-') ||
        (f.vorvortag === '-' && f.vorher === 'N' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'N' && f.vorher === 'N' && frei(f.nachher) && frei(f.folgetagplus)) ||
        (f.vorvortag === '-' && nichtFrei(f.vorher) && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === 'S' && f.vorher === 'S' && f.nachher === 'F' && f.folgetagplus === 'F') ||
        (f.vorvortag === '-' && frei(f.vorher) && f.nachher === 'U' && f.folgetagplus === 'U')
      ) return 'amber';

      if (
        (f.vorher === '-' && f.vorvortag === 'U') ||
        (f.vorvortag === '-' && f.vorher === '-' && f.nachher === 'U' && f.folgetagplus === 'F') ||
        (frei(f.nachher) && f.folgetagplus === 'F')
      ) return 'gelb';

      if (
        (f.vorher === '-' && f.vorvortag === 'N') ||
        (f.vorher === '-' && frei(f.nachher)) ||
        (f.vorvortag === 'F' && f.vorher === 'F' && f.nachher === 'S' && f.folgetagplus === 'N')
      ) return 'grün';
    }

    return null;
  };

  // ===== Daten laden =====
  useEffect(() => {
    if (!offen || !modalDatum || !modalSchicht || !firma || !unit) return;

    let alive = true;

    const ladeDaten = async () => {
      setMitarbeiter([]);
      setFreieMitarbeiter([]);
      setDeckungByShift(null);
      setOverByShift({ F: false, S: false, N: false });
      setTauschAktiv(false);
      setTauschQuelle('');
      setTauschChecks(new Map());
      setDeckungBasis(null);
      setShiftUserIds({ F: [], S: [], N: [] });
      setDienstFensterByUserId({});

      const dates = [
        dayjs(modalDatum).subtract(3, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).subtract(2, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).subtract(1, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).format('YYYY-MM-DD'),
        dayjs(modalDatum).add(1, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).add(2, 'day').format('YYYY-MM-DD'),
        dayjs(modalDatum).add(3, 'day').format('YYYY-MM-DD'),
      ];
      const windowStart = dates[0];
      const windowEnd = dates[dates.length - 1];

      // (A) Soll-Plan
      const { data: soll } = await supabase
        .from('DB_SollPlan')
        .select('datum, schichtgruppe, kuerzel')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('datum', dates);

      const planByDate = new Map();
      (soll || []).forEach((r) => {
        const d = r.datum?.slice(0, 10);
        if (!d) return;
        if (!planByDate.has(d)) planByDate.set(d, new Map());
        planByDate.get(d).set(r.schichtgruppe, r.kuerzel);
      });

      // (B) Zuweisungen im Fenster
      const { data: zuw } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, von_datum, bis_datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .lte('von_datum', windowEnd)
        .or(`bis_datum.is.null, bis_datum.gte.${windowStart}`);

      const membersByDate = new Map();
      dates.forEach((d) => membersByDate.set(d, new Map()));
      for (const z of zuw || []) {
        for (const d of dates) {
          if (dayjs(z.von_datum).isAfter(d, 'day')) continue;
          if (z.bis_datum && dayjs(z.bis_datum).isBefore(d, 'day')) continue;

          const map = membersByDate.get(d);
          const prev = map.get(z.user_id);
          if (!prev || dayjs(z.von_datum).isAfter(prev.von_datum, 'day')) {
            map.set(z.user_id, { gruppe: z.schichtgruppe, von_datum: z.von_datum });
          }
        }
      }

      // (C) Kampfliste Overrides (nur Modal-Tag)
      const { data: overridesModalTag } = await supabase
        .from('DB_Kampfliste')
        .select('user, datum, ist_schicht(kuerzel)')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('datum', modalDatum);

      const overrideMapModal = new Map(); // `${d}|${uid}` -> kuerzel
      (overridesModalTag || []).forEach((r) => {
        const k = r.ist_schicht?.kuerzel || null;
        overrideMapModal.set(`${r.datum}|${r.user}`, rolle === 'Employee' ? maskForEmployee(k) : (k || null));
      });

      // (D) finalAtDay
      const mMap = membersByDate.get(modalDatum) || new Map();
      const allUserIdsAtDay = Array.from(mMap.keys());

      const finalAtDay = new Map(); // uid -> kuerzel
      for (const uid of allUserIdsAtDay) {
        const grp = mMap.get(uid)?.gruppe;
        const planK = planByDate.get(modalDatum)?.get(grp) || null;
        const overK = overrideMapModal.get(`${modalDatum}|${uid}`);
        const raw = overK ?? planK ?? '-';
        finalAtDay.set(uid, rolle === 'Employee' ? maskForEmployee(raw) : (raw || '-'));
      }

      // (E) Ausgrauen am Modal-Tag
      let greySet = new Set();
      if (allUserIdsAtDay.length) {
        const { data: aus } = await supabase
          .from('DB_Ausgrauen')
          .select('user_id, von, bis')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', allUserIdsAtDay)
          .lte('von', modalDatum)
          .or(`bis.is.null, bis.gte.${modalDatum}`);
        (aus || []).forEach((r) => greySet.add(String(r.user_id)));
      }

      const visibleIds = allUserIdsAtDay.filter((uid) => !greySet.has(String(uid)));

      const dienstUserIds = visibleIds.filter((uid) => finalAtDay.get(uid) === sch);
      const freiUserIds = visibleIds.filter((uid) => finalAtDay.get(uid) === '-');

      // (F) Namen
      const alleIds = Array.from(new Set([...visibleIds]));
      let userNameMap = {};
      if (alleIds.length) {
        const { data: userRows } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname, tel_number1, tel_number2')
          .in('user_id', alleIds);

        (userRows || []).forEach((u) => {
          userNameMap[u.user_id] = {
            vorname: u.vorname || '',
            nachname: u.nachname || '',
            tel1: u.tel_number1 || '',
            tel2: u.tel_number2 || '',
            voll: `${u.nachname || 'Unbekannt'}, ${u.vorname || ''}`.trim(),
          };
        });
        if (alive) setUserNameById(userNameMap);
      }

      // ✅ NEU: Overrides fürs Fenster für ALLE sichtbaren IDs
      const { data: overridesFensterAll } = await supabase
        .from('DB_Kampfliste')
        .select('user, datum, ist_schicht(kuerzel)')
        .in('user', visibleIds)
        .in('datum', dates)
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      const overrideWinAll = new Map();
      (overridesFensterAll || []).forEach((r) => {
        const k = r.ist_schicht?.kuerzel || null;
        const v = rolle === 'Employee' ? maskForEmployee(k) : (k || null);
        overrideWinAll.set(`${r.datum}|${r.user}`, v);
      });

      // ✅ NEU: Fensteranzeige für alle sichtbaren IDs bauen (damit Schichttausch-Liste exakt so aussieht)
      const fensterObj = {};
      for (const uid of visibleIds) {
        const profil = userNameMap[uid] || { voll: 'Unbekannt, ', tel1: '', tel2: '' };

        const res = {
          uid,
          name: profil.voll,
          tel1: profil.tel1 || '',
          tel2: profil.tel2 || '',

          vor3: '-', vor2: '-', vor1: '-',
          heute: '-',
          nach1: '-', nach2: '-', nach3: '-',

          // helper keys für Bewertung:
          vorvortag: '-', vorher: '-', nachher: '-', folgetagplus: '-',
        };

        for (let i = 0; i < dates.length; i++) {
          const d = dates[i];
          const grp = membersByDate.get(d)?.get(uid)?.gruppe;
          const base = planByDate.get(d)?.get(grp) || null;
          const over = overrideWinAll.get(`${d}|${uid}`);
          const finalK = over ?? base ?? '-';
          const show = rolle === 'Employee' ? maskForEmployee(finalK) : (finalK || '-');

          if (i === 0) res.vor3 = show;
          if (i === 1) { res.vor2 = show; res.vorvortag = show; }
          if (i === 2) { res.vor1 = show; res.vorher = show; }
          if (i === 3) res.heute = show;
          if (i === 4) { res.nach1 = show; res.nachher = show; }
          if (i === 5) { res.nach2 = show; res.folgetagplus = show; }
          if (i === 6) res.nach3 = show;
        }

        fensterObj[String(uid)] = res;
      }
      if (alive) setDienstFensterByUserId(fensterObj);

      // (G) Mitarbeiter im Dienst sortieren nach höchster Quali
      let bestPosByUser = {};
      if (dienstUserIds.length) {
        const tag = dayjs(modalDatum);
        const { data: qRows } = await supabase
          .from('DB_Qualifikation')
          .select(`
            user_id,
            quali_start,
            quali_endet,
            matrix:DB_Qualifikationsmatrix!inner(
              id,
              position,
              betriebs_relevant,
              aktiv,
              firma_id,
              unit_id
            )
          `)
          .in('user_id', dienstUserIds)
          .eq('matrix.firma_id', firma)
          .eq('matrix.unit_id', unit)
          .eq('matrix.aktiv', true)
          .eq('matrix.betriebs_relevant', true);

        for (const r of qRows || []) {
          const startOk = !r.quali_start || dayjs(r.quali_start).isSameOrBefore(tag, 'day');
          const endOk = !r.quali_endet || dayjs(r.quali_endet).isSameOrAfter(tag, 'day');
          if (!startOk || !endOk) continue;
          const uid = String(r.user_id);
          const p = Number(r.matrix?.position ?? 999);
          bestPosByUser[uid] = Math.min(bestPosByUser[uid] ?? 999, p);
        }
      }

      const imDienst = dienstUserIds
        .map((uid) => ({
          uid,
          vorname: userNameMap[uid]?.vorname || '',
          nachname: userNameMap[uid]?.nachname || '',
          bestPos: bestPosByUser[String(uid)] ?? 999,
        }))
        .sort((a, b) => a.bestPos - b.bestPos)
        .map(({ vorname, nachname }) => ({ vorname, nachname }));

      if (!alive) return;
      setMitarbeiter(imDienst);

      // (H) Kandidatenliste – nutzt jetzt das zentrale fensterObj (kein doppelt rechnen)
      if (freiUserIds.length === 0) {
        setFreieMitarbeiter([]);
      } else {
        const tag = dayjs(modalDatum);
        const { data: qualRows } = await supabase
          .from('DB_Qualifikation')
          .select(`
            user_id,
            quali_start,
            quali_endet,
            matrix:DB_Qualifikationsmatrix!inner(
              id,
              quali_kuerzel,
              aktiv,
              firma_id,
              unit_id
            )
          `)
          .in('user_id', freiUserIds)
          .eq('matrix.firma_id', firma)
          .eq('matrix.unit_id', unit)
          .eq('matrix.aktiv', true);

        const userKuerzelSet = new Map();
        for (const q of qualRows || []) {
          const startOk = !q.quali_start || dayjs(q.quali_start).isSameOrBefore(tag, 'day');
          const endOk = !q.quali_endet || dayjs(q.quali_endet).isSameOrAfter(tag, 'day');
          if (!startOk || !endOk) continue;

          const kz = q.matrix?.quali_kuerzel;
          if (!kz) continue;

          const set = userKuerzelSet.get(q.user_id) || new Set();
          set.add(kz);
          userKuerzelSet.set(q.user_id, set);
        }

        const kandidaten = fehlendeQualis.length
          ? freiUserIds.filter((uid) => {
              const set = userKuerzelSet.get(uid);
              if (!set) return false;
              return fehlendeQualis.some((k) => set.has(k));
            })
          : freiUserIds;

        const freieZeilen = kandidaten.map((uid) => fensterObj[String(uid)]).filter(Boolean);
        if (!alive) return;
        setFreieMitarbeiter(freieZeilen);
      }

      // (I) Deckung/Überbesetzung – bleibt wie bei dir (unverändert bis auf Basis-Set)
      try {
        const { data: bedarfRows, error: bErr } = await supabase
          .from('DB_Bedarf')
          .select('quali_id, anzahl, von, bis, normalbetrieb, schichtart, start_schicht, end_schicht, betriebsmodus, wochen_tage')
          .eq('firma_id', firma)
          .eq('unit_id', unit);
        if (bErr) console.error('DB_Bedarf error', bErr);

        const { data: matrixRows, error: mErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, quali_kuerzel, betriebs_relevant, position, aktiv')
          .eq('firma_id', firma)
          .eq('unit_id', unit);
        if (mErr) console.error('DB_Qualifikationsmatrix error', mErr);

        const matrixMap = {};
        (matrixRows || []).forEach((q) => {
          matrixMap[q.id] = {
            kuerzel: q.quali_kuerzel,
            relevant: !!q.betriebs_relevant,
            position: Number(q.position ?? 999),
            aktiv: !!q.aktiv,
          };
        });

        const makeBedarfHeute = (shiftKey) => {
          const datum = modalDatum;
          const bedarfTag = (bedarfRows || []).filter((b) => (!b.von || datum >= b.von) && (!b.bis || datum <= b.bis));
          const bedarfTagSchicht = bedarfTag.filter((b) => bedarfGiltFuerSchicht(b, datum, shiftKey));

          const hatZeitlich = bedarfTagSchicht.some((b) => b.normalbetrieb === false);
          const bedarfHeute = bedarfTagSchicht.filter((b) => b.normalbetrieb === !hatZeitlich);

          return bedarfHeute
            .map((b) => ({
              ...b,
              position: matrixMap[b.quali_id]?.position ?? 999,
              kuerzel: matrixMap[b.quali_id]?.kuerzel || '???',
              relevant: matrixMap[b.quali_id]?.relevant,
              aktiv: matrixMap[b.quali_id]?.aktiv,
            }))
            .filter((b) => b.relevant && b.aktiv);
        };

        const bedarfHeuteByShift = {
          F: makeBedarfHeute('F'),
          S: makeBedarfHeute('S'),
          N: makeBedarfHeute('N'),
        };

        const idsByShift = {
          F: visibleIds.filter((uid) => finalAtDay.get(uid) === 'F'),
          S: visibleIds.filter((uid) => finalAtDay.get(uid) === 'S'),
          N: visibleIds.filter((uid) => finalAtDay.get(uid) === 'N'),
        };

        const tag = dayjs(modalDatum);
        let qAllRows = [];
        if (visibleIds.length) {
          const { data: qRows, error: qErr } = await supabase
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
                aktiv,
                betriebs_relevant,
                position,
                quali_kuerzel
              )
            `)
            .in('user_id', visibleIds)
            .eq('matrix.firma_id', firma)
            .eq('matrix.unit_id', unit)
            .eq('matrix.aktiv', true)
            .eq('matrix.betriebs_relevant', true);

          if (qErr) console.error('Qualis for Deckung error', qErr);
          qAllRows = qRows || [];
        }

        const qualisByUser = new Map();
        for (const r of qAllRows || []) {
          const startOk = !r.quali_start || dayjs(r.quali_start).isSameOrBefore(tag, 'day');
          const endOk = !r.quali_endet || dayjs(r.quali_endet).isSameOrAfter(tag, 'day');
          if (!startOk || !endOk) continue;

          const qid = r.quali;
          if (!qid) continue;
          const pos = Number(r.matrix?.position ?? 999);
          const kz = r.matrix?.quali_kuerzel || matrixMap[qid]?.kuerzel || '???';

          const arr = qualisByUser.get(String(r.user_id)) || [];
          arr.push({ id: qid, kz, position: pos });
          qualisByUser.set(String(r.user_id), arr);
        }

        const calcDeckung = (shiftKey) => {
          const bedarfHeute = makeBedarfHeute(shiftKey);
          const bedarfSortiert = bedarfHeute.slice().sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

          const totalNeed = bedarfSortiert.reduce((s, b) => s + Number(b.anzahl || 0), 0);
          const totalHave = (idsByShift[shiftKey] || []).length;

          const people = (idsByShift[shiftKey] || []).map((uid) => {
            const qs = (qualisByUser.get(String(uid)) || []).slice().sort((a, b) => a.position - b.position);
            return { uid: String(uid), qualis: qs };
          });

          const used = new Set();
          const missingByQuali = [];

          for (const b of bedarfSortiert) {
            const need = Number(b.anzahl || 0);
            if (!need) continue;

            let remaining = need;
            while (remaining > 0) {
              const cand = people.find((p) => !used.has(p.uid) && p.qualis.some((q) => q.id === b.quali_id));
              if (!cand) break;
              used.add(cand.uid);
              remaining -= 1;
            }
            if (remaining > 0) missingByQuali.push({ kz: b.kuerzel, missing: remaining, position: b.position ?? 999 });
          }

          const missingTotal = missingByQuali.reduce((s, x) => s + Number(x.missing || 0), 0);
          const overCount = Math.max(totalHave - totalNeed, 0);

          return {
            totalNeed,
            totalHave,
            overCount,
            missingTotal,
            missingByQuali: missingByQuali.sort((a, b) => a.position - b.position),
            ok: missingTotal === 0 && totalHave >= totalNeed,
          };
        };

        const deck = {
          F: calcDeckung('F'),
          S: calcDeckung('S'),
          N: calcDeckung('N'),
        };

        if (!alive) return;
        setDeckungByShift(deck);
        setOverByShift({
          F: deck.F.overCount > 0,
          S: deck.S.overCount > 0,
          N: deck.N.overCount > 0,
        });
        setShiftUserIds({
          F: idsByShift.F || [],
          S: idsByShift.S || [],
          N: idsByShift.N || [],
        });
        setDeckungBasis({
          bedarfHeuteByShift,
          qualisByUser,
        });
      } catch (e) {
        console.error('Deckung/Überbesetzung exception:', e);
      }
      if (!alive) return;
    };

    ladeDaten();

    return () => { alive = false; };
  }, [offen, modalDatum, modalSchicht, firma, unit, fehlendeQualis, rolle, sch]);

  // ===== MOVE Auto-Prüfung (dein Code) =====
  const missingText = (d) => {
    if (!d) return '—';
    if (!d.missingByQuali?.length) return '—';
    return d.missingByQuali.map((x) => `${x.kz}${x.missing > 1 ? `+${x.missing}` : ''}`).join(', ');
  };

  const simulateDeckung = (shiftKey, userIdsOverride) => {
    if (!deckungBasis) return { ok: false, missingText: 'Basisdaten fehlen' };

    const bedarfHeuteRaw = deckungBasis?.bedarfHeuteByShift?.[shiftKey] || [];
    const bedarfHeute = bedarfHeuteRaw.slice().sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

    const people = (userIdsOverride || [])
      .map(String)
      .sort((a, b) => a.localeCompare(b))
      .map(uid => {
        const qs = (deckungBasis.qualisByUser.get(uid) || [])
          .slice()
          .sort((a, b) => a.position - b.position);
        return { uid, qualis: qs };
      });

    const used = new Set();
    const missingByQuali = [];

    for (const b of bedarfHeute) {
      const need = Number(b.anzahl || 0);
      if (!need) continue;

      let remaining = need;
      while (remaining > 0) {
        const candidates = people
          .filter(p => !used.has(p.uid) && p.qualis.some(q => q.id === b.quali_id))
          .sort((p1, p2) => {
            const d = (p1.qualis.length - p2.qualis.length);
            if (d !== 0) return d;

            const best1 = p1.qualis[0]?.position ?? 999;
            const best2 = p2.qualis[0]?.position ?? 999;
            if (best1 !== best2) return best1 - best2;

            return p1.uid.localeCompare(p2.uid);
          });

        const cand = candidates[0];
        if (!cand) break;
        used.add(cand.uid);
        remaining -= 1;
      }
      if (remaining > 0) missingByQuali.push({ kz: b.kuerzel, missing: remaining, pos: b.position ?? 999 });
    }

    const missingTotal = missingByQuali.reduce((s, x) => s + Number(x.missing || 0), 0);
    const txt = missingByQuali
      .sort((a, b) => a.pos - b.pos)
      .map(x => `${x.kz}${x.missing > 1 ? `+${x.missing}` : ''}`)
      .join(', ');

    return { ok: missingTotal === 0, missingText: txt || '—' };
  };

  const calcMoveResult = (uid) => {
    const ziel = sch;
    const quelle = tauschQuelle;

    if (!uid || !quelle || quelle === ziel) {
      return { ok: false, text: 'Quelle/Ziel ungültig' };
    }

    const srcIds = (shiftUserIds[quelle] || []).map(String);
    const dstIds = (shiftUserIds[ziel] || []).map(String);

    const srcNext = srcIds.filter(x => x !== String(uid));
    const dstNext = [...dstIds, String(uid)];

    const srcRes = simulateDeckung(quelle, srcNext);
    const dstRes = simulateDeckung(ziel, dstNext);

    const ok = srcRes.ok && dstRes.ok;

    const text = ok
      ? `✅ OK – Quelle & Ziel bleiben qualifiziert`
      : `❌ Nicht OK – Quelle fehlt: ${srcRes.ok ? '—' : srcRes.missingText} | Ziel fehlt: ${dstRes.ok ? '—' : dstRes.missingText}`;

    return { ok, text };
  };

  useEffect(() => {
    if (!tauschAktiv) return;
    if (!tauschQuelle) return;
    if (!deckungBasis) return;

    const ids = (shiftUserIds[tauschQuelle] || []).map(String);

    if (!ids.length) {
      setTauschChecks(new Map());
      setTauschOkIds([]);
      return;
    }

    setTauschAutoLoading(true);

    const m = new Map();
    const okList = [];

    for (const uid of ids) {
      const res = calcMoveResult(uid);
      m.set(String(uid), res);
      if (res.ok) okList.push(String(uid));
    }

    setTauschChecks(m);
    setTauschOkIds(okList);
    setTauschAutoLoading(false);
  }, [tauschAktiv, tauschQuelle, deckungBasis, shiftUserIds, sch]);

  // Gesprächsnotizen laden (dein Code – unverändert)
  useEffect(() => {
    if (!offen || !modalDatum || !firma || !unit) return;

    const ids = Array.from(new Set([
      ...(shiftUserIds?.F || []),
      ...(shiftUserIds?.S || []),
      ...(shiftUserIds?.N || []),
      ...(freieMitarbeiter || []).map(x => x?.uid).filter(Boolean),
    ]));

    if (!ids.length) {
      setNotizByUser(new Map());
      return;
    }

    let alive = true;

    (async () => {
      try {
        const { data: nRows, error: nErr } = await supabase
          .from('DB_Gespraechsnotiz')
          .select('*')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('datum', modalDatum)
          .in('user_id', ids);

        if (nErr) {
          console.error('DB_Gespraechsnotiz:', nErr);
          if (alive) setNotizByUser(new Map());
          return;
        }

        const map = new Map();
        (nRows || []).forEach((r) => map.set(String(r.user_id), r));

        if (alive) setNotizByUser(map);
      } catch (e) {
        console.error('DB_Gespraechsnotiz load exception:', e);
        if (alive) setNotizByUser(new Map());
      }
    })();

    return () => { alive = false; };
  }, [offen, modalDatum, firma, unit, shiftUserIds, freieMitarbeiter]);

  // ===== UI helper: User aus Tauschliste klicken =====
  const pickUserById = (uid) => {
    const profil = userNameById?.[uid];
    const n = notizByUser.get(String(uid));

    setSelected({
      uid,
      name: profil?.voll || String(uid),
      tel1: profil?.tel1 || '',
      tel2: profil?.tel2 || '',
    });
    setNotizText(n?.notiz || '');
    setFlags({
      macht_schicht: false,
      kann_heute_nicht: !!n?.kann_heute_nicht,
      kann_keine_frueh: !!n?.kann_keine_frueh,
      kann_keine_spaet: !!n?.kann_keine_spaet,
      kann_keine_nacht: !!n?.kann_keine_nacht,
      kann_nur_frueh: !!n?.kann_nur_frueh,
      kann_nur_spaet: !!n?.kann_nur_spaet,
      kann_nur_nacht: !!n?.kann_nur_nacht,
    });
  };

  const pickUserFromFreeRow = (row) => {
    const n = notizByUser.get(String(row.uid));
    setSelected({ uid: row.uid, name: row.name, tel1: row.tel1, tel2: row.tel2 });
    setNotizText(n?.notiz || '');
    setFlags({
      macht_schicht: false,
      kann_heute_nicht: !!n?.kann_heute_nicht,
      kann_keine_frueh: !!n?.kann_keine_frueh,
      kann_keine_spaet: !!n?.kann_keine_spaet,
      kann_keine_nacht: !!n?.kann_keine_nacht,
      kann_nur_frueh: !!n?.kann_nur_frueh,
      kann_nur_spaet: !!n?.kann_nur_spaet,
      kann_nur_nacht: !!n?.kann_nur_nacht,
    });
  };

  const tauschenMoeglich = !!(overByShift.F || overByShift.S || overByShift.N);

  return (
    <>
      <BAM_UI
        offen={offen}
        onClose={onClose}
        onInfo={() => setInfoOffen(true)}
        title={`${SCH_LABEL[sch] || sch}-Schicht am ${dayjs(modalDatum).format('DD.MM.YYYY')}`}
      >
        <p className="text-sm">❌ Fehlende Qualifikationen (Ziel): {fehlendeQualis.length ? fehlendeQualis.join(', ') : '—'}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Links */}
          <BAM_MitarbeiterimDienst mitarbeiter={mitarbeiter} />

          {/* Rechts */}
          <div>
            <BAM_SchichtTausch
              deckungByShift={deckungByShift}
              overByShift={overByShift}
              missingText={missingText}

              tauschenMoeglich={tauschenMoeglich}
              tauschAktiv={tauschAktiv}
              setTauschAktiv={setTauschAktiv}

              sch={sch}
              tauschQuelle={tauschQuelle}
              setTauschQuelle={(v) => {
                setTauschQuelle(v);
                setTauschChecks(new Map());
              }}

              tauschAutoLoading={tauschAutoLoading}
              tauschShowAll={tauschShowAll}
              setTauschShowAll={setTauschShowAll}
              tauschOkIds={tauschOkIds}
              tauschChecks={tauschChecks}
              shiftUserIds={shiftUserIds}

              userNameById={userNameById}
              notizByUser={notizByUser}
              flagsSummary={flagsSummary}
              onPickUser={pickUserById}

              dienstFensterByUserId={dienstFensterByUserId}
              modalDatum={modalDatum}
            />

            <BAM_VerfuegbareMitarbeiter
              modalDatum={modalDatum}
              modalSchicht={modalSchicht}
              kollidiertAktiv={kollidiertAktiv}
              setKollidiertAktiv={setKollidiertAktiv}
              freieMitarbeiter={freieMitarbeiter}
              getBewertungsStufe={getBewertungsStufe}
              flagsSummary={flagsSummary}
              notizByUser={notizByUser}
              onPickUser={pickUserFromFreeRow}
            />
          </div>
        </div>

        {/* User Modal (deins – unverändert) */}
        {selected && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]" onClick={() => setSelected(null)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 border border-gray-900 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-xl p-5 w-full max-w-md shadow-xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{selected.name}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Tel1: <span className="font-medium">{selected.tel1 || '—'}</span><br />
                    Tel2: <span className="font-medium">{selected.tel2 || '—'}</span>
                  </div>
                </div>
                <button className="text-xl opacity-70 hover:opacity-100" onClick={() => setSelected(null)}>×</button>
              </div>

              <div className="mt-4">
                <label className="text-sm font-medium">Gesprächsnotiz</label>
                <textarea
                  rows={3}
                  value={notizText}
                  onChange={(e) => setNotizText(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-sm"
                  placeholder="Kurze Notiz…"
                  maxLength={250}
                />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={flags.macht_schicht} onChange={() => toggleFlag('macht_schicht')} />
                  Macht die Schicht ✅
                </label>

                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={flags.kann_heute_nicht} onChange={() => toggleFlag('kann_heute_nicht')} />
                  Kann heute nicht
                </label>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flags.kann_keine_frueh} onChange={() => toggleFlag('kann_keine_frueh')} />
                    Kann keine Früh
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flags.kann_nur_frueh} onChange={() => toggleFlag('kann_nur_frueh')} />
                    Kann nur Früh
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flags.kann_keine_spaet} onChange={() => toggleFlag('kann_keine_spaet')} />
                    Kann keine Spät
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flags.kann_nur_spaet} onChange={() => toggleFlag('kann_nur_spaet')} />
                    Kann nur Spät
                  </label>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flags.kann_keine_nacht} onChange={() => toggleFlag('kann_keine_nacht')} />
                    Kann keine Nacht
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={flags.kann_nur_nacht} onChange={() => toggleFlag('kann_nur_nacht')} />
                    Kann nur Nacht
                  </label>
                </div>

                <button
                  className="mt-3 w-full rounded-xl px-4 py-2 bg-green-700 text-white hover:bg-green-600 disabled:opacity-60"
                  disabled={saving}
                  onClick={handleDecision}
                >
                  Speichern
                </button>

                {saving && <div className="text-xs text-gray-500">Speichere…</div>}
              </div>
            </div>
          </div>
        )}
      </BAM_UI>

      <BAM_InfoModal offen={infoOffen} onClose={() => setInfoOffen(false)} />
    </>
  );
};

export default BedarfsAnalyseModal;
