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
  }, [selectedTeam, anzeigeDatum, firmenId, unitId]);

  const ladeTeam = async () => {
    // Ohne Kontext oder Datum: nichts laden
    if (!selectedTeam || !firmenId || !unitId || !anzeigeDatum) {
      setTeamMitglieder([]);
      setZeigeSpeichernButton(false);
      return;
    }
    const datum = anzeigeDatum;

    // 1) Alle Zuweisungen der Gruppe laden
    const { data: zuweisungData, error: zuweisungError } = await supabase
      .from('DB_SchichtZuweisung')
      .select('id, user_id, position_ingruppe, von_datum, bis_datum')
      .eq('firma_id', firmenId)
      .eq('unit_id', unitId)
      .eq('schichtgruppe', selectedTeam);

    if (zuweisungError) {
      console.error('Fehler beim Laden der Zuweisungen:', zuweisungError);
      setTeamMitglieder([]);
      setZeigeSpeichernButton(false);
      return;
    }

    // 2) Am Datum gültige Zuweisungen filtern
    const filtered = (zuweisungData || []).filter(z => {
      return dayjs(z.von_datum).isSameOrBefore(datum, 'day') &&
             (!z.bis_datum || dayjs(z.bis_datum).isSameOrAfter(datum, 'day'));
    });

    if (filtered.length === 0) {
      setTeamMitglieder([]);
      setZeigeSpeichernButton(false);
      return;
    }

    const userIds = filtered.map(z => z.user_id);

    // 3) Userdaten laden
    const { data: userData, error: userError } = await supabase
      .from('DB_User')
      .select('user_id, vorname, nachname, rolle')
      .in('user_id', userIds);

    if (userError) {
      console.error('Fehler beim Laden der Userdaten:', userError);
      setTeamMitglieder([]);
      setZeigeSpeichernButton(false);
      return;
    }

    // 4) Qualis laden
    const { data: qualiData } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali')
      .in('user_id', userIds);

    const { data: matrixData } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, quali_kuerzel, position')
      .eq('firma_id', firmenId)
      .eq('unit_id', unitId);

    // 5) Zusammenbauen (inkl. gültiger Zuweisung am Datum)
    const userMitQuali = (userData || []).map((user) => {
      const zuweisung = filtered.find(z => z.user_id === user.user_id);
      const userQualis = (qualiData || []).filter(q => q.user_id === user.user_id);
      const qualisMitPosition = userQualis
        .map(q => (matrixData || []).find(m => m.id === q.quali))
        .filter(Boolean);

      let hauptquali = null;
      if (qualisMitPosition.length > 0) {
        hauptquali = qualisMitPosition
          .sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))[0]
          .quali_kuerzel;
      }

      return {
        ...user,
        hauptquali,
        position_ingruppe: zuweisung?.position_ingruppe ?? null,
        zuweisung_id: zuweisung?.id ?? null,     // wichtig fürs Update
        zuweisung_von: zuweisung?.von_datum ?? null,
        zuweisung_bis: zuweisung?.bis_datum ?? null,
      };
    });

    // 6) Sortieren nach Position
    const sortiert = userMitQuali.sort((a, b) => {
      if (a.position_ingruppe == null) return 1;
      if (b.position_ingruppe == null) return -1;
      return a.position_ingruppe - b.position_ingruppe;
    });

    setTeamMitglieder(sortiert);

    // Button zeigen, wenn mind. eine Position fehlt
    const hatLuecken = sortiert.some(m => m.position_ingruppe === null);
    setZeigeSpeichernButton(hatLuecken);
  };

  // Drag-Start
  const handleDragStart = (index) => {
    window.dragIndex = index;
  };

