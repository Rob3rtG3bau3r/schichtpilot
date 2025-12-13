// ==============================
// components/Dashboard/TagesUebersicht.jsx
// ==============================
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { ChevronDown, ChevronRight } from 'lucide-react';

const Pill = ({ children, title }) => (
  <span
    title={title}
    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-300 dark:bg-gray-600 mr-2 mb-2"
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
  }, [open]);

  return (
    <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-300/10 dark:bg-gray-900/20">
      <button
        className="w-full flex items-center justify-between px-3 py-2"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2 text-left ">
          {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
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

const MiniTable = ({ rows }) => (
  <div className="overflow-x-auto ">
    <table className="min-w-full text-sm ">
      <thead>
        <tr className="text-left text-xs uppercase opacity-70">
          <th className="py-1 pr-4">Kürzel</th>
          <th className="py-1 pr-4">Anzahl</th>
          <th className="py-1">Namen</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx} className="border-t border-gray-300 dark:border-gray-700">
            <td className="py-1 pr-4 font-mono">{r.kuerzel}</td>
            <td className="py-1 pr-4">{r.anzahl}</td>
            <td className="py-1">
              <div className="flex flex-wrap">
                {r.namen.map((n, i) => (<Pill key={i}>{n}</Pill>))}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function TagesUebersicht() {
  const { rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();

  // Gesamt-Klappzustand
  const mainStorageKey = `sp_tages_offen_${unit || 'none'}`;
  const [offen, setOffen] = useState(() => {
    try { return localStorage.getItem(mainStorageKey) !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(mainStorageKey, offen ? '1' : '0'); } catch {}
  }, [offen, mainStorageKey]);
  useEffect(() => {
    try { setOffen(localStorage.getItem(mainStorageKey) !== '0'); } catch { setOffen(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        // --- 1) Schichtarten ---
        const [{ data: artRows, error: artErr }] = await Promise.all([
          supabase.from('DB_SchichtArt')
            .select('id, kuerzel')
            .eq('firma_id', Number(firma))
            .eq('unit_id', Number(unit)),
        ]);
        if (artErr) throw artErr;
        const kuerzelByArtId = new Map();
        (artRows || []).forEach(r => kuerzelByArtId.set(r.id, r.kuerzel));

        // --- 2) SOLL-Plan heute ---
        const { data: sollRows, error: sollErr } = await supabase
          .from('DB_SollPlan')
          .select('schichtgruppe, kuerzel')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('datum', heute);
        if (sollErr) throw sollErr;
        const kuerzelByGruppe = new Map();
        (sollRows || []).forEach(r => kuerzelByGruppe.set(r.schichtgruppe, r.kuerzel));

        // --- 3) Zuweisungen heute ---
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

        // --- 4) Kampfliste heute/gestern ---
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

        // --- 5) Kandidaten-User ---
        const userIdsSet = new Set([
          ...Array.from(gruppeByUser.keys()),
          ...Array.from(latestKuerzelByUserHeute.keys()),
        ]);
        const userIds = Array.from(userIdsSet);

        // --- 6) Usernamen laden ---
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

        // --- 7) Ausgrauen HEUTE für diese User bestimmen ---
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

          // Ein Eintrag reicht, um "heute ausgegraut" zu sein
          (greyRows || []).forEach(r => {
            isGreyToday.set(String(r.user_id), true);
          });
        }
        // --- 7a) Quali-Ranking pro User (heute gültig) ---
const bestPosByUser = new Map(); // uid -> kleinste (beste) Position

if (userIds.length) {
  // heute gültige Qualis holen
  const { data: qualiRows, error: qualiErr } = await supabase
    .from('DB_Qualifikation')
    .select('user_id, quali, quali_start, quali_endet')
    .in('user_id', userIds);
  if (qualiErr) throw qualiErr;

  const heuteISO = heute; // already defined above
  // betroffene quali-ids einsammeln
  const usedQualiIds = Array.from(
    new Set(
      (qualiRows || [])
        .filter(q => (!q.quali_start || q.quali_start <= heuteISO) && (!q.quali_endet || q.quali_endet >= heuteISO))
        .map(q => q.quali)
        .filter(Boolean)
    )
  );

  // Matrix-Positionen für diese Qualis
  let matrixPosById = new Map();
  if (usedQualiIds.length) {
    const { data: posRows, error: posErr } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, position')
      .in('id', usedQualiIds);
    if (posErr) throw posErr;
    matrixPosById = new Map((posRows || []).map(r => [r.id, Number(r.position) || 9999]));
  }

  // pro User beste (kleinste) Position bestimmen
  for (const uid of userIds) {
    const own = (qualiRows || []).filter(q =>
      String(q.user_id) === String(uid) &&
      (!q.quali_start || q.quali_start <= heuteISO) &&
      (!q.quali_endet || q.quali_endet >= heuteISO)
    );
    let best = 9999;
    for (const q of own) {
      const pos = matrixPosById.get(q.quali);
      if (pos != null && pos < best) best = pos;
    }
    bestPosByUser.set(String(uid), best);
  }
}

        // --- 8) Finale Kürzel (Override -> Plan) ---
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

        // --- 9) Aufteilen / Sammeln mit Grey-Flag ---
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


        // Sortierung: erst nicht-grau, dann grau; innerhalb alphabetisch
// Sortierung: 1) nicht-grau vor grau, 2) nach bester Quali (kleinste Position) aufsteigend,
// 3) Name alphabetisch —> wirkt wie "höchste Quali zuerst"
const sortNames = (arr) =>
  arr
    .slice()
    .sort((a, b) => {
      if (a.grey !== b.grey) return a.grey ? 1 : -1; // grau nach unten

      const pa = bestPosByUser.get(String(a.uid)) ?? 9999;
      const pb = bestPosByUser.get(String(b.uid)) ?? 9999;
      if (pa !== pb) return pa - pb; // kleinere Position = höherwertig

      return a.name.localeCompare(b.name, 'de');
    });

        const F_sorted = sortNames(F);
        const S_sorted = sortNames(S);
        const N_sorted = sortNames(N);

const andere = Array.from(andereMap.entries())
  .filter(([k]) => k && k.trim() !== '-')
  .map(([kuerzel, list]) => {
    const sorted = sortNames(list).map(x => (x.grey ? `${x.name} ⦸` : x.name));
    return {
      kuerzel,
      anzahl: sorted.length,
      namen: sorted,
    };
  })
  .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));


        // Krank sortieren (unverändert)
        krankArr.sort((a, b) => a.name.localeCompare(b.name, 'de'));

        // --- 10) Bedarf ---
const { data: bedarfRows, error: bedErr } = await supabase
  .from('DB_Bedarf')
  .select(`
    id, quali_id, anzahl, von, bis, namebedarf, farbe,
    normalbetrieb, schichtart, start_schicht, end_schicht
  `)
  .eq('firma_id', Number(firma))
  .eq('unit_id', Number(unit));
if (bedErr) throw bedErr;

const { data: matrixRows, error: matrixErr } = await supabase
  .from('DB_Qualifikationsmatrix')
  .select('id, quali_kuerzel, qualifikation, firma_id, unit_id, aktiv, betriebs_relevant')
  .eq('firma_id', Number(firma))
  .eq('unit_id', Number(unit));
if (matrixErr) throw matrixErr;


const qmById = new Map();
(matrixRows || []).forEach(q => {
  // Markierung NUR anhand von "betriebs_relevant"
  // Default = true, nur exakt false soll als "nicht betriebsl." gelten
  const isRelevant = (q.betriebs_relevant === false) ? false : true;

  qmById.set(q.id, {
    kuerzel: q.quali_kuerzel,
    label: q.qualifikation,
    relevant: isRelevant,
  });
});

// „Heute gültig“: Zeitbedarf über von/bis; Normalbetrieb gilt immer
const isWithin = (row) =>
  row.normalbetrieb === true ||
  ((!row.von || row.von <= heute) && (!row.bis || row.bis >= heute));

const heuteAlle    = (bedarfRows || []).filter(isWithin);
const zeitlichAlle = heuteAlle.filter(b => b.normalbetrieb === false);

// Priorität: gibt es *irgendeinen* zeitlich begrenzten Bedarf heute?
const aktivSet = zeitlichAlle.length
  ? zeitlichAlle
  : heuteAlle.filter(b => b.normalbetrieb === true);

const mapped = aktivSet.map(b => ({
  id: b.id,
  quali_kuerzel: qmById.get(b.quali_id)?.kuerzel || '???',
  quali_label:   qmById.get(b.quali_id)?.label  || null,
  relevant:      qmById.get(b.quali_id)?.relevant ?? true, 
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

// Anzeigeaufteilung: entweder „zeitlich“ ODER „Normalbetrieb“
const showingZeitlich = mapped.some(e => !e.normalbetrieb);
const normalbetrieb = showingZeitlich ? [] : mapped;
const zeitlich      = showingZeitlich ? mapped : [];

// Summen (qualifikationsweise)
const summeMap = new Map();
for (const e of mapped) {
  const key = e.quali_kuerzel;
  summeMap.set(key, (summeMap.get(key) || 0) + (e.anzahl || 0));
}
const summiert = Array.from(summeMap.entries())
  .map(([quali_kuerzel, total_anzahl]) => ({ quali_kuerzel, total_anzahl }))
  .sort((a, b) => a.quali_kuerzel.localeCompare(b.quali_kuerzel, 'de'));

        // --- 11) Termine heute (nur explicit heute, wie gehabt) ---
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
        }));

        // --- 12) setData (mit grauen unten + Symbol) ---
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
  const summe = data?.bedarf?.summiert || [];

  const counter = `${termine.length} Termine • ${andere.length} andere Kürzel • ${krank.length} krank`;

  return (
    <div className="rounded-2xl shadow-xl border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 cursor-pointer" onClick={() => setOffen(o => !o)}>
        <div className="flex items-center gap-2">
          {offen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          <span className="text-lg font-semibold">Tagesübersicht</span>
          <span className="text-sm opacity-70">heute: {datumStr}</span>
          {!enabled && !loading && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-800">Feature nicht aktiv</span>
          )}
        </div>
        <div className="text-xs opacity-70">{counter}</div>
      </div>

      {!offen ? null : (
        <>
          {loading ? (
            <div className="text-sm opacity-80">Lade…</div>
          ) : error ? (
            <div className="text-sm text-red-600">{error}</div>
          ) : !enabled ? null : (
            <div className="space-y-3">
              {/* Schichten */}
              <Section id="schichten" title="Schichten">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs uppercase opacity-70 mb-1">Früh</div>
                    <div className="flex flex-wrap">
                      {schichten.frueh.map((n, i) => (
                        <Pill key={i} title={n.endsWith('⦸') ? 'ausgegraut' : undefined}>{n}</Pill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase opacity-70 mb-1">Spät</div>
                    <div className="flex flex-wrap">
                      {schichten.spaet.map((n, i) => (
                        <Pill key={i} title={n.endsWith('⦸') ? 'ausgegraut' : undefined}>{n}</Pill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase opacity-70 mb-1">Nacht</div>
                    <div className="flex flex-wrap">
                      {schichten.nacht.map((n, i) => (
                        <Pill key={i} title={n.endsWith('⦸') ? 'ausgegraut' : undefined}>{n}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Andere Kürzel */}
              <Section id="andere" title="Andere Kürzel">
                {andere.length === 0 ? (
                  <div className="text-sm opacity-70">Keine weiteren Einträge heute.</div>
                ) : (
                  <MiniTable rows={andere} />
                )}
              </Section>

              {/* Krank */}
              <Section id="krank" title="Krankmeldungen">
                {krank.length === 0 ? (
                  <div className="text-sm opacity-70">Keine Krankmeldungen heute.</div>
                ) : (
                  <div className="flex flex-wrap">
                    {krank.map((k, i) => (
                      <Pill key={i} title={k.neu ? 'Neu seit heute' : 'Bereits krank'}>
                        {k.name}{k.neu ? ' • neu' : ''}
                      </Pill>
                    ))}
                  </div>
                )}
              </Section>

              {/* Termine */}
              <Section id="termine" title="Termine heute" counter={`${termine.length}`}>
                {termine.length === 0 ? (
                  <div className="text-sm opacity-70">Keine Termine heute.</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                    {termine.map(t => (
                      <div key={t.id} className="rounded-2xl border border-gray-300 shadow dark:border-gray-800 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{t.bezeichnung}</div>
                          {t.farbe && <span className="w-5 h-5 rounded-full inline-block" style={{ backgroundColor: t.farbe }} />}
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {t.wiederholend ? 'Wiederkehrend • ' : ''}
                        </div>
                        <div className="text-xs opacity-70 mt-1">{t.ziel_typ}</div>
                        {t.team?.length > 0 && (
                          <div className="text-xs mt-1"> {t.team.join(', ')}</div>
                        )}
                        {t.quali_ids?.length > 0 && (
                          <div className="text-xs mt-1"> {t.quali_ids.join(', ')}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Bedarf */}
{/* Bedarf */}
<Section id="bedarf" title="Bedarf heute">
  {(() => {
    // Aktiver Datensatz: wenn zeitlich vorhanden, dann den – sonst Normalbetrieb
    const aktive = showZeitlich ? zb : nb;

    // Kopfzeile (nur bei Zeitbedarf mit Name/Farbe/Zeitraum)
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
            <span className="text-sm font-medium">{aktive[0].namebedarf}</span>
          )}
          <span className="text-xs opacity-70">
            {dayjs(aktive[0].von).format('DD.MM.YYYY')} – {dayjs(aktive[0].bis).format('DD.MM.YYYY')}
          </span>
          <span className="text-xs opacity-70">
            • {aktive[0].start_schicht} → {aktive[0].end_schicht}
          </span>
        </div>
      ) : (
        <div className="text-xs uppercase opacity-70 mb-2">Normalbetrieb</div>
      )
    );

    // Matrix aufbauen: key = quali_kuerzel|label
const matrix = new Map();
for (const e of aktive) {
  const key = `${e.quali_kuerzel}|${e.quali_label || ''}`;
  if (!matrix.has(key)) {
    matrix.set(key, {
      kuerzel: e.quali_kuerzel,
      label: e.quali_label || '',
      relevant: e.relevant !== false, // default true
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
      return <div className="text-sm opacity-70">Kein Bedarf erfasst.</div>;
    }

    return (
      <div className="space-y-2">
        <Kopf />
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="p-1 text-left text-xs uppercase opacity-70">
                <th className="py-1 pr-4">Quali</th>
                <th className="py-1 pr-4">Früh</th>
                <th className="py-1 pr-4">Spät</th>
                <th className="py-1 pr-0">Nacht</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="bg-gray-300/40 dark:bg-gray-900/30">
<td className={`py-1 pr-4 ${!r.relevant ? 'opacity-60 italic' : ''}`}>
  <span className="font-mono mr-2 p-1">{r.kuerzel}</span>
  {r.label && r.label !== r.kuerzel && <span className="opacity-80">{r.label}</span>}
  {!r.relevant && (
    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-gray-400 dark:border-gray-700">
      nicht betriebsl.
    </span>
  )}
</td>
                  <td className="py-1 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/20 dark:bg-gray-500 border border-gray-400 dark:border-gray-500 inline-block min-w-[2.5rem] text-center">
                      {r.frueh}
                    </span>
                  </td>
                  <td className="py-1 pr-4">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/20 dark:bg-gray-500 border border-gray-400 dark:border-gray-500 inline-block min-w-[2.5rem] text-center">
                      {r.spaet}
                    </span>
                  </td>
                  <td className="py-1 pr-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400/20 dark:bg-gray-500 border border-gray-400 dark:border-gray-700 inline-block min-w-[2.5rem] text-center">
                      {r.nacht}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  })()}
</Section>

            </div>
          )}
        </>
      )}
    </div>
  );
}
