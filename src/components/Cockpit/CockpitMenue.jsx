import React, { useEffect, useState } from 'react';
import { useRollen } from '../../context/RollenContext';
import { supabase } from '../../supabaseClient';
import { Users } from 'lucide-react';

const CockpitMenue = ({ sollPlanAktiv, setSollPlanAktiv, sichtbareGruppen, setSichtbareGruppen, gruppenZähler }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [schichtgruppen, setSchichtgruppen] = useState([]);

useEffect(() => {
  const ladeSchichtgruppen = async () => {
    if (!unit) return;

    const { data, error } = await supabase
      .from('DB_Unit')
      .select('schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
      .eq('id', unit)
      .single();
    if (error) {
      console.error('Fehler beim Laden der Schichtgruppen:', error);
      return;
    }
    const gruppen = [
      data.schichtname1,
      data.schichtname2,
      data.schichtname3,
      data.schichtname4,
      data.schichtname5,
      data.schichtname6,
    ].filter(Boolean); // entfernt alle nulls oder leeren Strings
    setSchichtgruppen(gruppen);
  };
  ladeSchichtgruppen();
}, [unit]);

  return (
    <div className="w-full bg-gray-200 dark:bg-gray-800 text-gray-900 text-md dark:text-white px-4 py-3 rounded-md mb-4 flex flex-wrap items-center gap-2">
      {/* Sollplan-Checkbox */}
      <div className="flex items-center">
        <input
          id="sollplan-toggle"
          type="checkbox"
          checked={sollPlanAktiv}
          onChange={(e) => setSollPlanAktiv(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="sollplan-toggle">SollPlan anzeigen</label>
      </div>
{/* Checkbox: Alle Schichten */}
{Object.keys(gruppenZähler || {}).length > 0 && (
  <label
    className={`flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer border text-xs
      ${sichtbareGruppen.length === Object.keys(gruppenZähler).length
        ? 'bg-gray-300 dark:bg-gray-900 border-gray-400 text-gray-900 dark:text-gray-100'
        : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-800 dark:text-gray-200'}
    `}
  >
    <input
      type="checkbox"
      checked={sichtbareGruppen.length === Object.keys(gruppenZähler).length}
      onChange={(e) => {
        if (e.target.checked) {
          setSichtbareGruppen(Object.keys(gruppenZähler));
        } else {
          setSichtbareGruppen([]);
        }
      }}
      className="accent-gray-500"
    />
    <span>Alle Schichten</span>
    <span className="ml-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-2 py-[1px] flex items-center gap-1">
      <Users size={12} />
      {Object.values(gruppenZähler).reduce((sum, val) => sum + val, 0)}
    </span>
  </label>
)}
{/* Einzelne Gruppen-Checkboxen */}
{Object.keys(gruppenZähler || {}).sort().map((gruppe) => {
  const aktiv = sichtbareGruppen.includes(gruppe);
  const zaehler = gruppenZähler?.[gruppe] ?? 0;

  return (
    <label
      key={gruppe}
      className={`flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer border text-xs
        ${aktiv
          ? 'bg-gray-300 dark:bg-gray-900 border-gray-400 text-gray-900 dark:text-gray-100'
          : 'bg-gray-100 dark:bg-gray-700 border-gray-400 text-gray-800 dark:text-gray-200'}
      `}
    >
      <input
        type="checkbox"
        checked={aktiv}
        onChange={(e) => {
          if (e.target.checked) {
            setSichtbareGruppen((prev) => [...prev, gruppe]);
          } else {
            setSichtbareGruppen((prev) => prev.filter((g) => g !== gruppe));
          }
        }}
        className="accent-Gray-500"
      />
      <span>{gruppe}</span>
      <span className="flex items-center gap-1 ml-1 text-xs bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-2 py-[1px]">
        <Users size={12} />
        {zaehler}
      </span>
    </label>
  );
})}
      {/* Platzhalter-Checkboxen 
      <div className="flex items-center">
        <input type="checkbox" className="mr-2" />
        <label>Termine</label>
      </div>
      <div className="flex items-center">
        <input type="checkbox" className="mr-2" />
        <label>Produktionsplanung</label>
      </div>*/}
    </div>
  );
};

export default CockpitMenue;