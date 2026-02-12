// ==============================
// components/Dashboard/TagesUebersicht.jsx
// ==============================
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { ChevronDown, ChevronRight, Maximize2, X, Presentation, Rows3 } from 'lucide-react';

/* -------------------------------- UI Helpers -------------------------------- */

const Pill = ({ children, title, stacked = false, big = false }) => (
  <span
    title={title}
    className={[
      "inline-flex items-center rounded-full bg-gray-300 dark:bg-gray-600",
      big ? "text-sm px-3 py-2" : "text-xs px-2 py-1",
      stacked ? "w-full mr-0 mb-0" : "mr-2 mb-2",
    ].join(" ")}
  >
    {children}
  </span>
);

const Section = ({ id, title, counter, children, defaultOpen = true }) => {
  const storageKey = `sp_tages_section_${id}`;
  const [open, setOpen] = useState(() => {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? defaultOpen : raw === '1';
  });

  useEffect(() => {
    localStorage.setItem(storageKey, open ? '1' : '0');
  }, [open, storageKey]);

  return (
    <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-300/10 dark:bg-gray-900/20">
      <button
        className="w-full flex items-center justify-between px-3 py-2"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <div className="flex items-center gap-2 text-left">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-semibold">{title}</span>
        </div>
        {typeof counter !== 'undefined' && (
          <span className="text-xs opacity-70">{counter}</span>
        )}
      </button>
      {open && (<div className="px-3 pb-3">{children}</div>)}
    </div>
  );
};

