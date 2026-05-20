// src/components/Dashboard/AnfragenMitarbeiterAnalyseModal.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { X, Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { speichernInKampfliste } from '../../utils/speichernInKampfliste';
import AMAMKandidatenliste from './AMAMKandidatenliste';

/* --------------------------- Helpers --------------------------- */

// 1 = genehmigt, -1 = abgelehnt, 0 = offen (robust)
const triStatus = (v) => {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 't' || v === 'TRUE' || v === 'T') return 1;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'f' || v === 'FALSE' || v === 'F') return -1;
  return 0;
};

const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { Früh: 0, Spät: 1, Nacht: 2 };

const isBetweenQualiDate = (row, datum) => {
  const d = dayjs(datum).startOf('day');
  const s = row?.quali_start ? dayjs(row.quali_start).startOf('day') : null;
  const e = row?.quali_endet ? dayjs(row.quali_endet).startOf('day') : null;
  if (s && d.isBefore(s)) return false;
  if (e && d.isAfter(e)) return false;
  return true;
};

const parseAntrag = (txt = '') => {
  const t = (txt || '').toLowerCase();

  if (t.includes('urlaub')) return { type: 'urlaub', label: 'Urlaub beantragt' };
  if (t.includes('freizeitausgleich')) return { type: 'freizeitausgleich', label: 'Freizeitausgleich beantragt' };
  if (t.includes('frei beantragt') || (t.includes('frei') && !t.includes('freiwillig')))
    return { type: 'frei', label: 'Frei beantragt' };

  if (t.includes('freiwillig') || t.includes('biete') || t.includes('einspring'))
    return { type: 'angebot', label: 'Freiwillig angeboten (einspringen)' };

  return { type: 'sonstiges', label: 'Antrag' };
};
  const istAngebotText = (txt = '') => {
    const t = String(txt || '').toLowerCase();

    return (
      t.includes('freiwillig') ||
      t.includes('biete') ||
      t.includes('einspring') ||
      t.includes('angeboten')
    );
  };
// Bedarf-Logik wie MitarbeiterBedarf (nur F/S/N)
const schichtInnerhalbGrenzen = (b, datumISO, schLabel) => {
  // Grenzen gelten nur für zeitlich begrenzt
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

  const schLabel = SCH_LABEL[schKey]; // Früh/Spät/Nacht

  // Wochenbetrieb nur für Normalbetrieb relevant
  if (b.normalbetrieb && b.betriebsmodus === 'wochenbetrieb') {
    const weekday = dayjs(datumISO).day(); // 0=So .. 6=Sa

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
          // Mo–Do: alles ok
        } else if (weekday === 5) {
          if (schLabel === 'Nacht') return false;
        } else {
          return false;
        }
        break;
      }
      default:
        break;
    }
  }

  if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

  // schichtart null => alle, sonst nur konkrete
  if (b.schichtart == null) return true;
  return b.schichtart === schLabel;
};

const fmtStd = (v) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
};
const timeToMinutes = (time) => {
  if (!time) return null;

  const [h, m] = String(time).split(':').map(Number);

  if (Number.isNaN(h) || Number.isNaN(m)) return null;

  return h * 60 + m;
};

const buildShiftInterval = (datumISO, startzeit, endzeit) => {
  const startMin = timeToMinutes(startzeit);
  const endMin = timeToMinutes(endzeit);

  if (startMin == null || endMin == null) return null;

  let start = dayjs(`${datumISO}T${String(startzeit).slice(0, 5)}:00`);
  let ende = dayjs(`${datumISO}T${String(endzeit).slice(0, 5)}:00`);

  // Nachtschicht / tagübergreifend
  if (endMin <= startMin) {
    ende = ende.add(1, 'day');
  }

  return { start, ende };
};
const Badge = ({ children }) => (
  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
    {children}
  </span>
);

/* --------------------------- Ampel UI --------------------------- */

const AmpelDot = ({ title, color }) => (
  <div
    title={title}
    className="w-4 h-4 rounded-full border border-gray-400 dark:border-gray-600"
    style={{ backgroundColor: color }}
  />
);

const ampelColor = (s) => {
  // s: 'red' | 'green' | 'darkgreen' | 'grey'
  if (s === 'red') return '#EF4444';
  if (s === 'green') return '#34D399';
  if (s === 'darkgreen') return '#047857';
  return '#9CA3AF';
};

