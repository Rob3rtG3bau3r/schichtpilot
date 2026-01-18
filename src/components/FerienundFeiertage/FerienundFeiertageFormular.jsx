import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';

const FeiertageFormular = ({ onRefresh }) => {
  const [land, setLand] = useState('');
  const [bundesland, setBundesland] = useState('');
  const [istBundesweit, setIstBundesweit] = useState(false);

  const [typ, setTyp] = useState('Feiertag');
  const [name, setName] = useState('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [farbe, setFarbe] = useState('#22d3ee');

  const [feedback, setFeedback] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);

  const [laender, setLaender] = useState([]);
  const [bundeslaender, setBundeslaender] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 1) Länder aus DB_Unit laden
  useEffect(() => {
    const ladeLaender = async () => {
      setLoadingOptions(true);
      setFeedback('');
      const { data, error } = await supabase
        .from('DB_Unit')
        .select('land')
        .not('land', 'is', null);

      if (error) {
        console.error(error);
        setFeedback('Fehler: Länder konnten nicht geladen werden (DB_Unit.land).');
        setLoadingOptions(false);
        return;
      }

      const unique = Array.from(
        new Set((data || []).map(r => (r.land || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      setLaender(unique);

      // Wenn nur ein Land existiert, automatisch setzen
      if (!land && unique.length === 1) setLand(unique[0]);

      setLoadingOptions(false);
    };

    ladeLaender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Bundesländer abhängig vom Land aus DB_Unit laden
  useEffect(() => {
    const ladeBundeslaender = async () => {
      setBundeslaender([]);
      setBundesland('');

      if (!land) return;

      const { data, error } = await supabase
        .from('DB_Unit')
        .select('bundesland')
        .eq('land', land)
        .not('bundesland', 'is', null);

      if (error) {
        console.error(error);
        setFeedback('Fehler: Bundesländer konnten nicht geladen werden.');
        return;
      }

      const unique = Array.from(
        new Set((data || []).map(r => (r.bundesland || '').trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));

      setBundeslaender(unique);

      // Wenn nur ein BL existiert, automatisch setzen (außer bundesweit)
      if (unique.length === 1 && !istBundesweit) setBundesland(unique[0]);
    };

    ladeBundeslaender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [land]);

  // 3) Typ- / Bundesweit-Logik sauber halten
  useEffect(() => {
    // Bei Ferien niemals bundesweit
    if (typ === 'Ferien') setIstBundesweit(false);

    // Bei Feiertag: bis = von
    if (typ === 'Feiertag' && von) setBis(von);
  }, [typ, von]);

  // 4) Wenn bundesweit aktiviert: BL löschen
  useEffect(() => {
    if (istBundesweit) setBundesland('');
  }, [istBundesweit]);

  const handleVonChange = (e) => {
    const value = e.target.value;
    setVon(value);
    // Feiertag: bis automatisch = von
    if (typ === 'Feiertag') setBis(value);
    // Ferien: bis initial auch setzen, damit es nicht leer ist
    if (typ === 'Ferien' && !bis) setBis(value);
  };

  const isFerien = typ === 'Ferien';
  const isFeiertag = typ === 'Feiertag';

  const canPickBundesland = useMemo(() => {
    if (!land) return false;
    if (isFerien) return true;
    if (isFeiertag && !istBundesweit) return true;
    return false;
  }, [land, isFerien, isFeiertag, istBundesweit]);

  const validate = () => {
    if (!land || !typ || !name || !von) {
      return 'Bitte Land, Typ, Bezeichnung und Startdatum ausfüllen.';
    }

    if (isFerien) {
      if (!bis) return 'Bitte bei Ferien ein Enddatum (bis) angeben.';
      if (new Date(bis) < new Date(von)) return 'Enddatum darf nicht vor dem Startdatum liegen.';
      if (!bundesland) return 'Bitte bei Ferien ein Bundesland auswählen.';
    }

    if (isFeiertag) {
      // Feiertag: bundesweit => bundesland NULL/leer, sonst Pflicht
      if (!istBundesweit && !bundesland) return 'Bitte Bundesland auswählen oder "Bundesweit" aktivieren.';
    }

    return '';
  };

  const resetForm = () => {
    setName('');
    setVon('');
    setBis('');
    setFarbe('#22d3ee');
    setIstBundesweit(false);
    setBundesland('');
  };

  const handleSpeichern = async () => {
    setFeedback('');

    const msg = validate();
    if (msg) {
      setFeedback(msg);
      return;
    }

    const jahr = new Date(von).getFullYear();

    const payload = {
      land: land,
      typ,
      name,
      von,
      bis: isFeiertag ? von : bis,
      jahr,
      farbe,
      ist_bundesweit: isFeiertag ? !!istBundesweit : false,
      bundesland: isFeiertag
        ? (istBundesweit ? null : bundesland)
        : bundesland,
    };

    const { error } = await supabase.from('DB_FeiertageundFerien').insert(payload);

    if (error) {
      console.error(error);
      setFeedback('Fehler beim Speichern. (Prüfe Pflichtfelder / RLS / DB-Spalten)');
      return;
    }

    setFeedback('Erfolgreich gespeichert.');
    resetForm();
    if (onRefresh) onRefresh();
  };

  return (
    <>
      <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="bg-gray-200 dark:bg-gray-800 flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Feiertag oder Ferien eintragen</h2>
          <button
            onClick={() => setInfoOpen(true)}
            className="text-blue-500 hover:text-blue-700"
            title="Info anzeigen"
          >
            <Info size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
          Hier pflegst du zentral Feiertage & Ferien (Land + optional Bundesland). Units greifen später anhand
          von Land/Bundesland darauf zu.
        </p>

        <div className="grid grid-cols-1 gap-4">
          {/* Land + Typ */}
          <div className="flex gap-4">
            <select
              value={land}
              onChange={(e) => setLand(e.target.value)}
              className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
              disabled={loadingOptions}
            >
              <option value="">{loadingOptions ? 'Lade Länder…' : 'Land wählen'}</option>
              {laender.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>

            <select
              value={typ}
              onChange={(e) => setTyp(e.target.value)}
              className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
            >
              <option value="Feiertag">Feiertag</option>
              <option value="Ferien">Ferien</option>
            </select>
          </div>

          {/* Bundesweit Toggle (nur bei Feiertag) */}
          {isFeiertag && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={istBundesweit}
                onChange={(e) => setIstBundesweit(e.target.checked)}
              />
              Bundesweit (gilt im ganzen Land)
            </label>
          )}

          {/* Bundesland */}
          <select
            value={bundesland}
            onChange={(e) => setBundesland(e.target.value)}
            className={`p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 ${
              !canPickBundesland ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            disabled={!canPickBundesland}
            title={
              !land
                ? 'Bitte zuerst ein Land wählen'
                : (isFeiertag && istBundesweit)
                  ? 'Bundesweit aktiv → kein Bundesland nötig'
                  : ''
            }
          >
            <option value="">
              {isFeiertag && istBundesweit ? '— (bundesweit)' : 'Bundesland wählen'}
            </option>
            {bundeslaender.map((bl) => (
              <option key={bl} value={bl}>{bl}</option>
            ))}
          </select>

          {/* Name */}
          <input
            type="text"
            placeholder="Bezeichnung"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
          />

          {/* Von / Bis */}
          <div className="flex gap-4">
            <input
              type="date"
              value={von}
              onChange={handleVonChange}
              className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
            />

            {isFerien ? (
              <input
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
              />
            ) : (
              <input
                type="date"
                value={bis}
                disabled
                className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700 opacity-60 cursor-not-allowed"
                title="Bei Feiertag wird 'bis' automatisch = 'von' gesetzt"
              />
            )}
          </div>

          {/* Farbe */}
          <div className="flex items-center gap-4">
            <label className="text-sm">Farbe:</label>
            <input
              type="color"
              value={farbe}
              onChange={(e) => setFarbe(e.target.value)}
              className="w-12 h-8 p-1 bg-gray-200 dark:bg-gray-800"
            />
          </div>

          {feedback && (
            <p className="text-sm text-red-500 dark:text-red-300">
              {feedback}
            </p>
          )}

          <button
            onClick={handleSpeichern}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Eintrag speichern
          </button>
        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-lg text-sm relative">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-2">Informationen zu Feiertagen & Ferien</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Land:</strong> Wird aus vorhandenen Units geladen (DB_Unit.land).</li>
              <li><strong>Bundesland:</strong> Wird passend zum Land aus Units geladen (DB_Unit.bundesland).</li>
              <li><strong>Feiertag:</strong> „bis“ wird automatisch auf „von“ gesetzt.</li>
              <li><strong>Bundesweit:</strong> Bei Feiertagen möglich → Bundesland wird dann leer/NULL gespeichert.</li>
              <li><strong>Ferien:</strong> brauchen immer ein Start- und Enddatum + Bundesland.</li>
              <li><strong>Jahr:</strong> Wird (vorerst) automatisch aus „von“ berechnet.</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default FeiertageFormular;
