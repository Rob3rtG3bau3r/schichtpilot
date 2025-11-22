// src/pages/WochenPlaner.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import { useRollen } from '../context/RollenContext';
import { supabase } from '../supabaseClient';
import WochenPlanerConfigModal from '../components/WochenPlaner/WochenPlanerConfigModal';
import KWSelector from '../components/WochenPlaner/KWSelector';
import WochenPlanerHeader from '../components/WochenPlaner/WochenPlanerHeader';
import WochenPlanerMitarbeiterListe from '../components/WochenPlaner/WochenPlanerMitarbeiterListe';
import WochenPlanerBedarfZeile from '../components/WochenPlaner/WochenPlanerBedarfZeile';


const BASIS_SCHICHTEN = [
  { code: 'F', label: 'F' },
  { code: 'S', label: 'S' },
  { code: 'N', label: 'N' },
];

// Standard-Muster pro Schicht (Mo–So)
const DEFAULT_PATTERN = {
  F: ['F', 'F', 'F', 'F', 'F', '-', '-'],
  S: ['S', 'S', 'S', 'S', 'S', '-', '-'],
  N: ['N', 'N', 'N', 'N', 'N', '-', '-'],
};

// Schicht-Labels für Bedarf
const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { Früh: 0, Spät: 1, Nacht: 2 };

// Hilfsfunktion: Schicht-Grenzen (Start/Endschicht) für zeitlich begrenzten Bedarf
const schichtInnerhalbGrenzen = (b, datumISO, schLabel) => {
  if (b.normalbetrieb) return true;

  const sIdx = SCH_INDEX[schLabel];
  const startLabel = b.start_schicht || 'Früh';
  const endLabel = b.end_schicht || 'Nacht';
  const startIdx = SCH_INDEX[startLabel];
  const endIdx = SCH_INDEX[endLabel];

  const amStart = b.von && datumISO === b.von;
  const amEnde = b.bis && datumISO === b.bis;

  if (amStart && amEnde) {
    return sIdx >= startIdx && sIdx <= endIdx;
  } else if (amStart) {
    return sIdx >= startIdx;
  } else if (amEnde) {
    return sIdx <= endIdx;
  }
  return true;
};

// Prüft, ob ein Bedarfs-Eintrag für Datum + Schicht gilt
const bedarfGiltFuerSchicht = (b, datumISO, schKey) => {
  // 1) Datums-Fenster
  if (b.von && datumISO < b.von) return false;
  if (b.bis && datumISO > b.bis) return false;

  const schLabel = SCH_LABEL[schKey]; // 'Früh' | 'Spät' | 'Nacht'

  // 2) Wochenbetriebs-Logik (vereinfachte Variante)
  if (b.normalbetrieb && b.betriebsmodus === 'wochenbetrieb') {
    const weekday = dayjs(datumISO).day(); // 0=So, 1=Mo, ... 6=Sa

    switch (b.wochen_tage) {
      case 'MO_FR': {
        if (weekday < 1 || weekday > 5) return false;
        break;
      }
      case 'MO_SA_ALL': {
        if (weekday < 1 || weekday > 6) return false;
        break;
      }
      case 'MO_FR_SA_F': {
        if (weekday === 0) return false;
        if (weekday === 6 && schLabel !== 'Früh') return false;
        if (weekday < 1 || weekday > 6) return false;
        break;
      }
      case 'MO_FR_SA_FS': {
        if (weekday === 0) return false;
        if (weekday === 6 && schLabel === 'Nacht') return false;
        if (weekday < 1 || weekday > 6) return false;
        break;
      }
      case 'SO_FR_ALL': {
        if (weekday === 0) {
          if (schLabel !== 'Nacht') return false;
        } else if (weekday >= 1 && weekday <= 4) {
          // Mo–Do: alles erlaubt
        } else if (weekday === 5) {
          if (schLabel === 'Nacht') return false;
        } else {
          return false;
        }
        break;
      }
      default:
        // unbekannt -> wie 24/7
        break;
    }
  }

  // 3) Schichtgrenzen (nur für zeitlich begrenzt)
  if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

  // 4) Schichtart: null = alle, sonst nur konkrete
  if (b.schichtart == null) return true;
  return b.schichtart === schLabel;
};

dayjs.extend(isoWeek);

// römische Zahlen
const toRoman = (num) => {
  if (!num || num <= 0) return '';
  const romanMap = [
    { value: 1000, symbol: 'M' },
    { value: 900, symbol: 'CM' },
    { value: 500, symbol: 'D' },
    { value: 400, symbol: 'CD' },
    { value: 100, symbol: 'C' },
    { value: 90, symbol: 'XC' },
    { value: 50, symbol: 'L' },
    { value: 40, symbol: 'XL' },
    { value: 10, symbol: 'X' },
    { value: 9, symbol: 'IX' },
    { value: 5, symbol: 'V' },
    { value: 4, symbol: 'IV' },
    { value: 1, symbol: 'I' },
  ];
  let result = '';
  let n = num;
  for (const { value, symbol } of romanMap) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
};