/* --------------------------- Component --------------------------- */
export default function AnfragenMitarbeiterAnalyseModal({
  offen,
  onClose,
  anfrage,
  gruppenAnfragen = [],
  firmaId,
  unitId,
  verantwortlicherUserId,
  onSaved,
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aktiveAnfrage, setAktiveAnfrage] = useState(anfrage);
  const [analyseGeladen, setAnalyseGeladen] = useState(false);

  useEffect(() => {
    setAktiveAnfrage(anfrage);
    setAnalyseGeladen(false);
    setEntscheidung(null);
    setKommentar('');
    setKandidatZugesagt(false);
    setAndereAngeboteAblehnen(false);
  }, [anfrage]);

  const [ruhezeitLoading, setRuhezeitLoading] = useState(false);
  const [ruhezeitCheck, setRuhezeitCheck] = useState(null);
  const [urlaubRestAktuell, setUrlaubRestAktuell] = useState(null);

  const [offeneUrlaubsantraege, setOffeneUrlaubsantraege] = useState(0);
  const [urlaubLoading, setUrlaubLoading] = useState(false);

  const [stundenAktuell, setStundenAktuell] = useState(null);
  const [stundenNachGenehmigung, setStundenNachGenehmigung] = useState(null);
  const [stundenLoading, setStundenLoading] = useState(false);

  // Analyse-Daten
  const [userPlan7, setUserPlan7] = useState([]);        // 7-Tage Plan (nur Antragsteller)
  const [besetzung, setBesetzung] = useState([]);        // Personen am Tag (für beantragte Schicht)
  const [matrix, setMatrix] = useState([]);              // Qualifikationsmatrix
  const [userQualis, setUserQualis] = useState([]);      // Qualis für Personen (für Besetzung-Liste)
  const [requestedArt, setRequestedArt] = useState(null);// SchichtArt aus anfrage.schicht inkl Farben

  // Für Ampel: alle Schichten F/S/N am Tag
  const [bedarfRows, setBedarfRows] = useState([]);      // DB_Bedarf
  const [qualiMatrix, setQualiMatrix] = useState([]);    // DB_Qualifikationsmatrix
  const [dayAssignments, setDayAssignments] = useState({ F: [], S: [], N: [] }); // userIds pro Schicht
  const [dayQualis, setDayQualis] = useState([]);        // DB_Qualifikation für alle Day-UserIds
  const [requesterQualis, setRequesterQualis] = useState([]);

  // Genehmigungsteil
  const [entscheidung, setEntscheidung] = useState(null);
  const [kommentar, setKommentar] = useState('');
  const [kandidatZugesagt, setKandidatZugesagt] = useState(false);
  const [andereAngeboteAblehnen, setAndereAngeboteAblehnen] = useState(false);

  const basisAnfrage = aktiveAnfrage || anfrage;
  const gruppenOhneAuswahl = !!basisAnfrage?._gruppeNichtAusgewaehlt;
  const hatAusgewaehltenMitarbeiter =
  !!basisAnfrage?.created_by && !gruppenOhneAuswahl;

  const datum = basisAnfrage?.datum
    ? dayjs(basisAnfrage.datum).format('YYYY-MM-DD')
    : null;

  const schichtKuerzel = (basisAnfrage?.schicht || '').trim();

  const antragInfo = useMemo(
    () => parseAntrag(basisAnfrage?.antrag),
    [basisAnfrage?.antrag]
  );
const istFreizeitausgleichFall = antragInfo.type === 'freizeitausgleich';
const istUrlaubsFall = antragInfo.type === 'urlaub';

const istEinspringKandidat =
  antragInfo.type === 'angebot' ||
  (basisAnfrage?._nurKandidat && !istFreizeitausgleichFall && !istUrlaubsFall);

  const istAngebotsKontext =
    antragInfo.type === 'angebot' ||
    basisAnfrage?.gruppenTyp === 'angebot' ||
    basisAnfrage?._fairnessModus === 'einspringen';
  
    const andereOffeneAngebote = useMemo(() => {
    if (!istAngebotsKontext) return [];

    return (gruppenAnfragen || []).filter((a) => {
      if (!a?.id) return false;

      // Den aktuell ausgewählten echten Antrag nicht mitzählen
      if (!basisAnfrage?._nurKandidat && basisAnfrage?.id && a.id === basisAnfrage.id) {
        return false;
      }

      const info = parseAntrag(a.antrag);
      const s = triStatus(a.genehmigt);
      const istOffen = s === 0 && a.datum_entscheid == null;

      return info.type === 'angebot' && istOffen;
    });
  }, [
    istAngebotsKontext,
    gruppenAnfragen,
    basisAnfrage?.id,
    basisAnfrage?._nurKandidat,
  ]);

  const anzahlAndereOffeneAngebote = andereOffeneAngebote.length;

  // Range für 7 Tage
  const range = useMemo(() => {
    if (!datum) return null;
    const from = dayjs(datum).subtract(3, 'day').format('YYYY-MM-DD');
    const to = dayjs(datum).add(3, 'day').format('YYYY-MM-DD');
    return { from, to };
  }, [datum]);

  // Matrix Maps
  const matrixById = useMemo(() => {
    const m = new Map();
    (matrix || []).forEach((q) => m.set(q.id, q));
    return m;
  }, [matrix]);

  const qualiMatrixMap = useMemo(() => {
    const m = {};
    (qualiMatrix || []).forEach((q) => {
      m[q.id] = {
        kuerzel: q.quali_kuerzel,
        relevant: q.betriebs_relevant,
        position: q.position ?? 999,
        aktiv: q.aktiv !== false,
      };
    });
    return m;
  }, [qualiMatrix]);

  // Qualis gruppiert (für Besetzung-Liste)
  const qualisByUser = useMemo(() => {
    const map = new Map();
    (userQualis || []).forEach((q) => {
      if (!q.user_id) return;
      const arr = map.get(q.user_id) || [];
      arr.push(q);
      map.set(q.user_id, arr);
    });
    return map;
  }, [userQualis]);

  // Besetzung sortiert nach Priorität (kleinste Position oben)
  const besetzungSorted = useMemo(() => {
    if (!datum) return [];
    const rows = (besetzung || []).map((r) => {
      const qs = (qualisByUser.get(r.user) || [])
        .filter((q) => isBetweenQualiDate(q, datum))
        .map((q) => matrixById.get(q.quali))
        .filter(Boolean)
        .filter((x) => x.aktiv !== false);

      const bestPos = qs.length ? Math.min(...qs.map((x) => Number(x.position ?? 9999))) : 9999;
      const badges = qs
        .slice()
        .sort((a, b) => Number(a.position ?? 9999) - Number(b.position ?? 9999))
        .map((x) => x.quali_kuerzel || x.qualifikation || '?');

      return { ...r, bestPos, badges };
    });

    return rows.sort((a, b) => a.bestPos - b.bestPos);
  }, [besetzung, qualisByUser, matrixById, datum]);

  const kandidatHinweisTitel = useMemo(() => {
  if (!basisAnfrage?._nurKandidat) return null;

  if (istFreizeitausgleichFall) {
    return 'Mitarbeiter hat keinen eigenen Freizeitausgleich beantragt';
  }

  if (istUrlaubsFall) {
    return 'Mitarbeiter hat keinen eigenen Urlaubsantrag gestellt';
  }

  return 'Mitarbeiter hat sich nicht angeboten';
}, [basisAnfrage?._nurKandidat, istFreizeitausgleichFall, istUrlaubsFall]);

const kandidatHinweisText = useMemo(() => {
  if (!basisAnfrage?._nurKandidat) return null;

  if (istFreizeitausgleichFall) {
    return 'Dieser Mitarbeiter wird aus Fairnessgründen angezeigt, weil er ebenfalls viele Stunden hat und aus dieser Schicht fachlich entfallen könnte. Bitte vorher mit dem Mitarbeiter klären.';
  }

  if (istUrlaubsFall) {
    return 'Dieser Mitarbeiter wird aus Fairnessgründen angezeigt. Bitte vorher klären, ob die Freigabe wirklich gewünscht und organisatorisch möglich ist.';
  }

  return 'Dieser Mitarbeiter ist nur als geeigneter Kandidat vorgeschlagen. Er muss bitte vorher gefragt werden und ausdrücklich zusagen.';
}, [basisAnfrage?._nurKandidat, istFreizeitausgleichFall, istUrlaubsFall]);

const kandidatCheckboxText = useMemo(() => {
  if (istFreizeitausgleichFall) {
    return 'Ja, der Mitarbeiter wurde gefragt und hat dem Freizeitausgleich für diese Schicht ausdrücklich zugestimmt.';
  }

  if (istUrlaubsFall) {
    return 'Ja, der Mitarbeiter wurde gefragt und die Urlaubsfreigabe wurde ausdrücklich abgestimmt.';
  }

  return 'Ja, der Mitarbeiter wurde gefragt und hat der Übernahme dieser Schicht ausdrücklich zugesagt.';
}, [istFreizeitausgleichFall, istUrlaubsFall]);

  // Style für "Beantragt"-Box
  const beantragtBoxStyle = useMemo(() => {
    if (antragInfo?.type === 'urlaub' || antragInfo?.type === 'freizeitausgleich') {
      return { backgroundColor: '#FDE047', color: '#000000' };
    }
    if (antragInfo?.type === 'angebot' && requestedArt?.farbe_bg) {
      return {
        backgroundColor: requestedArt.farbe_bg,
        color: requestedArt.farbe_text || '#000000',
      };
    }
    return null;
  }, [antragInfo?.type, requestedArt?.farbe_bg, requestedArt?.farbe_text]);
    const schKey = useMemo(() => {
      const k = (schichtKuerzel || '').trim().toUpperCase();
      return (k === 'F' || k === 'S' || k === 'N') ? k : null;
    }, [schichtKuerzel]);

    useEffect(() => {
        if (!offen) return;

        setUrlaubRestAktuell(null);
        setOffeneUrlaubsantraege(0);
        setUrlaubLoading(false);

        setStundenAktuell(null);
        setStundenNachGenehmigung(null);
        setStundenLoading(false);
      }, [offen, anfrage?.id]);

  /* --------------------------- LOAD --------------------------- */
    useEffect(() => {
      if (!offen || !basisAnfrage || !firmaId || !unitId || !datum) return;

      const load = async () => {
        setLoading(true);
        setAnalyseGeladen(false);

        try {
        /* A) Qualifikationsmatrix (für Besetzung-Anzeige) */
        const { data: mtx, error: mtxErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, quali_kuerzel, position, firma_id, unit_id, aktiv')
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId);

        if (mtxErr) throw mtxErr;
        setMatrix(mtx || []);

        /* B) Requested SchichtArt (aus anfrage.schicht) inkl. Farben */
        let reqArt = null;
        if (schichtKuerzel) {
          const { data: art, error: artErr } = await supabase
            .from('DB_SchichtArt')
            .select('id, kuerzel, startzeit, endzeit, dauer, pause_aktiv, pause_dauer, farbe_bg, farbe_text')
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId)
            .eq('kuerzel', schichtKuerzel)
            .maybeSingle();

          if (artErr) throw artErr;
          reqArt = art || null;
        }
        setRequestedArt(reqArt);

        /* C) 7-Tage Plan des ausgewählten Mitarbeiters (v_tagesplan) */
if (hatAusgewaehltenMitarbeiter && range?.from && range?.to) {
  const { data: plan, error: planErr } = await supabase
    .from('v_tagesplan')
    .select(
      'datum, user_id, soll_schichtart_id, soll_startzeit, soll_endzeit, ist_schichtart_id, ist_startzeit, ist_endzeit, hat_aenderung, kommentar'
    )
    .eq('firma_id', firmaId)
    .eq('unit_id', unitId)
    .eq('user_id', basisAnfrage.created_by)
    .gte('datum', range.from)
    .lte('datum', range.to);

  if (planErr) throw planErr;

  const ids = [
    ...new Set(
      (plan || [])
        .flatMap((p) => [p.ist_schichtart_id, p.soll_schichtart_id])
        .filter(Boolean)
    ),
  ];

  let artsById = new Map();

  if (ids.length) {
    const { data: arts, error: artsErr } = await supabase
      .from('DB_SchichtArt')
      .select('id, kuerzel, startzeit, endzeit, farbe_bg, farbe_text')
      .in('id', ids)
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId);

    if (artsErr) throw artsErr;

    (arts || []).forEach((a) => artsById.set(a.id, a));
  }

  const plan7 = (plan || []).map((p) => {
    const useIst = !!p.ist_schichtart_id;
    const schichtId = useIst ? p.ist_schichtart_id : p.soll_schichtart_id;
    const art = artsById.get(schichtId);

    const start = useIst
      ? (p.ist_startzeit || art?.startzeit)
      : (p.soll_startzeit || art?.startzeit);

    const ende = useIst
      ? (p.ist_endzeit || art?.endzeit)
      : (p.soll_endzeit || art?.endzeit);

    return {
      datum: p.datum,
      kuerzel: art?.kuerzel || '—',
      start: start || '',
      ende: ende || '',
      bg: art?.farbe_bg || null,
      text: art?.farbe_text || null,
      hat_aenderung: p.hat_aenderung,
      kommentar: p.kommentar,
    };
  });

  setUserPlan7(plan7);
} else {
  setUserPlan7([]);
}

                /* F) Urlaubskontingent für Analyse-Modal */
        if (hatAusgewaehltenMitarbeiter && datum) {
          setUrlaubLoading(true);
          try {
            const jahr = dayjs(datum).year();
            const jahrStart = `${jahr}-01-01`;
            const jahrEnde = `${jahr}-12-31`;

            const [{ data: urlaubData, error: urlaubErr }, { data: offeneData, error: offeneErr }] =
              await Promise.all([
                supabase
                  .from('DB_Urlaub')
                  .select('urlaub_gesamt, summe_jahr')
                  .eq('user_id', basisAnfrage.created_by)
                  .eq('jahr', jahr)
                  .maybeSingle(),

                supabase
                  .from('DB_AnfrageMA')
                  .select('id, datum, antrag, genehmigt, datum_entscheid')
                  .eq('created_by', basisAnfrage.created_by)
                  .eq('firma_id', firmaId)
                  .eq('unit_id', unitId)
                  .gte('datum', jahrStart)
                  .lte('datum', jahrEnde)
                  .is('genehmigt', null)
                  .is('datum_entscheid', null)
              ]);

            if (urlaubErr) throw urlaubErr;
            if (offeneErr) throw offeneErr;

            const urlaubGesamt = Number(urlaubData?.urlaub_gesamt ?? 0);
            const urlaubGenommen = Number(urlaubData?.summe_jahr ?? 0);
            const restAktuell = urlaubGesamt - urlaubGenommen;

            const offeneUrlaubeOhneDiesen = (offeneData || []).filter((r) => {
              if (r.id === basisAnfrage.id) return false;
              const txt = (r.antrag || '').toLowerCase();
              return txt.includes('urlaub');
            }).length;

            setUrlaubRestAktuell(restAktuell);
            setOffeneUrlaubsantraege(offeneUrlaubeOhneDiesen);
          } finally {
            setUrlaubLoading(false);
          }
        }
                /* G) Stundenkonto für Freizeitausgleich */
          if (
            hatAusgewaehltenMitarbeiter &&
            datum &&
            (antragInfo.type === 'freizeitausgleich' || istEinspringKandidat)
          ) {
          setStundenLoading(true);
          try {
            const jahr = dayjs(datum).year();

            const { data: stundenData, error: stundenErr } = await supabase
              .from('DB_Stunden')
              .select('vorgabe_stunden, summe_jahr, uebernahme_vorjahr')
              .eq('user_id', basisAnfrage.created_by)
              .eq('jahr', jahr)
              .maybeSingle();

            if (stundenErr) throw stundenErr;

            const vorgabe = Number(stundenData?.vorgabe_stunden ?? 0);
            const summeJahr = Number(stundenData?.summe_jahr ?? 0);
            const uebernahmeVorjahr = Number(stundenData?.uebernahme_vorjahr ?? 0);

            const aktuell = summeJahr + uebernahmeVorjahr - vorgabe;
            const schichtDauer = Number(requestedArt?.dauer ?? 0);

            const nachGenehmigung =
              istEinspringKandidat
                ? aktuell + schichtDauer
                : aktuell - schichtDauer;

            setStundenAktuell(aktuell);
            setStundenNachGenehmigung(nachGenehmigung);
          } finally {
            setStundenLoading(false);
          }
        }
        /* D) Tages-Plan für Ampel (F/S/N) + Besetzung (für beantragte Schicht) */
        const { data: dayRows, error: dayErr } = await supabase
          .from('v_tagesplan')
          .select('datum, user_id, ist_schichtart_id, soll_schichtart_id')
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId)
          .eq('datum', datum);

        if (dayErr) throw dayErr;

        // Alle SchichtArt IDs sammeln, um kuerzel zu mappen
        const dayIds = [
          ...new Set(
            (dayRows || [])
              .flatMap((r) => [r.ist_schichtart_id, r.soll_schichtart_id])
              .filter(Boolean)
          ),
        ];

        let dayArtsById = new Map();
        if (dayIds.length) {
          const { data: arts, error: artsErr } = await supabase
            .from('DB_SchichtArt')
            .select('id, kuerzel')
            .in('id', dayIds)
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId);

          if (artsErr) throw artsErr;
          (arts || []).forEach((a) => dayArtsById.set(a.id, a));
        }

        // Assignments je F/S/N
        const ass = { F: [], S: [], N: [] };
        const allUserIds = new Set();

        (dayRows || []).forEach((r) => {
          const useIst = !!r.ist_schichtart_id;
          const sid = useIst ? r.ist_schichtart_id : r.soll_schichtart_id;
          const ku = dayArtsById.get(sid)?.kuerzel;

          // nur F/S/N berücksichtigen
          if (ku === 'F' || ku === 'S' || ku === 'N') {
            ass[ku].push(r.user_id);
            allUserIds.add(r.user_id);
          }
        });

        setDayAssignments({
          F: [...new Set(ass.F)],
          S: [...new Set(ass.S)],
          N: [...new Set(ass.N)],
        });

        // Besetzung (Anzeige) – optional auf beantragte Schicht filtern
        const schichtArtId = reqArt?.id ?? null;

        const besFiltered = schichtArtId
          ? (dayRows || []).filter((r) => (r.ist_schichtart_id || r.soll_schichtart_id) === schichtArtId)
          : (dayRows || []);

        const besUserIds = [...new Set(besFiltered.map((b) => b.user_id).filter(Boolean))];

        // Namen holen (für Besetzung-Anzeige)
        let usersById = new Map();
        if (besUserIds.length) {
          const { data: users, error: uErr } = await supabase
            .from('DB_User')
            .select('user_id, vorname, nachname')
            .in('user_id', besUserIds);

          if (uErr) throw uErr;
          (users || []).forEach((u) => usersById.set(u.user_id, u));
        }

        setBesetzung(
          besUserIds.map((uid) => {
            const u = usersById.get(uid);
            return { id: `${uid}_${datum}`, user: uid, name: u ? `${u.vorname} ${u.nachname}` : '—' };
          })
        );

        // Qualis für Besetzung-Anzeige
        if (besUserIds.length) {
          const { data: q, error: qErr } = await supabase
            .from('DB_Qualifikation')
            .select('id, user_id, quali, quali_start, quali_endet')
            .in('user_id', besUserIds);

          if (qErr) throw qErr;
          setUserQualis(q || []);
        } else {
          setUserQualis([]);
        }

        /* E) Bedarf + Matrix + Qualis für Ampel (alle Day-User) */
        const [{ data: bedarf, error: bErr }, { data: qm, error: qmErr }] = await Promise.all([
          supabase
            .from('DB_Bedarf')
            .select('quali_id, anzahl, von, bis, namebedarf, farbe, normalbetrieb, schichtart, start_schicht, end_schicht, betriebsmodus, wochen_tage')
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId),
          supabase
            .from('DB_Qualifikationsmatrix')
            .select('id, quali_kuerzel, betriebs_relevant, position, aktiv')
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId),
        ]);

        if (bErr) throw bErr;
        if (qmErr) throw qmErr;

        setBedarfRows(bedarf || []);
        setQualiMatrix(qm || []);

        const dayUserIds = [...allUserIds];
        if (dayUserIds.length) {
          const { data: dq, error: dqErr } = await supabase
            .from('DB_Qualifikation')
            .select('id, user_id, quali, quali_start, quali_endet')
            .in('user_id', dayUserIds);

          if (dqErr) throw dqErr;
          setDayQualis(dq || []);
        } else {
          setDayQualis([]);
        }