const MiniTable = ({ rows, big = false }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full">
      <thead>
        <tr className={["text-left uppercase opacity-70", big ? "text-sm" : "text-xs"].join(" ")}>
          <th className="py-1 pr-4">Kürzel</th>
          <th className="py-1 pr-4">Anzahl</th>
          <th className="py-1">Namen</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx} className="border-t border-gray-300 dark:border-gray-700">
            <td className={["py-1 pr-4 font-mono", big ? "text-base" : "text-sm"].join(" ")}>
              {r.kuerzel}
            </td>
            <td className={["py-1 pr-4", big ? "text-base" : "text-sm"].join(" ")}>
              {r.anzahl}
            </td>
            <td className="py-1">
              <div className="flex flex-wrap">
                {r.namen.map((n, i) => (<Pill key={i} big={big}>{n}</Pill>))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AmpelDot = ({ status }) => {
  // status: 'ok' | 'warn' | 'bad' | 'none' | 'unknown'
  const cls =
    status === 'ok' ? 'bg-green-500' :
      status === 'warn' ? 'bg-amber-400' :
        status === 'bad' ? 'bg-red-500' :
          status === 'none' ? 'bg-gray-400/60 dark:bg-gray-600/60' :
            'bg-gray-300 dark:bg-gray-700';

  const title =
    status === 'ok' ? 'Bedarf gedeckt' :
      status === 'warn' ? 'Zeitliche Unterdeckung (Segment)' :
        status === 'bad' ? 'Bedarf nicht gedeckt' :
          status === 'none' ? 'Kein betriebsrelevanter Bedarf' :
            'Bedarf-Status unbekannt';

  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${cls} border border-black/10 dark:border-white/10`}
      title={title}
    />
  );
};

const shiftKeyFromTitle = (t) => (t === 'Früh' ? 'F' : t === 'Spät' ? 'S' : t === 'Nacht' ? 'N' : null);

/* ----------------------------- Bedarf-Helpers ------------------------------ */

const SCH_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };
const SCH_INDEX = { 'Früh': 0, 'Spät': 1, 'Nacht': 2 };

// (wie in MitarbeiterBedarf) - gilt ein Bedarfseintrag für diese Schicht?
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

  // Wochenbetrieb-Regeln (wie in MitarbeiterBedarf)
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
        break;
    }
  }

  if (!schichtInnerhalbGrenzen(b, datumISO, schLabel)) return false;

  if (b.schichtart == null) return true;
  return b.schichtart === schLabel;
};

// Abdeckungs-Algorithmus (1 Person deckt genau 1 Quali) – wie in MitarbeiterBedarf
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

/* -------------------------------- Component -------------------------------- */

export default function TagesUebersicht() {
  const { rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();

  // Gesamt-Klappzustand
  const mainStorageKey = `sp_tages_offen_${unit || 'none'}`;
  const [offen, setOffen] = useState(() => {
    try { return localStorage.getItem(mainStorageKey) !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(mainStorageKey, offen ? '1' : '0'); } catch { }
  }, [offen, mainStorageKey]);
  useEffect(() => {
    try { setOffen(localStorage.getItem(mainStorageKey) !== '0'); } catch { setOffen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ampelToday, setAmpelToday] = useState({
    datum: null,
    F: 'unknown',
    S: 'unknown',
    N: 'unknown',
  });

  // Fokus-Modal State
  const [focusOpen, setFocusOpen] = useState(false);
  const [praesiMode, setPraesiMode] = useState(true);        // größer + besser lesbar
  const [onlySchichten, setOnlySchichten] = useState(false); // für Morgenrunde: nur Schichten

  // ESC + Scroll-Lock
  useEffect(() => {
    if (!focusOpen) return;

    const onKey = (e) => {
      if (e.key === 'Escape') setFocusOpen(false);
    };
    window.addEventListener('keydown', onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [focusOpen]);

  // Initial-State
  const [data, setData] = useState({
    enabled: true,
    datum: dayjs().format('YYYY-MM-DD'),
    kampfliste: { schichten: { frueh: [], spaet: [], nacht: [] }, andere_kuerzel: [], krank: [] },
    termine: { termine: [] },
    bedarf: { normalbetrieb: [], zeitlich: [], summiert: [] },
  });

  // Sichtbarkeit (wer sieht diese Box überhaupt)
  const darfSehen = useMemo(() => ['Planner', 'Admin_Dev'].includes(rolle), [rolle]);

  useEffect(() => {
    const ladeHeute = async () => {
      if (!darfSehen || !firma || !unit) { setLoading(false); return; }
      setLoading(true);
      setError('');

      const heute = dayjs().format('YYYY-MM-DD');
      const gestern = dayjs(heute).subtract(1, 'day').format('YYYY-MM-DD');

      try {
        // --- 1) Schichtarten (Mapping id -> kuerzel) ---
        const { data: artRows, error: artErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit));

        if (artErr) throw artErr;

        const kuerzelByArtId = new Map();
        (artRows || []).forEach(r => kuerzelByArtId.set(r.id, r.kuerzel));

        // --- 2) SOLL-Plan heute (für Anzeige) ---
        const { data: sollRows, error: sollErr } = await supabase
          .from('DB_SollPlan')
          .select('schichtgruppe, kuerzel')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('datum', heute);
        if (sollErr) throw sollErr;
        const kuerzelByGruppe = new Map();
        (sollRows || []).forEach(r => kuerzelByGruppe.set(r.schichtgruppe, r.kuerzel));

        // --- 3) Zuweisungen heute (für Anzeige) ---
        const { data: zuwRows, error: zuwErr } = await supabase
          .from('DB_SchichtZuweisung')
          .select('user_id, schichtgruppe')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .lte('von_datum', heute)
          .or(`bis_datum.is.null,bis_datum.gte.${heute}`);
        if (zuwErr) throw zuwErr;
        const gruppeByUser = new Map();
        (zuwRows || []).forEach(r => gruppeByUser.set(String(r.user_id), r.schichtgruppe));

        // --- 4) Kampfliste heute/gestern (für Anzeige krank "neu") ---
        const [klHeute, klGestern] = await Promise.all([
          supabase.from('DB_Kampfliste')
            .select('user, ist_schicht, created_at')
            .eq('firma_id', Number(firma)).eq('unit_id', Number(unit))
            .eq('datum', heute).order('created_at', { ascending: false }),
          supabase.from('DB_Kampfliste')
            .select('user, ist_schicht, created_at')
            .eq('firma_id', Number(firma)).eq('unit_id', Number(unit))
            .eq('datum', gestern).order('created_at', { ascending: false }),
        ]);
        if (klHeute.error) throw klHeute.error;
        if (klGestern.error) throw klGestern.error;

        const latestKuerzelByUserHeute = new Map();
        for (const row of klHeute.data || []) {
          const uid = String(row.user);
          if (!latestKuerzelByUserHeute.has(uid)) {
            latestKuerzelByUserHeute.set(uid, kuerzelByArtId.get(row.ist_schicht) || null);
          }
        }
        const latestKuerzelByUserGestern = new Map();
        for (const row of klGestern.data || []) {
          const uid = String(row.user);
          if (!latestKuerzelByUserGestern.has(uid)) {
            latestKuerzelByUserGestern.set(uid, kuerzelByArtId.get(row.ist_schicht) || null);
          }
        }

        // --- 5) Kandidaten-User (für Anzeige) ---
        const userIdsSet = new Set([
          ...Array.from(gruppeByUser.keys()),
          ...Array.from(latestKuerzelByUserHeute.keys()),
        ]);
        const userIds = Array.from(userIdsSet);

        // --- 6) Usernamen laden (für Anzeige) ---
        let userNameMap = new Map();
        if (userIds.length) {
          const { data: userRows, error: userErr } = await supabase
            .from('DB_User')
            .select('user_id, vorname, nachname')
            .in('user_id', userIds);
          if (userErr) throw userErr;
          (userRows || []).forEach(u => {
            userNameMap.set(String(u.user_id), `${u.nachname || ''}, ${u.vorname || ''}`.trim());
          });
        }

        // --- 7) Ausgrauen HEUTE (für Anzeige + Bedarf) ---
        const isGreyToday = new Map(); // uid -> true/false
        if (userIds.length) {
          const { data: greyRows, error: greyErr } = await supabase
            .from('DB_Ausgrauen')
            .select('user_id, von, bis')
            .in('user_id', userIds)
            .eq('firma_id', Number(firma))
            .eq('unit_id', Number(unit))
            .lte('von', heute)
            .or(`bis.is.null, bis.gte.${heute}`);
          if (greyErr) throw greyErr;
          (greyRows || []).forEach(r => {
            isGreyToday.set(String(r.user_id), true);
          });
        }

        // --- 8) Bedarf + QualiMatrix (wie MitarbeiterBedarf) ---
        const [{ data: bedarfRows, error: bedErr }, { data: matrixRows, error: matrixErr }] = await Promise.all([
          supabase
            .from('DB_Bedarf')
            .select(`
              id, quali_id, anzahl, von, bis, namebedarf, farbe,
              normalbetrieb, schichtart, start_schicht, end_schicht,
              betriebsmodus, wochen_tage
            `)
            .eq('firma_id', Number(firma))
            .eq('unit_id', Number(unit)),
          supabase
            .from('DB_Qualifikationsmatrix')
            .select('id, quali_kuerzel, qualifikation, firma_id, unit_id, aktiv, betriebs_relevant, position')
            .eq('firma_id', Number(firma))
            .eq('unit_id', Number(unit)),
        ]);
        if (bedErr) throw bedErr;
        if (matrixErr) throw matrixErr;

        // für Anzeige (Bedarf-Tabelle in Tagesübersicht)
        const qmById = new Map();
        (matrixRows || []).forEach(q => {
          const isRelevant = (q.betriebs_relevant === false) ? false : true;
          qmById.set(q.id, {
            kuerzel: q.quali_kuerzel,
            label: q.qualifikation,
            relevant: isRelevant,
          });
        });

        // für Berechnung (Ampel)
        const matrixMap = {};
        (matrixRows || []).forEach(q => {
          matrixMap[q.id] = {
            kuerzel: q.quali_kuerzel,
            position: Number(q.position) || 999,
            relevant: (q.betriebs_relevant === false) ? false : true,
          };
        });

        // --- 9) v_tagesplan HEUTE (Basis für Ampel) ---
        const { data: tpRows, error: tpErr } = await supabase
          .from('v_tagesplan')
          .select('user_id, ist_schichtart_id')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('datum', heute);
        if (tpErr) throw tpErr;

        // aktiveUser pro Schicht (nur F/S/N)
        const activeByShift = { F: [], S: [], N: [] };
        const allUsersTodaySet = new Set();

        for (const r of tpRows || []) {
          const uid = String(r.user_id);
          const kz = kuerzelByArtId.get(r.ist_schichtart_id) || null;
          if (kz === 'F' || kz === 'S' || kz === 'N') {
            activeByShift[kz].push(uid);
            allUsersTodaySet.add(uid);
          }
        }

        // Ausgrauen rausfiltern (wie Cockpit)
        const notGrey = (uid) => !isGreyToday.get(String(uid));
        activeByShift.F = activeByShift.F.filter(notGrey);
        activeByShift.S = activeByShift.S.filter(notGrey);
        activeByShift.N = activeByShift.N.filter(notGrey);

        const allUsersToday = Array.from(allUsersTodaySet).filter(notGrey);

        // --- 10) Qualifikationen HEUTE für diese User (Ampel) ---
        let qualiRows = [];
        if (allUsersToday.length) {
          const { data: qRows, error: qErr } = await supabase
            .from('DB_Qualifikation')
            .select('user_id, quali, quali_start, quali_endet')
            .in('user_id', allUsersToday);
          if (qErr) throw qErr;
          qualiRows = qRows || [];
        }

        const userQualiMap = {};
        for (const q of qualiRows || []) {
          const uid = String(q.user_id);
          const startOk = !q.quali_start || q.quali_start <= heute;
          const endOk = !q.quali_endet || q.quali_endet >= heute;
          if (!startOk || !endOk) continue;
          if (!userQualiMap[uid]) userQualiMap[uid] = [];
          userQualiMap[uid].push(q.quali);
        }

        // --- 11) Ampel berechnen (ok/bad/none) ---
        const calcAmpelForShift = (schKey) => {
          // Bedarf HEUTE
          const bedarfTag = (bedarfRows || []).filter(b =>
            (!b.von || heute >= b.von) && (!b.bis || heute <= b.bis)
          );

          // nur Bedarfe, die für diese Schicht gelten
          const bedarfTagSchicht = bedarfTag.filter(b => bedarfGiltFuerSchicht(b, heute, schKey));

          // zeitlich überschreibt normalbetrieb
          const hatZeitlich = bedarfTagSchicht.some(b => b.normalbetrieb === false);
          const bedarfHeute = bedarfTagSchicht.filter(b => b.normalbetrieb === !hatZeitlich);

          // sortiert + nur betriebsrelevant
          const bedarfSortiert = bedarfHeute
            .map(b => ({
              ...b,
              position: matrixMap[b.quali_id]?.position ?? 999,
              kuerzel: matrixMap[b.quali_id]?.kuerzel || '???',
              relevant: matrixMap[b.quali_id]?.relevant,
            }))
            .filter(b => b.relevant)
            .sort((a, b) => a.position - b.position);

          if (bedarfSortiert.length === 0) return 'none';

          const aktiveUser = activeByShift[schKey] || [];
          const base = calcCoverage({ aktiveUser, userQualiMap, bedarfSortiert, matrixMap });

          return base.totalMissing > 0 ? 'bad' : 'ok';
        };

        setAmpelToday({
          datum: heute,
          F: calcAmpelForShift('F'),
          S: calcAmpelForShift('S'),
          N: calcAmpelForShift('N'),
        });

        // --- 12) Anzeige: "beste Quali-Position" pro User (Sortierung) ---
        const bestPosByUser = new Map(); // uid -> kleinste Position (nur relevante Qualis)
        for (const uid of userIds) bestPosByUser.set(String(uid), 9999);

        for (const q of qualiRows || []) {
          const uid = String(q.user_id);
          if (!bestPosByUser.has(uid)) continue;
          const pos = matrixMap[q.quali]?.position ?? 9999;
          const rel = matrixMap[q.quali]?.relevant;
          const startOk = !q.quali_start || q.quali_start <= heute;
          const endOk = !q.quali_endet || q.quali_endet >= heute;
          if (!startOk || !endOk) continue;
          if (!rel) continue;
          const cur = bestPosByUser.get(uid) ?? 9999;
          if (pos < cur) bestPosByUser.set(uid, pos);
        }

        // --- 13) Finale Kürzel (Override -> Plan) (Anzeige wie vorher) ---
        const finalKuerzelByUser = new Map();
        for (const uid of userIds) {
          const over = latestKuerzelByUserHeute.get(uid);
          if (over) finalKuerzelByUser.set(uid, over);
          else {
            const grp = gruppeByUser.get(uid);
            const base = grp ? kuerzelByGruppe.get(grp) : null;
            if (base) finalKuerzelByUser.set(uid, base);
          }
        }

        // --- 14) Aufteilen / Sammeln mit Grey-Flag (Anzeige wie vorher) ---
        const F = [], S = [], N = [];
        const andereMap = new Map();
        const krankArr = [];

        const addAndere = (kz, name, grey, uid) => {
          if (!kz || kz.trim() === '-') return;
          if (!andereMap.has(kz)) andereMap.set(kz, []);
          andereMap.get(kz).push({ name, grey, uid });
        };

        for (const uid of userIds) {
          const name = userNameMap.get(uid) || `User ${uid}`;
          const k = finalKuerzelByUser.get(uid);
          if (!k) continue;

          const grey = !!isGreyToday.get(uid);

          if (k === 'F') F.push({ name, grey, uid });
          else if (k === 'S') S.push({ name, grey, uid });
          else if (k === 'N') N.push({ name, grey, uid });
          else if (k === 'K' || k === 'KO') {
            const gesternK = latestKuerzelByUserGestern.get(uid);
            krankArr.push({ name, neu: !(gesternK === 'K' || gesternK === 'KO') });
          } else addAndere(k, name, grey, uid);
        }

        // Sortierung: 1) nicht-grau vor grau, 2) nach bester Quali (kleinste Position), 3) Name
        const sortNames = (arr) =>
          arr.slice().sort((a, b) => {
            if (a.grey !== b.grey) return a.grey ? 1 : -1;
            const pa = bestPosByUser.get(String(a.uid)) ?? 9999;
            const pb = bestPosByUser.get(String(b.uid)) ?? 9999;
            if (pa !== pb) return pa - pb;
            return a.name.localeCompare(b.name, 'de');
          });

        const F_sorted = sortNames(F);
        const S_sorted = sortNames(S);
        const N_sorted = sortNames(N);

        const andere = Array.from(andereMap.entries())
          .filter(([k]) => k && k.trim() !== '-')
          .map(([kuerzel, list]) => {
            const sorted = sortNames(list).map(x => (x.grey ? `${x.name} ⦸` : x.name));
            return { kuerzel, anzahl: sorted.length, namen: sorted };
          })
          .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));

        krankArr.sort((a, b) => a.name.localeCompare(b.name, 'de'));

        // --- 15) Bedarf: Anzeige-Logik wie bisher (Normalbetrieb vs Zeitlich) ---
        const isWithin = (row) =>
          row.normalbetrieb === true ||
          ((!row.von || row.von <= heute) && (!row.bis || row.bis >= heute));

        const heuteAlle = (bedarfRows || []).filter(isWithin);
        const zeitlichAlle = heuteAlle.filter(b => b.normalbetrieb === false);

        const aktivSet = zeitlichAlle.length ? zeitlichAlle : heuteAlle.filter(b => b.normalbetrieb === true);

        const mapped = aktivSet.map(b => ({
          id: b.id,
          quali_kuerzel: qmById.get(b.quali_id)?.kuerzel || '???',
          quali_label: qmById.get(b.quali_id)?.label || null,
          relevant: qmById.get(b.quali_id)?.relevant ?? true,
          anzahl: Number(b.anzahl || 0),
          namebedarf: b.namebedarf || null,
          farbe: b.farbe || null,
          von: b.von || null,
          bis: b.bis || null,
          normalbetrieb: !!b.normalbetrieb,
          schichtart: b.schichtart || null,
          start_schicht: b.start_schicht || 'Früh',
          end_schicht: b.end_schicht || 'Nacht',
        }));

        const showingZeitlich = mapped.some(e => !e.normalbetrieb);
        const normalbetrieb = showingZeitlich ? [] : mapped;
        const zeitlich = showingZeitlich ? mapped : [];

        const summeMap = new Map();
        for (const e of mapped) {
          const key = e.quali_kuerzel;
          summeMap.set(key, (summeMap.get(key) || 0) + (e.anzahl || 0));
        }
        const summiert = Array.from(summeMap.entries())
          .map(([quali_kuerzel, total_anzahl]) => ({ quali_kuerzel, total_anzahl }))
          .sort((a, b) => a.quali_kuerzel.localeCompare(b.quali_kuerzel, 'de'));

        // --- 16) Termine heute (Anzeige wie bisher) ---
        const { data: termRows, error: termErr } = await supabase
          .from('DB_TerminVerwaltung')
          .select('id, bezeichnung, farbe, ziel_typ, team, quali_ids, datum, wiederholend, created_at')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('datum', heute)
          .order('created_at', { ascending: false });
        if (termErr) throw termErr;

        const termineHeute = (termRows || []).map(r => ({
          id: r.id,
          bezeichnung: r.bezeichnung || '(ohne Titel)',
          farbe: r.farbe || null,
          ziel_typ: r.ziel_typ || (Array.isArray(r.quali_ids) && r.quali_ids.length ? 'Qualifikationen' : 'Team'),
          team: Array.isArray(r.team) ? r.team : (r.team ? [r.team] : []),
          quali_ids: Array.isArray(r.quali_ids) ? r.quali_ids : [],
          datum: r.datum || heute,
          wiederholend: !!r.wiederholend,
        }));

        // --- 17) Final render state ---
        setData({
          enabled: true,
          datum: heute,
          kampfliste: {
            schichten: {
              frueh: F_sorted.map(x => (x.grey ? `${x.name} ⦸` : x.name)),
              spaet: S_sorted.map(x => (x.grey ? `${x.name} ⦸` : x.name)),
              nacht: N_sorted.map(x => (x.grey ? `${x.name} ⦸` : x.name)),
            },
            andere_kuerzel: andere,
            krank: krankArr,
          },
          termine: { termine: termineHeute },
          bedarf: { normalbetrieb, zeitlich, summiert },
        });
      } catch (e) {
        console.error('Tagesübersicht laden fehlgeschlagen', e);
        setError(e.message || 'Fehler beim Laden');
        setAmpelToday({
          datum: dayjs().format('YYYY-MM-DD'),
          F: 'unknown',
          S: 'unknown',
          N: 'unknown',
        });
      } finally {
        setLoading(false);
      }
    };

    ladeHeute();
  }, [darfSehen, firma, unit]);

  if (!darfSehen) return null;

  const datumStr = dayjs(data?.datum).format('DD.MM.YYYY');
  const enabled = !!data?.enabled;
  const schichten = data?.kampfliste?.schichten || { frueh: [], spaet: [], nacht: [] };
  const andere = data?.kampfliste?.andere_kuerzel || [];
  const krank = data?.kampfliste?.krank || [];
  const termine = data?.termine?.termine || [];
  const nb = data?.bedarf?.normalbetrieb || [];
  const zb = data?.bedarf?.zeitlich || [];
  const showZeitlich = Array.isArray(zb) && zb.length > 0;

  const counter = `${termine.length} Termine • ${andere.length} andere Kürzel • ${krank.length} krank`;

  // ✅ Inhalt-Funktion
  const renderInhalt = (big = false) => (
    <>
      {loading ? (
        <div className={big ? "text-base opacity-80" : "text-sm opacity-80"}>Lade…</div>
      ) : error ? (
        <div className={big ? "text-base text-red-600" : "text-sm text-red-600"}>{error}</div>
      ) : !enabled ? null : (
        <div className="space-y-3">
          {/* Schichten */}
          <Section id="schichten" title="Schichten">
            <div className={["grid gap-3", big ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 md:grid-cols-3"].join(" ")}>
              {[
                { title: 'Früh', items: schichten.frueh },
                { title: 'Spät', items: schichten.spaet },
                { title: 'Nacht', items: schichten.nacht },
              ].map((blk) => (
                <div key={blk.title}>
                  <div className={["flex items-center gap-2 uppercase opacity-70 mb-1", big ? "text-sm" : "text-xs"].join(" ")}>
                    <span>{blk.title}</span>
                    <AmpelDot status={ampelToday?.[shiftKeyFromTitle(blk.title)] || 'unknown'} />
                  </div>

                  <div className="flex flex-col gap-2">
                    {blk.items.map((n, i) => (
                      <Pill
                        key={i}
                        stacked
                        big={big}
                        title={n.endsWith('⦸') ? 'ausgegraut' : undefined}
                      >
                        {n}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {onlySchichten ? null : (
            <>
              {/* Andere Kürzel */}
              <Section id="andere" title="Andere Kürzel">
                {andere.length === 0 ? (
                  <div className={big ? "text-base opacity-70" : "text-sm opacity-70"}>Keine weiteren Einträge heute.</div>
                ) : (
                  <MiniTable rows={andere} big={big} />
                )}
              </Section>

              {/* Krank */}
              <Section id="krank" title="Krankmeldungen">
                {krank.length === 0 ? (
                  <div className={big ? "text-base opacity-70" : "text-sm opacity-70"}>Keine Krankmeldungen heute.</div>
                ) : (
                  <div className="flex flex-wrap">
                    {krank.map((k, i) => (
                      <Pill key={i} title={k.neu ? 'Neu seit heute' : 'Bereits krank'} big={big}>
                        {k.name}{k.neu ? ' • neu' : ''}
                      </Pill>
                    ))}
                  </div>
                )}
              </Section>

              {/* Termine */}
              <Section id="termine" title="Termine heute" counter={`${termine.length}`}>
                {termine.length === 0 ? (
                  <div className={big ? "text-base opacity-70" : "text-sm opacity-70"}>Keine Termine heute.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {termine.map(t => (
                      <div key={t.id} className="rounded-2xl border border-gray-300 shadow dark:border-gray-800 p-3">
                        <div className="flex items-center justify-between">
                          <div className={big ? "text-lg font-medium" : "font-medium"}>{t.bezeichnung}</div>
                          {t.farbe && <span className="w-5 h-5 rounded-full inline-block" style={{ backgroundColor: t.farbe }} />}
                        </div>
                        <div className={["opacity-70 mt-1", big ? "text-sm" : "text-xs"].join(" ")}>
                          {t.wiederholend ? 'Wiederkehrend • ' : ''}
                          {t.ziel_typ}
                        </div>
                        {t.team?.length > 0 && (
                          <div className={big ? "text-sm mt-1" : "text-xs mt-1"}>{t.team.join(', ')}</div>
                        )}
                        {t.quali_ids?.length > 0 && (
                          <div className={big ? "text-sm mt-1" : "text-xs mt-1"}>{t.quali_ids.join(', ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Bedarf */}
                <Section
                  id="bedarf"
                  title="Bedarf heute"
                  defaultOpen={showZeitlich}   // ✅ Zeitlich -> offen, Normalbetrieb -> zu
                >
                {(() => {
                  const aktive = showZeitlich ? zb : nb;

                  const Kopf = () => (
                    showZeitlich && aktive.length > 0 ? (
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        {aktive[0].farbe && (
                          <span
                            className="inline-block w-3 h-3 rounded-full border border-black/10"
                            style={{ backgroundColor: aktive[0].farbe }}
                            title={aktive[0].farbe}
                          />
                        )}
                        {aktive[0].namebedarf && (
                          <span className={big ? "text-lg font-medium" : "text-sm font-medium"}>
                            {aktive[0].namebedarf}
                          </span>
                        )}
                        <span className={big ? "text-sm opacity-70" : "text-xs opacity-70"}>
                          {dayjs(aktive[0].von).format('DD.MM.YYYY')} – {dayjs(aktive[0].bis).format('DD.MM.YYYY')}
                        </span>
                        <span className={big ? "text-sm opacity-70" : "text-xs opacity-70"}>
                          • {aktive[0].start_schicht} → {aktive[0].end_schicht}
                        </span>
                      </div>
                    ) : (
                      <div className={big ? "text-sm uppercase opacity-70 mb-2" : "text-xs uppercase opacity-70 mb-2"}>
                        Normalbetrieb
                      </div>
                    )
                  );

                  const matrix = new Map();
                  for (const e of aktive) {
                    const key = `${e.quali_kuerzel}|${e.quali_label || ''}`;
                    if (!matrix.has(key)) {
                      matrix.set(key, {
                        kuerzel: e.quali_kuerzel,
                        label: e.quali_label || '',
                        relevant: e.relevant !== false,
                        frueh: 0, spaet: 0, nacht: 0
                      });
                    }
                    const row = matrix.get(key);
                    const add = (col) => { row[col] = (row[col] || 0) + Number(e.anzahl || 0); };
                    if (!e.schichtart) { add('frueh'); add('spaet'); add('nacht'); }
                    else if (e.schichtart === 'Früh') add('frueh');
                    else if (e.schichtart === 'Spät') add('spaet');
                    else if (e.schichtart === 'Nacht') add('nacht');
                  }

                  const rows = Array.from(matrix.values())
                    .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));

                  if (rows.length === 0) {
                    return <div className={big ? "text-base opacity-70" : "text-sm opacity-70"}>Kein Bedarf erfasst.</div>;
                  }

                  return (
                    <div className="space-y-2">
                      <Kopf />
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-separate border-spacing-y-1">
                          <thead>
                            <tr className={["text-left uppercase opacity-70", big ? "text-sm" : "text-xs"].join(" ")}>
                              <th className="py-1 pr-4">Quali</th>
                              <th className="py-1 pr-4">Früh</th>
                              <th className="py-1 pr-4">Spät</th>
                              <th className="py-1 pr-0">Nacht</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, i) => (
                              <tr key={i} className="bg-gray-300/40 dark:bg-gray-900/30">
                                <td className={`py-2 pr-4 ${!r.relevant ? 'opacity-60 italic' : ''}`}>
                                  <span className={["font-mono mr-2 p-1", big ? "text-base" : "text-sm"].join(" ")}>
                                    {r.kuerzel}
                                  </span>
                                  {r.label && r.label !== r.kuerzel && (
                                    <span className={big ? "opacity-80 text-base" : "opacity-80 text-sm"}>{r.label}</span>
                                  )}
                                  {!r.relevant && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-gray-400 dark:border-gray-700">
                                      nicht betriebsl.
                                    </span>
                                  )}
                                </td>
                                {['frueh', 'spaet', 'nacht'].map((col) => (
                                  <td key={col} className="py-2 pr-4">
                                    <span className={[
                                      "px-3 py-1 rounded-full bg-gray-400/20 dark:bg-gray-500 border border-gray-400 dark:border-gray-500 inline-block min-w-[3rem] text-center",
                                      big ? "text-base" : "text-xs"
                                    ].join(" ")}>
                                      {r[col]}
                                    </span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </Section>
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* NORMAL BOX */}
      <div className="rounded-2xl shadow-xl border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 p-3">
        {/* Header */}
        <div
          className="flex items-center justify-between gap-2 mb-2 cursor-pointer"
          onClick={() => setOffen(o => !o)}
        >
          <div className="flex items-center gap-2">
            {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <span className="text-lg font-semibold">Tagesübersicht</span>
            <span className="text-sm opacity-70">heute: {datumStr}</span>
            {!enabled && !loading && (
              <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-800">
                Feature nicht aktiv
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs opacity-70">{counter}</div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOnlySchichten(v => !v); }}
              className={[
                "p-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/40 dark:hover:bg-gray-700/40",
                onlySchichten ? "bg-gray-200 dark:bg-gray-800" : ""
              ].join(" ")}
              title="Nur Schichten anzeigen"
            >
              <Rows3 size={16} />
            </button>

            {/* Fokus / Highlight */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFocusOpen(true); }}
              className="p-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/40 dark:hover:bg-gray-700/40"
              title="Tagesübersicht hervorheben (Fokus)"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>

        {!offen ? null : renderInhalt(false)}
      </div>

      {/* FOKUS MODAL */}
      {focusOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto"
          onMouseDown={() => setFocusOpen(false)}
        >
          <div className="w-full max-w-6xl rounded-3xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 shadow-2xl max-h-[calc(100vh-24px)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-300 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="text-xl font-semibold">Tagesübersicht • {datumStr}</div>
                <div className="text-sm opacity-70">{counter}</div>
              </div>

              <div className="flex items-center gap-2">
                {/* Präsentationsmodus */}
                <button
                  type="button"
                  className={[
                    "p-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/40 dark:hover:bg-gray-700/40",
                    praesiMode ? "bg-gray-200 dark:bg-gray-800" : ""
                  ].join(" ")}
                  onClick={() => setPraesiMode(v => !v)}
                  title="Präsentationsmodus (größer)"
                >
                  <Presentation size={16} />
                </button>

                {/* Nur Schichten */}
                <button
                  type="button"
                  className={[
                    "p-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/40 dark:hover:bg-gray-700/40",
                    onlySchichten ? "bg-gray-200 dark:bg-gray-800" : ""
                  ].join(" ")}
                  onClick={() => setOnlySchichten(v => !v)}
                  title="Nur Schichten anzeigen"
                >
                  <Rows3 size={16} />
                </button>

                {/* Close */}
                <button
                  type="button"
                  className="p-2 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/40 dark:hover:bg-gray-700/40"
                  onClick={() => setFocusOpen(false)}
                  title="Schließen (ESC)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Inhalt */}
            <div className="p-4 overflow-y-auto flex-1">
              {renderInhalt(praesiMode)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
