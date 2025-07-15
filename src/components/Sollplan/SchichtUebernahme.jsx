import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';

const SchichtUebernahme = ({
  schicht,
  setSchicht,
  onGruppeChange,
  onSaveSuccess,
  selectedFirma,
  setSelectedFirma,
  selectedUnit,
  setSelectedUnit,
}) => {
  const [schichtgruppe, setSchichtgruppe] = useState('');
  const [datum, setDatum] = useState(() => new Date().toISOString().split('T')[0]);
  const [meldung, setMeldung] = useState('');
  const [automatisch, setAutomatisch] = useState(false);
  const [intervall, setIntervall] = useState(1);
  const [enddatum, setEnddatum] = useState('');
  const [firmen, setFirmen] = useState([]);
  const [units, setUnits] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [modalOffen, setModalOffen] = useState(false);


  useEffect(() => {
    const ladeFirmenUndUnits = async () => {
      const { data: firmenData } = await supabase.from('DB_Kunden').select('id, firmenname');
      setFirmen(firmenData || []);
    };
    ladeFirmenUndUnits();
  }, []);

  useEffect(() => {
    const ladeUnitsUndGruppen = async () => {
      if (!selectedFirma) return;

      const { data: unitsData } = await supabase
        .from('DB_Unit')
        .select('id, unitname, schichtname1, schichtname2, schichtname3, schichtname4, schichtname5, schichtname6')
        .eq('firma', selectedFirma);

      setUnits(unitsData || []);

      if (unitsData && selectedUnit) {
        const unit = unitsData.find((u) => u.id === Number(selectedUnit));
        if (unit) {
          const gruppenNamen = [
            unit.schichtname1,
            unit.schichtname2,
            unit.schichtname3,
            unit.schichtname4,
            unit.schichtname5,
            unit.schichtname6,
          ].filter(Boolean);
          setGruppen(gruppenNamen);
        } else {
          setGruppen([]);
        }
      }
    };

    ladeUnitsUndGruppen();
  }, [selectedFirma, selectedUnit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMeldung('');

    if (!schicht || !schichtgruppe || !datum || !selectedFirma || !selectedUnit) {
      setMeldung('Bitte alle Felder ausfüllen.');
      return;
    }

    const neueEintraege = [];
    let aktuellesDatumStr = datum;
    const letztesDatumStr = automatisch && enddatum ? enddatum : datum;
    let gespeicherte = 0;
    let übersprungen = 0;

    while (aktuellesDatumStr <= letztesDatumStr) {
      const { data: existing, error: checkError } = await supabase
        .from('DB_SollPlan')
        .select('id')
        .eq('datum', aktuellesDatumStr)
        .eq('schichtgruppe', schichtgruppe)
        .eq('firma_id', selectedFirma)
        .eq('unit_id', selectedUnit);

      if (checkError) {
        console.error(checkError);
        setMeldung('Fehler bei der Duplikatprüfung.');
        return;
      }

      if (!existing || existing.length === 0) {
        neueEintraege.push({
          datum: aktuellesDatumStr,
          startzeit: schicht.startzeit,
          endzeit: schicht.endzeit,
          dauer: schicht.dauer,
          kuerzel: schicht.kuerzel,
          schichtart_id: schicht.id,
          schichtgruppe,
          firma_id: selectedFirma,
          unit_id: selectedUnit,
        });
        gespeicherte++;
      } else {
        übersprungen++;
      }

      const d = new Date(aktuellesDatumStr + 'T12:00:00');
      d.setDate(d.getDate() + (automatisch ? intervall : 1));
      aktuellesDatumStr = d.toISOString().split('T')[0];
    }

    if (neueEintraege.length > 0) {
      const { error } = await supabase.from('DB_SollPlan').insert(neueEintraege);
      if (error) {
        console.error(error);
        setMeldung('Fehler beim Speichern.');
        return;
      }
    }

    setMeldung(`✅ ${gespeicherte} Eintrag(e) gespeichert, ${übersprungen} übersprungen.`);
    const d = new Date(datum + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setDatum(d.toISOString().split('T')[0]);

    if (onSaveSuccess) onSaveSuccess();
  };

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="bg-gray-200 dark:bg-gray-800 p-4 rounded-xl shadow-xl w-full space-y-4 min-h-[300px] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700"
    >
      <div className="flex items-center justify-between">
  <h3 className="text-lg">Soll Schicht Übergabe</h3>
  <button onClick={() => setModalOffen(true)} title="Info">
    <Info size={20} className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
  </button>
</div>


      <select value={selectedFirma} onChange={(e) => setSelectedFirma(e.target.value)} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
        <option value="">Firma wählen</option>
        {firmen.map((firma) => (
          <option key={firma.id} value={firma.id}>
            {firma.firmenname}
          </option>
        ))}
      </select>

      <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
        <option value="">Unit wählen</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.unitname}
          </option>
        ))}
      </select>

      <select
        value={schichtgruppe}
        onChange={(e) => {
          setSchichtgruppe(e.target.value);
          if (onGruppeChange) onGruppeChange(e.target.value);
        }}
        className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
      >
        <option value="">Schichtgruppe wählen</option>
        {gruppen.map((g, idx) => (
          <option key={idx}>{g}</option>
        ))}
      </select>

      <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />

      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={automatisch} onChange={(e) => setAutomatisch(e.target.checked)} />
        Automatisch wiederholen
      </label>

      {automatisch && (
        <>
          <select value={intervall} onChange={(e) => setIntervall(Number(e.target.value))} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Alle {i + 1} Tage
              </option>
            ))}
          </select>
          <input type="date" value={enddatum} onChange={(e) => setEnddatum(e.target.value)} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />
        </>
      )}

      {schicht && (
        <div className="text-sm space-y-1">
          <div>
            Kürzel:{' '}
            <span
              className="inline-block px-2 py-1 rounded"
              style={{ backgroundColor: schicht.farbe_bg, color: schicht.farbe_schrift }}
            >
              {schicht.kuerzel}
            </span>
          </div>
          <div>Beginn: <strong>{schicht.startzeit}</strong></div>
          <div>Ende: <strong>{schicht.endzeit}</strong></div>
          <div>Dauer: <strong>{schicht.dauer}</strong></div>
        </div>
      )}

      <button
        type="submit"
        disabled={!schicht || !schichtgruppe || !datum || !selectedFirma || !selectedUnit}
        className="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-700"
      >
        Übernehmen
      </button>

      {meldung && <div className="text-sm mt-2 text-green-400">{meldung}</div>}
    </form>
    {modalOffen && (
  <div
    className="animate-fade-in fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
    onClick={() => setModalOffen(false)}
  >
    <div
      className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-6 max-w-sm shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-lg font-bold mb-2">Information zur Übergabe</h2>
      <p className="text-sm mb-4">
        Hier kannst du später eine Beschreibung aller Funktionen reinschreiben.
        <br />
        Aktuell: Auswahl von Firma, Unit, Schichtgruppe, Datum & Wiederholung.
        <br />
        Speichern prüft auf Duplikate und übernimmt die Schicht in den Soll-Plan.
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
</>   
  );
};

export default SchichtUebernahme;