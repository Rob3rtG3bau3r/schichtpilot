// src/components/Dashboard/AMAMKandidatenliste.jsx
import React, { useEffect, useState } from 'react';
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

const istAngebotText = (txt = '') => {
  const t = String(txt || '').toLowerCase();

  return (
    t.includes('freiwillig') ||
    t.includes('biete') ||
    t.includes('einspring') ||
    t.includes('angeboten')
  );
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

  // schichtart null => gilt für alle Schichten
  if (b.schichtart == null) return true;

  return b.schichtart === schLabel;
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
         * 1) Offene Angebote für denselben Tag + dieselbe Schicht
         * --------------------------------------------------------- */
        const { data: angebotRows, error: angebotErr } = await supabase
          .from('DB_AnfrageMA')
          .select(
            `
            id,
            created_by,
            antrag,
            created_at,
            created_by_user:created_by (
              vorname,
              nachname
            )
          `
          )
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId)
          .eq('datum', datum)
          .eq('schicht', schichtKuerzel)
          .is('genehmigt', null)
          .is('datum_entscheid', null);

        if (angebotErr) throw angebotErr;

        const angebotGefiltert = (angebotRows || []).filter((r) =>
          istAngebotText(r.antrag)
        );

        const angebotUserIds = new Set(
          angebotGefiltert
            .map((r) => r.created_by)
            .filter(Boolean)
            .map(String)
        );

        const angebotByUser = new Map();

        angebotGefiltert.forEach((r) => {
          angebotByUser.set(String(r.created_by), r);
        });

        /* ---------------------------------------------------------
         * 2) Tagesplan laden: Nur echte freie Tage zulassen
         * Regel:
         * Soll = '-' UND Ist = null oder '-'
         * Alles andere ist NICHT verfügbar.
         * --------------------------------------------------------- */
        const { data: planRows, error: planErr } = await supabase
          .from('v_tagesplan')
          .select('user_id, soll_schichtart_id, ist_schichtart_id')
          .eq('firma_id', firmaId)
          .eq('unit_id', unitId)
          .eq('datum', datum);

        if (planErr) throw planErr;

        const schichtArtIds = [
          ...new Set(
            (planRows || [])
              .flatMap((r) => [r.soll_schichtart_id, r.ist_schichtart_id])
              .filter(Boolean)
          ),
        ];

        let artsById = new Map();

        if (schichtArtIds.length) {
          const { data: arts, error: artsErr } = await supabase
            .from('DB_SchichtArt')
            .select('id, kuerzel')
            .eq('firma_id', firmaId)
            .eq('unit_id', unitId)
            .in('id', schichtArtIds);

          if (artsErr) throw artsErr;

          (arts || []).forEach((a) => {
            artsById.set(a.id, a);
          });
        }

        const verfuegbarUserIds = new Set();

        (planRows || []).forEach((r) => {
          const sollKuerzel = artsById.get(r.soll_schichtart_id)?.kuerzel || null;

          const istKuerzel = r.ist_schichtart_id
            ? artsById.get(r.ist_schichtart_id)?.kuerzel || null
            : null;

          const istVerfuegbar =
            sollKuerzel === '-' &&
            (istKuerzel === null || istKuerzel === '-');

          if (istVerfuegbar) {
            verfuegbarUserIds.add(String(r.user_id));
          }
        });

        let kandidatenIds = [...verfuegbarUserIds];

        if (!kandidatenIds.length) {
          setKandidaten([]);
          return;
        }

        /* ---------------------------------------------------------
         * 3) Ruhezeitprüfung:
         * Wer keine 11 Stunden vor/nach der Zielschicht hat,
         * wird gar nicht angezeigt.
         * --------------------------------------------------------- */
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

        const { data: ruheRows, error: ruheErr } = await supabase
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
          .lte('datum', bisRuhe);

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

            // Zieltag ignorieren, weil hier die neue Schicht geprüft wird.
            if (rowDatum === datum) return;

            const useIst = !!r.ist_schichtart_id;
            const artId = useIst ? r.ist_schichtart_id : r.soll_schichtart_id;
            const art = ruheArtsById.get(artId);

            if (!art) return;

            // Nur echte Arbeitsschichten sind ruhezeitrelevant.
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

          const vorherOk = stundenVorher == null || stundenVorher >= 11;
          const nachherOk = stundenNachher == null || stundenNachher >= 11;

          return vorherOk && nachherOk;
        };

        kandidatenIds = kandidatenIds.filter((uid) => hatGenugRuhezeit(uid));

        if (!kandidatenIds.length) {
          setKandidaten([]);
          return;
        }

        /* ---------------------------------------------------------
         * 4) Qualifikationslogik:
         * Nur Kandidaten anzeigen, die mindestens eine für diese
         * Schicht benötigte, aktive und betriebsrelevante Qualifikation haben.
         * --------------------------------------------------------- */
        const [{ data: bedarfRows, error: bedarfErr }, { data: matrixRows, error: matrixErr }] =
          await Promise.all([
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

        if (bedarfErr) throw bedarfErr;
        if (matrixErr) throw matrixErr;

        const matrixById = new Map();

        (matrixRows || []).forEach((q) => {
          matrixById.set(q.id, q);
        });

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

        const requiredQualiIds = [
            ...new Set(
                (bedarfHeute || [])
                .filter((b) => Number(b.anzahl || 0) > 0)
                .filter((b) => {
                    const q = matrixById.get(b.quali_id);
                    return q && q.aktiv !== false && q.betriebs_relevant === true;
                })
                .map((b) => Number(b.quali_id))
                .filter(Boolean)
            ),
            ];

            if (!requiredQualiIds.length) {
            setKandidaten([]);
            return;
            }

            const fehlendeQualiFilterIds = [
            ...new Set(
                (fehlendeQualiIds || [])
                .map((id) => Number(id))
                .filter((id) => requiredQualiIds.includes(id))
            ),
            ];

            // Wichtig:
            // Die Kandidatenliste zeigt nur Mitarbeitende,
            // die eine aktuell wirklich fehlende Qualifikation haben.
            // Wenn aktuell keine Qualifikation fehlt, zeigen wir keine Kandidaten.
            if (!fehlendeQualiFilterIds.length) {
            setKandidaten([]);
            return;
            }
        
        const { data: qualiRows, error: qualiErr } = await supabase
          .from('DB_Qualifikation')
          .select('id, user_id, quali, quali_start, quali_endet')
          .in('user_id', kandidatenIds);

        if (qualiErr) throw qualiErr;

        const qualiByUser = new Map();

        (qualiRows || []).forEach((q) => {
          const uid = String(q.user_id);

          if (!isBetweenQualiDate(q, datum)) return;
          if (!fehlendeQualiFilterIds.includes(Number(q.quali))) return;

          const matrix = matrixById.get(q.quali);
          if (!matrix) return;
          if (matrix.aktiv === false) return;
          if (matrix.betriebs_relevant !== true) return;

          const arr = qualiByUser.get(uid) || [];

          arr.push({
            quali_id: q.quali,
            kuerzel: matrix.quali_kuerzel || matrix.qualifikation || '?',
            position: Number(matrix.position ?? 9999),
          });

          qualiByUser.set(uid, arr);
        });

        kandidatenIds = kandidatenIds.filter((uid) => {
          const arr = qualiByUser.get(String(uid)) || [];
          return arr.length > 0;
        });

        if (!kandidatenIds.length) {
          setKandidaten([]);
          return;
        }

        /* ---------------------------------------------------------
         * 5) Namen laden
         * --------------------------------------------------------- */
        const { data: userRows, error: userErr } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname')
          .in('user_id', kandidatenIds);

        if (userErr) throw userErr;

        const userMap = new Map();

        (userRows || []).forEach((u) => {
          userMap.set(String(u.user_id), u);
        });

        /* ---------------------------------------------------------
         * 6) Stundenkonto laden
         * --------------------------------------------------------- */
        const { data: stundenRows, error: stundenErr } = await supabase
          .from('DB_Stunden')
          .select('user_id, vorgabe_stunden, summe_jahr, uebernahme_vorjahr')
          .eq('jahr', jahr)
          .in('user_id', kandidatenIds);

        if (stundenErr) throw stundenErr;

        const stundenMap = new Map();

        (stundenRows || []).forEach((s) => {
          const vorgabe = Number(s.vorgabe_stunden ?? 0);
          const summe = Number(s.summe_jahr ?? 0);
          const uebernahme = Number(s.uebernahme_vorjahr ?? 0);

          stundenMap.set(String(s.user_id), summe + uebernahme - vorgabe);
        });

        /* ---------------------------------------------------------
         * 7) Kandidaten bauen
         * --------------------------------------------------------- */
        const rows = kandidatenIds.map((uid) => {
          const id = String(uid);
          const u = userMap.get(id);
          const angebot = angebotByUser.get(id);

          const qualis = (qualiByUser.get(id) || [])
            .slice()
            .sort((a, b) => a.position - b.position);

          return {
            user_id: id,
            name: u ? `${u.vorname} ${u.nachname}` : '—',
            vorname: u?.vorname || '',
            nachname: u?.nachname || '',
            hatAngebot: angebotUserIds.has(id),
            stunden: stundenMap.get(id) ?? 0,
            antragId: angebot?.id || null,
            antragText: angebot?.antrag || null,
            angebotenAm: angebot?.created_at || null,
            qualis,
          };
        });

        // Fairness-Sortierung:
        // 1. niedrigstes Stundenkonto zuerst
        // 2. bei Gleichstand Name
        // "Angeboten" ist nur Highlight, kein Sortier-Vorteil.
        rows.sort((a, b) => {
          if (a.stunden !== b.stunden) {
            return a.stunden - b.stunden;
          }

          return a.name.localeCompare(b.name);
        });

        setKandidaten(rows);
      } catch (e) {
        console.error('Kandidaten laden Fehler:', e?.message || e);
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
    JSON.stringify(fehlendeQualiIds || []),
    ]);

  return (
    <div className="hidden lg:flex w-80 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl overflow-hidden flex-col">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          Faire Kandidatenempfehlung
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-300">
          Verfügbar • Ruhezeit ok • Quali passend • nach Stunden sortiert
        </div>
      </div>

      <div className="p-2 overflow-auto max-h-[78vh]">
        {loading ? (
          <div className="text-sm text-gray-500 dark:text-gray-300 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Lädt Kandidaten…
          </div>
        ) : kandidaten.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-300">
            Keine passenden Kandidaten gefunden.
          </div>
        ) : (
          <div className="space-y-2">
            {kandidaten.map((k) => (
              <button
                type="button"
                key={k.user_id}
                onClick={() => {
                  onKandidatAuswahl?.({
                    ...basisAnfrage,
                    id: k.antragId || basisAnfrage.id,
                    created_by: k.user_id,
                    created_by_user: {
                      vorname: k.vorname,
                      nachname: k.nachname,
                    },
                    antrag: k.antragText || `Kandidat ist frei für ${schichtKuerzel}`,
                    _nurKandidat: !k.antragId,
                  });
                }}
                className={[
                  'w-full text-left rounded-xl border px-3 py-2 text-sm hover:scale-[1.01] transition',
                  k.hatAngebot
                    ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
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

                  {k.qualis?.map((q) => (
                    <span
                      key={`${k.user_id}_${q.quali_id}`}
                      className="inline-flex rounded-full bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200 px-2 py-0.5 text-[11px] font-semibold"
                    >
                      {q.kuerzel}
                    </span>
                  ))}
                </div>

                {k.angebotenAm && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-300 mt-1">
                    Angebot: {dayjs(k.angebotenAm).format('DD.MM.YY HH:mm')}
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