// ✅ Qualis vom ausgewählten Mitarbeiter laden.
// Bei gebündelten Gruppen ohne Auswahl darf hier NICHT mit uuid null gesucht werden.
if (hatAusgewaehltenMitarbeiter) {
  const { data: rq, error: rqErr } = await supabase
    .from('DB_Qualifikation')
    .select('id, user_id, quali, quali_start, quali_endet')
    .eq('user_id', basisAnfrage.created_by);

  if (rqErr) throw rqErr;
  setRequesterQualis(rq || []);
} else {
  setRequesterQualis([]);
}

      } catch (e) {
        console.error('AnalyseModal load error:', e?.message || e);
      } finally {
        setLoading(false);
        setAnalyseGeladen(true);
      }
    };

    load();
  
    }, [
      offen,
      basisAnfrage,
      firmaId,
      unitId,
      datum,
      range?.from,
      range?.to,
      schichtKuerzel,
      antragInfo.type,
      istEinspringKandidat,
      requestedArt?.dauer,
    ]);
  

  /* --------------------------- Ruhezeitprüfung --------------------------- */
useEffect(() => {
  if (
    !offen ||
    !basisAnfrage?.created_by ||
    !datum ||
    !requestedArt?.startzeit ||
    !requestedArt?.endzeit
  ) {
    setRuhezeitCheck(null);
    return;
  }

  const pruefeRuhezeit = async () => {
    setRuhezeitLoading(true);

    try {
      const uid = basisAnfrage.created_by;

      const von = dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD');
      const bis = dayjs(datum).add(1, 'day').format('YYYY-MM-DD');

      const zielIntervall = buildShiftInterval(
        datum,
        requestedArt.startzeit,
        requestedArt.endzeit
      );

      if (!zielIntervall) {
        setRuhezeitCheck({
          ok: false,
          text: 'Ruhezeit konnte nicht geprüft werden.',
        });
        return;
      }

      const { data: planRows, error: planErr } = await supabase
        .from('v_tagesplan')
        .select(
          `
          datum,
          user_id,
          soll_schichtart_id,
          soll_startzeit,
          soll_endzeit,
          ist_schichtart_id,
          ist_startzeit,
          ist_endzeit
        `
        )
        .eq('firma_id', firmaId)
        .eq('unit_id', unitId)
        .eq('user_id', uid)
        .gte('datum', von)
        .lte('datum', bis);

      if (planErr) throw planErr;

      const ids = [
        ...new Set(
          (planRows || [])
            .flatMap((r) => [r.soll_schichtart_id, r.ist_schichtart_id])
            .filter(Boolean)
        ),
      ];

      let artsById = new Map();

      if (ids.length) {
        const { data: arts, error: artsErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, startzeit, endzeit')
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId)
          .in('id', ids);

        if (artsErr) throw artsErr;

        (arts || []).forEach((a) => {
          artsById.set(a.id, a);
        });
      }

      const vorhandeneIntervalle = [];

      (planRows || []).forEach((r) => {
        const rowDatum = dayjs(r.datum).format('YYYY-MM-DD');

        // Zieltag selbst ignorieren, weil dort die neue Schicht geprüft wird.
        if (rowDatum === datum) return;

        const useIst = !!r.ist_schichtart_id;
        const artId = useIst ? r.ist_schichtart_id : r.soll_schichtart_id;
        const art = artsById.get(artId);

        if (!art) return;

        // Nur echte Arbeitsschichten als Ruhezeit-relevant bewerten
        if (!['F', 'S', 'N'].includes(art.kuerzel)) return;

        const startzeit = useIst
          ? r.ist_startzeit || art.startzeit
          : r.soll_startzeit || art.startzeit;

        const endzeit = useIst
          ? r.ist_endzeit || art.endzeit
          : r.soll_endzeit || art.endzeit;

        const intervall = buildShiftInterval(rowDatum, startzeit, endzeit);

        if (intervall) {
          vorhandeneIntervalle.push(intervall);
        }
      });

      const letzteVorher = vorhandeneIntervalle
        .filter((x) => x.ende.isBefore(zielIntervall.start) || x.ende.isSame(zielIntervall.start))
        .sort((a, b) => b.ende.valueOf() - a.ende.valueOf())[0];

      const ersteNachher = vorhandeneIntervalle
        .filter((x) => x.start.isAfter(zielIntervall.ende) || x.start.isSame(zielIntervall.ende))
        .sort((a, b) => a.start.valueOf() - b.start.valueOf())[0];

      const stundenVorher = letzteVorher
        ? zielIntervall.start.diff(letzteVorher.ende, 'minute') / 60
        : null;

      const stundenNachher = ersteNachher
        ? ersteNachher.start.diff(zielIntervall.ende, 'minute') / 60
        : null;

      const vorherOk = stundenVorher == null || stundenVorher >= 11;
      const nachherOk = stundenNachher == null || stundenNachher >= 11;

      const ok = vorherOk && nachherOk;

      setRuhezeitCheck({
        ok,
        stundenVorher,
        stundenNachher,
        vorherOk,
        nachherOk,
        text: ok
          ? 'Ruhezeit erfüllt.'
          : 'Ruhezeit unter 11 Stunden. Genehmigung sollte nicht erfolgen.',
      });
    } catch (e) {
      console.error('Ruhezeitprüfung Fehler:', e?.message || e);

      setRuhezeitCheck({
        ok: false,
        text: 'Ruhezeitprüfung fehlgeschlagen.',
      });
    } finally {
      setRuhezeitLoading(false);
    }
  };

  pruefeRuhezeit();
}, [
  offen,
  basisAnfrage?.created_by,
  datum,
  requestedArt?.startzeit,
  requestedArt?.endzeit,
  firmaId,
  unitId,
]);

  /* --------------------------- Ampel Logic --------------------------- */

  // user_id -> [qualiIds...] gültig am Datum
  const dayUserQualiMap = useMemo(() => {
  const map = {};
  if (!datum) return map;

  for (const q of dayQualis || []) {
    if (!q?.user_id) continue;
    if (!isBetweenQualiDate(q, datum)) continue;

    const mid = q.quali;
    const mm = qualiMatrixMap[mid];
    if (!mm) continue;
    if (mm.aktiv === false) continue;
    if (!mm.relevant) continue;

    if (!map[q.user_id]) map[q.user_id] = new Set();
    map[q.user_id].add(mid);
  }

  // ✅ Sets in Arrays umwandeln (stabil, uniq)
  const out = {};
  Object.keys(map).forEach((uid) => {
    out[uid] = Array.from(map[uid]);
  });
  return out;
}, [dayQualis, datum, qualiMatrixMap]);

  // ✅ QualiMap für Simulation ("Wenn Ja"):
