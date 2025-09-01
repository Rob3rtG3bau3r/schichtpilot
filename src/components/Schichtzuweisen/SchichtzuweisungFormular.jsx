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
  className
}) => {
  const [team, setTeam] = useState('');
  const [teams, setTeams] = useState([]);
  const [datumStart, setDatumStart] = useState('');
  const [datumEnde, setDatumEnde] = useState('');
  const [maxDatumEnde, setMaxDatumEnde] = useState('');
  const [kundenCheckInfo, setKundenCheckInfo] = useState(null);
  const [modalOffen, setModalOffen] = useState(false);
  const [gesamtAnzahl, setGesamtAnzahl] = useState(0);
  const [aktuellerFortschritt, setAktuellerFortschritt] = useState(0);

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
      setDatumEnde(reinesDatum);
    };

    fetchMaxDatum();
  }, [team, firma, unit]);

  const handleSubmit = async () => {
    setIsLoading(true);
    let darfUeberschreiben = false;

    if (!selectedUser || !team || !datumStart || !datumEnde) {
      alert('Bitte alle Felder ausfüllen!');
      setIsLoading(false);
      return;
    }

    const start = dayjs(datumStart);
    const ende = dayjs(datumEnde);

    if (ende.isBefore(start, 'day')) {
      alert('Enddatum darf nicht vor dem Startdatum liegen.');
      setIsLoading(false);
      return;
    }

    if (dayjs(maxDatumEnde).isBefore(ende, 'day')) {
      alert('Enddatum liegt außerhalb des Sollplans.');
      setIsLoading(false);
      return;
    }

    const { data: kundenData, error: kundenError } = await supabase
      .from('DB_Kunden')
      .select('id, firmenname, created_at')
      .eq('id', firma)
      .maybeSingle();

    if (kundenError || !kundenData) {
      alert('Kunde wurde nicht in DB_Kunden gefunden.');
      setIsLoading(false);
      return;
    }

    setKundenCheckInfo({ db: kundenData.firmenname, client: firma });

    if (start.isBefore(dayjs(kundenData.created_at), 'day')) {
      alert('Startdatum liegt vor dem Beginn des Kundenvertrags.');
      setIsLoading(false);
      return;
    }

    const tageAnzahl = ende.diff(start, 'day') + 1;
    setGesamtAnzahl(tageAnzahl);
    setAktuellerFortschritt(0);

    for (let d = start.clone(); d.isSameOrBefore(ende, 'day'); d = d.add(1, 'day')) {
      const datum = d.format('YYYY-MM-DD');

      const { data: sollEintraege, error: sollFehler } = await supabase
        .from('DB_SollPlan')
        .select('kuerzel, schichtart_id, startzeit, endzeit, dauer')
        .eq('datum', datum)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('schichtgruppe', team)
        .limit(1);

      if (sollFehler) {
        console.warn(`❌ Fehler beim Laden des SollPlans für ${datum}:`, sollFehler.message);
        continue;
      }

      if (!sollEintraege || sollEintraege.length === 0) {
        console.warn(`⚠️ Kein SollPlan für ${datum} und Team ${team} gefunden.`);
        continue;
      }

      const { kuerzel, schichtart_id, startzeit, endzeit, dauer } = sollEintraege[0];

      const { data: vorhandeneEintraege, error: checkError } = await supabase
        .from('DB_Kampfliste')
        .select('*')
        .eq('user', selectedUser.user_id)
        .eq('datum', datum);

      if (checkError) {
        alert('Fehler beim Prüfen auf vorhandene Einträge.');
        setIsLoading(false);
        return;
      }

      if (vorhandeneEintraege.length > 0) {
        if (!darfUeberschreiben) {
          const bestaetigt = window.confirm(
            `Es existieren bereits Einträge im gewählten Zeitraum.\n\nMöchtest du alle überschreiben?`
          );
          if (!bestaetigt) {
            setIsLoading(false);
            return;
          }
          darfUeberschreiben = true;
        }

        const alterEintrag = vorhandeneEintraege[0];
        const { id, ...rest } = alterEintrag;

        const erlaubteFelder = [
          'created_at', 'created_by', 'user', 'firma', 'unit', 'datum',
          'schichtgruppe', 'soll_schicht', 'ist_schicht', 'kommentar',
          'startzeit_ist', 'endzeit_ist', 'dauer_ist'
        ];

        const eintragGefiltert = {};
        for (const key of erlaubteFelder) {
          if (rest[key] !== undefined) {
            eintragGefiltert[key] = rest[key];
          }
        }

        const { error: verlaufError } = await supabase.from('DB_KampflisteVerlauf').insert({
          ...eintragGefiltert,
          change_on: new Date().toISOString()
        });

        if (verlaufError) {
          alert('Fehler beim Verschieben in den Verlauf.');
          setIsLoading(false);
          return;
        }

        await supabase.from('DB_Kampfliste').delete().eq('id', alterEintrag.id);
      }

      const { error: insertError } = await supabase.from('DB_Kampfliste').insert({
        created_by: selectedUser.user_id,
        created_at: new Date().toISOString(),
        user: selectedUser.user_id,
        firma_id: firma,
        unit_id: unit,
        datum,
        schichtgruppe: team,
        soll_schicht: kuerzel,
        ist_schicht: schichtart_id,
        startzeit_ist: startzeit,
        endzeit_ist: endzeit,
        dauer_ist: dauer,
        dauer_soll: dauer,
        kommentar: '',
        aenderung: false,
      });

      if (insertError) {
        alert(`Fehler beim Einfügen für ${datum}: ${insertError.message}`);
        setIsLoading(false);
        return;
      }

      setAktuellerFortschritt((prev) => prev + 1);
    }

    // Nach allen Inserts Berechnung starten
    await berechneFuerJahre(
      selectedUser.user_id,
      firma,
      unit,
      start.year(),
      ende.year()
    );

    alert('✅ Schicht erfolgreich zugewiesen!');
    if (typeof onRefresh === 'function') {
      onRefresh();
    }

    setIsLoading(false);
  };

  return (
    <div className={`bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Soll Schichtplan zuweisen</h2>
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

      <label className="block mb-2">Zuweisung bis</label>
      <input
        type="date"
        value={datumEnde}
        onChange={(e) => setDatumEnde(e.target.value)}
        max={maxDatumEnde}
        min={datumStart || undefined}
        className="bg-gray-100 dark:bg-gray-800 p-2 w-full rounded mb-4"
      />

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

      {gesamtAnzahl > 0 && (
        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 text-center">
          Kopiere {aktuellerFortschritt} von {gesamtAnzahl} Tagen...
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
