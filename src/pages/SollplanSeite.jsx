import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

import SchichtartListe from '../components/Sollplan/SchichtartListe';
import RhythmusPlanner from '../components/Sollplan/RhythmusPlanner';
import SollplanGenerator from '../components/Sollplan/SollplanGenerator';
import SollplanAnzeige from '../components/Sollplan/SollplanAnzeige';

const SollplanSeite = () => {
  const [selectedFirma, setSelectedFirma] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const [firmen, setFirmen] = useState([]);
  const [units, setUnits] = useState([]);
  const [gruppen, setGruppen] = useState([]);

  const [schichtarten, setSchichtarten] = useState([]);
  const [rhythmus, setRhythmus] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const [anzeigeGruppe, setAnzeigeGruppe] = useState('');

  useEffect(() => {
    const ladeFirmen = async () => {
      const { data, error } = await supabase
        .from('DB_Kunden')
        .select('id, firmenname')
        .order('firmenname', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Firmen:', error.message);
        return;
      }

      setFirmen(data || []);
    };

    ladeFirmen();
  }, []);

  useEffect(() => {
    const ladeUnits = async () => {
      setUnits([]);
      setGruppen([]);
      setSelectedUnit('');
      setAnzeigeGruppe('');

      if (!selectedFirma) return;

      const { data, error } = await supabase
        .from('DB_Unit')
        .select('id, unitname, schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
        .eq('firma', selectedFirma)
        .order('unitname', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Units:', error.message);
        return;
      }

      setUnits(data || []);
    };

    ladeUnits();
  }, [selectedFirma]);

  useEffect(() => {
    const unitObj = units.find((u) => String(u.id) === String(selectedUnit));

    if (!unitObj) {
      setGruppen([]);
      setAnzeigeGruppe('');
      return;
    }

    const namen = [
      unitObj.schichtname1,
      unitObj.schichtname2,
      unitObj.schichtname3,
      unitObj.schichtname4,
      unitObj.schichtname5,
      unitObj.schichtname6,
    ].filter(Boolean);

    setGruppen(namen);
    setAnzeigeGruppe(namen[0] || '');
  }, [selectedUnit, units]);

  useEffect(() => {
    const ladeSchichtarten = async () => {
      setSchichtarten([]);

      if (!selectedFirma || !selectedUnit) return;

      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('*')
        .eq('sollplan_relevant', true)
        .eq('firma_id', selectedFirma)
        .eq('unit_id', selectedUnit)
        .order('position', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Schichtarten:', error.message);
        return;
      }

      setSchichtarten(data || []);
    };

    ladeSchichtarten();
  }, [selectedFirma, selectedUnit]);

  const handleSaveSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="px-6 pb-4 text-gray-900 dark:text-white">
      <div className="mb-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
              Firma
            </label>
            <select
              value={selectedFirma}
              onChange={(e) => setSelectedFirma(e.target.value)}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
            >
              <option value="">Firma wählen</option>
              {firmen.map((firma) => (
                <option key={firma.id} value={firma.id}>
                  {firma.firmenname}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
              Unit
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              disabled={!selectedFirma}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50"
            >
              <option value="">Unit wählen</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitname}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-3 space-y-4">
          <SchichtartListe
            schichtarten={schichtarten}
          />

        <RhythmusPlanner
          firma={selectedFirma}
          unit={selectedUnit}
          schichtarten={schichtarten}
          rhythmus={rhythmus}
          setRhythmus={setRhythmus}
        />
        </div>

        <div className="col-span-12 xl:col-span-6">
          <SollplanGenerator
            firma={selectedFirma}
            unit={selectedUnit}
            gruppen={gruppen}
            schichtarten={schichtarten}
            rhythmus={rhythmus}
            onSaveSuccess={handleSaveSuccess}
          />
        </div>

        <div className="col-span-12 xl:col-span-3 space-y-3">
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-4 shadow-md">
            <h3 className="text-lg mb-3">Bestehende Sollpläne</h3>

            {gruppen.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Wähle zuerst Firma und Unit.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {gruppen.map((g) => (
                  <button
                    key={g}
                    onClick={() => setAnzeigeGruppe(g)}
                    className={[
                      'px-3 py-2 rounded-lg text-sm border',
                      anzeigeGruppe === g
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600',
                    ].join(' ')}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>

          <SollplanAnzeige
            schichtgruppe={anzeigeGruppe}
            firma={selectedFirma}
            unit={selectedUnit}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
};

export default SollplanSeite;