// - Basis: IST-Qualis (dayUserQualiMap)
// - Wenn "angebot": Qualis vom Antragsteller hinzufügen (auch wenn er vorher nicht eingeteilt war)
// - Wenn "urlaub/frei/freizeitausgleich": Antragsteller entfernen
const dayUserQualiMapAfter = useMemo(() => {
  const base = { ...(dayUserQualiMap || {}) };
  const uid = basisAnfrage?.created_by;
  if (!uid || !datum) return base;

  // Urlaub/Frei => User ist nach "Ja" nicht mehr in der Schicht -> Qualis entfernen
  if (
    antragInfo.type === 'urlaub' ||
    antragInfo.type === 'frei' ||
    antragInfo.type === 'freizeitausgleich'
  ) {
    delete base[uid];
    return base;
  }

  // Angebot => Qualis vom Antragsteller hinzufügen
  if (istEinspringKandidat) {
    const arr = Array.isArray(base[uid]) ? [...base[uid]] : [];

    for (const q of requesterQualis || []) {
      if (!isBetweenQualiDate(q, datum)) continue;

      const mid = q.quali;
      const mm = qualiMatrixMap[mid];
      if (!mm) continue;
      if (mm.aktiv === false) continue;
      if (!mm.relevant) continue;

      arr.push(mid);
    }

    base[uid] = [...new Set(arr)];
  }

  return base;
}, [dayUserQualiMap, basisAnfrage?.created_by, antragInfo.type, istEinspringKandidat, requesterQualis, datum, qualiMatrixMap]);


  // Bedarf für Datum+Schicht bestimmen (Override Normalbetrieb/zeitlich begrenzt) + nur relevant
  const getBedarfFor = (datumISO, schKey) => {
    const bedarfTag = (bedarfRows || []).filter((b) => (!b.von || datumISO >= b.von) && (!b.bis || datumISO <= b.bis));
    const bedarfTagSchicht = bedarfTag.filter((b) => bedarfGiltFuerSchicht(b, datumISO, schKey));

    const hatZeitlich = bedarfTagSchicht.some((b) => b.normalbetrieb === false);
    const bedarfHeute = bedarfTagSchicht.filter((b) => b.normalbetrieb === !hatZeitlich);

    const relevant = bedarfHeute
      .map((b) => ({
        ...b,
        position: qualiMatrixMap[b.quali_id]?.position ?? 999,
        kuerzel: qualiMatrixMap[b.quali_id]?.kuerzel || '???',
        relevant: !!qualiMatrixMap[b.quali_id]?.relevant,
        aktiv: qualiMatrixMap[b.quali_id]?.aktiv !== false,
      }))
      .filter((b) => b.relevant && b.aktiv)
      .sort((a, b) => a.position - b.position);

    return relevant;
  };

