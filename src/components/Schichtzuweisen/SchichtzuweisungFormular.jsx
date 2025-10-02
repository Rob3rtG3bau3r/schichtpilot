import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import { Info } from 'lucide-react';
import { berechneFuerJahre } from '../../utils/berechnungen_schichtzuweisung';

dayjs.extend(isSameOrBefore);

const SchichtzuweisungFormular = ({
  selectedUser,
  firma,
  unit,
  onTeamSelect,
  onRefresh,
  setIsLoading,
  isLoading,
  className,
  datumStart,
  setDatumStart
}) => {
  const [team, setTeam] = useState('');
  const [teams, setTeams] = useState([]);
  //const [datumStart, setDatumStart] = useState('');
  const [datumEnde, setDatumEnde] = useState('');
  const [maxDatumEnde, setMaxDatumEnde] = useState('');
  const [kundenCheckInfo, setKundenCheckInfo] = useState(null);
  const [modalOffen, setModalOffen] = useState(false);
  const [gesamtAnzahl, setGesamtAnzahl] = useState(0);
  const [aktuellerFortschritt, setAktuellerFortschritt] = useState(0);
  const [endet, setEndet] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const ladeTeams = async () => {
      if (!firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_Unit')
        .select('schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
        .eq('firma', firma)
        .eq('id', unit)
        .single();

      if (error || !data) {
        setTeams([]);
        return;
      }

      const gruppen = [
        data.schichtname1,
        data.schichtname2,
        data.schichtname3,
        data.schichtname4,
        data.schichtname5,
        data.schichtname6,
      ].filter(Boolean);
      setTeams(gruppen);
    };
    ladeTeams();
  }, [firma, unit]);

  useEffect(() => {
    const fetchMaxDatum = async () => {
      if (!team || !firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_SollPlan')
        .select('datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('schichtgruppe', team)
        .order('datum', { ascending: false })
        .limit(1);

      if (error || !data?.[0]) {
        setMaxDatumEnde('');
        return;
      }

      const reinesDatum = data[0].datum?.slice(0, 10);
      setMaxDatumEnde(reinesDatum);

    };

    fetchMaxDatum();
  }, [team, firma, unit]);

const handleSubmit = async () => {
  setIsLoading(true);

  if (!selectedUser || !team || !datumStart) {
    alert('Bitte Team und Startdatum auswählen!');
    setIsLoading(false);
    return;
  }

  if (datumEnde && dayjs(datumEnde).isBefore(datumStart, 'day')) {
    alert('Enddatum darf nicht vor dem Startdatum liegen.');
    setIsLoading(false);
    return;
  }

  try {
    const { error: insertError } = await supabase.from('DB_SchichtZuweisung').insert({
      user_id: selectedUser.user_id,
      schichtgruppe: team,
      von_datum: datumStart,
      bis_datum: endet ? datumEnde : null,
      position_ingruppe: 99, // kann später per Drag-Drop gesetzt werden
      firma_id: firma,
      unit_id: unit,
      created_at: new Date().toISOString(),
      created_by: localStorage.getItem('user_id') || null,
    });

    if (insertError) {
      throw insertError;
    }

setFeedback('✅ Schichtgruppe erfolgreich zugewiesen!');
setTimeout(() => setFeedback(''), 1000);
    if (typeof onRefresh === 'function') onRefresh();

  } catch (error) {
    setFeedback('❌ Fehler beim Speichern: ' + error.message);
    setTimeout(() => setFeedback(''), 2000);
  }

  setIsLoading(false);
};


  return (
    <div className={`bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Team zuweisen</h2>
        <button onClick={() => setModalOffen(true)} title="Info">
          <Info size={20} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
        </button>
      </div>

      {kundenCheckInfo && (
        <div className="bg-gray-100 dark:bg-gray-800 text-sm rounded p-2 mb-2">
          <p><strong>Unternehmen:</strong></p>
          <p>{kundenCheckInfo.db}</p>
        </div>
      )}

      <label className="block mb-2">Zugewiesenes Team</label>
      <select
        value={team}
        onChange={(e) => {
          setTeam(e.target.value);
          onTeamSelect(e.target.value);
        }}
        className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
      >
        <option value="">Team wählen</option>
        {teams.map((t, i) => (
          <option key={i} value={t}>{t}</option>
        ))}
      </select>

      <label className="block mb-2">Zuweisung ab</label>
      <input
        type="date"
        value={datumStart}
        onChange={(e) => setDatumStart(e.target.value)}
        className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
      />
<div className="flex items-center mb-2">
  <input
    type="checkbox"
    id="endet"
    checked={endet}
    onChange={(e) => {
      setEndet(e.target.checked);
      if (!e.target.checked) setDatumEnde(''); // Reset wenn ausgeschaltet
    }}
    className="mr-2"
  />
  <label htmlFor="endet">Zuweisung endet (z.B MA verlässt das Unternehmen?)</label>
</div>

{endet && (
  <>
    <label className="block mb-2">Zuweisung bis</label>
    <input
      type="date"
      value={datumEnde}
      onChange={(e) => setDatumEnde(e.target.value)}
      max={maxDatumEnde}
      min={datumStart || undefined}
      className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
    />
  </>
)}


      {selectedUser && (
        <p className="mb-4">
          Mitarbeiter: <strong>{selectedUser.nachname}, {selectedUser.vorname}</strong>
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className={`px-4 py-2 rounded w-full flex items-center justify-center gap-2 text-white ${
          isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {isLoading && (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isLoading ? 'Mitarbeiter wird zugewiesen' : 'Zuweisung durchführen'}
      </button>
      <h2 className="text-xs p-2 text-gray-600 dark:text-gray-500">Das zuweisen eines Teams ist Zeitintensiv!</h2>
      {gesamtAnzahl > 0 && (
        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 text-center">
          Kopiere {aktuellerFortschritt} von {gesamtAnzahl} Tagen...
        </div>
      )}
{feedback && (
  <div className="mt-2 text-green-600 dark:text-green-400 text-sm text-center">
    {feedback}
  </div>
)}
      {modalOffen && (
        <div
          className="fixed inset-0 bg-black backdrop-blur-sm bg-opacity-50 z-50 flex items-center justify-center"
          onClick={() => setModalOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-6 max-w-sm shadow-lg animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-2">Information zur Zuweisung</h2>
            <p className="text-sm mb-4">
              Hier kannst du später die Beschreibung aller Funktionen eintragen.
              <br />
              Aktuell: Auswahl Team, Zeitraum, automatische Prüfung, Verlauf & Eintrag in Kampfliste.
            </p>
            <button
              onClick={() => setModalOffen(false)}
              className="mt-2 px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchichtzuweisungFormular;
