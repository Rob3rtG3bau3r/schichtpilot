// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { useRollen } from '../context/RollenContext';
import { supabase } from '../supabaseClient';

import TagesUebersicht from '../components/Dashboard/TagesUebersicht';
import MeineDienste from '../components/Dashboard/MeineDienste';
import AnfragenMitarbeiter from '../components/Dashboard/AnfragenMitarbeiter';
import MeineUebersicht from '../components/Dashboard/MeineUebersicht';
import TeamPflegen from '../components/Dashboard/TeamPflegen';

const Dashboard = () => {
  const { rolle, userId, sichtUnit: unit } = useRollen();
  const [istInKampfliste, setIstInKampfliste] = useState(false);
  const [tagesuebersichtAktiv, setTagesuebersichtAktiv] = useState(false);

  const darfTeamPflegenSehen = ['Team_Leader', 'Planner', 'Admin_Dev'].includes(rolle);

  // 1) Heutige Kampfliste (für "Meine Dienste" / "Meine Übersicht")
  useEffect(() => {
    const checkKampfliste = async () => {
      try {
        if (!rolle || !userId || !unit) return;
        const heute = dayjs().format('YYYY-MM-DD');
        const { data, error } = await supabase
          .from('DB_Kampfliste')
          .select('id')
          .eq('unit_id', unit)
          .eq('user', userId)
          .eq('datum', heute)
          .maybeSingle();
        if (error) throw error;
        setIstInKampfliste(!!data);
      } catch (err) {
        console.error('Fehler bei Kampfliste-Prüfung:', err?.message || err);
        setIstInKampfliste(false);
      }
    };
    checkKampfliste();
  }, [rolle, userId, unit]);

  // 2) Plan-/Feature-Check für Tagesübersicht (serverseitig via RPC)
  useEffect(() => {
    const checkTagesFeature = async () => {
      try {
        if (!unit) return setTagesuebersichtAktiv(false);
        const { data, error } = await supabase.rpc('tagesuebersicht_enabled', { p_unit_id: unit });
        if (error) throw error;
        setTagesuebersichtAktiv(!!data); // true/false
      } catch (err) {
        console.error('Feature-Check Tagesübersicht:', err?.message || err);
        setTagesuebersichtAktiv(false);
      }
    };
    checkTagesFeature();
  }, [unit]);

  // MeineDienste: Employee/Team_Leader immer; Planner/Admin_Dev nur wenn heute gebucht
  const darfMeineDiensteSehen =
    rolle === 'Employee' ||
    rolle === 'Team_Leader' ||
    ((rolle === 'Planner' || rolle === 'Admin_Dev') && istInKampfliste);

  // MeineUebersicht: Employee/Team_Leader oder wenn heute gebucht
  const darfUebersichtSehen =
    rolle === 'Employee' || rolle === 'Team_Leader' || istInKampfliste;

  // Tagesübersicht nur für Planner/Admin_Dev UND wenn Plan/Feature aktiv ist
  const darfTagesuebersichtSehen =
    (rolle === 'Planner' || rolle === 'Admin_Dev') && tagesuebersichtAktiv === true;

  return (
    <div className="p-1">
      <div className="grid grid-cols-12 gap-2">
        {/* Linke Spalte – Tagesübersicht (oben), darunter MeineDienste */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-2">
          {darfTagesuebersichtSehen && <TagesUebersicht />}

          {darfMeineDiensteSehen && <MeineDienste />}
        </div>

        {/* Rechte Spalte – Anfragen, Übersicht, TeamPflegen */}
        <div className="col-span-12 md:col-span-8 flex flex-col gap-2">
          <AnfragenMitarbeiter />

          {darfUebersichtSehen && <MeineUebersicht />}

          {darfTeamPflegenSehen && <TeamPflegen />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