const evaluateShift = (datumISO, schKey, activeUserIds, qualiMap) => {
  const bedarfSortiert = getBedarfFor(datumISO, schKey);

  // kein relevanter Bedarf -> grau
  if (!bedarfSortiert.length) {
    return {
      state: 'grey',
      needed: 0,
      active: activeUserIds.length,
      missing: 0,
      missingTop: null,
      missingQualiIds: [],
    };
  }

  // --- Zuweisung: jede Person deckt max. 1 Quali ---
  const verwendete = new Set();
  const abdeckung = {}; // qualiId -> [uids]
  const fehlendKuerzel = [];
  const fehlendQualiIds = [];

    // User Reihenfolge (wenige Qualis zuerst)
    const userOrder = [...activeUserIds]
  .map((uid) => {
    const qs = (qualiMap?.[uid] || []);
    return { uid: String(uid), anzahl: qs.length };
  })
  .sort((a, b) => {
    if (a.anzahl !== b.anzahl) return a.anzahl - b.anzahl;
    // ✅ stabiler Tie-Breaker
    return a.uid.localeCompare(b.uid);
  })
  .map((x) => x.uid);

    for (const b of bedarfSortiert) {
      const qid = b.quali_id;
      const need = Number(b.anzahl || 0);
      if (!need) continue;

      for (let i = 0; i < need; i++) {
        // finde ersten passenden, noch nicht verwendeten User
        const found = userOrder.find((uid) => !verwendete.has(uid) && (qualiMap?.[uid] || []).includes(qid));
        if (found) {
          verwendete.add(found);
          if (!abdeckung[qid]) abdeckung[qid] = [];
          abdeckung[qid].push(found);
        } else {
          fehlendKuerzel.push(b.kuerzel || '???');
          fehlendQualiIds.push(Number(qid));
        }
      }
    }

    const missing = fehlendKuerzel.length;
    const neededTotal = bedarfSortiert.reduce((s, b) => s + Number(b.anzahl || 0), 0);
    const active = activeUserIds.length;

    // Status wie “Ampel”: rot / grün / dunkelgrün
    if (missing > 0 || active < neededTotal) {
      return {
        state: 'red',
        needed: neededTotal,
        active,
        missing,
        missingTop: fehlendKuerzel[0] || null,
        missingQualiIds: [...new Set(fehlendQualiIds)],
      };
    }
    const over = active - neededTotal;
    if (over >= 2) {
      return {
        state: 'darkgreen',
        needed: neededTotal,
        active,
        missing: 0,
        missingTop: null,
        missingQualiIds: [],
      };
    }

    return {
      state: 'green',
      needed: neededTotal,
      active,
      missing: 0,
      missingTop: null,
      missingQualiIds: [],
    };
  };

  // Aktueller Kürzel des Antragstellers am Tag (F/S/N oder null)
  const requesterCurrentShift = useMemo(() => {
    const uid = basisAnfrage?.created_by;
    if (!uid) return null;

    for (const k of ['F', 'S', 'N']) {
      if ((dayAssignments?.[k] || []).includes(uid)) return k;
    }
    return null;
  }, [basisAnfrage?.created_by, dayAssignments]);

  // Simulation: wie sieht es aus, wenn "Ja" bestätigt wird?
  const simulatedAssignments = useMemo(() => {
    const base = {
      F: [...(dayAssignments.F || [])],
      S: [...(dayAssignments.S || [])],
      N: [...(dayAssignments.N || [])],
    };

    const uid = basisAnfrage?.created_by;
    if (!uid) return base;

    const removeFromAll = () => {
      base.F = base.F.filter((x) => x !== uid);
      base.S = base.S.filter((x) => x !== uid);
      base.N = base.N.filter((x) => x !== uid);
    };

    // Wenn KEIN "Ja" gewählt ist, trotzdem Vorschau anhand Antrag (du wolltest “Zustand wenn Ja bestätigt wird”)
    // => wir simulieren immer "Ja"-Folge, unabhängig von entscheidung-state.
    if (
      antragInfo.type === 'urlaub' ||
      antragInfo.type === 'frei' ||
      antragInfo.type === 'freizeitausgleich'
    ) {
      removeFromAll();
    } else if (istEinspringKandidat) {
      // User soll in beantragte Schicht (F/S/N) rein
      // erst raus aus evtl. anderer Schicht, dann rein in Ziel
      removeFromAll();

      const target = schichtKuerzel; // erwartet F/S/N
      if (target === 'F' || target === 'S' || target === 'N') {
        base[target] = [...new Set([...base[target], uid])];
      }
    }
    return base;
    }, [dayAssignments, basisAnfrage?.created_by, antragInfo.type, istEinspringKandidat, schichtKuerzel]);
