// src/components/Dashboard/AMAMKandidatenliste.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

/* --------------------------- Helpers --------------------------- */

const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { Früh: 0, Spät: 1, Nacht: 2 };

const fmtStd = (v) => {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return '—';

  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
};

const parseAntrag = (txt = '') => {
  const t = String(txt || '').toLowerCase();

  if (t.includes('urlaub')) return { type: 'urlaub', label: 'Urlaub beantragt' };

  if (t.includes('freizeitausgleich')) {
    return { type: 'freizeitausgleich', label: 'Freizeitausgleich beantragt' };
  }

  if (t.includes('frei beantragt') || (t.includes('frei') && !t.includes('freiwillig'))) {
    return { type: 'frei', label: 'Frei beantragt' };
  }

  if (
    t.includes('freiwillig') ||
    t.includes('biete') ||
    t.includes('einspring') ||
    t.includes('angeboten')
  ) {
    return { type: 'angebot', label: 'Freiwillig angeboten (einspringen)' };
  }

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

const istUrlaubsText = (txt = '') => {
  const t = String(txt || '').toLowerCase();
  return t.includes('urlaub');
};

const istFzaText = (txt = '') => {
  const t = String(txt || '').toLowerCase();
  return t.includes('freizeitausgleich');
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

const isBetweenQualiDate = (row, datum) => {
  const d = dayjs(datum).startOf('day');
  const s = row?.quali_start ? dayjs(row.quali_start).startOf('day') : null;
  const e = row?.quali_endet ? dayjs(row.quali_endet).startOf('day') : null;

  if (s && d.isBefore(s)) return false;
  if (e && d.isAfter(e)) return false;

  return true;
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

  if (b.normalbetrieb && b.betriebsmodus === 'wochenbetrieb') {
    const weekday = dayjs(datumISO).day(); // 0=So .. 6=Sa

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
          // Mo–Do: alles ok
        } else if (weekday === 5) {
          if (schLabel === 'Nacht') return false;
        } else {
          return false;
        }
        break;

      default:
        break;
    }
  }

  if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

  // schichtart null => gilt für alle Schichten
  if (b.schichtart == null) return true;

  return b.schichtart === schLabel;
};

const getEffectiveShiftId = (row) => {
  return row?.ist_schichtart_id || row?.soll_schichtart_id || null;
};

const getEffectiveShiftKuerzel = (row, artsById) => {
  const id = getEffectiveShiftId(row);
  return id ? artsById.get(id)?.kuerzel || null : null;
};

const buildQualiMapForUsers = ({ qualiRows, datum, matrixById }) => {
  const map = {};

  (qualiRows || []).forEach((q) => {
    if (!q?.user_id) return;
    if (!isBetweenQualiDate(q, datum)) return;

    const matrix = matrixById.get(q.quali);
    if (!matrix) return;
    if (matrix.aktiv === false) return;
    if (matrix.betriebs_relevant !== true) return;

    const uid = String(q.user_id);

    if (!map[uid]) map[uid] = [];

    map[uid].push(Number(q.quali));
  });

  Object.keys(map).forEach((uid) => {
    map[uid] = [...new Set(map[uid])];
  });

  return map;
};

const getBedarfForSchicht = ({ bedarfRows, matrixById, datum, schKey }) => {
  const bedarfTag = (bedarfRows || []).filter(
    (b) => (!b.von || datum >= b.von) && (!b.bis || datum <= b.bis)
  );

  const bedarfTagSchicht = bedarfTag.filter((b) =>
    bedarfGiltFuerSchicht(b, datum, schKey)
  );

  const hatZeitlich = bedarfTagSchicht.some((b) => b.normalbetrieb === false);

  const bedarfHeute = bedarfTagSchicht.filter(
    (b) => b.normalbetrieb === !hatZeitlich
  );

  return (bedarfHeute || [])
    .map((b) => {
      const matrix = matrixById.get(b.quali_id);

      return {
        ...b,
        quali_id: Number(b.quali_id),
        anzahl: Number(b.anzahl || 0),
        position: Number(matrix?.position ?? 9999),
        kuerzel: matrix?.quali_kuerzel || matrix?.qualifikation || '???',
        relevant: !!matrix?.betriebs_relevant,
        aktiv: matrix?.aktiv !== false,
      };
    })
    .filter((b) => b.anzahl > 0)
    .filter((b) => b.relevant && b.aktiv)
    .sort((a, b) => a.position - b.position);
};

