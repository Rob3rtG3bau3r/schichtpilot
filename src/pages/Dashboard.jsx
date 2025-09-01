import React, { useState, useEffect } from 'react';
import { useRollen } from '../context/RollenContext';
import { supabase } from '../supabaseClient';
import MeineDienste from '../components/Dashboard/MeineDienste';
import AnfragenMitarbeiter from '../components/Dashboard/AnfragenMitarbeiter';
import MeineUebersicht from '../components/Dashboard/MeineUebersicht';
import TeamPflegen from '../components/Dashboard/TeamPflegen';
import dayjs from 'dayjs';

const Dashboard = () => {
  const { rolle, userId, sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [istInKampfliste, setIstInKampfliste] = useState(false);

  const darfTeamPflegenSehen = ['Team_Leader', 'Planner', 'Admin_Dev'].includes(rolle);

  useEffect(() => {
    const checkKampfliste = async () => {
      try {
        const heute = dayjs().format('YYYY-MM-DD');
        const { data, error } = await supabase
          .from('DB_Kampfliste')
          .select('id')
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('user', userId)
          .eq('datum', heute)
          .maybeSingle();

        if (error) {
          console.error('Fehler bei Kampfliste-Prüfung:', error.message);
          setIstInKampfliste(false);
        } else {
          setIstInKampfliste(!!data);
        }
      } catch (err) {
        console.error('Fehler beim CheckKampfliste:', err.message);
        setIstInKampfliste(false);
      }
    };

    if (rolle && userId) checkKampfliste();
  }, [rolle, userId, firma, unit]);

  // Übersicht nur für Employer/Team_Leader oder User in Kampfliste
  const darfUebersichtSehen = rolle === 'Employee' || rolle === 'Team_Leader' || istInKampfliste;

  return (
    <div className="p-1">
      <div className="grid grid-cols-12 gap-2">
        {/* Linke Spalte – Meine Dienste (4/12) */}
        <div className="col-span-12 md:col-span-4">
          <MeineDienste />
        </div>

        {/* Rechte Spalte – Anfragen, Übersicht, TeamPflegen */}
        <div className="col-span-12 md:col-span-8 flex flex-col gap-2">
          {/* Anfragen Mitarbeiter – jetzt ganz oben */}
          <div className="bg-gray-200 dark:bg-gray-800 p-2">
            <AnfragenMitarbeiter />
          </div>

          {/* Meine Übersicht – nur wenn erlaubt */}
          {darfUebersichtSehen && (
            <div className="bg-gray-200 dark:bg-gray-800 p-2">
              <MeineUebersicht />
            </div>
          )}

          {/* Team Pflege – nur für bestimmte Rollen */}
          {darfTeamPflegenSehen && (
            <div className="bg-gray-200 dark:bg-gray-800 p-2">
              <TeamPflegen />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