// ✅ Ampel nur anzeigen, wenn die wichtigen Daten geladen sind
const ampelReady = useMemo(() => {
  if (loading) return false;      // solange load() läuft -> keine Ampel zeigen
  if (!datum || !schKey) return false;

  // Bedarf + QualiMatrix müssen geladen sein
  if (!Array.isArray(bedarfRows) || bedarfRows.length === 0) return false;
  if (!Array.isArray(qualiMatrix) || qualiMatrix.length === 0) return false;

  // Qualis müssen geladen sein (kann leer sein, aber muss "geladen" sein)
  // Wir nehmen dafür: dayQualis !== null (bei dir ist es ein Array, also immer ok)
  // Optional: dayAssignments prüfen
  if (!dayAssignments) return false;

  return true;
}, [loading, datum, schKey, bedarfRows, qualiMatrix, dayAssignments]);

  const ampelNow = useMemo(() => {
  if (!datum || !schKey) return null;
  return evaluateShift(datum, schKey, dayAssignments?.[schKey] || [], dayUserQualiMap);

}, [datum, schKey, dayAssignments, bedarfRows, dayUserQualiMap, qualiMatrixMap]);
  const fehlendeQualiIds = useMemo(() => {
    return [
      ...new Set(
        (ampelNow?.missingQualiIds || [])
          .map((id) => Number(id))
          .filter(Boolean)
      ),
    ];
  }, [ampelNow]);

