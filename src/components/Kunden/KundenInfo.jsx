import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Dialog } from '@headlessui/react';
import { Pencil } from 'lucide-react';

const KundenInfo = ({ firma }) => {
  const [kunde, setKunde] = useState(null);
  const [modalOffen, setModalOffen] = useState(false);
  const [neuerName, setNeuerName] = useState('');
  const [bestaetigungOffen, setBestaetigungOffen] = useState(false);
  const [erfolgsmeldung, setErfolgsmeldung] = useState('');

  // Kundendaten laden
  useEffect(() => {
    const ladeKunde = async () => {
      if (!firma) {
        console.log('Firma fehlt – Abfrage wird nicht ausgeführt');
        return;
      }

      const { data, error } = await supabase
        .from('DB_Kunden')
        .select('*')
        .eq('id', firma)
        .single();

      if (error) {
        console.log('Fehler beim Laden der Kundendaten:', error.message);
      } else {
        setKunde(data);
        setNeuerName(data.firmenname);
      }
    };

    ladeKunde();
  }, [firma]);

  // Speichern
const handleSpeichern = async () => {
  const nameGeändert = neuerName !== kunde.firmenname;

  // Nur bei Namensänderung bestätigen
  if (nameGeändert && !bestaetigungOffen) {
    setBestaetigungOffen(true);
    return;
  }

  const { error } = await supabase
    .from('DB_Kunden')
    .update({
      firmenname: neuerName,
      strasse: kunde.strasse,
      plz: kunde.plz,
      stadt: kunde.stadt,
      telefon: kunde.telefon,
      telefon2: kunde.telefon2,
    })
    .eq('firmenname', firma);

  if (!error) {
    setErfolgsmeldung('Daten erfolgreich geändert!');
    setModalOffen(false); // ← Modal schließen
    setBestaetigungOffen(false);

    // lokal den Namen übernehmen
    setKunde(prev => ({
      ...prev,
      firmenname: neuerName,
    }));

    setTimeout(() => setErfolgsmeldung(''), 3000);
  }
};

  if (!kunde) return <div className="text-sm text-gray-400">Lade Unternehmensdaten…</div>;

  return (
    <div className="p-4 rounded-xl text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-600 shadow-xl bg-gray-200 dark:bg-gray-800">
      <h2 className="text-xl font-semibold mb-4">Dein Unternehmen</h2>

      <div className="flex items-center gap-2">
        <span className="text-lg font-medium">{kunde.firmenname}</span>
        <button
          className="text-blue-500 hover:underline text-sm flex items-center gap-1"
          onClick={() => setModalOffen(true)}
        >
          <Pencil size={16} /> Ändern
        </button>
      </div>

      <div className="mt-6 p-4 border rounded-lg dark:border-gray-700">
        <h3 className="text-sm font-semibold mb-2 text-gray-600 dark:text-gray-300">Kontaktdaten</h3>
        <div className="text-sm text-gray-800 dark:text-gray-100">
          <p>Straße: {kunde.strasse || '–'}</p>
          <p>PLZ & Ort: {kunde.plz || '–'} {kunde.stadt || ''}</p>
          <p>Telefon: {kunde.telefon || '–'}</p>
          <p>Mobil: {kunde.telefon2 || '–'}</p>
        </div>
      </div>

      {erfolgsmeldung && (
        <div className="mt-4 text-green-600 dark:text-green-400 text-sm">
          ✅ {erfolgsmeldung}
        </div>
      )}

      {/* Modal */}
<Dialog open={modalOffen} onClose={() => { setModalOffen(false); setBestaetigungOffen(false); }}>
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-[90%] max-w-md">
      <Dialog.Title className="text-lg font-semibold mb-4">
        Du möchtest die Firmendaten ändern?
      </Dialog.Title>

      {/* Eingabefelder */}
      <div className="space-y-2">
        <input
          type="text"
          value={neuerName}
          onChange={(e) => setNeuerName(e.target.value)}
          className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          placeholder="Firmenname"
        />
        <input
          type="text"
          value={kunde.strasse || ''}
          onChange={(e) => setKunde(prev => ({ ...prev, strasse: e.target.value }))}
          className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          placeholder="Straße"
        />
<div className="flex gap-2">
  <input
    type="text"
    value={kunde.plz || ''}
    onChange={(e) => setKunde(prev => ({ ...prev, plz: e.target.value }))}
    className="w-24 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
    placeholder="PLZ"
    maxLength={10}
  />
  <input
    type="text"
    value={kunde.stadt || ''}
    onChange={(e) => setKunde(prev => ({ ...prev, stadt: e.target.value }))}
    className="flex-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
    placeholder="Ort"
  />
</div>

        <input
          type="text"
          value={kunde.telefon || ''}
          onChange={(e) => setKunde(prev => ({ ...prev, telefon: e.target.value }))}
          className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          placeholder="Telefon"
        />
        <input
          type="text"
          value={kunde.telefon2 || ''}
          onChange={(e) => setKunde(prev => ({ ...prev, telefon2: e.target.value }))}
          className="w-full p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          placeholder="Mobil"
        />
      </div>

      {/* Sicherheitshinweis */}
      {bestaetigungOffen && (
        <p className="text-sm text-red-500 mt-2">⚠️ Bist du dir sicher?</p>
      )}

      {/* Buttons */}
      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => { setModalOffen(false); setBestaetigungOffen(false); }}
          className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-sm"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSpeichern}
          className="px-3 py-1 rounded bg-blue-600 text-white text-sm"
        >
          Speichern
        </button>
      </div>
    </div>
  </div>
</Dialog>

    </div>
  );
};

export default KundenInfo;
