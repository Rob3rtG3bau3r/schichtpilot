import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';
import dayjs from 'dayjs';

const TeamVorschau = ({ selectedTeam, firmenId, unitId, anzeigeDatum, className }) => {
  const [teamMitglieder, setTeamMitglieder] = useState([]);
  const [zeigeSpeichernButton, setZeigeSpeichernButton] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    ladeTeam();
  }, [selectedTeam, anzeigeDatum]);

  const ladeTeam = async () => {
    if (!selectedTeam || !firmenId || !unitId) {
      setTeamMitglieder([]);
      return;
    }

    const datum = anzeigeDatum || dayjs().format('YYYY-MM-DD');

    const { data: kampfData, error: kampfError } = await supabase
      .from('DB_Kampfliste')
      .select('user')
      .eq('datum', datum)
      .eq('firma_id', firmenId)
      .eq('unit_id', unitId)
      .eq('schichtgruppe', selectedTeam);

    if (kampfError || !kampfData) {
      console.error('Fehler beim Laden der Teamdaten aus Kampfliste:', kampfError);
      setTeamMitglieder([]);
      return;
    }

    const userIds = kampfData.map(e => e.user);
    if (userIds.length === 0) {
      setTeamMitglieder([]);
      return;
    }

    const { data: userData, error: userError } = await supabase
      .from('DB_User')
      .select('user_id, vorname, nachname, rolle, position_ingruppe')
      .in('user_id', userIds);

    if (userError || !userData) {
      console.error('Fehler beim Laden der Benutzerdaten:', userError);
      setTeamMitglieder([]);
      return;
    }

    const { data: qualiData, error: qualiError } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali')
      .in('user_id', userIds);

    if (qualiError) {
      console.error('Fehler beim Laden der Qualifikationen:', qualiError);
    }

    const { data: matrixData, error: matrixError } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, quali_kuerzel, position')
      .eq('firma_id', firmenId)
      .eq('unit_id', unitId);

    if (matrixError) {
      console.error('Fehler beim Laden der Qualifikationsmatrix:', matrixError);
    }

    const userMitQuali = userData.map((user) => {
      const userQualis = qualiData?.filter(q => q.user_id === user.user_id) || [];
      const qualisMitPosition = userQualis
        .map(q => matrixData.find(m => m.id === q.quali))
        .filter(q => q);

      let hauptquali = null;
      if (qualisMitPosition.length > 0) {
        hauptquali = qualisMitPosition
          .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))[0]
          .quali_kuerzel;
      }

      return {
        ...user,
        hauptquali,
      };
    });

    setTeamMitglieder(
      userMitQuali.sort((a, b) => {
        if (a.position_ingruppe == null) return 1;
        if (b.position_ingruppe == null) return -1;
        return a.position_ingruppe - b.position_ingruppe;
      })
    );

    const hatLücken = userMitQuali.some(m => m.position_ingruppe === null);
    setZeigeSpeichernButton(hatLücken);
  };

  const reihenfolgeSpeichern = async () => {
    const aktualisiert = await Promise.all(
      teamMitglieder.map(async (user, index) => {
        await supabase
          .from('DB_User')
          .update({ position_ingruppe: index + 1 })
          .eq('user_id', user.user_id);
        return { ...user, position_ingruppe: index + 1 };
      })
    );
    setTeamMitglieder(aktualisiert);
    setZeigeSpeichernButton(false);
  };

  const handleDragStart = (index) => {
    window.dragIndex = index;
  };

  const handleDrop = async (hoverIndex) => {
    const dragIndex = window.dragIndex;
    if (dragIndex === undefined || dragIndex === hoverIndex) return;

    const updated = [...teamMitglieder];
    const draggedItem = updated.splice(dragIndex, 1)[0];
    updated.splice(hoverIndex, 0, draggedItem);

    const aktualisiert = await Promise.all(
      updated.map(async (user, index) => {
        await supabase
          .from('DB_User')
          .update({ position_ingruppe: index + 1 })
          .eq('user_id', user.user_id);
        return { ...user, position_ingruppe: index + 1 };
      })
    );

    setTeamMitglieder(aktualisiert);
    setZeigeSpeichernButton(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className={`bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className || ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">
          Team: {selectedTeam || 'Keine Gruppe gewählt'}
        </h2>
        <button onClick={() => setInfoOffen(true)} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white">
          <Info size={20} />
        </button>
      </div>

      {infoOffen && (
        <div className="fixed inset-0 bg-black backdrop-blur-sm bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-lg p-6 max-w-xl shadow-xl animate-fade-in">
            <h3 className="text-lg font-bold mb-2">Teamvorschau – Hinweise</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Du kannst Teammitglieder per Drag & Drop umsortieren.</li>
              <li>Wenn eine Position fehlt, wird ein Speichern-Button angezeigt.</li>
              <li>Die Position bestimmt die Reihenfolge z. B. im Cockpit.</li>
              <li>Diese Änderungen werden direkt in der Datenbank gespeichert.</li>
              <li>Postion Speichern nur wenn der Wechsel aktuell ist.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {zeigeSpeichernButton && (
        <button
          onClick={reihenfolgeSpeichern}
          className="mb-4 bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded"
        >
          Reihenfolge speichern
        </button>
      )}

      {teamMitglieder.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          Keine Mitglieder gefunden.
        </p>
      ) : (
        <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-1 space-y-1">
          {teamMitglieder.map((member, index) => (
            <div
              key={member.user_id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className="bg-gray-100 dark:bg-gray-800 p-2 rounded flex justify-between items-center cursor-move"
            >
              <div>
                <span className="font-semibold">
                  {member.nachname}, {member.vorname}
                </span>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Rolle: {member.rolle}
                </div>
                {member.hauptquali && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Qualifikation: {member.hauptquali}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 pr-6">
                Gruppenposition: {member.position_ingruppe || '–'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamVorschau;