const WochenPlaner = () => {
  const { sichtFirma: firma, sichtUnit: unit, userId: currentUserId } =
    useRollen();

  const heute = dayjs();
  const [jahr, setJahr] = useState(heute.year());
  const [kw, setKw] = useState(heute.isoWeek());
  const [anzahlWochen, setAnzahlWochen] = useState(1);

  // Personalliste
  const [mitarbeiter, setMitarbeiter] = useState([]);
  const [loadingMitarbeiter, setLoadingMitarbeiter] = useState(false);
  const [errorMitarbeiter, setErrorMitarbeiter] = useState(null);

  // Wocheninfos: { [user_id]: { prevWeekCodes:[], currWeekCodes:[], countU, countK, awayFullWeek } }
  const [wochenDaten, setWochenDaten] = useState({});
  const [schichtFarben, setSchichtFarben] = useState({});
  const [selectedMitarbeiterId, setSelectedMitarbeiterId] = useState(null);

  // Schichtgruppen-Konfig
  const [gruppen, setGruppen] = useState([]);
  const [config, setConfig] = useState(null); // {F, S, N}
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Board-Zuweisungen
  const [zuweisungen, setZuweisungen] = useState({});
// Board-Overrides: { [user_id]: { [datumYYYYMMDD]: code } }
const [boardPlan, setBoardPlan] = useState({});

  // Bedarf / Quali-Matrix für den Planungszeitraum
  const [bedarfStatus, setBedarfStatus] = useState({ F: {}, S: {}, N: {} });
  const [matrixMap, setMatrixMap] = useState({});

  // Feedback-Hinweise (statt alert)
  const [feedback, setFeedback] = useState(null); // {type: 'success'|'error'|'info', text: string}

  // Zeitraum der Planung
  const { startDatum, endDatum } = useMemo(() => {
    const start = dayjs().year(jahr).isoWeek(kw).startOf('isoWeek'); // Montag ISO
    const end = start.add(anzahlWochen * 7 - 1, 'day');
    return { startDatum: start, endDatum: end };
  }, [jahr, kw, anzahlWochen]);

  // Liste der Wochen (Startdatum) für das Planungsboard
  const wochenListe = useMemo(() => {
    const arr = [];
    for (let i = 0; i < anzahlWochen; i++) {
      arr.push(startDatum.add(i, 'week'));
    }
    return arr;
  }, [startDatum, anzahlWochen]);

  const zeitraumLabel = `${startDatum.format('DD.MM.YYYY')} – ${endDatum.format(
    'DD.MM.YYYY'
  )}`;

  // --- Personalliste laden ---
  useEffect(() => {
    const ladeMitarbeiter = async () => {
      if (!firma || !unit) {
        setMitarbeiter([]);
        return;
      }

      setLoadingMitarbeiter(true);
      setErrorMitarbeiter(null);

      try {
        const { data: userData, error: userError } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname, rolle, aktiv')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .order('nachname', { ascending: true });

        if (userError) throw userError;

        const aktiveUser = (userData || []).filter((u) => u.aktiv !== false);

        if (aktiveUser.length === 0) {
          setMitarbeiter([]);
          setLoadingMitarbeiter(false);
          return;
        }

        const userIds = aktiveUser.map((u) => u.user_id);

        // Qualifikationen
        const { data: qualiUserData, error: qualiUserErr } = await supabase
          .from('DB_Qualifikation')
          .select('user_id, quali')
          .in('user_id', userIds);

        if (qualiUserErr) throw qualiUserErr;

        const qualiIds = [
          ...new Set((qualiUserData || []).map((q) => q.quali)),
        ];

        // Quali-Definitionen
        const { data: qualiMatrixData, error: qualiMatrixErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select(
            'id, quali_kuerzel, beschreibung, position, betriebs_relevant, aktiv'
          )
          .in('id', qualiIds)
          .eq('firma_id', firma)
          .eq('unit_id', unit);

        if (qualiMatrixErr) throw qualiMatrixErr;

        const qualiDefMap = new Map();
        (qualiMatrixData || []).forEach((q) => {
          if (q.aktiv !== false) {
            qualiDefMap.set(q.id, q);
          }
        });

        const combined = aktiveUser.map((u) => {
          const eigeneQualis = (qualiUserData || [])
            .filter((q) => q.user_id === u.user_id)
            .map((q) => qualiDefMap.get(q.quali))
            .filter(Boolean);

          return {
            ...u,
            qualis: eigeneQualis,
          };
        });

        setMitarbeiter(combined);
      } catch (err) {
        console.error('Fehler beim Laden der Mitarbeiterliste:', err);
        setErrorMitarbeiter('Mitarbeiterliste konnte nicht geladen werden.');
      } finally {
        setLoadingMitarbeiter(false);
      }
    };

    ladeMitarbeiter();
  }, [firma, unit]);

  // --- Schichtgruppen + Config laden ---
  useEffect(() => {
    const ladeGruppenUndConfig = async () => {
      if (!firma || !unit) {
        setGruppen([]);
        setConfig(null);
        return;
      }

      try {
        // 1) Schichtgruppen aus Sollplan
        const { data: gruppenData, error: gruppenErr } = await supabase
          .from('DB_SollPlan')
          .select('schichtgruppe')
          .eq('firma_id', firma)
          .eq('unit_id', unit);

        if (gruppenErr) {
          console.error(
            'Fehler beim Laden der Schichtgruppen aus DB_SollPlan:',
            gruppenErr
          );
        } else if (gruppenData) {
          const unique = [
            ...new Set(
              gruppenData
                .map((g) => g.schichtgruppe)
                .filter((g) => g && g.trim().length > 0)
            ),
          ].sort((a, b) => a.localeCompare(b, 'de'));
          setGruppen(unique);
        } else {
          setGruppen([]);
        }

        // 2) Bestehende Config
        const { data: cfg, error: cfgErr } = await supabase
          .from('DB_SchichtgruppenConfig')
          .select('frueh_gruppe, spaet_gruppe, nacht_gruppe')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .maybeSingle();

        if (cfgErr) {
          console.error(
            'Fehler beim Laden der SchichtgruppenConfig:',
            cfgErr
          );
          setConfig(null);
        } else if (cfg) {
          setConfig({
            F: cfg.frueh_gruppe,
            S: cfg.spaet_gruppe,
            N: cfg.nacht_gruppe,
          });
        } else {
          setConfig(null);
        }
      } catch (e) {
        console.error(
          'Unerwarteter Fehler beim Laden der Schichtgruppen-Config:',
          e
        );
        setConfig(null);
      }
    };

    ladeGruppenUndConfig();
  }, [firma, unit]);

  const handleSaveConfig = async (newConfig) => {
    if (!firma || !unit) return;

    if (!newConfig.F || !newConfig.S || !newConfig.N) {
      setFeedback({
        type: 'error',
        text: 'Bitte Früh-, Spät- und Nachtschicht jeweils einer Schichtgruppe zuordnen.',
      });
      return;
    }

    try {
      setConfigSaving(true);

      const payload = {
        firma_id: firma,
        unit_id: unit,
        frueh_gruppe: newConfig.F,
        spaet_gruppe: newConfig.S,
        nacht_gruppe: newConfig.N,
      };

      const { error } = await supabase
        .from('DB_SchichtgruppenConfig')
        .upsert(payload, { onConflict: 'firma_id,unit_id' });

      if (error) {
        console.error(
          'Fehler beim Speichern der Schichtgruppen-Config:',
          error
        );
        setFeedback({
          type: 'error',
          text: 'Konfiguration konnte nicht gespeichert werden.',
        });
      } else {
        setConfig(newConfig);
        setConfigModalOpen(false);
        setFeedback({
          type: 'success',
          text: 'Schichtgruppen-Konfiguration gespeichert.',
        });
      }
    } catch (e) {
      console.error(
        'Unerwarteter Fehler beim Speichern der Schichtgruppen-Config:',
        e
      );
      setFeedback({
        type: 'error',
        text: 'Konfiguration konnte nicht gespeichert werden.',
      });
    } finally {
      setConfigSaving(false);
    }
  };

  // --- KW-Muster: Vorwoche + aktuelle KW laden ---
  useEffect(() => {
    const ladeWochenDaten = async () => {
      if (!firma || !unit || mitarbeiter.length === 0) {
        setWochenDaten({});
        return;
      }

      try {
        const weekStart = dayjs().year(jahr).isoWeek(kw).startOf('isoWeek'); // Mo aktuelle KW
        const weekEnd = weekStart.add(6, 'day'); // So aktuelle KW

        const prevWeekStart = weekStart.subtract(1, 'week'); // Mo Vorwoche
        const prevWeekEnd = prevWeekStart.add(6, 'day'); // So Vorwoche

        const fromDate = prevWeekStart.format('YYYY-MM-DD');
        const toDate = weekEnd.format('YYYY-MM-DD');

        const userIds = mitarbeiter.map((m) => m.user_id);

        const { data: planData, error: planError } = await supabase
          .from('v_tagesplan')
          .select('datum, user_id, ist_schichtart_id')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .in('user_id', userIds)
          .gte('datum', fromDate)
          .lte('datum', toDate);

        if (planError) throw planError;

        // Schichtarten inkl. Farben
        const { data: schichtData, error: schichtError } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, farbe_bg, farbe_text')
          .eq('firma_id', firma)
          .eq('unit_id', unit);

        if (schichtError) throw schichtError;

        const schichtMap = new Map();
        const colorMap = {};

        (schichtData || []).forEach((s) => {
          schichtMap.set(s.id, s.kuerzel);
          if (s.kuerzel) {
            colorMap[s.kuerzel] = {
              bg: s.farbe_bg || '#9ca3af',
              text: s.farbe_text || '#111827',
            };
          }
        });

        setSchichtFarben(colorMap);

        const result = {};

        const ensureUser = (userId) => {
          if (!result[userId]) {
            result[userId] = {
              prevWeekCodes: Array(7).fill('-'),
              currWeekCodes: Array(7).fill('-'),
              countU: 0,
              countK: 0,
            };
          }
          return result[userId];
        };

        (planData || []).forEach((row) => {
          const userId = row.user_id;
          const datum = dayjs(row.datum);
          const code =
            row.ist_schichtart_id != null
              ? schichtMap.get(row.ist_schichtart_id) || '-'
              : '-';

          const info = ensureUser(userId);

          // Vorwoche
          if (
            datum.isSameOrAfter(prevWeekStart, 'day') &&
            datum.isSameOrBefore(prevWeekEnd, 'day')
          ) {
            const idx = datum.diff(prevWeekStart, 'day'); // 0..6
            if (idx >= 0 && idx < 7) {
              info.prevWeekCodes[idx] = code || '-';
            }
          }

          // aktuelle Woche
          if (
            datum.isSameOrAfter(weekStart, 'day') &&
            datum.isSameOrBefore(weekEnd, 'day')
          ) {
            const idx = datum.diff(weekStart, 'day'); // 0..6
            if (idx >= 0 && idx < 7) {
              info.currWeekCodes[idx] = code || '-';
            }

            if (code === 'U') {
              info.countU += 1;
            }
            if (code === 'K' || code === 'KO') {
              info.countK += 1;
            }
          }
        });

        // weg-sortieren, wenn in aktueller KW >4 U oder >4 K/KO
        Object.keys(result).forEach((userId) => {
          const entry = result[userId];
          const countU = entry.countU || 0;
          const countK = entry.countK || 0;
          entry.awayFullWeek = countU > 4 || countK > 4;
        });

        setWochenDaten(result);
      } catch (err) {
        console.error('Fehler beim Laden der Wochen-Daten:', err);
        setWochenDaten({});
      }
    };

    ladeWochenDaten();
  }, [firma, unit, jahr, kw, mitarbeiter]);

// --- Overrides für das Planungsboard (startDatum–endDatum) ---
// Hier holen wir Einträge aus DB_Kampfliste (U, K, KO, F, S, N, ...),
// damit Ausnahmen das Standard-F/S/N-Muster pro Tag überschreiben.
useEffect(() => {
  const ladeBoardPlan = async () => {
    if (!firma || !unit || mitarbeiter.length === 0) {
      setBoardPlan({});
      return;
    }

    try {
      const fromDate = startDatum.format('YYYY-MM-DD');
      const toDate = endDatum.format('YYYY-MM-DD');
      const userIds = mitarbeiter.map((m) => m.user_id);

      // 1) Kampfliste für den Planungszeitraum laden
      const { data: kampfData, error: kampfError } = await supabase
        .from('DB_Kampfliste')
        .select('datum, user, ist_schicht')             // ⬅️ user statt user_id
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user', userIds)                            // ⬅️ in('user', ...)
        .gte('datum', fromDate)
        .lte('datum', toDate);

      if (kampfError) throw kampfError;

      // 2) Schichtarten → Kürzel (F, S, N, U, K, KO, ...)
      const { data: schichtData, error: schichtError } = await supabase
        .from('DB_SchichtArt')
        .select('id, kuerzel')
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (schichtError) throw schichtError;

      const schichtMap = new Map();
      (schichtData || []).forEach((s) => {
        schichtMap.set(s.id, s.kuerzel);
      });

      const map = {};

      (kampfData || []).forEach((row) => {
        const uid = row.user;                           // ⬅️ row.user statt row.user_id

        let code = '-';

        if (row.ist_schicht != null) {
          // 1. Versuch: ID → Kürzel aus DB_SchichtArt
          const mapped = schichtMap.get(row.ist_schicht);

          // Wenn in DB_SchichtArt gefunden → mapped (z. B. 'U')
          // Wenn nicht gefunden → Rohwert aus DB_Kampfliste nehmen (falls dort direkt ein Kürzel steht)
          if (mapped != null && mapped !== '') {
            code = mapped;
          } else {
            code = row.ist_schicht || '-';
          }
        }

        const dateStr = dayjs(row.datum).format('YYYY-MM-DD');

        if (!map[uid]) map[uid] = {};
        map[uid][dateStr] = code;
      });

      // Optional zum Testen:
      // console.log('BoardPlan Debug:', { fromDate, toDate, kampfData, map });

      setBoardPlan(map);
    } catch (err) {
      console.error('Fehler beim Laden des Board-Plans (DB_Kampfliste):', err);
      setBoardPlan({});
    }
  };

  ladeBoardPlan();
}, [firma, unit, startDatum, endDatum, mitarbeiter]);

  // --- Bedarf für den Planungszeitraum laden (DB_Bedarf + Quali-Matrix) ---
  useEffect(() => {
    const ladeBedarf = async () => {
      if (!firma || !unit) {
        setBedarfStatus({ F: {}, S: {}, N: {} });
        setMatrixMap({});
        return;
      }

      try {
        const fromDate = startDatum.format('YYYY-MM-DD');
        const toDate = endDatum.format('YYYY-MM-DD');

        // 1) Bedarfs-Einträge
        const { data: bedarf, error: bedarfErr } = await supabase
          .from('DB_Bedarf')
          .select(
            'quali_id, anzahl, von, bis, namebedarf, normalbetrieb, schichtart, start_schicht, end_schicht, betriebsmodus, wochen_tage'
          )
          .eq('firma_id', firma)
          .eq('unit_id', unit);

        if (bedarfErr) throw bedarfErr;

        // 2) Qualifikationsmatrix (Kürzel, Position, relevant)
        const { data: qualiMatrix, error: matrixErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, quali_kuerzel, betriebs_relevant, position')
          .eq('firma_id', firma)
          .eq('unit_id', unit);

        if (matrixErr) throw matrixErr;

        const mMap = {};
        (qualiMatrix || []).forEach((q) => {
          mMap[q.id] = {
            kuerzel: q.quali_kuerzel,
            relevant: q.betriebs_relevant !== false,
            position: q.position ?? 999,
          };
        });
        setMatrixMap(mMap);

        // 3) Pro Tag & Schicht den Bedarf vorberechnen
        const status = { F: {}, S: {}, N: {} };
        const totalDays = endDatum.diff(startDatum, 'day') + 1;

        for (let offset = 0; offset < totalDays; offset++) {
          const d = startDatum.add(offset, 'day');
          const dStr = d.format('YYYY-MM-DD');

          ['F', 'S', 'N'].forEach((schKey) => {
            const bedarfTag = (bedarf || []).filter(
              (b) => (!b.von || dStr >= b.von) && (!b.bis || dStr <= b.bis)
            );

            const bedarfTagSchicht = bedarfTag.filter((b) =>
              bedarfGiltFuerSchicht(b, dStr, schKey)
            );

            // Zeitlich begrenzt überschreibt Normalbetrieb
            const hatZeitlich = bedarfTagSchicht.some(
              (b) => b.normalbetrieb === false
            );
            const bedarfHeute = bedarfTagSchicht.filter(
              (b) => b.normalbetrieb === !hatZeitlich
            );

            const items = bedarfHeute
              .map((b) => ({
                quali_id: b.quali_id,
                anzahl: Number(b.anzahl || 0),
                kuerzel: mMap[b.quali_id]?.kuerzel || '???',
                relevant: mMap[b.quali_id]?.relevant !== false,
                position: mMap[b.quali_id]?.position ?? 999,
                namebedarf: b.namebedarf || '',
              }))
              .filter((x) => x.relevant)
              .sort((a, b) => a.position - b.position);

            const total = items.reduce((sum, it) => sum + it.anzahl, 0);

            status[schKey][dStr] = {
              total,
              items, // [{quali_id, kuerzel, anzahl, ...}]
            };
          });
        }

        setBedarfStatus(status);
      } catch (e) {
        console.error('Fehler beim Laden des Bedarfs für den WochenPlaner:', e);
        setBedarfStatus({ F: {}, S: {}, N: {} });
        setMatrixMap({});
      }
    };

    ladeBedarf();
  }, [firma, unit, startDatum, endDatum]);

  // --- Zuweisungen für das Board laden ---
  useEffect(() => {
    const ladeZuweisungen = async () => {
      if (
        !firma ||
        !unit ||
        !config ||
        !config.F ||
        !config.S ||
        !config.N
      ) {
        setZuweisungen({});
        return;
      }

      try {
        const firstWeekStart = startDatum;
        const lastWeekEnd = startDatum.add(anzahlWochen * 7 - 1, 'day');

        const { data, error } = await supabase
          .from('DB_SchichtZuweisung')
          .select('user_id, schichtgruppe, von_datum, position_ingruppe')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .gte('von_datum', firstWeekStart.format('YYYY-MM-DD'))
          .lte('von_datum', lastWeekEnd.format('YYYY-MM-DD'))
          .order('von_datum', { ascending: true })
          .order('position_ingruppe', { ascending: true });

        if (error) throw error;

        const map = {};

        (data || []).forEach((row) => {
          const weekStart = dayjs(row.von_datum);
          const weekIndex = weekStart.diff(firstWeekStart, 'week');
          if (weekIndex < 0 || weekIndex >= anzahlWochen) return;

          let shiftCode = null;
          if (row.schichtgruppe === config.F) shiftCode = 'F';
          else if (row.schichtgruppe === config.S) shiftCode = 'S';
          else if (row.schichtgruppe === config.N) shiftCode = 'N';
          else return;

          const key = `${weekIndex}_${shiftCode}`;
          if (!map[key]) map[key] = [];
          if (!map[key].includes(row.user_id)) {
            map[key].push(row.user_id);
          }
        });

        setZuweisungen(map);
      } catch (e) {
        console.error('Fehler beim Laden der Schichtzuweisungen:', e);
        setZuweisungen({});
      }
    };

    ladeZuweisungen();
  }, [firma, unit, startDatum, anzahlWochen, config]);

// Hilfsfunktion: User in Ziel-Slot eintragen, dabei sicherstellen,
// dass er in dieser KW nur in genau einer Schicht steht.
const assignUserToSlot = (prev, weekIndex, shiftCode, userId) => {
  if (!userId) return prev;

  const next = { ...prev };

  // User aus allen Schichten dieser KW entfernen
  Object.keys(next).forEach((key) => {
    const [wStr] = key.split('_');
    if (Number(wStr) === weekIndex) {
      next[key] = (next[key] || []).filter((id) => id !== userId);
    }
  });

  // In Ziel-Schicht/KW eintragen
  const targetKey = `${weekIndex}_${shiftCode}`;
  const current = next[targetKey] || [];
  if (!current.includes(userId)) {
    next[targetKey] = [...current, userId];
  }

  return next;
};

  // Hilfsfunktion: Mitarbeiter zuweisen / entfernen
// Hilfsfunktion: Mitarbeiter in eine Schicht/Woche hinzufügen
const handleZuweisung = (weekIndex, shiftCode, userId) => {
  if (!userId) return;
  setZuweisungen((prev) => assignUserToSlot(prev, weekIndex, shiftCode, userId));
};


  const handleEntfernen = (weekIndex, shiftCode, userId) => {
    const key = `${weekIndex}_${shiftCode}`;
    setZuweisungen((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.filter((id) => id !== userId),
      };
    });
  };

  // Für jeden User: in wie vielen Wochen ist er eingeplant?
  const assignedWeeksByUser = useMemo(() => {
    const map = {};
    Object.entries(zuweisungen).forEach(([key, userIds]) => {
      const [weekIndexStr] = key.split('_');
      const weekIndex = Number(weekIndexStr);
      (userIds || []).forEach((uid) => {
        if (!map[uid]) map[uid] = new Set();
        map[uid].add(weekIndex);
      });
    });
    return map;
  }, [zuweisungen]);

// Mitarbeiter + WeekInfos kombinieren
const mitarbeiterMitInfo = useMemo(() => {
  return mitarbeiter.map((m) => {
    const info = wochenDaten[m.user_id] || {};
    const weekSet = assignedWeeksByUser[m.user_id];
    const assignedWeeks = weekSet ? weekSet.size : 0;

    // 🔥 NEU: pro Woche im Zeitraum ein Flag (true/false),
    // ob der MA in dieser Woche im Board zugewiesen ist
    const assignedWeeksFlags = Array(anzahlWochen).fill(false);
    if (weekSet) {
      weekSet.forEach((wi) => {
        if (wi >= 0 && wi < anzahlWochen) {
          assignedWeeksFlags[wi] = true;
        }
      });
    }

    const qualiCount = m.qualis?.length || 0;
    const qualiRoman = qualiCount > 0 ? toRoman(qualiCount) : '';

    return {
      ...m,
      weekPrevCodes: info.prevWeekCodes || null,
      weekCodes: info.currWeekCodes || null, // aktuelle KW
      awayFullWeek: !!info.awayFullWeek,
      qualiCount,
      qualiRoman,
      isTeamLeader: m.rolle === 'Team_Leader',
      debugU: info.countU || 0,
      debugK: info.countK || 0,
      assignedWeeks,
      assignedWeeksFlags, // 🔥 wichtig fürs Badge!
    };
  });
}, [mitarbeiter, wochenDaten, assignedWeeksByUser, anzahlWochen]);

  // Sortierung: oben Team_Leader + viele Qualis, unten Urlaub/Krank
  const sortierteMitarbeiter = useMemo(() => {
    const list = [...mitarbeiterMitInfo];
    list.sort((a, b) => {
      if (a.awayFullWeek !== b.awayFullWeek) {
        return a.awayFullWeek ? 1 : -1;
      }
      if (a.isTeamLeader !== b.isTeamLeader) {
        return a.isTeamLeader ? -1 : 1;
      }
      if (a.qualiCount !== b.qualiCount) {
        return b.qualiCount - a.qualiCount;
      }
      const nameA = `${a.nachname} ${a.vorname}`.toLowerCase();
      const nameB = `${b.nachname} ${b.vorname}`.toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
    return list;
  }, [mitarbeiterMitInfo]);

  const oben = sortierteMitarbeiter.filter((m) => !m.awayFullWeek);
  const unten = sortierteMitarbeiter.filter((m) => m.awayFullWeek);

  return (
    <div className="p-4 space-y-4 ">
     
{/* Kopfbereich */}
<WochenPlanerHeader
  jahr={jahr}
  setJahr={setJahr}
  anzahlWochen={anzahlWochen}
  setAnzahlWochen={setAnzahlWochen}
  zeitraumLabel={zeitraumLabel}
  onOpenConfig={() => setConfigModalOpen(true)}
/>
      {/* KW-Auswahl */}
<KWSelector
  jahr={jahr}
  kw={kw}
  setKw={setKw}
  anzahlWochen={anzahlWochen}
/>
{feedback && (
  <div
    className={
      'text-xs px-2 py-1 rounded border ' +
      (feedback.type === 'error'
        ? 'bg-red-100 border-red-400 text-red-700 dark:bg-red-900/40 dark:text-red-200'
        : feedback.type === 'success'
        ? 'bg-green-100 border-green-400 text-green-700 dark:bg-green-900/40 dark:text-green-200'
        : 'bg-blue-100 border-blue-400 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200')
    }
  >
    {feedback.text}
  </div>
)}

      {/* Hauptbereich */}
    <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,320px),1fr] gap-4">
  {/* Links: Personalliste */}
  <WochenPlanerMitarbeiterListe
    firma={firma}
    unit={unit}
    loadingMitarbeiter={loadingMitarbeiter}
    errorMitarbeiter={errorMitarbeiter}
    oben={oben}
    unten={unten}
    schichtFarben={schichtFarben}
    anzahlWochen={anzahlWochen}
    selectedMitarbeiterId={selectedMitarbeiterId}
    setSelectedMitarbeiterId={setSelectedMitarbeiterId}
  />

        {/* Rechts: Planungsboard */}
        <div className="border shadow-xl border-gray-700 rounded-xl p-3 bg-gray-200 dark:bg-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-sm">Schicht-Planungsboard</h2>
            <span className="text-xs text-gray-500">
              Wochen:{' '}
              {wochenListe
                .map(
                  (w) =>
                    `KW ${w.isoWeek()} (${w.format('DD.MM.')}-${w
                      .add(6, 'day')
                      .format('DD.MM.')})`
                )
                .join(' · ')}
            </span>
          </div>

          {/* Kopfzeile: Wochen */}
          <div className="flex gap-2 text-[11px] font-semibold mb-1">
  <div className="w-24" />
  {wochenListe.map((w, idx) => (
    <div
      key={idx}
      className="basis-1/4 max-w-[25%] flex-none text-center"
    >
      KW {w.isoWeek()}
      <div className="text-[10px] font-normal">
        {w.format('DD.MM.')}–{w.add(6, 'day').format('DD.MM.')}
      </div>
    </div>
  ))}
</div>

          {/* Grid: Schichten × Wochen */}
<div className="space-y-2">
  {BASIS_SCHICHTEN.map((schicht) => (
    <div
      key={schicht.code}
      className="flex gap-2 items-stretch text-xs"
    >
      <div className="w-20 font-medium flex items-center">
        {schicht.label}
      </div>

      {wochenListe.map((w, weekIndex) => {
        const key = `${weekIndex}_${schicht.code}`;
        const assignedUserIds = zuweisungen[key] || [];

        return (
          <div
            key={weekIndex}
            className="basis-1/4 max-w-[23%] flex-none min-h-[72px] border-gray-900 border dark:border-gray-700 rounded-md bg-gray-900/70 p-1 flex flex-col gap-1"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const raw = e.dataTransfer.getData('text/plain');
              if (!raw) return;

              // aus der Liste gezogen
              if (raw.startsWith('list:')) {
                const uid = raw.split(':')[1];
                if (uid) {
                  setZuweisungen((prev) =>
                    assignUserToSlot(prev, weekIndex, schicht.code, uid)
                  );
                }
                return;
              }

              // aus dem Board gezogen (move)
              if (raw.startsWith('board:')) {
                const [, fromWeekStr, fromShiftCode, uid] = raw.split(':');
                const fromWeek = Number(fromWeekStr);
                if (!uid) return;

                setZuweisungen((prev) => {
                  let next = { ...prev };

                  // aus altem Slot entfernen
                  const fromKey = `${fromWeek}_${fromShiftCode}`;
                  const fromArr = next[fromKey] || [];
                  next[fromKey] = fromArr.filter((id) => id !== uid);

                  // im neuen Slot eintragen (inkl. „nur eine Schicht pro KW“)
                  next = assignUserToSlot(next, weekIndex, schicht.code, uid);

                  return next;
                });
              }
            }}
          >
            <div className="flex flex-col gap-1">
            {/* 🔥 Neue Bedarfszeile oberhalb der Mitarbeitenden */}
            <WochenPlanerBedarfZeile
              weekIndex={weekIndex}
              weekStart={w}
              schichtCode={schicht.code}
              basePattern={DEFAULT_PATTERN[schicht.code] || Array(7).fill(schicht.code)}
              bedarfStatus={bedarfStatus}
              mitarbeiterMitInfo={mitarbeiterMitInfo}
              zuweisungen={zuweisungen}
              boardPlan={boardPlan}
            />
              {assignedUserIds.map((uid) => {
                const ma = mitarbeiterMitInfo.find(
                  (m) => m.user_id === uid
                );
                if (!ma) return null;

                return (
                  <div
                    key={uid}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData(
                        'text/plain',
                        `board:${weekIndex}:${schicht.code}:${uid}`
                      );
                    }}
                    className="flex flex-col rounded-md bg-gray-800 px-1 py-0.5"
                  >
                    <div className="flex items-center justify-between gap-1">
  <div className="flex items-center text-gray-100 gap-1">
    <span className="truncate">
      {ma.nachname?.slice(0, 20)} {ma.vorname?.[0]}.
    </span>
  </div>

  <button
    type="button"
    onClick={() =>
      handleEntfernen(weekIndex, schicht.code, uid)
    }
    className="text-[10px] px-1 py-0.5 rounded bg-red-600 text-white hover:bg-red-500"
    title="Entfernen aus dieser Schicht/Woche"
  >
    x
  </button>
</div>


                    <div className="mt-0.5 flex gap-0.5">
                      {(() => {
  // Basis-Muster für diese Schicht (F-, S- oder N-Woche)
  const basePattern =
  DEFAULT_PATTERN[schicht.code] || Array(7).fill(schicht.code);

const overridesForUser = boardPlan[ma.user_id] || {};
const weekStart = w; // Startdatum dieser KW

return basePattern.map((baseCode, idx) => {
  const day = weekStart.add(idx, 'day');
  const dayStr = day.format('YYYY-MM-DD');

  const overrideCode = overridesForUser[dayStr];

  // null/undefined = kein Eintrag in der Kampfliste → wir nehmen das Basis-Muster
  const hasOverride = overrideCode !== undefined && overrideCode !== null;

  // Urlaub/Frei/Krank/... aus der Kampfliste haben Vorrang – auch wenn das '-'
  const finalCode = hasOverride ? overrideCode : baseCode;

  const isOverride = hasOverride && finalCode !== baseCode;

  const farbe = finalCode ? schichtFarben[finalCode] : null;

  const style = farbe
    ? {
        backgroundColor: farbe.bg || undefined,
        color: farbe.text || undefined,
      }
    : {};

  return (
    <span
      key={idx}
      style={style}
      className={
        'w-8 h-4 rounded-sm text-[10px] flex items-center justify-center bg-gray-500 text-gray-900 ' +
        (isOverride ? 'ring-1 ring-yellow-400/20' : 'opacity-90')
      }
      title={`Tag ${idx + 1} (${day.format('dd, DD.MM.')}): ${finalCode || '-'}`}
    >
      {finalCode || '-'}
    </span>
  );
});
})()}

                    </div>
                  </div>
                );
              })}
            </div>


          </div>
        );
      })}
    </div>
  ))}
