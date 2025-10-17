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
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20">
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
          <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
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

  // Initial-State: WICHTIG -> termine: []
  const [data, setData] = useState({
    enabled: true,
    datum: dayjs().format('YYYY-MM-DD'),
    kampfliste: { schichten: { frueh: [], spaet: [], nacht: [] }, andere_kuerzel: [], krank: [] },
    termine: { termine: [] },
    bedarf: { normalbetrieb: [], zeitlich: [], summiert: [] },
  });

  // Sichtbarkeit
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

        // --- 6) Userdaten ---
        let userNameMap = new Map();
        let userVisibleMap = new Map();
        if (userIds.length) {
          const { data: userRows, error: userErr } = await supabase
            .from('DB_User')
            .select('user_id, vorname, nachname, user_visible')
            .in('user_id', userIds);
          if (userErr) throw userErr;
          (userRows || []).forEach(u => {
            userNameMap.set(String(u.user_id), `${u.nachname || ''}, ${u.vorname || ''}`.trim());
            userVisibleMap.set(String(u.user_id), u.user_visible !== false);
          });
        }

        // --- 7) Finale Kürzel ---
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

        // --- 8) Aufteilen / Sammeln ---
        const F = [], S = [], N = [];
        const andereMap = new Map();
        const krankArr = [];
        const isVisible = (uid) => userVisibleMap.get(uid) !== false;
        const addAndere = (kz, name) => {
          if (!kz || kz.trim() === '-') return;
          if (!andereMap.has(kz)) andereMap.set(kz, []);
          andereMap.get(kz).push(name);
        };

        for (const uid of userIds) {
          if (!isVisible(uid)) continue;
          const name = userNameMap.get(uid) || `User ${uid}`;
          const k = finalKuerzelByUser.get(uid);
          if (!k) continue;
          if (k === 'F') F.push(name);
          else if (k === 'S') S.push(name);
          else if (k === 'N') N.push(name);
          else if (k === 'K' || k === 'KO') {
            const gesternK = latestKuerzelByUserGestern.get(uid);
            krankArr.push({ name, neu: !(gesternK === 'K' || gesternK === 'KO') });
          } else addAndere(k, name);
        }

        const andere = Array.from(andereMap.entries())
          .filter(([k]) => k && k.trim() !== '-')
          .map(([kuerzel, namen]) => ({
            kuerzel,
            anzahl: namen.length,
            namen: namen.sort((a, b) => a.localeCompare(b, 'de')),
          }))
          .sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));

        F.sort((a, b) => a.localeCompare(b, 'de'));
        S.sort((a, b) => a.localeCompare(b, 'de'));
        N.sort((a, b) => a.localeCompare(b, 'de'));
        krankArr.sort((a, b) => a.name.localeCompare(b.name, 'de'));

        // --- 9) Bedarf ---
        const { data: bedarfRows, error: bedErr } = await supabase
          .from('DB_Bedarf')
          .select('id, quali_id, anzahl, von, bis, namebedarf, farbe, normalbetrieb')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit));
        if (bedErr) throw bedErr;

        const { data: matrixRows, error: matrixErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, quali_kuerzel, qualifikation');
        if (matrixErr) throw matrixErr;

        const qmById = new Map();
        (matrixRows || []).forEach(q => {
          qmById.set(q.id, { kuerzel: q.quali_kuerzel, label: q.qualifikation });
        });

        const isWithin = (row) => (!row.von || row.von <= heute) && (!row.bis || row.bis >= heute);
        const heuteAlle = (bedarfRows || []).filter(isWithin);

        const hatZeitlich = heuteAlle.some(b => b.normalbetrieb === false);
        const aktivSet = hatZeitlich
          ? heuteAlle.filter(b => b.normalbetrieb === false)
          : heuteAlle.filter(b => b.normalbetrieb !== false);

        const mapped = aktivSet.map(b => ({
          id: b.id,
          quali_kuerzel: qmById.get(b.quali_id)?.kuerzel || '???',
          quali_label: qmById.get(b.quali_id)?.label || null,
          anzahl: b.anzahl || 0,
          namebedarf: null,
          farbe: b.farbe || null,
          von: b.von || null,
          bis: b.bis || null,
        }));

        const normalbetrieb = hatZeitlich ? [] : mapped;
        const zeitlich = hatZeitlich ? mapped : [];

        const summeMap = new Map();
        for (const e of mapped) {
          const key = e.quali_kuerzel;
          summeMap.set(key, (summeMap.get(key) || 0) + (e.anzahl || 0));
        }
        const summiert = Array.from(summeMap.entries())
          .map(([quali_kuerzel, total_anzahl]) => ({ quali_kuerzel, total_anzahl }))
          .sort((a, b) => a.quali_kuerzel.localeCompare(b.quali_kuerzel, 'de'));

        // --- 10) Termine heute (Schema: datum + wiederholend) ---
        const { data: termRows, error: termErr } = await supabase
          .from('DB_TerminVerwaltung')
          .select('id, bezeichnung, farbe, ziel_typ, team, quali_ids, datum, wiederholend, created_at')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          // Entweder genau heute oder als wiederholender Termin
         .eq('datum', heute)  
          .order('created_at', { ascending: false });
        if (termErr) throw termErr;

        // Nur die, die für "heute" gelten:
        // - datum == heute
        // - oder wiederholend == true (täglich sichtbar)

const termineHeute = (termRows || []).map(r => ({
  id: r.id,
  bezeichnung: r.bezeichnung || '(ohne Titel)',
  farbe: r.farbe || null,
  ziel_typ: r.ziel_typ || (Array.isArray(r.quali_ids) && r.quali_ids.length ? 'Qualifikationen' : 'Team'),
  team: Array.isArray(r.team) ? r.team : (r.team ? [r.team] : []),
  quali_ids: Array.isArray(r.quali_ids) ? r.quali_ids : [],
  datum: r.datum || heute,
}));

        // EIN setData am Ende
        setData({
          enabled: true,
          datum: heute,
          kampfliste: {
            schichten: { frueh: F, spaet: S, nacht: N },
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
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2 cursor-pointer" onClick={() => setOffen(o => !o)}>
        <div className="flex items-center gap-2">
          {offen ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
          <span className="text-lg font-semibold">Tagesübersicht</span>
          <span className="text-sm opacity-70">heute: {datumStr}</span>
          {!enabled && !loading && (
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Feature nicht aktiv</span>
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
              <Section id="schichten" title="Schichten (Früh / Spät / Nacht)">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <div className="text-xs uppercase opacity-70 mb-1">Früh</div>
                    <div className="flex flex-wrap">{schichten.frueh.map((n, i) => <Pill key={i}>{n}</Pill>)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase opacity-70 mb-1">Spät</div>
                    <div className="flex flex-wrap">{schichten.spaet.map((n, i) => <Pill key={i}>{n}</Pill>)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase opacity-70 mb-1">Nacht</div>
                    <div className="flex flex-wrap">{schichten.nacht.map((n, i) => <Pill key={i}>{n}</Pill>)}</div>
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
                        <div className="text-xs opacity-70 mt-1"> {t.ziel_typ}</div>
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
              <Section id="bedarf" title="Bedarf heute">
                <div className={`grid grid-cols-1 ${showZeitlich ? '' : 'md:grid-cols-2'} gap-3`}>
                  {!showZeitlich && (
                    <div>
                      <div className="text-xs uppercase opacity-70 mb-1">Normalbetrieb</div>
                      {nb.length === 0 ? (
                        <div className="text-sm opacity-70">Keine Einträge.</div>
                      ) : (
                        <ul className="text-sm space-y-1">
                          {nb.map((e) => (
                            <li key={`nb-${e.id}`} className="flex items-center justify-between">
                              <div>
                                <span className="font-mono mr-2">{e.quali_kuerzel}</span>
                                {e.quali_label && e.quali_label !== e.quali_kuerzel && (
                                  <span className="opacity-80">{e.quali_label}</span>
                                )}
                              </div>
                              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">{e.anzahl}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {showZeitlich && (
                    <div>
                      <div className="text-xs uppercase opacity-70 mb-1">Zeitlich</div>
                      <ul className="text-sm space-y-1">
                        {zb.map((e) => (
                          <li key={`zb-${e.id}`} className="flex items-center justify-between">
                            <div>
                              <span className="font-mono mr-2">{e.quali_kuerzel}</span>
                              {e.quali_label && e.quali_label !== e.quali_kuerzel && (
                                <span className="opacity-80">{e.quali_label}</span>
                              )}
                              <span className="opacity-60"> • {dayjs(e.von).format('DD.MM.')}–{dayjs(e.bis).format('DD.MM.')}</span>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">{e.anzahl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-xs uppercase opacity-70 mb-1">Summiert</div>
                  {summe.length === 0 ? (
                    <div className="text-sm opacity-70">Keine Summen.</div>
                  ) : (
                    <div className="flex flex-wrap">
                      {summe.map((s, i) => (
                        <Pill key={i}>
                          <span className="font-mono mr-1">{s.quali_kuerzel}</span>
                          <span>{s.total_anzahl}</span>
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
