// ==============================
// components/Dashboard/TagesUebersicht.jsx
// ==============================
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

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
  const { rolle, sichtUnit: unit } = useRollen();

  // === NEU: Gesamt-Klappmechanismus wie in TeamPflegen.jsx ===
  const mainStorageKey = `sp_tages_offen_${unit || 'none'}`;
  const [offen, setOffen] = useState(() => {
    // Standard: offen, nur bei gespeicherter '0' zu
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
  const [data, setData] = useState({ enabled: false, datum: dayjs().format('YYYY-MM-DD'), kampfliste: {}, termine: {}, bedarf: {} });

  // Sichtbarkeitslogik: Employee/Team_Leader sehen NIE diese Komponente
  const darfSehen = useMemo(() => ['Planner', 'Admin_Dev'].includes(rolle), [rolle]);

  useEffect(() => {
    let alive = true;
    const fetcher = async () => {
      if (!darfSehen || !unit) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      const { data: payload, error: err } = await supabase.rpc('tagesuebersicht_heute', { p_unit_id: unit });
      if (!alive) return;
      if (err) {
        console.error('tagesuebersicht_heute RPC error', err);
        setError(err.message || 'Fehler beim Laden');
        setLoading(false);
        return;
      }
      setData(payload || { enabled: false });
      setLoading(false);
    };
    fetcher();
    return () => { alive = false; };
  }, [darfSehen, unit]);

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
      {/* === NEU: Header klickbar, Chevron links – identisch zur Logik in TeamPflegen.jsx === */}
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

      {/* Inhalt nur sichtbar, wenn offen */}
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
    {/* Normalbetrieb: nur zeigen, wenn KEIN Zeitlich vorhanden ist */}
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
                  {e.namebedarf ? <span className="opacity-60"> • {e.namebedarf}</span> : null}
                </div>
                <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">{e.anzahl}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )}

    {/* Zeitlich: nur zeigen, wenn vorhanden (und dann exklusiv) */}
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
                {e.namebedarf ? <span className="opacity-60"> • {e.namebedarf}</span> : null}
                <span className="opacity-60"> • {dayjs(e.von).format('DD.MM.')}–{dayjs(e.bis).format('DD.MM.')}</span>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">{e.anzahl}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>

  {/* Summiert bleibt wie ist; Server rechnet bereits „Zeitlich ersetzt Normalbetrieb“ */}
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