const evaluateCoverage = ({ bedarfSortiert, activeUserIds, qualiMap }) => {
  if (!bedarfSortiert.length) {
    return {
      ok: true,
      missing: 0,
      missingQualiIds: [],
      missingTop: null,
      needed: 0,
      active: activeUserIds.length,
    };
  }

  const verwendete = new Set();
  const fehlendKuerzel = [];
  const fehlendQualiIds = [];

  const userOrder = [...activeUserIds]
    .map((uid) => {
      const qs = qualiMap?.[String(uid)] || [];
      return { uid: String(uid), anzahl: qs.length };
    })
    .sort((a, b) => {
      if (a.anzahl !== b.anzahl) return a.anzahl - b.anzahl;
      return a.uid.localeCompare(b.uid);
    })
    .map((x) => x.uid);

  for (const b of bedarfSortiert) {
    const qid = Number(b.quali_id);
    const need = Number(b.anzahl || 0);

    for (let i = 0; i < need; i++) {
      const found = userOrder.find(
        (uid) => !verwendete.has(uid) && (qualiMap?.[uid] || []).includes(qid)
      );

      if (found) {
        verwendete.add(found);
      } else {
        fehlendKuerzel.push(b.kuerzel || '???');
        fehlendQualiIds.push(qid);
      }
    }
  }

  const neededTotal = bedarfSortiert.reduce((sum, b) => sum + Number(b.anzahl || 0), 0);
  const active = activeUserIds.length;
  const missing = fehlendKuerzel.length;

  return {
    ok: missing === 0 && active >= neededTotal,
    missing,
    missingQualiIds: [...new Set(fehlendQualiIds)],
    missingTop: fehlendKuerzel[0] || null,
    needed: neededTotal,
    active,
  };
};

/* --------------------------- Component --------------------------- */