</div>

          {/* Speichern-Button */}
          <div className="mt-5 flex justify-left">
           <button
  type="button"
  onClick={async () => {
    try {
      if (!firma || !unit) {
        setFeedback({
          type: 'error',
          text: 'Bitte zuerst Firma und Unit wählen.',
        });
        return;
      }
      if (!config || !config.F || !config.S || !config.N) {
        setFeedback({
          type: 'error',
          text: 'Bitte zuerst die Schichtgruppen-Konfiguration (Früh/Spät/Nacht) festlegen.',
        });
        return;
      }

      const today = dayjs().startOf('day');

      // ❌ Wochenplaner nur für die Zukunft
      if (startDatum.isBefore(today, 'day')) {
        setFeedback({
          type: 'error',
          text: 'Der WochenPlaner kann nur für zukünftige Wochen verwendet werden. Bitte eine KW ab nächster Woche wählen.',
        });
        return;
      }

      const neueZuweisungen = [];
      const betroffeneUser = new Set();

      // 1) Alle geplanten Zuweisungen aus dem Board einsammeln (nur Zukunft)
      Object.entries(zuweisungen).forEach(([key, userIds]) => {
        const [weekIndexStr, shiftCode] = key.split('_'); // F / S / N
        const weekIndex = Number(weekIndexStr);
        const weekStart = wochenListe[weekIndex];

        if (!weekStart) return;

        // Sicherheit: nur zukünftige Wochen
        if (weekStart.isBefore(today, 'day')) return;

        const weekEnd = weekStart.add(6, 'day');

        const schichtgruppe =
          shiftCode === 'F'
            ? config.F
            : shiftCode === 'S'
            ? config.S
            : config.N;

        if (!schichtgruppe) return;

        (userIds || []).forEach((userId, idx) => {
          neueZuweisungen.push({
            userId,
            schichtgruppe,
            weekStart,
            weekEnd,
            position: idx + 1,
          });
          betroffeneUser.add(userId);
        });
      });

      if (neueZuweisungen.length === 0) {
        setFeedback({
          type: 'info',
          text: 'Es wurden keine Schichtzuweisungen geändert.',
        });
        return;
      }

      const betroffeneUserIds = Array.from(betroffeneUser);

      // Gemeinsamer Zeitraum für diese Planung (nur Zukunft)
      const firstWeekStart = startDatum;
      const lastWeekEnd = endDatum;
      const firstStr = firstWeekStart.format('YYYY-MM-DD');
      const lastStr = lastWeekEnd.format('YYYY-MM-DD');

      // 2a) Langlaufende Zuweisungen "umschneiden":
      //     Alle Zuweisungen dieser User, die VOR dem Planungszeitraum beginnen,
      //     aber in den Planungszeitraum hineinreichen (bis null oder >= firstWeekStart)
      const { data: existingLong, error: existingLongErr } = await supabase
        .from('DB_SchichtZuweisung')
        .select('id, user_id, schichtgruppe, von_datum, bis_datum, position_ingruppe')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user_id', betroffeneUserIds)
        .lt('von_datum', firstStr)
        .or(`bis_datum.is.null,bis_datum.gte.${firstStr}`);

      if (existingLongErr) {
        console.error('Fehler beim Laden bestehender Langläufer-Zuweisungen:', existingLongErr);
        setFeedback({
          type: 'error',
          text: 'Bestehende Schichtzuweisungen konnten nicht vorbereitet werden.',
        });
        return;
      }

      const extraNachPlan = [];

      // Diese Langläufer so schneiden, dass sie nur VOR dem Planungszeitraum gelten
      for (const row of existingLong || []) {
        const oldVon = dayjs(row.von_datum);
        const oldBis = row.bis_datum ? dayjs(row.bis_datum) : null;

        // Falls die alte Zuweisung sowieso vor dem Zeitraum endet, nichts tun
        if (oldBis && oldBis.isBefore(firstWeekStart, 'day')) {
          continue;
        }

        // 2a-1) Alt-Eintrag: bis_datum auf Tag vor firstWeekStart setzen
        const newBis = firstWeekStart.subtract(1, 'day').format('YYYY-MM-DD');

        const { error: cutErr } = await supabase
          .from('DB_SchichtZuweisung')
          .update({ bis_datum: newBis })
          .eq('id', row.id);

        if (cutErr) {
          console.error('Fehler beim Kürzen einer bestehenden Zuweisung:', cutErr);
          setFeedback({
            type: 'error',
            text: 'Bestehende Schichtzuweisungen konnten nicht angepasst werden.',
          });
          return;
        }

        // 2a-2) Wenn die alte Zuweisung NACH dem Planungszeitraum weitergehen sollte,
        //        legen wir eine "Fortsetzung" ab dem Tag nach lastWeekEnd an.
        const brauchtFortsetzung =
          !oldBis || oldBis.isAfter(lastWeekEnd, 'day');

        if (brauchtFortsetzung) {
          extraNachPlan.push({
            firma_id: firma,
            unit_id: unit,
            user_id: row.user_id,
            schichtgruppe: row.schichtgruppe,
            von_datum: lastWeekEnd.add(1, 'day').format('YYYY-MM-DD'),
            bis_datum: oldBis ? oldBis.format('YYYY-MM-DD') : null,
            position_ingruppe: row.position_ingruppe,
            created_by: currentUserId,
          });
        }
      }

      // 2b) Alte Einträge für diese User IM geplanten Zeitraum löschen
      const { error: deleteError } = await supabase
        .from('DB_SchichtZuweisung')
        .delete()
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user_id', betroffeneUserIds)
        .gte('von_datum', firstStr)
        .lte('von_datum', lastStr);

      if (deleteError) {
        console.error('Fehler beim Löschen alter Schichtzuweisungen:', deleteError);
        setFeedback({
          type: 'error',
          text: 'Alte Schichtzuweisungen konnten nicht entfernt werden.',
        });
        return;
      }

      // 3) Neue Zuweisungen F/S/N aus dem WochenPlaner eintragen (innerhalb des Zeitraums)
      const payload = neueZuweisungen.map((z) => ({
        firma_id: firma,
        unit_id: unit,
        user_id: z.userId,
        schichtgruppe: z.schichtgruppe,
        von_datum: z.weekStart.format('YYYY-MM-DD'),
        bis_datum: z.weekEnd.format('YYYY-MM-DD'),
        position_ingruppe: z.position,
        created_by: currentUserId,
      }));

      const insertPayload = [...payload, ...extraNachPlan];

      const { error: insertError } = await supabase
        .from('DB_SchichtZuweisung')
        .insert(insertPayload);

      if (insertError) {
        console.error('Fehler beim Speichern DB_SchichtZuweisung:', insertError);
        setFeedback({
          type: 'error',
          text: 'Fehler beim Speichern der Schichtzuweisungen.',
        });
      } else {
        setFeedback({
          type: 'success',
          text: 'Schichtzuweisungen gespeichert (Langläufer wurden geschnitten, neue Wochen gesetzt).',
        });
      }
    } catch (e) {
      console.error('Speicherfehler:', e);
      setFeedback({
        type: 'error',
        text: 'Unerwarteter Fehler beim Speichern.',
      });
    }
  }}
  className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-500"
>
  Zuweisungen speichern
</button>

          </div>
        </div>
      </div>

      {/* Konfig-Modal */}
      <WochenPlanerConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        gruppen={gruppen}
        config={config}
        onSave={handleSaveConfig}
        loading={configSaving}
      />
    </div>
  );
};

export default WochenPlaner;
