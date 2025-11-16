import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const KundenUnitTabelle = ({ onSelectUnit }) => {
  const { sichtFirma } = useRollen();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadUnits = async () => {
    if (!sichtFirma) return;

    setLoading(true);

    try {
      const [{ data: unitRows, error: unitErr }, { data: userRows, error: userErr }] =
        await Promise.all([
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
        console.error(
          'Fehler beim Laden der Units oder User:',
          unitErr || userErr
        );
        setUnits(unitRows || []);
      } else {
        const counts = {};
        (userRows || []).forEach((u) => {
          if (!u.unit_id) return;
          counts[u.unit_id] = (counts[u.unit_id] || 0) + 1;
        });

        setUnits(
          (unitRows || []).map((u) => ({
            ...u,
            aktive_ma: counts[u.id] || 0,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnits();
  }, [sichtFirma]);

  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-400/50 dark:bg-gray-900/50 p-3 text-gray-800 dark:text-gray-200">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Vorhandene Units</h3>
        <button
          className="text-xs px-2 py-1 rounded border border-gray-600 hover:bg-gray-400 dark:hover:bg-gray-800"
          onClick={loadUnits}
        >
          Neu laden
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        Hier siehst du die Units, die der Kunde im SchichtPiloten nutzt.{' '}
        <span className="font-semibold">
          MA (Standard)
        </span>{' '}
        ist der hinterlegte Richtwert pro Unit,{' '}
        <span className="font-semibold">
          MA (aktiv)
        </span>{' '}
        sind die aktuell aktiven User in dieser Unit.
      </p>

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
                <th className="p-2 text-left">MA Standard</th>
                <th className="p-2 text-left">MA aktiv</th>
                <th className="p-2 text-left"># Schichten</th>
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
                  <td className="p-2">{unit.unit_standort}</td>
                  <td className="p-2">{unit.anzahl_ma ?? '—'}</td>
                  <td className="p-2">{unit.aktive_ma ?? 0}</td>
                  <td className="p-2">{unit.anzahl_schichten}</td>
                  <td className="p-2">
                    <button className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700">
                      Details
                    </button>
                  </td>
                </tr>
              ))}

              {units.length === 0 && (
                <tr>
                  <td className="p-2 text-center text-gray-400" colSpan="7">
                    Keine Units vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default KundenUnitTabelle;