export default function AMAMKandidatenliste({
  offen,
  analyseGeladen,
  firmaId,
  unitId,
  datum,
  schichtKuerzel,
  requestedArt,
  basisAnfrage,
  fehlendeQualiIds = [],
  onKandidatAuswahl,
}) {
  const [loading, setLoading] = useState(false);
  const [kandidaten, setKandidaten] = useState([]);

  const antragInfo = useMemo(
    () => parseAntrag(basisAnfrage?.antrag),
    [basisAnfrage?.antrag]
  );

  const modus = useMemo(() => {
    if (basisAnfrage?._fairnessModus) return basisAnfrage._fairnessModus;

    if (antragInfo.type === 'freizeitausgleich') return 'freizeitausgleich';
    if (antragInfo.type === 'urlaub') return 'urlaub';
    if (antragInfo.type === 'angebot') return 'einspringen';

    if (basisAnfrage?._nurKandidat) return 'einspringen';

    return 'standard';
  }, [basisAnfrage?._fairnessModus, antragInfo.type, basisAnfrage?._nurKandidat]);

  const titel = useMemo(() => {
    if (modus === 'einspringen') return 'Faire Kandidatenempfehlung';
    if (modus === 'freizeitausgleich') return 'Fairnessprüfung Freizeitausgleich';
    if (modus === 'urlaub') return 'Fairnessprüfung Urlaub';
    return 'Fairnessprüfung';
  }, [modus]);

  const untertitel = useMemo(() => {
    if (modus === 'einspringen') {
      return 'Verfügbar • Ruhezeit ok • Quali passend • wenig Stunden oben';
    }

    if (modus === 'freizeitausgleich') {
      return 'Gleiche Schicht • Quali verzichtbar • viele Stunden oben';
    }

    if (modus === 'urlaub') {
      return 'Urlaubsanträge gleicher Tag • Quali verzichtbar';
    }

    return 'Faire Entscheidungsgrundlage';
  }, [modus]);

  useEffect(() => {
    if (
      !offen ||
      !analyseGeladen ||
      !firmaId ||
      !unitId ||
      !datum ||
      !schichtKuerzel ||
      !requestedArt?.startzeit ||
      !requestedArt?.endzeit
    ) {
      setKandidaten([]);
      return;
    }

    const ladeKandidaten = async () => {
      setLoading(true);

      try {
        const jahr = dayjs(datum).year();
        const schKey = String(schichtKuerzel || '').trim().toUpperCase();

        if (!['F', 'S', 'N'].includes(schKey)) {
          setKandidaten([]);
          return;
        }

        /* ---------------------------------------------------------
         * Gemeinsame Grunddaten
         * --------------------------------------------------------- */
        const [
          { data: planRows, error: planErr },
          { data: bedarfRows, error: bedarfErr },
          { data: matrixRows, error: matrixErr },
        ] = await Promise.all([
          supabase
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
            .eq('datum', datum),

          supabase
            .from('DB_Bedarf')
            .select(
              `
              quali_id,
              anzahl,
              von,
              bis,
              namebedarf,
              farbe,
              normalbetrieb,
              schichtart,
              start_schicht,
              end_schicht,
              betriebsmodus,
              wochen_tage
            `
            )
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId),

          supabase
            .from('DB_Qualifikationsmatrix')
            .select('id, quali_kuerzel, qualifikation, betriebs_relevant, position, aktiv')
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId),
        ]);

        if (planErr) throw planErr;
        if (bedarfErr) throw bedarfErr;
        if (matrixErr) throw matrixErr;

        const matrixById = new Map();
        (matrixRows || []).forEach((q) => {
          matrixById.set(Number(q.id), q);
        });

        const allSchichtArtIds = [
          ...new Set(
            (planRows || [])
              .flatMap((r) => [r.soll_schichtart_id, r.ist_schichtart_id])
              .filter(Boolean)
          ),
        ];

        let artsById = new Map();

        if (allSchichtArtIds.length) {
          const { data: arts, error: artsErr } = await supabase
            .from('DB_SchichtArt')
            .select('id, kuerzel, startzeit, endzeit')
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId)
            .in('id', allSchichtArtIds);

          if (artsErr) throw artsErr;

          (arts || []).forEach((a) => {
            artsById.set(a.id, a);
          });
        }

        const bedarfSortiert = getBedarfForSchicht({
          bedarfRows,
          matrixById,
          datum,
          schKey,
        });

        if (!bedarfSortiert.length) {
          setKandidaten([]);
          return;
        }

        const schichtUserIds = (planRows || [])
          .filter((r) => getEffectiveShiftKuerzel(r, artsById) === schKey)
          .map((r) => String(r.user_id))
          .filter(Boolean);

        const uniqueSchichtUserIds = [...new Set(schichtUserIds)];

        const alleUserIdsAusPlan = [
          ...new Set(
            (planRows || [])
              .map((r) => String(r.user_id))
              .filter(Boolean)
          ),
        ];

        const { data: qualiRows, error: qualiErr } = alleUserIdsAusPlan.length
          ? await supabase
              .from('DB_Qualifikation')
              .select('id, user_id, quali, quali_start, quali_endet')
              .in('user_id', alleUserIdsAusPlan)
          : { data: [], error: null };

        if (qualiErr) throw qualiErr;

        const qualiMap = buildQualiMapForUsers({
          qualiRows,
          datum,
          matrixById,
        });

        const coverageNow = evaluateCoverage({
          bedarfSortiert,
          activeUserIds: uniqueSchichtUserIds,
          qualiMap,
        });

        /* ---------------------------------------------------------
         * Offene Anträge laden
         * --------------------------------------------------------- */
        const { data: offeneAnfragen, error: anfragenErr } = await supabase
          .from('DB_AnfrageMA')
          .select(
            `
            id,
            created_by,
            antrag,
            created_at,
            schicht,
            created_by_user:created_by (
              vorname,
              nachname
            )
          `
          )
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId)
          .eq('datum', datum)
          .is('genehmigt', null)
          .is('datum_entscheid', null);

        if (anfragenErr) throw anfragenErr;

        const offeneAnfragenTag = offeneAnfragen || [];

        const angebotByUser = new Map();
        const fzaByUser = new Map();
        const urlaubByUser = new Map();

        offeneAnfragenTag.forEach((a) => {
          const uid = String(a.created_by);

          if (String(a.schicht || '').trim().toUpperCase() === schKey && istAngebotText(a.antrag)) {
            angebotByUser.set(uid, a);
          }

          if (String(a.schicht || '').trim().toUpperCase() === schKey && istFzaText(a.antrag)) {
            fzaByUser.set(uid, a);
          }

          if (istUrlaubsText(a.antrag)) {
            urlaubByUser.set(uid, a);
          }
        });

        /* ---------------------------------------------------------
         * Kandidaten nach Modus bestimmen
         * --------------------------------------------------------- */
        let kandidatenIds = [];

        if (modus === 'einspringen') {
          // Nur wirklich frei: Soll '-' und Ist leer oder '-'
          kandidatenIds = (planRows || [])
            .filter((r) => {
              const sollKuerzel = artsById.get(r.soll_schichtart_id)?.kuerzel || null;
              const istKuerzel = r.ist_schichtart_id
                ? artsById.get(r.ist_schichtart_id)?.kuerzel || null
                : null;

              return sollKuerzel === '-' && (istKuerzel === null || istKuerzel === '-');
            })
            .map((r) => String(r.user_id));

          kandidatenIds = [...new Set(kandidatenIds)];

          // Ruhezeit prüfen
          const zielIntervall = buildShiftInterval(
            datum,
            requestedArt.startzeit,
            requestedArt.endzeit
          );

          if (!zielIntervall) {
            setKandidaten([]);
            return;
          }

          const vonRuhe = dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD');
          const bisRuhe = dayjs(datum).add(1, 'day').format('YYYY-MM-DD');

          const { data: ruheRows, error: ruheErr } = kandidatenIds.length
            ? await supabase
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
                .in('user_id', kandidatenIds)
                .gte('datum', vonRuhe)
                .lte('datum', bisRuhe)
            : { data: [], error: null };

          if (ruheErr) throw ruheErr;

          const ruheArtIds = [
            ...new Set(
              (ruheRows || [])
                .flatMap((r) => [r.soll_schichtart_id, r.ist_schichtart_id])
                .filter(Boolean)
            ),
          ];

          let ruheArtsById = new Map();

          if (ruheArtIds.length) {
            const { data: ruheArts, error: ruheArtsErr } = await supabase
              .from('DB_SchichtArt')
              .select('id, kuerzel, startzeit, endzeit')
              .eq('firma_id', firmaId)
              .eq('unit_id', unitId)
              .in('id', ruheArtIds);

            if (ruheArtsErr) throw ruheArtsErr;

            (ruheArts || []).forEach((a) => {
              ruheArtsById.set(a.id, a);
            });
          }

          const hatGenugRuhezeit = (uid) => {
            const rowsUser = (ruheRows || []).filter(
              (r) => String(r.user_id) === String(uid)
            );

            const vorhandeneIntervalle = [];

            rowsUser.forEach((r) => {
              const rowDatum = dayjs(r.datum).format('YYYY-MM-DD');

              if (rowDatum === datum) return;

              const useIst = !!r.ist_schichtart_id;
              const artId = useIst ? r.ist_schichtart_id : r.soll_schichtart_id;
              const art = ruheArtsById.get(artId);

              if (!art) return;
              if (!['F', 'S', 'N'].includes(art.kuerzel)) return;

              const startzeit = useIst
                ? r.ist_startzeit || art.startzeit
                : r.soll_startzeit || art.startzeit;

              const endzeit = useIst
                ? r.ist_endzeit || art.endzeit
                : r.soll_endzeit || art.endzeit;

              const intervall = buildShiftInterval(rowDatum, startzeit, endzeit);

              if (intervall) vorhandeneIntervalle.push(intervall);
            });

            const letzteVorher = vorhandeneIntervalle
              .filter(
                (x) =>
                  x.ende.isBefore(zielIntervall.start) ||
                  x.ende.isSame(zielIntervall.start)
              )
              .sort((a, b) => b.ende.valueOf() - a.ende.valueOf())[0];

            const ersteNachher = vorhandeneIntervalle
              .filter(
                (x) =>
                  x.start.isAfter(zielIntervall.ende) ||
                  x.start.isSame(zielIntervall.ende)
              )
              .sort((a, b) => a.start.valueOf() - b.start.valueOf())[0];

            const stundenVorher = letzteVorher
              ? zielIntervall.start.diff(letzteVorher.ende, 'minute') / 60
              : null;

            const stundenNachher = ersteNachher
              ? ersteNachher.start.diff(zielIntervall.ende, 'minute') / 60
              : null;

            return (
              (stundenVorher == null || stundenVorher >= 11) &&
              (stundenNachher == null || stundenNachher >= 11)
            );
          };

          kandidatenIds = kandidatenIds.filter((uid) => hatGenugRuhezeit(uid));

          const fehlendeQualiFilterIds = [
            ...new Set(
              (fehlendeQualiIds || [])
                .map((id) => Number(id))
                .filter(Boolean)
            ),
          ];

          if (!fehlendeQualiFilterIds.length) {
            setKandidaten([]);
            return;
          }

          kandidatenIds = kandidatenIds.filter((uid) => {
            const qs = qualiMap[String(uid)] || [];
            return qs.some((qid) => fehlendeQualiFilterIds.includes(Number(qid)));
          });
        }

        if (modus === 'freizeitausgleich') {
          // Alle Mitarbeitenden mit derselben Schicht.
          // Nur anzeigen, wenn die Quali nach Herausnahme noch gedeckt bleibt.
          kandidatenIds = uniqueSchichtUserIds.filter((uid) => {
            const afterIds = uniqueSchichtUserIds.filter((x) => String(x) !== String(uid));

            const afterCoverage = evaluateCoverage({
              bedarfSortiert,
              activeUserIds: afterIds,
              qualiMap,
            });

            return afterCoverage.ok;
          });
        }

        if (modus === 'urlaub') {
          // Nur Mitarbeitende, die für denselben Tag einen Urlaubsantrag gesendet haben.
          // Nur anzeigen, wenn sie aktuell in F/S/N sind und ihre Quali verzichtbar ist.
          kandidatenIds = [...urlaubByUser.keys()].filter((uid) => {
            const row = (planRows || []).find((r) => String(r.user_id) === String(uid));
            const kuerzel = row ? getEffectiveShiftKuerzel(row, artsById) : null;

            if (!['F', 'S', 'N'].includes(kuerzel)) return false;

            const userSchichtIds = (planRows || [])
              .filter((r) => getEffectiveShiftKuerzel(r, artsById) === kuerzel)
              .map((r) => String(r.user_id));

            const bedarfFuerUserSchicht = getBedarfForSchicht({
              bedarfRows,
              matrixById,
              datum,
              schKey: kuerzel,
            });

            const afterIds = [...new Set(userSchichtIds)].filter(
              (x) => String(x) !== String(uid)
            );

            const afterCoverage = evaluateCoverage({
              bedarfSortiert: bedarfFuerUserSchicht,
              activeUserIds: afterIds,
              qualiMap,
            });

            return afterCoverage.ok;
          });
        }

        kandidatenIds = [...new Set(kandidatenIds)].filter(Boolean);

        if (!kandidatenIds.length) {
          setKandidaten([]);
          return;
        }

        /* ---------------------------------------------------------
         * Namen + Stunden
         * --------------------------------------------------------- */
        const [{ data: userRows, error: userErr }, { data: stundenRows, error: stundenErr }] =
          await Promise.all([
            supabase
              .from('DB_User')
              .select('user_id, vorname, nachname')
              .in('user_id', kandidatenIds),

            supabase
              .from('DB_Stunden')
              .select('user_id, vorgabe_stunden, summe_jahr, uebernahme_vorjahr')
              .eq('jahr', jahr)
              .in('user_id', kandidatenIds),
          ]);

        if (userErr) throw userErr;
        if (stundenErr) throw stundenErr;

        const userMap = new Map();
        (userRows || []).forEach((u) => {
          userMap.set(String(u.user_id), u);
        });

        const stundenMap = new Map();
        (stundenRows || []).forEach((s) => {
          const vorgabe = Number(s.vorgabe_stunden ?? 0);
          const summe = Number(s.summe_jahr ?? 0);
          const uebernahme = Number(s.uebernahme_vorjahr ?? 0);

          stundenMap.set(String(s.user_id), summe + uebernahme - vorgabe);
        });

        const rows = kandidatenIds.map((uid) => {
          const id = String(uid);
          const u = userMap.get(id);

          const angebot = angebotByUser.get(id);
          const fza = fzaByUser.get(id);
          const urlaub = urlaubByUser.get(id);

          const passendeQualis = (qualiMap[id] || [])
            .map((qid) => {
              const matrix = matrixById.get(Number(qid));

              return {
                quali_id: Number(qid),
                kuerzel: matrix?.quali_kuerzel || matrix?.qualifikation || '?',
                position: Number(matrix?.position ?? 9999),
              };
            })
            .filter(Boolean)
            .sort((a, b) => a.position - b.position);

          const primaryAnfrage =
            modus === 'einspringen'
              ? angebot
              : modus === 'freizeitausgleich'
                ? fza
                : modus === 'urlaub'
                  ? urlaub
                  : null;

          return {
            user_id: id,
            name: u ? `${u.vorname} ${u.nachname}` : '—',
            vorname: u?.vorname || '',
            nachname: u?.nachname || '',
            stunden: stundenMap.get(id) ?? 0,
            hatAngebot: !!angebot,
            hatFzaAntrag: !!fza,
            hatUrlaubsantrag: !!urlaub,
            antragId: primaryAnfrage?.id || null,
            antragText: primaryAnfrage?.antrag || null,
            angefragtAm: primaryAnfrage?.created_at || null,
            qualis: passendeQualis,
          };
        });

        rows.sort((a, b) => {
          // Einspringen: wenig Stunden oben.
          if (modus === 'einspringen') {
            if (a.stunden !== b.stunden) return a.stunden - b.stunden;
            return a.name.localeCompare(b.name);
          }

          // FZA/Urlaub: viele Stunden oben.
          if (a.stunden !== b.stunden) return b.stunden - a.stunden;
          return a.name.localeCompare(b.name);
        });

        setKandidaten(rows);
      } catch (e) {
        console.error('Fairnessliste laden Fehler:', e?.message || e);
        setKandidaten([]);
      } finally {
        setLoading(false);
      }
    };

    ladeKandidaten();
  }, [
    offen,
    analyseGeladen,
    firmaId,
    unitId,
    datum,
    schichtKuerzel,
    requestedArt?.startzeit,
    requestedArt?.endzeit,
    modus,
    basisAnfrage?._nurKandidat,
    JSON.stringify(fehlendeQualiIds || []),
  ]);

  return (
    <div className="hidden lg:flex w-80 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden flex-col">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {titel}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-300">
          {untertitel}
        </div>
      </div>

      <div className="p-2 overflow-auto max-h-[78vh]">
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Lädt Fairnessliste…
          </div>
        ) : kandidaten.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-300">
            Keine passenden Einträge gefunden.
          </div>
        ) : (
          <div className="space-y-2">
            {kandidaten.map((k) => (
              <button
                type="button"
                key={k.user_id}
                onClick={() => {
                  const istEchterAntrag =
                    (modus === 'einspringen' && k.antragId) ||
                    (modus === 'freizeitausgleich' && k.antragId) ||
                    (modus === 'urlaub' && k.antragId);

                  onKandidatAuswahl?.({
                    ...basisAnfrage,
                    id: k.antragId || basisAnfrage.id,
                    created_by: k.user_id,
                    created_by_user: {
                      vorname: k.vorname,
                      nachname: k.nachname,
                    },
                    antrag:
                      k.antragText ||
                      (modus === 'freizeitausgleich'
                        ? 'Mitarbeiter hat keinen eigenen Freizeitausgleich beantragt.'
                        : modus === 'urlaub'
                          ? 'Mitarbeiter hat keinen eigenen Urlaub beantragt.'
                          : 'Mitarbeiter hat sich nicht angeboten.'),
                    _nurKandidat: !istEchterAntrag,
                    _fairnessModus: modus,
                  });
                }}
                className={[
                  'w-full text-left rounded-xl border px-3 py-2 text-sm hover:scale-[1.01] transition',
                  k.hatAngebot
                    ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : k.hatFzaAntrag
                      ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
                      : k.hatUrlaubsantrag
                        ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                        : 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
                ].join(' ')}
                title={k.antragText || ''}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {k.name}
                  </div>

                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 whitespace-nowrap">
                    {fmtStd(k.stunden)} Std.
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {k.hatAngebot && (
                    <span className="inline-flex rounded-full bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100 px-2 py-0.5 text-[11px] font-semibold">
                      angeboten
                    </span>
                  )}

                  {k.hatFzaAntrag && (
                    <span className="inline-flex rounded-full bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100 px-2 py-0.5 text-[11px] font-semibold">
                      FZA-Antrag
                    </span>
                  )}

                  {k.hatUrlaubsantrag && (
                    <span className="inline-flex rounded-full bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 px-2 py-0.5 text-[11px] font-semibold">
                      Urlaubsantrag
                    </span>
                  )}

                  {k.qualis?.slice(0, 4).map((q) => (
                    <span
                      key={`${k.user_id}_${q.quali_id}`}
                      className="inline-flex rounded-full bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-0.5 text-[11px] font-semibold"
                    >
                      {q.kuerzel}
                    </span>
                  ))}
                </div>

                {k.angefragtAm && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-300 mt-1">
                    Antrag: {dayjs(k.angefragtAm).format('DD.MM.YY HH:mm')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-300">
        Der SchichtPilot entscheidet nicht automatisch. Die Auswahl bleibt beim Menschen.
      </div>
    </div>
  );
}