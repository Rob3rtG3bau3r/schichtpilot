import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const Pill = ({ active, children }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] ${
      active
        ? 'bg-emerald-600/80 text-white'
        : 'bg-gray-700 text-gray-200'
    }`}
  >
    {children}
  </span>
);

export default function KundenFeatureUebersicht() {
  const { sichtFirma } = useRollen();
  const [plan, setPlan] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);

  // Plan der Firma laden
  useEffect(() => {
    if (!sichtFirma) return;
    (async () => {
      const { data, error } = await supabase
        .from('DB_Kunden')
        .select('plan')
        .eq('id', sichtFirma)
        .maybeSingle();
      if (!error && data) {
        setPlan(data.plan || null);
      }
    })();
  }, [sichtFirma]);

  // Feature-Matrix laden, sobald Plan bekannt ist
  useEffect(() => {
    if (!plan) {
      setFeatures([]);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const [{ data: featRows, error: fErr }, { data: pfRows, error: pErr }] =
          await Promise.all([
            supabase
              .from('DB_Features')
              .select('key, beschreibung, active')
              .order('key'),
            supabase
              .from('DB_PlanFeatures')
              .select('feature_key, enabled')
              .eq('plan', plan),
          ]);

        if (fErr || pErr) {
          console.error('Feature-Matrix:', fErr || pErr);
          setFeatures([]);
          return;
        }

        const pfMap = new Map();
        (pfRows || []).forEach((p) => pfMap.set(p.feature_key, !!p.enabled));

        const merged = (featRows || []).map((f) => ({
          key: f.key,
          beschreibung: f.beschreibung,
          systemAktiv: !!f.active,
          imPlan: pfMap.get(f.key) === true,
        }));

        setFeatures(merged);
      } finally {
        setLoading(false);
      }
    })();
  }, [plan]);

  if (!sichtFirma) {
    return <div className="text-sm text-gray-400">Keine Firma ausgewählt.</div>;
  }

  if (!plan) {
    return (
      <div className="text-sm text-gray-400">
        Kein aktiver Plan hinterlegt oder wird geladen…
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase opacity-70">Aktueller Plan</div>
          <div className="text-sm font-semibold">{plan}</div>
        </div>
        <div className="text-xs text-gray-400 text-right">
          Diese Übersicht zeigt, welche Features laut Plan grundsätzlich
          enthalten sind. Feinere Einstellungen pro Unit siehst du auf
          der System-Admin-Seite.
        </div>
      </div>

      {loading ? (
        <div className="text-gray-400">Lade Features…</div>
      ) : features.length === 0 ? (
        <div className="text-gray-400">Keine Features gefunden.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left uppercase text-[11px] opacity-70 border-b border-gray-700">
                <th className="py-1 pr-2">Feature</th>
                <th className="py-1 pr-2">Beschreibung</th>
                <th className="py-1 pr-2">Im Plan</th>
                <th className="py-1 pr-2">Systemstatus</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f) => (
                <tr key={f.key} className="border-b border-gray-800">
                  <td className="py-1 pr-2 font-mono text-[11px]">{f.key}</td>
                  <td className="py-1 pr-2">{f.beschreibung || '—'}</td>
                  <td className="py-1 pr-2">
                    <Pill active={f.imPlan}>
                      {f.imPlan ? 'inklusive' : 'nicht im Plan'}
                    </Pill>
                  </td>
                  <td className="py-1 pr-2">
                    <Pill active={f.systemAktiv}>
                      {f.systemAktiv ? 'aktiv' : 'deaktiviert'}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