// Hilfsfunktion: Position für EINEN User am Datum updaten oder sauber splitten (ohne DB-Constraint)
const upsertPositionForUserAtDate = async (user, newPos, datum) => {
  const oldPos = user.position_ingruppe ?? null;
  if (oldPos === newPos) {
    // Keine Änderung -> nichts schreiben
    return user;
  }

  // Falls (theoretisch) kein gültiger Eintrag existiert, neu ab Datum anlegen
  if (!user.zuweisung_id) {
    // -> neuen Zeitraum [datum, next_von - 1] anlegen,
    //    damit wir nicht in die Zukunft hineinragen
    const { data: nextRow } = await supabase
      .from('DB_SchichtZuweisung')
      .select('von_datum')
      .eq('user_id', user.user_id)
      .eq('schichtgruppe', selectedTeam)
      .eq('firma_id', firmenId)
      .eq('unit_id', unitId)
      .gt('von_datum', datum)
      .order('von_datum', { ascending: true })
      .limit(1)
      .maybeSingle();

    const newBis = nextRow?.von_datum
      ? dayjs(nextRow.von_datum).subtract(1, 'day').format('YYYY-MM-DD')
      : null;

    const { data: inserted, error: insertError } = await supabase
      .from('DB_SchichtZuweisung')
      .insert([{
        user_id: user.user_id,
        schichtgruppe: selectedTeam,
        von_datum: datum,
        bis_datum: newBis,               // << hier: auf nächsten Start - 1 begrenzen
        position_ingruppe: newPos,
        firma_id: firmenId,
        unit_id: unitId,
        created_at: new Date().toISOString(),
        created_by: localStorage.getItem('user_id') || null
      }])
      .select('id')
      .single();

    if (insertError) {
      console.error('Fehler beim Anlegen neuer Zuweisung:', insertError);
      return user;
    }

    return {
      ...user,
      position_ingruppe: newPos,
      zuweisung_id: inserted?.id ?? null,
      zuweisung_von: datum,
      zuweisung_bis: newBis
    };
  }

  // Es existiert ein gültiger Eintrag für das Datum
  const startsExactlyAtDate = user.zuweisung_von && dayjs(user.zuweisung_von).isSame(datum, 'day');

  if (startsExactlyAtDate) {
    // Einfach nur Position aktualisieren
    await supabase
      .from('DB_SchichtZuweisung')
      .update({ position_ingruppe: newPos })
      .eq('id', user.zuweisung_id);

    return { ...user, position_ingruppe: newPos };
  }

  // Split-Fall: gültiger Eintrag startet VOR dem Datum -> Intervall splitten
  const dayBefore = dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD');

  // 1) alten Eintrag zum Vortag begrenzen
  await supabase
    .from('DB_SchichtZuweisung')
    .update({ bis_datum: dayBefore })
    .eq('id', user.zuweisung_id);

  // 2) neuen Eintrag ab Datum mit gleicher bis_datum und neuer Position
  const { data: inserted, error: insertError } = await supabase
    .from('DB_SchichtZuweisung')
    .insert([{
      user_id: user.user_id,
      schichtgruppe: selectedTeam,
      von_datum: datum,
      bis_datum: user.zuweisung_bis || null,
      position_ingruppe: newPos,
      firma_id: firmenId,
      unit_id: unitId,
      created_at: new Date().toISOString(),
      created_by: localStorage.getItem('user_id') || null
    }])
    .select('id')
    .single();

  if (insertError) {
    console.error('Fehler beim Split/Anlegen neuer Zuweisung:', insertError);
    return user;
  }

  return {
    ...user,
    position_ingruppe: newPos,
    zuweisung_id: inserted?.id ?? user.zuweisung_id,
    zuweisung_von: datum,
    zuweisung_bis: user.zuweisung_bis ?? null
  };
};


  // Reihenfolge speichern – nur geänderte Positionen anfassen
  const reihenfolgeSpeichern = async () => {
    if (!anzeigeDatum) return;
    const datum = anzeigeDatum;

    // neue Ziel-Positionen
    const newOrder = Object.fromEntries(teamMitglieder.map((u, i) => [u.user_id, i + 1]));

    // Updates nur dort, wo sich die Position wirklich ändert
    const aktualisiert = await Promise.all(
      teamMitglieder.map(async (user) => {
        const newPos = newOrder[user.user_id];
        return upsertPositionForUserAtDate(user, newPos, datum);
      })
    );

    setTeamMitglieder(aktualisiert);
    setZeigeSpeichernButton(false);
  };

  // Drag & Drop – sofortige (differenzielle) Speicherung nur für veränderte
  const handleDrop = async (hoverIndex) => {
    const dragIndex = window.dragIndex;
    if (dragIndex === undefined || dragIndex === hoverIndex) return;

    // Alte Reihenfolge merken (für diff)
    const oldPositions = Object.fromEntries(teamMitglieder.map(u => [u.user_id, u.position_ingruppe]));

    // Lokal neu anordnen
    const updated = [...teamMitglieder];
    const draggedItem = updated.splice(dragIndex, 1)[0];
    updated.splice(hoverIndex, 0, draggedItem);

    if (!anzeigeDatum) {
      setTeamMitglieder(updated);
      window.dragIndex = undefined;
      return;
    }
    const datum = anzeigeDatum;

    // Nur geänderte Positionen per DB anpassen
    const aktualisiert = await Promise.all(
      updated.map(async (user, index) => {
        const newPos = index + 1;
        const oldPos = oldPositions[user.user_id] ?? null;
        if (oldPos === newPos) return user; // nichts tun

        return upsertPositionForUserAtDate(user, newPos, datum);
      })
    );

    setTeamMitglieder(aktualisiert);
    setZeigeSpeichernButton(false);
    window.dragIndex = undefined; // Cleanup
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className={`bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className || ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">
          Team: {selectedTeam || 'Keine Gruppe gewählt'}
          {!anzeigeDatum ? (
            <span className="ml-4 text-sm text-red-500">
              ⚠ Kein Datum gewählt
            </span>
          ) : (
            <span className="ml-4 text-sm text-gray-600 dark:text-gray-300">
              (Datum: {dayjs(anzeigeDatum).format('DD.MM.YYYY')})
            </span>
          )}
        </h2>
        <button
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:bg-blue-700/10 rounded p-1 dark:text-blue-300 dark:hover:text-white"
        >
          <Info size={20} />
        </button>
      </div>

      {infoOffen && (
        <div className="fixed inset-0 bg-black backdrop-blur-sm bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-lg p-6 max-w-xl shadow-xl animate-fade-in">
            <h3 className="text-lg font-bold mb-2">Teamvorschau – Hinweise</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Drag & Drop zum Umsortieren.</li>
              <li>Änderungen gelten ab dem gewählten Datum (Intervall wird ggf. gesplittet).</li>
              <li>Vergangene und zukünftige Zuweisungen bleiben unangetastet.</li>
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
              className="bg-gray-100 dark:bg-gray-900 p-2 rounded-2xl border border-gray-500 flex justify-between items-center cursor-move"
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
                Gruppenposition: {member.position_ingruppe ?? '–'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamVorschau;
