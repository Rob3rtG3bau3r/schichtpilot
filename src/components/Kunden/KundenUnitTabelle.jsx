import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';

const fmtNum = (v, digits = 0) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(digits).replace('.', ',');
};

const fmtSigned = (v, digits = 0) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  const s = n.toFixed(digits).replace('.', ',');
  return n > 0 ? `+${s}` : s;
};

const fmtPct = (v, digits = 1) => {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return '—';
  return `${n.toFixed(digits).replace('.', ',')}%`;
};

const calcKrankPct = (krankStundenYtd, ytdSoll) => {
  const k = Number(krankStundenYtd);
  const s = Number(ytdSoll);
  if (!Number.isFinite(k) || !Number.isFinite(s) || s <= 0) return null;
  return (k / s) * 100;
};

const calcUrlaubUebrig = (yearUrlaub, yearUrlaubSoll) => {
  const u = Number(yearUrlaub);
  const us = Number(yearUrlaubSoll);
  if (!Number.isFinite(u) || !Number.isFinite(us)) return null;
  return us - u;
};

const KundenUnitTabelle = ({ onSelectUnit, onOpenUnitReport }) => {
  const { sichtFirma } = useRollen();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentYear = useMemo(() => dayjs().year(), []);

  const loadUnits = async () => {
    if (!sichtFirma) return;
    setLoading(true);

    try {
      // 1) Stammdaten Units + 2) aktive User (für MA aktiv)
      const [
        { data: unitRows, error: unitErr },
        { data: userRows, error: userErr },
      ] = await Promise.all([
        supabase
          .from('DB_Unit')
          .select('id, unitname, unit_standort, anzahl_ma, anzahl_schichten')
          .eq('firma', sichtFirma)
          .order('unitname'),
        supabase
          .from('DB_User')
          .select('unit_id')
          .eq('firma_id', sichtFirma)
          .eq('aktiv', true),
      ]);

      if (unitErr || userErr) {
        console.error('Fehler beim Laden der Units oder User:', unitErr || userErr);
        setUnits(unitRows || []);
        return;
      }

      const unitIds = (unitRows || []).map((u) => u.id).filter(Boolean);

      // 3) Reports aus db_report_ytd (wir nehmen pro Unit den neuesten Eintrag nach bis_monat)
      let reportRows = [];
      if (unitIds.length) {
        const { data, error } = await supabase
          .from('db_report_ytd')
          .select(
            [
              'unit_id',
              'jahr',
              'bis_monat',
              'finalized_at',
              'ytd_soll',
              'krank_stunden_ytd',
              'year_diff_incl',
              'year_urlaub',
              'year_urlaub_soll',
              'dauer10_ytd',
              // optional, falls du lieber 11/12 zählen willst:
              // 'dauer11_ytd',
              // 'dauer12_ytd',
            ].join(',')
          )
          .eq('firma_id', sichtFirma)
          .eq('jahr', currentYear)
          .in('unit_id', unitIds)
          .order('unit_id', { ascending: true })
          .order('bis_monat', { ascending: false });

        if (error) {
          console.error('Fehler beim Laden db_report_ytd:', error);
          reportRows = [];
        } else {
          reportRows = data || [];
        }
      }

      // Map: pro unit_id den ersten (durch Order ist das der neueste bis_monat)
      const reportByUnitId = new Map();
      for (const r of reportRows) {
        if (!reportByUnitId.has(r.unit_id)) reportByUnitId.set(r.unit_id, r);
      }

      // MA aktiv zählen
      const counts = {};
      (userRows || []).forEach((u) => {
        if (!u.unit_id) return;
        counts[u.unit_id] = (counts[u.unit_id] || 0) + 1;
      });

      // Merge
      const merged = (unitRows || []).map((u) => {
        const rep = reportByUnitId.get(u.id);

        const krankPct = rep
          ? calcKrankPct(rep.krank_stunden_ytd, rep.ytd_soll)
          : null;

        const urlaubUebrig = rep
          ? calcUrlaubUebrig(rep.year_urlaub, rep.year_urlaub_soll)
          : null;

        return {
          ...u,
          aktive_ma: counts[u.id] || 0,

          // Report-Felder
          report_bis_monat: rep?.bis_monat ?? null,
          report_finalized_at: rep?.finalized_at ?? null,

          year_diff_incl: rep?.year_diff_incl ?? null,
          urlaub_uebrig: urlaubUebrig,
          krank_pct: krankPct,

          // >10h Dienste (hier nehme ich dauer10_ytd)
          ueber10_ytd: rep?.dauer10_ytd ?? 0,
        };
      });

      setUnits(merged);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, [sichtFirma]);

  // Optional: global refresh (falls du es im Parent triggerst)
  useEffect(() => {
    const fn = () => loadUnits();
    window.addEventListener('SP_REFRESH_UNITS', fn);
    return () => window.removeEventListener('SP_REFRESH_UNITS', fn);
  }, [sichtFirma]);

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-400/50 dark:bg-gray-900/50 p-3 text-gray-800 dark:text-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold">Unternehmensübersicht (Units)</h3>
          <p className="text-[11px] text-gray-600 dark:text-gray-400">
            Daten aus <span className="font-semibold">db_report_ytd</span> ({currentYear}) + MA aktiv live aus DB_User.
          </p>
        </div>

        <button
          className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-400 dark:hover:bg-gray-800"
          onClick={loadUnits}
        >
          Neu laden
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-300">Lade Units…</div>
      ) : (
        <div className="overflow-x-auto text-sm">
          <table className="min-w-full border border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-800 text-xs uppercase text-gray-300">
              <tr>
                <th className="p-2 text-left">ID</th>
                <th className="p-2 text-left">Unit</th>
                <th className="p-2 text-left">Standort</th>
                <th className="p-2 text-left">MA Ziel</th>
                <th className="p-2 text-left">MA aktiv</th>
                <th className="p-2 text-left"># Schichten</th>
                <th className="p-2 text-left">Std.-Diff (Year)</th>
                <th className="p-2 text-left">Urlaub übrig</th>
                <th className="p-2 text-left">Krank %</th>
                <th className="p-2 text-left">&gt;10h Dienste</th>
                <th className="p-2 text-left">Aktion</th>
              </tr>
            </thead>

            <tbody>
              {units.map((unit) => (
                <tr
                  key={unit.id}
                  className="border-t border-gray-700 hover:bg-gray-800/70 cursor-pointer"
                  onClick={() => onSelectUnit && onSelectUnit(unit)}
                >
                  <td className="p-2">{unit.id}</td>
                  <td className="p-2">{unit.unitname}</td>
                  <td className="p-2">{unit.unit_standort ?? '—'}</td>

                  <td className="p-2">{unit.anzahl_ma ?? '—'}</td>
                  <td className="p-2">{unit.aktive_ma ?? 0}</td>
                  <td className="p-2">{unit.anzahl_schichten ?? '—'}</td>

                  <td className="p-2">{fmtSigned(unit.year_diff_incl, 0)}</td>
                  <td className="p-2">{fmtNum(unit.urlaub_uebrig, 1)}</td>
                  <td className="p-2">{fmtPct(unit.krank_pct, 1)}</td>
                  <td className="p-2">{unit.ueber10_ytd ?? 0}</td>

                  <td className="p-2">
                    <button
                      className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Variante A: Parent macht Navigation
                        if (onOpenUnitReport) onOpenUnitReport(unit);

                        // Variante B: oder du nutzt onSelectUnit + Navigation im Parent
                        // onSelectUnit && onSelectUnit(unit);
                      }}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}

              {units.length === 0 && (
                <tr>
                  <td className="p-2 text-center text-gray-400" colSpan="12">
                    Keine Units vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Optional: kleiner Hinweis auf Datenstand */}
          <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-400">
            Hinweis: Report-Werte sind der neueste Stand je Unit (höchster <span className="font-semibold">bis_monat</span> im Jahr {currentYear}).
          </div>
        </div>
      )}
    </div>
  );
};

export default KundenUnitTabelle;
