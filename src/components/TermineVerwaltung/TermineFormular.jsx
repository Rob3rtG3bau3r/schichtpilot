// Datei: components/Termine/TermineFormular.jsx
import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';

const TermineFormular = ({ setReloadKey }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  const [bezeichnung, setBezeichnung] = useState('');
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [farbe, setFarbe] = useState('#3b82f6');
  const [wiederholend, setWiederholend] = useState(false);
  const [wiederholenBis, setWiederholenBis] = useState('');
  const [wiederholIntervall, setWiederholIntervall] = useState('monatlich');
  const [wiederholAnzahl, setWiederholAnzahl] = useState(1);

  const [verfuegbareQualis, setVerfuegbareQualis] = useState([]);
  const [verfuegbareTeams, setVerfuegbareTeams] = useState([]);
  const [auswahlQualis, setAuswahlQualis] = useState([]);
  const [auswahlTeams, setAuswahlTeams] = useState([]);

  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    const ladeDaten = async () => {
      const { data: qualiData } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation')
        .eq('firma_id', firma)
        .eq('unit_id', unit);
      setVerfuegbareQualis(qualiData || []);

      const { data: teamData } = await supabase
        .from('DB_Unit')
        .select('schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
        .eq('id', unit)
        .single();

      if (teamData) {
        const teams = Object.values(teamData).filter(Boolean);
        setVerfuegbareTeams(teams);
      }
    };

    ladeDaten();
  }, [firma, unit]);

  const toggleAuswahl = (value, type) => {
    if (type === 'quali') {
      setAuswahlQualis((prev) =>
        prev.includes(value) ? prev.filter((q) => q !== value) : [...prev, value]
      );
    } else {
      setAuswahlTeams((prev) =>
        prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]
      );
    }
  };

  const toggleAlle = (type) => {
    if (type === 'quali') {
      const alleIds = verfuegbareQualis.map((q) => q.id);
      setAuswahlQualis(auswahlQualis.length === alleIds.length ? [] : alleIds);
    } else {
      setAuswahlTeams(auswahlTeams.length === verfuegbareTeams.length ? [] : [...verfuegbareTeams]);
    }
  };

  const wiederholungSatz = () => {
    if (!wiederholend || !wiederholenBis) return '';
    const ab = dayjs(datum).format('DD.MM.YYYY');
    const bis = dayjs(wiederholenBis).format('DD.MM.YYYY');
    const einheit = {
      täglich: 'Tage',
      wöchentlich: 'Wochen',
      monatlich: 'Monate',
    }[wiederholIntervall];

    return `Wiederholt sich ab dem ${ab} alle ${wiederholAnzahl} ${einheit} bis zum ${bis}.`;
  };

  const generiereEintraege = () => {
    const eintraege = [];
    let aktuellesDatum = dayjs(datum);
    const ende = wiederholend ? dayjs(wiederholenBis) : aktuellesDatum;

    while (aktuellesDatum.isSameOrBefore(ende)) {
      if (aktuellesDatum.diff(dayjs(datum), 'year') >= 2) break;

      eintraege.push({
        bezeichnung,
        datum: aktuellesDatum.format('YYYY-MM-DD'),
        farbe,
        wiederholend,
        quali_ids: auswahlQualis.length ? auswahlQualis : null,
        team: auswahlTeams.length ? auswahlTeams : null,
        created_by: userId,
        firma_id: firma,
        unit_id: unit,
      });

      if (wiederholIntervall === 'täglich') aktuellesDatum = aktuellesDatum.add(wiederholAnzahl, 'day');
      else if (wiederholIntervall === 'wöchentlich') aktuellesDatum = aktuellesDatum.add(wiederholAnzahl * 7, 'day');
      else aktuellesDatum = aktuellesDatum.add(wiederholAnzahl, 'month');
    }

    return eintraege;
  };

  const handleSpeichern = async () => {
    if (!bezeichnung || (!auswahlQualis.length && !auswahlTeams.length)) {
      setFeedback('Bezeichnung und mindestens ein Team oder eine Qualifikation erforderlich.');
      return;
    }

    const eintraege = generiereEintraege();
    const { error } = await supabase.from('DB_TerminVerwaltung').insert(eintraege);

    if (!error) {
      setBezeichnung('');
      setDatum(new Date().toISOString().slice(0, 10));
      setFarbe('#3b82f6');
      setWiederholend(false);
      setWiederholenBis('');
      setWiederholAnzahl(1);
      setWiederholIntervall('monatlich');
      setAuswahlQualis([]);
      setAuswahlTeams([]);
      setFeedback('Termin erfolgreich gespeichert!');
      setTimeout(() => setFeedback(''), 2000);
      setReloadKey(prev => prev + 1); // <-- DAS ist dein klassischer Refresh!
    } else {
      setFeedback('Fehler beim Speichern.');
    }
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 p-4 space-y-4 shadow-xl rounded-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Termin erstellen</h2>
        <button onClick={() => setInfoOffen(true)} title="Infos zum Modul">
          <Info className="w-5 h-5 top-3 right-3 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <input
          className="flex-1 p-2 rounded bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          placeholder="Bezeichnung"
          value={bezeichnung}
          onChange={(e) => setBezeichnung(e.target.value)}
        />
        <input type="color" value={farbe} onChange={(e) => setFarbe(e.target.value)} />
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <input
          type="date"
          className="p-2 rounded bg-gray-200 dark:bg-gray-800 "
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
        />
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={wiederholend}
            onChange={() => setWiederholend(!wiederholend)}
          />
          Wiederholend
        </label>

        {wiederholend && (
          <>
            <input
              type="number"
              min="1"
              className="w-[60px] p-1 rounded text-gray-900 dark:text-gray-200 bg-gray-200 dark:bg-gray-700"
              value={wiederholAnzahl}
              onChange={(e) => setWiederholAnzahl(Number(e.target.value))}
            />
            <select
              className="p-1 rounded text-gray-900 dark:text-gray-200 bg-gray-200 dark:bg-gray-700"
              value={wiederholIntervall}
              onChange={(e) => setWiederholIntervall(e.target.value)}
            >
              <option value="täglich">Tage</option>
              <option value="wöchentlich">Wochen</option>
              <option value="monatlich">Monate</option>
            </select>
            <input
              type="date"
              className="p-1 rounded text-gray-900 dark:text-gray-200 bg-gray-200 dark:bg-gray-700"
              value={wiederholenBis}
              onChange={(e) => setWiederholenBis(e.target.value)}
            />
          </>
        )}
      </div>

      {wiederholend && <div className="text-sm italic text-gray-900 dark:text-gray-200">{wiederholungSatz()}</div>}

      <div>
        <div className="flex justify-between items-center">
          <label className="font-semibold">Teams auswählen</label>
          <button className="text-sm text-blue-400" onClick={() => toggleAlle('team')}>
            Alle auswählen
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {verfuegbareTeams.map((team, idx) => (
            <div
              key={idx}
              onClick={() => toggleAuswahl(team, 'team')}
              className={`px-3 py-1 rounded cursor-pointer border border-gray-300 dark:border-gray-600 ${
                auswahlTeams.includes(team)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {team}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center">
          <label className="font-semibold">Qualifikationen auswählen</label>
          <button className="text-sm text-blue-400" onClick={() => toggleAlle('quali')}>
            Alle auswählen
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {verfuegbareQualis.map((quali) => (
            <div
              key={quali.id}
              onClick={() => toggleAuswahl(quali.id, 'quali')}
              className={`px-3 py-1 rounded cursor-pointer border border-gray-300 dark:border-gray-600 ${
                auswahlQualis.includes(quali.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {quali.qualifikation}
            </div>
          ))}
        </div>
      </div>

      {(auswahlTeams.length > 0 || auswahlQualis.length > 0) && (
        <p className="text-sm italic text-gray-400">
          Ausgewählt: {auswahlTeams.length} Teams, {auswahlQualis.length} Qualifikationen
        </p>
      )}

      <button
        onClick={handleSpeichern}
        className="bg-green-700 hover:bg-green-800 px-4 py-2 rounded text-white"
      >
        Speichern
      </button>
      {feedback && <div className="text-green-400 text-sm pt-1">{feedback}</div>}

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 text-black dark:text-white rounded-xl p-6 w-[500px] relative">
            <h3 className="text-lg font-bold mb-2">Infos zum Termin-Modul</h3>
            <ul className="list-disc space-y-2 text-sm pl-5">
              <li>Erstelle Termine für Teams und/oder Qualifikationen.</li>
              <li>Wiederholungen sind z. B. alle 2 Wochen oder 5 Monate möglich.</li>
              <li>Maximal 2 Jahre in die Zukunft.</li>
              <li>Diese Termine erscheinen später im Planer und in Auswertungen.</li>
            </ul>
            <button
              onClick={() => setInfoOffen(false)}
              className="absolute top-2 right-3 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TermineFormular;