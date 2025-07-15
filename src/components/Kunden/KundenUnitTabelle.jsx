import React, { useEffect, useState } from 'react';
import { Pencil, RefreshCcw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const KundenUnitTabelle = ({ onEdit }) => {
  const { sichtFirma } = useRollen();
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadUnits = async () => {
    if (!sichtFirma) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('DB_Unit')
      .select('id, unitname, unit_standort, anzahl_ma, anzahl_schichten')
      .eq('firma', sichtFirma)
      .order('unitname');

    if (!error) {
      setUnits(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadUnits();
  }, [sichtFirma]);

  return (
    <div className="bg-white dark:bg-gray-800 text-black dark:text-white p-6 rounded-xl shadow-md overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Vorhandene Units</h2>
        <button
          onClick={loadUnits}
          className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 transition"
          title="Liste aktualisieren"
        >
          <RefreshCcw size={20} />
        </button>
      </div>

      <table className="min-w-full">
        <thead className="bg-gray-200 dark:bg-gray-700">
          <tr>
            <th className="p-2 text-left">ID</th>
            <th className="text-left">Name</th>
            <th className="text-left">Standort</th>
            <th className="text-left"># MA</th>
            <th className="text-left"># Schichten</th>
            <th className="text-left">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {units.map(unit => (
            <tr key={unit.id} className="hover:bg-gray-100 dark:hover:bg-gray-700 transition">
              <td className="p-2">{unit.id}</td>
              <td>{unit.unitname}</td>
              <td>{unit.unit_standort}</td>
              <td>{unit.anzahl_ma}</td>
              <td>{unit.anzahl_schichten}</td>
              <td className="p-2">
                <Pencil
                  size={18}
                  className="text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 cursor-pointer"
                  onClick={() => onEdit(unit)}
                  title="Bearbeiten"
                />
              </td>
            </tr>
          ))}
          {units.length === 0 && !loading && (
            <tr>
              <td colSpan="6" className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                Keine Units gefunden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default KundenUnitTabelle;