const ampelAfter = useMemo(() => {
  if (!datum || !schKey) return null;
  return evaluateShift(datum, schKey, simulatedAssignments?.[schKey] || [], dayUserQualiMapAfter);
}, [datum, schKey, simulatedAssignments, bedarfRows, dayUserQualiMapAfter, qualiMatrixMap]);

  const urlaubRestNachGenehmigung = useMemo(() => {
    if (urlaubRestAktuell == null) return null;
    if (antragInfo.type !== 'urlaub') return null;

    return urlaubRestAktuell - offeneUrlaubsantraege - 1;
  }, [urlaubRestAktuell, offeneUrlaubsantraege, antragInfo.type]);

  const urlaubGenehmigungBlockiert = useMemo(() => {
    if (antragInfo.type !== 'urlaub') return false;
    if (urlaubRestNachGenehmigung == null) return false;
    return urlaubRestNachGenehmigung < 0;
  }, [antragInfo.type, urlaubRestNachGenehmigung]);

 const andereAngeboteAutomatischAbsagen = async ({ selectedId, createdBy }) => {
  if (!istAngebotsKontext || !datum || !schichtKuerzel) return;

  let andereAngebote = [...andereOffeneAngebote];

  // Falls keine Gruppen-Anfragen vorhanden sind, zur Sicherheit nochmal aus DB laden.
  if (!andereAngebote.length) {
    const { data, error } = await supabase
      .from('DB_AnfrageMA')
      .select('id, antrag, genehmigt, datum_entscheid')
      .eq('firma_id', firmaId)
      .eq('unit_id', unitId)
      .eq('datum', datum)
      .eq('schicht', schichtKuerzel)
      .is('genehmigt', null)
      .is('datum_entscheid', null);

    if (error) throw error;

    andereAngebote = (data || []).filter((a) => {
      if (!a?.id) return false;
      if (selectedId && a.id === selectedId) return false;

      const info = parseAntrag(a.antrag);
      return info.type === 'angebot';
    });
  }

const idsZumAbsagen = [
  ...new Set(andereAngebote.map((a) => a.id).filter(Boolean)),
];

  if (!idsZumAbsagen.length) return;

  const { error: absageErr } = await supabase
    .from('DB_AnfrageMA')
    .update({
      genehmigt: false,
      verantwortlicher: createdBy || verantwortlicherUserId,
      datum_entscheid: new Date().toISOString(),
      kommentar:
        'Automatisch abgelehnt: Die Einspring-Schicht wurde vergeben und weitere Angebote wurden vom Verantwortlichen geschlossen.',
    })
    .in('id', idsZumAbsagen);

  if (absageErr) throw absageErr;
};
  /* --------------------------- SAVE --------------------------- */
  const handleSpeichern = async () => {
    if (!basisAnfrage || entscheidung === null) return;
    if (gruppenOhneAuswahl || !basisAnfrage.created_by) {
      alert('Bitte zuerst links einen Mitarbeiter aus der Fairnessliste auswählen.');
      return;
    }
    if (entscheidung === true && basisAnfrage._nurKandidat && !kandidatZugesagt) {
      alert(`Bitte zuerst bestätigen: ${kandidatCheckboxText}`);
      return;
    }

  if (entscheidung === true && ruhezeitCheck && ruhezeitCheck.ok === false) {
    alert('Genehmigung nicht möglich: Die Ruhezeit von 11 Stunden wird nicht eingehalten.');
    return;
  }
    if (antragInfo.type === 'urlaub' && entscheidung === true && urlaubGenehmigungBlockiert) {
      return;
    }

    const s = triStatus(basisAnfrage.genehmigt)
    if (!(s === 0 && basisAnfrage.datum_entscheid == null)) return;

    setSaving(true);
    try {
      // 1) Anfrage speichern
    if (!basisAnfrage._nurKandidat) {
      const { error: upErr } = await supabase
        .from('DB_AnfrageMA')
        .update({
          genehmigt: entscheidung,
          kommentar,
          verantwortlicher: verantwortlicherUserId,
          datum_entscheid: new Date().toISOString(),
        })
        .eq('id', basisAnfrage.id);

      if (upErr) throw upErr;
    }

      // 2) Wenn genehmigt => zentraler Kampfliste-Write (Verlauf -> Delete -> Insert + Recalc)
      if (entscheidung === true) {
        let zielKuerzel = schichtKuerzel;
          if (antragInfo.type === 'urlaub') zielKuerzel = 'U';
          if (antragInfo.type === 'frei') zielKuerzel = '-';
          if (antragInfo.type === 'freizeitausgleich') zielKuerzel = '-';

        const createdBy =
          (await supabase.auth.getUser()).data?.user?.id || verantwortlicherUserId || null;
          if (!createdBy) {
          throw new Error("Kein createdBy gefunden (auth user).");
          }
        const zusageKommentar = istFreizeitausgleichFall
          ? 'Mitarbeiter wurde vom Verantwortlichen gefragt und hat dem Freizeitausgleich zugestimmt.'
          : istUrlaubsFall
            ? 'Mitarbeiter wurde vom Verantwortlichen gefragt und die Urlaubsfreigabe wurde abgestimmt.'
            : 'Mitarbeiter wurde vom Verantwortlichen gefragt und hat der Übernahme zugesagt.';

        await speichernInKampfliste({
          firmaId,
          unitId,
          userId: basisAnfrage.created_by,
          dates: [datum],
          kuerzelNeu: zielKuerzel,
          createdBy,
          kommentar: basisAnfrage._nurKandidat
            ? [kommentar, zusageKommentar].filter(Boolean).join(' | ')
            : kommentar || null,
          // start/ende/pauseHours nicht nötig: Helper nutzt SchichtArt-Fallback
          skipUrlaubOnFreeDay: true,
        })
        if (entscheidung === true && istAngebotsKontext && andereAngeboteAblehnen) {
          await andereAngeboteAutomatischAbsagen({
            selectedId: basisAnfrage._nurKandidat ? null : basisAnfrage.id,
            createdBy,
          });
        };
      }

      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error('AnalyseModal speichern error:', e?.message || e);
    } finally {
      setSaving(false);
    }
  };

  if (!offen) return null;

  return (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm">
    <div className="flex items-stretch gap-3 mx-3 w-full max-w-6xl">

      <AMAMKandidatenliste
        offen={offen}
        analyseGeladen={analyseGeladen}
        firmaId={firmaId}
        unitId={unitId}
        datum={datum}
        schichtKuerzel={schichtKuerzel}
        requestedArt={requestedArt}
        basisAnfrage={basisAnfrage}
        fehlendeQualiIds={fehlendeQualiIds}
        onKandidatAuswahl={(neueAnfrage) => {
          setAktiveAnfrage({
            ...neueAnfrage,
            _gruppeNichtAusgewaehlt: false,
          });

          setAnalyseGeladen(false);
          setEntscheidung(null);
          setKommentar('');
          setKandidatZugesagt(false);
          setAndereAngeboteAblehnen(false);
        }}
      />

      {/* Hauptmodal */}
      <div className="w-full max-w-2xl rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <div className="text-sm text-gray-500 dark:text-gray-300">Anfrage Analyse</div>

            <div className="text-xl font-semibold text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
              <span className="truncate">
              {gruppenOhneAuswahl
                ? 'Bitte Kandidaten auswählen'
                : basisAnfrage?.created_by_user
                  ? `${basisAnfrage.created_by_user.vorname} ${basisAnfrage.created_by_user.nachname}`
                  : '—'}
              </span>

              <span className="text-gray-400">•</span>
              <span>{datum ? dayjs(datum).format('DD.MM.YYYY') : '—'}</span>

              <span className="text-gray-400">•</span>

              <span
                className="px-2 py-0.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm"
                style={
                  requestedArt?.farbe_bg
                    ? { backgroundColor: requestedArt.farbe_bg, color: requestedArt.farbe_text || '#000' }
                    : undefined
                }
              >
                {requestedArt?.kuerzel || schichtKuerzel || '—'}
              </span>
            </div>

            {/* Ampel Bereich */}
            <div className="mt-2 flex flex-wrap gap-3 items-center">
              <div className="text-xs text-gray-600 dark:text-gray-300 font-semibold">
                Ampel (Ist/Bedarfs-Abgleich)           </div>
              {ampelReady && ampelNow && ampelAfter && schKey ? (
  <div className="flex flex-wrap gap-3 items-center">
    {/* Jetzt */}
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-2 py-1">
      <div className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold">Jetzt</div>
      <AmpelDot
        title={`${schKey}: ${ampelNow.active}/${ampelNow.needed}${ampelNow.missingTop ? ` • fehlt ${ampelNow.missingTop}` : ''}`}
        color={ampelColor(ampelNow.state)}
      />
      <div className="text-[11px] text-gray-500 dark:text-gray-300">
        {schKey} • {ampelNow.active}/{ampelNow.needed}{ampelNow.missingTop ? ` • fehlt ${ampelNow.missingTop}` : ''}
      </div>
    </div>

    {/* Wenn Ja */}
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-2 py-1">
      <div className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold">Wenn Ja</div>
      <AmpelDot
        title={`${schKey}: ${ampelAfter.active}/${ampelAfter.needed}${ampelAfter.missingTop ? ` • fehlt ${ampelAfter.missingTop}` : ''}`}
        color={ampelColor(ampelAfter.state)}
      />
      <div className="text-[11px] text-gray-500 dark:text-gray-300">
        {schKey} • {ampelAfter.active}/{ampelAfter.needed}{ampelAfter.missingTop ? ` • fehlt ${ampelAfter.missingTop}` : ''}
      </div>
    </div>
  </div>
) : null}

            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lädt Analyse…
            </div>
          ) : (
            <>
{/* Antrag / Kandidatenhinweis */}
{gruppenOhneAuswahl ? (
  <div className="rounded-xl border border-blue-700 bg-blue-600 px-3 py-2 text-sm text-white shadow">
    <div className="font-semibold">
      Gebündelte Anfrage geöffnet
    </div>
    <div className="text-xs mt-1">
      Bitte links in der Fairnessliste zuerst einen Mitarbeiter auswählen. Erst danach kann entschieden oder gespeichert werden.
    </div>
  </div>
) : basisAnfrage?._nurKandidat ? (
  <div className="rounded-xl border border-red-700 bg-red-600 px-3 py-2 text-sm text-white shadow">
    <div className="font-semibold">
      {kandidatHinweisTitel}
    </div>

    <div className="text-xs mt-1">
      {kandidatHinweisText}
    </div>
  </div>
) : (
  <div
    className="rounded-xl border border-gray-200 dark:border-gray-700 py-1 px-2 bg-gray-50 dark:bg-gray-900/10"
    style={beantragtBoxStyle || undefined}
  >
    <div
      className="text-sm"
      style={beantragtBoxStyle ? { color: beantragtBoxStyle.color } : undefined}
    >
      <span className="font-semibold">{antragInfo.label}</span>

      {basisAnfrage?.antrag ? (
        <span className={beantragtBoxStyle ? '' : 'text-gray-500 dark:text-gray-300'}>
          {' '}
          — „{basisAnfrage.antrag}“
        </span>
      ) : null}
    </div>
  </div>
)}

      {(
        antragInfo.type === 'urlaub' ||
        antragInfo.type === 'freizeitausgleich' ||
        istEinspringKandidat
      ) && (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1 text-sm bg-white dark:bg-gray-900/20">
    {antragInfo.type === 'urlaub' && (
      urlaubLoading ? (
        <div className="text-gray-600 dark:text-gray-300">Urlaubskontingent wird geladen…</div>
      ) : (
        <div className="space-y-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-1">
              <div className="text-xs text-gray-500 dark:text-gray-300">Resturlaub</div>
              <div className="font-semibold">{urlaubRestAktuell ?? '—'} Tage</div>
            </div>

            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-1">
              <div className="text-xs text-gray-500 dark:text-gray-300">Offene Anträge</div>
              <div className="font-semibold">{offeneUrlaubsantraege}</div>
            </div>

            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-1">
              <div className="text-xs text-gray-500 dark:text-gray-300">Nach Genehmigung</div>
              <div className={`font-semibold ${urlaubGenehmigungBlockiert ? 'text-red-600' : 'text-green-600'}`}>
                {urlaubRestNachGenehmigung ?? '—'} Tage
              </div>
            </div>
          </div>

          {urlaubGenehmigungBlockiert && (
            <div className="text-red-600 font-medium text-xs">
              Kontingent wäre negativ. Bitte erst andere offene Urlaubsanträge klären.
            </div>
          )}
        </div>
      )
    )}

    {antragInfo.type === 'freizeitausgleich' && (
      stundenLoading ? (
        <div className="text-gray-600 dark:text-gray-300">Stundenkonto wird geladen…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-1">
            <div className="text-xs text-gray-500 dark:text-gray-300">Std. Jahresende</div>
            <div className="font-semibold">{fmtStd(stundenAktuell)} Std.</div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-1">
            <div className="text-xs text-gray-500 dark:text-gray-300">Freizeitausgleich</div>
            <div className="font-semibold">{fmtStd(requestedArt?.dauer)} Std.</div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-1">
            <div className="text-xs text-gray-500 dark:text-gray-300">Nach Genehmigung</div>
            <div className="font-semibold text-purple-700 dark:text-purple-300">
              {fmtStd(stundenNachGenehmigung)} Std.
            </div>
          </div>
        </div>
      )
    )}

        {istEinspringKandidat && (
      stundenLoading ? (
        <div className="text-gray-600 dark:text-gray-300">Stundenkonto wird geladen…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
            <div className="text-xs text-gray-500 dark:text-gray-300">Std. Jahresende</div>
            <div className="font-semibold">{fmtStd(stundenAktuell)} Std.</div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
            <div className="text-xs text-gray-500 dark:text-gray-300">+ Stunden</div>
            <div className="font-semibold">{fmtStd(requestedArt?.dauer)} Std.</div>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-800 px-2 py-2">
            <div className="text-xs text-gray-500 dark:text-gray-300">Std. nach Genehmigung</div>
            <div className="font-semibold text-green-700 dark:text-green-300">
              {fmtStd(stundenNachGenehmigung)} Std.
            </div>
          </div>
        </div>
      )
    )}
  </div>
)}


              {/* 7 Tage Plan */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-1">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-0.5">
                  {range &&
                    Array.from({ length: 7 }).map((_, i) => {
                      const d = dayjs(range.from).add(i, 'day').format('YYYY-MM-DD');
                      const entry = (userPlan7 || []).find((x) => dayjs(x.datum).format('YYYY-MM-DD') === d);
                      const isFocus = d === datum;

                      return (
                        <div
                          key={d}
                          className={`rounded-xl px-2 py-1 border-4 transition-all ${
                            isFocus ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-200 dark:border-gray-700'
                          }`}
                          style={entry?.bg ? { backgroundColor: entry.bg, color: entry.text || '#000' } : undefined}
                          title={entry?.kommentar || ''}
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-[11px] opacity-80">{dayjs(d).format('dd DD.MM')}</div>
                            <div className="text-sm font-semibold">{entry?.kuerzel || '—'}</div>
                          </div>

                          <div className="text-[11px] opacity-80">
                            {entry?.start && entry?.ende ? `${entry.start}–${entry.ende}` : ''}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Besetzung */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 py-1 px-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Besetzung am {datum ? dayjs(datum).format('DD.MM.YYYY') : ''}{' '}
                    {requestedArt?.kuerzel ? `• Schicht ${requestedArt.kuerzel}` : ''}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    Sortiert nach Quali-Priorität (kleinste Position oben)
                  </div>
                </div>

                {besetzungSorted.length === 0 ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300">Keine Besetzung gefunden.</div>
                ) : (
                  <div className="space-y-1">
                    {besetzungSorted.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-1 bg-gray-50 dark:bg-gray-900/10"
                      >
                        <div className="text-xs font-medium text-gray-900 dark:text-white">{row.name}</div>
                        <div className="text-xs flex flex-wrap gap-1">
                          {row.badges?.length ? row.badges.map((b, idx) => <Badge key={idx}>{b}</Badge>) : <Badge>keine Quali</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Genehmigung */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-2">Genehmigung</div>

                <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setEntscheidung(true)}
                  disabled={urlaubGenehmigungBlockiert || gruppenOhneAuswahl}
                  className={`px-4 py-1 rounded-xl text-xs border ${
                    urlaubGenehmigungBlockiert || gruppenOhneAuswahl
                      ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed'
                      : entscheidung === true
                        ? 'bg-green-600 text-white border-green-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600'
                  }`}
                >
                  Ja
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEntscheidung(false)}
                    className={`px-4 py-1 rounded-xl text-xs border ${
                      entscheidung === false
                        ? 'bg-red-600 text-white border-red-700'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    Nein
                  </button>

                  {/* ✅ Mini-Info rechts neben Nein */}
                  <div className="text-xs text-gray-500 dark:text-gray-300">
                    {antragInfo.type === 'urlaub' && 'Bei Ja wird Urlaub (U) eingetragen'}
                    {antragInfo.type === 'frei' && 'Bei Ja wird Frei (-) eingetragen'}
                    {antragInfo.type === 'freizeitausgleich' && 'Bei Ja wird Freizeitausgleich (-) eingetragen'}
                    {istEinspringKandidat && `Bei Ja wird ${schichtKuerzel || 'Schicht'} eingetragen`}
                  </div>
                </div>
              </div>

                <textarea
                  className="w-full p-2 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  rows="2"
                  placeholder="Kommentar"
                  value={kommentar}
                  onChange={(e) => setKommentar(e.target.value)}
                />
              {basisAnfrage?._nurKandidat && (
                <label className="mb-2 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-3 py-2 text-xs text-red-800 dark:text-red-200">
                  <input
                    type="checkbox"
                    checked={kandidatZugesagt}
                    onChange={(e) => setKandidatZugesagt(e.target.checked)}
                    className="mt-0.5"
                  />
                <span>{kandidatCheckboxText}</span>
                </label>
              )}
              {istAngebotsKontext && entscheidung === true && anzahlAndereOffeneAngebote > 0 && (
                <label className="mb-2 flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
                  <input
                    type="checkbox"
                    checked={andereAngeboteAblehnen}
                    onChange={(e) => setAndereAngeboteAblehnen(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Alle anderen offenen Angebote zu dieser Schicht automatisch ablehnen.
                    <span className="block text-[11px] opacity-80 mt-0.5">
                      Nur aktivieren, wenn für diese Schicht keine weiteren Mitarbeitenden mehr benötigt werden.
                    </span>
                  </span>
                </label>
              )}
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleSpeichern}
                    disabled={saving || entscheidung === null || gruppenOhneAuswahl}
                    className={`px-4 py-2 rounded-xl text-sm text-white ${
                      saving || entscheidung === null ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Speichere…' : 'Speichern'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
