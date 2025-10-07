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
      {open && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
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
                {r.namen.map((n, i) => (
                  <Pill key={i}>{n}</Pill>
                ))}
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

  // Gesamt-Klappzustand (wie TeamPflegen)
  const mainStorageKey = `sp_tages_offen_${unit || 'none'}`;
  const [offen, setOffen] = useState(() => {
    try {
      return localStorage.getItem(mainStorageKey) !== '0';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(mainStorageKey, offen ? '1' : '0');
    } catch {}
  }, [offen, mainStorageKey]);
  useEffect(() => {
    try {
      setOffen(localStorage.getItem(mainStorageKey) !== '0');
    } catch {
      setOffen(true);
    }
  }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Datenstruktur wie zuvor erwartet
  const [data, setData] = useState({
    enabled: true,
    datum: dayjs().format('YYYY-MM-DD'),
    kampfliste: { schichten: { frueh: [], spaet: [], nacht: [] }, andere_kuerzel: [], krank: [] },
    termine: { termine: [] },
    bedarf: { normalbetrieb: [], zeitlich: [], summiert: [] },
  });

  // Sichtbarkeit: nur Planner/Admin_Dev
  const darfSehen = useMemo(() => ['Planner', 'Admin_Dev'].includes(rolle), [rolle]);

useEffect(() => {
  const ladeHeute = async () => {
    if (!darfSehen || !firma || !unit) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const heute   = dayjs().format('YYYY-MM-DD');
    const gestern = dayjs(heute).subtract(1, 'day').format('YYYY-MM-DD');

    try {
      // 1) Schichtarten (ID -> Kürzel)
      const { data: artRows, error: artErr } = await supabase
        .from('DB_SchichtArt')
        .select('id, kuerzel')
        .eq('firma_id', Number(firma))
        .eq('unit_id', Number(unit));
      if (artErr) throw artErr;
      const kuerzelByArtId = new Map((artRows || []).map(r => [r.id, r.kuerzel]));

      // 2) v_tagesplan heute & gestern (NEU: statt DB_Kampfliste/SollPlan/Zuweisung)
      const [{ data: vtHeute, error: vtErr }, { data: vtGestern, error: vgErr }] = await Promise.all([
        supabase
          .from('v_tagesplan')
          .select('user_id, ist_schichtart_id')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('datum', heute),
        supabase
          .from('v_tagesplan')
          .select('user_id, ist_schichtart_id')
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit))
          .eq('datum', gestern),
      ]);
      if (vtErr) throw vtErr;
      if (vgErr) throw vgErr;

      const kByUserHeute = new Map();
      for (const r of vtHeute || []) {
        const uid = String(r.user_id);
        const kz  = r.ist_schichtart_id ? kuerzelByArtId.get(r.ist_schichtart_id) : '-';
        kByUserHeute.set(uid, kz || '-');
      }
      const kByUserGestern = new Map();
      for (const r of vtGestern || []) {
        const uid = String(r.user_id);
        const kz  = r.ist_schichtart_id ? kuerzelByArtId.get(r.ist_schichtart_id) : '-';
        kByUserGestern.set(uid, kz || '-');
      }

      // 3) Kandidaten-User = alle aus v_tagesplan HEUTE
      const userIds = Array.from(new Set((vtHeute || []).map(r => String(r.user_id))));

      // 4) Userdaten (Name/Visibility)
      let userNameMap = new Map(), userVisibleMap = new Map();
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
      const isVisible = (uid) => userVisibleMap.get(uid) !== false;

      // 5) Aufteilen in F/S/N / Andere / Krank
      const F = [], S = [], N = [];
      const andereMap = new Map(); // kuerzel -> namen[]
      const krankArr  = [];        // { name, neu }

      const addAndere = (kuerzel, name) => {
        if (!kuerzel || kuerzel.trim() === '-') return;
        if (!andereMap.has(kuerzel)) andereMap.set(kuerzel, []);
        andereMap.get(kuerzel).push(name);
      };

      for (const uid of userIds) {
        if (!isVisible(uid)) continue;
        const name = userNameMap.get(uid) || `User ${uid}`;
        const k    = kByUserHeute.get(uid) || '-';

        if (k === 'F') F.push(name);
        else if (k === 'S') S.push(name);
        else if (k === 'N') N.push(name);
        else if (k === 'K' || k === 'KO') {
          const prev = kByUserGestern.get(uid);
          krankArr.push({ name, neu: !(prev === 'K' || prev === 'KO') });
        } else {
          addAndere(k, name);
        }
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

      // 6) Bedarf heute (unverändert)
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

      const qmById = new Map((matrixRows || []).map(q => [q.id, { kuerzel: q.quali_kuerzel, label: q.qualifikation }]));

      const isWithin = (row) => (!row.von || row.von <= heute) && (!row.bis || row.bis >= heute);
      const heuteAlle = (bedarfRows || []).filter(isWithin);
      const hatZeitlich = heuteAlle.some(b => b.normalbetrieb === false);
      const aktivSet = hatZeitlich
        ? heuteAlle.filter(b => b.normalbetrieb === false)
        : heuteAlle.filter(b => b.normalbetrieb !== false);

      const mapped = aktivSet.map(b => ({
        id: b.id,
        quali_kuerzel: qmById.get(b.quali_id)?.kuerzel || '???',
        quali_label:   qmById.get(b.quali_id)?.label  || null,
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
        summeMap.set(e.quali_kuerzel, (summeMap.get(e.quali_kuerzel) || 0) + (e.anzahl || 0));
      }
      const summiert = Array.from(summeMap.entries())
        .map(([quali_kuerzel, total_anzahl]) => ({ quali_kuerzel, total_anzahl }))
        .sort((a, b) => a.quali_kuerzel.localeCompare(b.quali_kuerzel, 'de'));

      // 7) Termine (noch leer)
      const termine = [];

      setData({
        enabled: true,
        datum: heute,
        kampfliste: {
          schichten: { frueh: F, spaet: S, nacht: N },
          andere_kuerzel: andere,
          krank: krankArr,
        },
        termine: { termine },
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
      {/* Header klickbar (wie gehabt) */}
      <div
        className="flex items-center justify-between gap-2 mb-2 cursor-pointer"
        onClick={() => setOffen(o => !o)}
      >
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

              {/* Termine (noch leer) */}
              <Section id="termine" title="Termine heute" counter={`${termine.length}`}>
                {termine.length === 0 ? (
                  <div className="text-sm opacity-70">Keine Termine heute.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {termine.map(t => (
                      <div key={t.id} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{t.bezeichnung}</div>
                          {t.farbe && (
                            <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: t.farbe }} />
                          )}
                        </div>
                        <div className="text-xs opacity-70 mt-1">Ziel: {t.ziel_typ}</div>
                        {t.team?.length > 0 && (
                          <div className="text-xs mt-1">Team: {t.team.join(', ')}</div>
                        )}
                        {t.quali_ids?.length > 0 && (
                          <div className="text-xs mt-1">Quali-IDs: {t.quali_ids.join(', ')}</div>
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
                                {/* namebedarf NICHT mehr pro Zeile */}
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
                              {/* kein namebedarf pro Zeile */}
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
