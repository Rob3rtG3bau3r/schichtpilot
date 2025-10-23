// src/components/Dashboard/BedarfsAnalyseModal.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const BedarfsAnalyseModal = ({ offen, onClose, modalDatum, modalSchicht, fehlendeQualis = [] }) => {
  const { sichtFirma: firma, sichtUnit: unit, rolle } = useRollen();

  const [mitarbeiter, setMitarbeiter] = useState([]);         // im Dienst (sortiert nach höchster Quali)
  const [freieMitarbeiter, setFreieMitarbeiter] = useState([]); // Kandidatenliste T-3..T+3
  const [kollidiertAktiv, setKollidiertAktiv] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  const maskForEmployee = (kuerzel) => {
    if (rolle === 'Employee' && (kuerzel === 'K' || kuerzel === 'KO')) return '-';
    return kuerzel || '-';
  };

  useEffect(() => {
    if (!offen || !modalDatum || !modalSchicht || !firma || !unit) return;

    const ladeDaten = async () => {
      setMitarbeiter([]);
      setFreieMitarbeiter([]);

      // -----------------------------
      // FENSTER T-3 .. T+3
      // -----------------------------
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
      const windowEnd   = dates[dates.length - 1];

      // (A) Soll-Plan
      const { data: soll } = await supabase
        .from('DB_SollPlan')
        .select('datum, schichtgruppe, kuerzel')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('datum', dates);

      const planByDate = new Map();
      (soll || []).forEach(r => {
        const d = r.datum?.slice(0, 10);
        if (!d) return;
        if (!planByDate.has(d)) planByDate.set(d, new Map());
        planByDate.get(d).set(r.schichtgruppe, r.kuerzel);
      });

      // (B) Zuweisungen, die Fenster berühren
      const { data: zuw } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, von_datum, bis_datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .lte('von_datum', windowEnd)
        .or(`bis_datum.is.null, bis_datum.gte.${windowStart}`);

      const membersByDate = new Map();
      dates.forEach(d => membersByDate.set(d, new Map()));
      for (const z of (zuw || [])) {
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

      // (C) Kampfliste-Overrides (nur Modal-Tag)
      const { data: overridesModalTag } = await supabase
        .from('DB_Kampfliste')
        .select('user, datum, ist_schicht(kuerzel)')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('datum', modalDatum);

      const overrideMapModal = new Map(); // `${d}|${uid}` -> kuerzel
      (overridesModalTag || []).forEach(r => {
        const k = r.ist_schicht?.kuerzel || null;
        overrideMapModal.set(`${r.datum}|${r.user}`, rolle === 'Employee' ? maskForEmployee(k) : (k || null));
      });

      // (D) Finaler Kuerzel am Modal-Tag
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

      // (E) Ausgrauen am Modal-Tag laden und filtern
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

        (aus || []).forEach(r => greySet.add(String(r.user_id)));
      }

      // Dienst/Frei bestimmen (nur sichtbare = nicht ausgegraut)
      const dienstUserIds = allUserIdsAtDay
        .filter(uid => !greySet.has(String(uid)))
        .filter(uid => finalAtDay.get(uid) === modalSchicht);

      const freiUserIds   = allUserIdsAtDay
        .filter(uid => !greySet.has(String(uid)))
        .filter(uid => finalAtDay.get(uid) === '-');

      // (F) Namen laden
      const alleIds = Array.from(new Set([...dienstUserIds, ...freiUserIds]));
      let userNameMap = {};
      if (alleIds.length) {
        const { data: userRows } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname')
          .in('user_id', alleIds);

        (userRows || []).forEach(u => {
          userNameMap[u.user_id] = {
            vorname: u.vorname || '',
            nachname: u.nachname || '',
            voll: `${u.nachname || 'Unbekannt'}, ${u.vorname || ''}`.trim(),
          };
        });
      }

// (G) „Mitarbeiter im Dienst“ nach höchster Quali sortieren (kleinste position = höchste)
let bestPosByUser = {};
if (dienstUserIds.length) {
  const tag = dayjs(modalDatum);

  const { data: qRows } = await supabase
    .from('DB_Qualifikation')
    .select(`
      user_id,
      quali,
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
    const endOk   = !r.quali_endet || dayjs(r.quali_endet).isSameOrAfter(tag, 'day');
    if (!startOk || !endOk) continue;

    const uid = String(r.user_id);
    const p = Number(r.matrix?.position ?? 999);
    bestPosByUser[uid] = Math.min(bestPosByUser[uid] ?? 999, p);
  }
}

const imDienst = dienstUserIds
  .map(uid => ({
    uid,
    vorname: userNameMap[uid]?.vorname || '',
    nachname: userNameMap[uid]?.nachname || '',
    bestPos: bestPosByUser[String(uid)] ?? 999
  }))
  .sort((a, b) => a.bestPos - b.bestPos)
  .map(({ vorname, nachname }) => ({ vorname, nachname }));

setMitarbeiter(imDienst);


// (H) Kandidatenliste (freie sichtbare), optional nach fehlenden Qualis filtern

if (freiUserIds.length === 0) {
  setFreieMitarbeiter([]);
  return;
}

// Qualis der freien Kandidaten (nur aktive Matrix dieser Firma/Unit; Gültigkeit am Tag)
const tag = dayjs(modalDatum);
const { data: qualRows } = await supabase
  .from('DB_Qualifikation')
  .select(`
    user_id,
    quali,
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

const userKuerzelSet = new Map(); // uid -> Set<Kürzel>
for (const q of qualRows || []) {
  const startOk = !q.quali_start || dayjs(q.quali_start).isSameOrBefore(tag, 'day');
  const endOk   = !q.quali_endet || dayjs(q.quali_endet).isSameOrAfter(tag, 'day');
  if (!startOk || !endOk) continue;

  const kz = q.matrix?.quali_kuerzel;
  if (!kz) continue;

  const set = userKuerzelSet.get(q.user_id) || new Set();
  set.add(kz);
  userKuerzelSet.set(q.user_id, set);
}

const kandidaten = fehlendeQualis.length
  ? freiUserIds.filter(uid => {
      const set = userKuerzelSet.get(uid);
      if (!set) return false;
      return fehlendeQualis.some(k => set.has(k));
    })
  : freiUserIds;

if (kandidaten.length === 0) {
  setFreieMitarbeiter([]);
  return;
}

      // (I) Overrides für Fenster (nur Kandidaten)
      const { data: overridesFenster } = await supabase
        .from('DB_Kampfliste')
        .select('user, datum, ist_schicht(kuerzel)')
        .in('user', kandidaten)
        .in('datum', dates)
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      const overrideWin = new Map(); // `${d}|${uid}` -> kuerzel
      (overridesFenster || []).forEach(r => {
        const k = r.ist_schicht?.kuerzel || null;
        const v = rolle === 'Employee' ? maskForEmployee(k) : (k || null);
        overrideWin.set(`${r.datum}|${r.user}`, v);
      });

      // (J) Ergebniszeilen T-3..T+3 (zusätzliche Spalten --- und +++)
      const freieZeilen = kandidaten.map(uid => {
        const profil = userNameMap[uid] || { voll: 'Unbekannt, ' };
        const res = {
          name: profil.voll,
          vor3: '-', vor2: '-', vor1: '-',
          heute: '-',
          nach1: '-', nach2: '-', nach3: '-',

          // Back-compat Felder für aktuelle Bewertungslogik (nutzt 5 Kerntage)
          vorvortag: '-', vorher: '-', nachher: '-', folgetagplus: '-',
        };

        for (let i = 0; i < dates.length; i++) {
          const d = dates[i];
          const grp = membersByDate.get(d)?.get(uid)?.gruppe;
          const base = planByDate.get(d)?.get(grp) || null;
          const over = overrideWin.get(`${d}|${uid}`);
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

        return res;
      });

      setFreieMitarbeiter(freieZeilen);
    };

    ladeDaten();
  }, [offen, modalDatum, modalSchicht, firma, unit, fehlendeQualis, rolle]);

  // ===== Bewertungs-Logik (bestehend; nutzt weiterhin die 5 Kerntage) =====
  const getBewertungsStufe = (f) => {
    const frei      = (v) => v === '-';
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
    ) {
      return 'rot';
    }

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

  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 px-4 py-2 rounded-xl w-full max-w-4xl shadow-xl flex flex-col gap-2 relative animate-fade-in"
      >
        <div className="absolute top-3 right-4 flex gap-2 items-center">
          <button onClick={() => setInfoOffen(true)} title="Info">
            <Info size={20} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        <h2 className="text-xl font-semibold text-center">
          {modalSchicht}-Schicht am {dayjs(modalDatum).format('DD.MM.YYYY')}
        </h2>
        <p>❌ Fehlende Qualifikationen: {fehlendeQualis.length ? fehlendeQualis.join(', ') : '—'}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold mb-2">Mitarbeiter im Dienst</h3>
            <ul className="text-sm list-disc list-inside">
              {mitarbeiter.length > 0
                ? mitarbeiter.map((m, i) => <li key={i}>{m.nachname}, {m.vorname}</li>)
                : <li className="italic">Keine gefunden</li>}
            </ul>
          </div>

          <div>
            <div className="mb-2">
              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={kollidiertAktiv}
                  onChange={(e) => setKollidiertAktiv(e.target.checked)}
                  className="accent-red-500"
                />
                Kollidiert mit Dienst
              </label>
            </div>

            <table className="w-full text-sm border-separate border-spacing-y-1">
              <thead>
                <tr className="text-left">
                  <th className="pl-2 text-left text-sm">Name</th>
                  <th className="px-0 text-[10px]">---</th>
                  <th className="px-0 text-[10px]">--</th>
                  <th className="px-0 text-center">-</th>
                  <th className="px-0 text-center text-[10px]">{dayjs(modalDatum).format('DD.MM.YYYY')}</th>
                  <th className="px-0 text-center">+</th>
                  <th className="px-0 text-[10px]">++</th>
                  <th className="px-0 text-[10px]">+++</th>
                </tr>
              </thead>
              <tbody>
                {freieMitarbeiter
                  .filter(Boolean)
                  .sort((a, b) => {
                    const gewicht = (f) => {
                      const st = getBewertungsStufe(f);
                      return st === 'grün' ? -3 : st === 'gelb' ? -2 : st === 'amber' ? -1 : 0;
                    };
                    const gA = gewicht(a);
                    const gB = gewicht(b);
                    if (gA !== gB) return gA - gB;

                    const schichtGewicht = (v) => {
                      if (modalSchicht === 'F') return v.vorher === 'N' ? 2 : v.vorher === 'S' ? 1 : 0;
                      if (modalSchicht === 'N') return v.nachher === 'F' ? 2 : v.nachher === 'S' ? 1 : 0;
                      if (modalSchicht === 'S') return (v.vorher === 'N' || v.nachher === 'F') ? 1 : 0;
                      return 0;
                    };
                    return schichtGewicht(a) - schichtGewicht(b);
                  })
                  .map((f, i) => {
                    const bewertung = getBewertungsStufe(f);
                    const istKollisionRot = bewertung === 'rot';
                    if (!kollidiertAktiv && istKollisionRot) return null;

                    let rowStyle = '';
                    if (bewertung === 'grün') rowStyle = 'bg-green-100 dark:bg-green-900/40';
                    else if (bewertung === 'gelb') rowStyle = 'bg-yellow-100 dark:bg-yellow-900/40';
                    else if (bewertung === 'amber') rowStyle = 'bg-amber-100 dark:bg-amber-900/40 text-red-500 dark:text-red-500';
                    else if (bewertung === 'rot') rowStyle = 'bg-red-100 dark:bg-red-900/40';

                    return (
                      <tr key={i} className={`text-center ${rowStyle}`}>
                        <td className="pl-2 text-left">{f.name}</td>
                        <td className="text-[10px] text-gray-500 px-1">{f.vor3}</td>
                        <td className="text-[10px] text-gray-500 px-1">{f.vor2}</td>
                        <td className="text-xs px-2">{f.vor1}</td>
                        <td className="text-md font-semibold px-2">
                          <span className={
                            f.heute === 'F' ? 'text-blue-500' :
                            f.heute === 'S' ? 'text-amber-500' :
                            f.heute === 'N' ? 'text-purple-500' :
                            'text-gray-500'
                          }>
                            {f.heute}
                          </span>
                        </td>
                        <td className="text-xs px-2">{f.nach1}</td>
                        <td className="text-[10px] text-gray-500 px-1">{f.nach2}</td>
                        <td className="text-[10px] text-gray-500 px-1">{f.nach3}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {infoOffen && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center backdrop-blur-sm z-60" onClick={() => setInfoOffen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full shadow-xl text-sm text-gray-800 dark:text-gray-100"
            >
              <h3 className="text-lg font-semibold mb-2">Regeln zur Anzeige</h3>
              <button
                onClick={() => setInfoOffen(false)}
                className="absolute top-2 right-3 text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-white text-2xl"
                aria-label="Schließen"
              >
                &times;
              </button>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="bg-green-500">Grün:</span> Sehr gute Kombination</li>
                <li><span className="bg-yellow-500 ">Gelb:</span> Gute Kombination</li>
                <li><span className="bg-amber-500 text-red-500"> Amber & Rote Schrift:</span> Arbeitszeitverstoß</li>
                <li><span className="bg-red-500 ">Rot:</span> Kollision</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BedarfsAnalyseModal;
