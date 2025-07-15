import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';
import InfoModal from './InfoModal'; // Neue Komponente für Modal
import { useRollen } from '../../context/RollenContext';

const erstelleFirmaUndHoleId = async (firmenname) => {
  const { data, error } = await supabase
    .from('DB_Kunden')
    .insert([{ firmenname }])
    .select('id')
    .single();

  if (error) {
    throw new Error('❌ Fehler beim Anlegen der Firma: ' + error.message);
  }

  return data.id;
};

const BenutzerFormular = ({ selectedUser, onCancelEdit, onUserUpdated }) => {
  const [formData, setFormData] = useState({
    typ: 'User Anlegen',
    vorname: '',
    nachname: '',
    funktion: 'Mitarbeiter',
    firma_id: '',
    unit_id: '',
    rolle: 'Employee',
    email: '',
    passwort: '',
    passwortWiederholen: '',
  });
  const [editingUserId, setEditingUserId] = useState(null);
  const [firmen, setFirmen] = useState([]);
  const [units, setUnits] = useState([]);
  const [passwortManuell, setPasswortManuell] = useState(false);
  const [ladeStatus, setLadeStatus] = useState(false);
  const [zeigePasswort, setZeigePasswort] = useState(false);
  const [zeigeInfo, setZeigeInfo] = useState(false);
  const { userId } = useRollen(); // oder userId oder wie du ihn im Kontext genannt hast
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const ladeFirmenUndUnits = async () => {
      const { data: firmenData } = await supabase.from('DB_Kunden').select('id, firmenname');
      const { data: unitsData } = await supabase.from('DB_Unit').select('id, unitname');
      setFirmen(firmenData || []);
      setUnits(unitsData || []);
    };
    ladeFirmenUndUnits();
  }, []);

  useEffect(() => {
    if (formData.typ === 'User Anlegen') {
      setFormData(prev => ({ ...prev, funktion: 'Mitarbeiter', rolle: 'Employee' }));
    } else if (formData.typ === 'Kunden Anlegen') {
      setFormData(prev => ({ ...prev, funktion: 'Kostenverantwortlich', rolle: 'Org_Admin' }));
    } else if (formData.typ === 'Entwickler Anlegen') {
      setFormData(prev => ({ ...prev, funktion: 'Entwickler', rolle: 'SuperAdmin' }));
    }
  }, [formData.typ]);

  useEffect(() => {
    if (selectedUser) {
      setFormData(prev => ({
        ...prev,
        typ: 'User Ändern',
        vorname: selectedUser.vorname || '',
        nachname: selectedUser.nachname || '',
        funktion: selectedUser.funktion || '',
        firma_id: selectedUser.firma_id || '',
        unit_id: selectedUser.unit_id || '',
        rolle: selectedUser.rolle || '',
        email: selectedUser.email || '',
      }));
      setEditingUserId(selectedUser.user_id || selectedUser.id || null);
    }
  }, [selectedUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLadeStatus(true);

    if (!formData.email || !formData.vorname || !formData.nachname || !formData.rolle) {
      alert("Bitte alle Pflichtfelder ausfüllen.");
      setLadeStatus(false);
      return;
    }

    const passwort = passwortManuell ? formData.passwort : crypto.randomUUID().slice(0, 12);

    let firmaId = formData.firma_id;

if (formData.typ === 'Kunden Anlegen') {
  try {
    firmaId = await erstelleFirmaUndHoleId(formData.firma_id); // hier steht der Firmenname drin
  } catch (error) {
    alert(error.message);
    setLadeStatus(false);
    return;
  }
}

    const userPayload = {
      vorname: formData.vorname,
      nachname: formData.nachname,
      rolle: formData.rolle,
      firma_id: firmaId || null,
      unit_id: formData.unit_id || null,
      funktion: formData.funktion,
      email: formData.email,
      erstellt_von: userId,
    };

    try {
      const res = await fetch(editingUserId
        ? 'https://schicht-pilot-backend.vercel.app/api/update-user'
        : 'https://schicht-pilot-backend.vercel.app/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingUserId
          ? { id: editingUserId, updateData: userPayload, updateAuthEmail: formData.email }
          : { email: formData.email, password: passwort, userData: userPayload })
      });

      const result = await res.json();
      if (res.ok) {
        console.log('✅ Erfolgreich gespeichert.');
        if (onUserUpdated) onUserUpdated();
        setStatusMessage(editingUserId ? '✅ Benutzer erfolgreich geändert.' : '✅ Benutzer erfolgreich angelegt.');
        setTimeout(() => setStatusMessage(''), 3000);
      } else {
        alert("❌ Fehler: " + result.error);
      }
    } catch (err) {
      alert("❌ Netzwerkfehler oder API nicht erreichbar.");
    }

    const firmaBehalten = formData.typ === 'User Anlegen' ? formData.firma_id : '';
    const unitBehalten = formData.typ === 'User Anlegen' ? formData.unit_id : '';

    setFormData({
      typ: 'User Anlegen',
      vorname: '',
      nachname: '',
      funktion: 'Mitarbeiter',
      firma_id: firmaBehalten,
      unit_id: unitBehalten,
      rolle: 'Employee',
      email: '',
      passwort: '',
      passwortWiederholen: '',
    });

    setPasswortManuell(false);
    setEditingUserId(null);
    setLadeStatus(false);
    if (onCancelEdit) onCancelEdit();
  };

  const istKunde = formData.typ === 'Kunden Anlegen';

  return (
    <div className="bg-gray-200 dark:bg-gray-800 p-6 rounded-xl shadow-xl text-gray-900 dark:text-white w-full relative border border-gray-300 dark:border-gray-700">
      <button onClick={() => setZeigeInfo(true)} className="absolute top-4 right-4 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" title="Info">
        <Info size={20} />
      </button>
<div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
  <strong>Nutzer-ID:</strong> {userId || 'wird geladen...'}
</div>

      {zeigeInfo && <InfoModal onClose={() => setZeigeInfo(false)} />}
    
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold">
          {editingUserId ? 'Benutzer ändern' : 'Benutzer anlegen'}
        </h2>
        <select name="typ" value={formData.typ} onChange={handleChange} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
          <option>User Anlegen</option>
          <option>Kunden Anlegen</option>
          <option>Entwickler Anlegen</option>
          <option>User Ändern</option>
        </select>

        <input name="vorname" placeholder="Vorname" onChange={handleChange} value={formData.vorname} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />
        <input name="nachname" placeholder="Nachname" onChange={handleChange} value={formData.nachname} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />

        <select name="funktion" value={formData.funktion} onChange={handleChange} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
          <option>Kostenverantwortlich</option>
          <option>Mitarbeiter</option>
          <option>Auszubildender</option>
          <option>Entwickler</option>
        </select>

        {istKunde ? (
          <input name="firma_id" placeholder="Firma (frei eingeben)" onChange={handleChange} value={formData.firma_id} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />
        ) : (
          <select name="firma_id" value={formData.firma_id} onChange={handleChange} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
            <option value="">Wähle Firma</option>
            {firmen.map((firma) => (
              <option key={firma.id} value={firma.id}>{firma.firmenname}</option>
            ))}
          </select>
        )}

        {!istKunde && (
          <select name="unit_id" value={formData.unit_id} onChange={handleChange} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
            <option value="">Wähle Unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>{unit.unitname}</option>
            ))}
          </select>
        )}

        <select name="rolle" value={formData.rolle} onChange={handleChange} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700">
          <option>Employee</option>
          <option>Team_Leader</option>
          <option>Planner</option>
          <option>Admin_Dev</option>
          <option>Org_Admin</option>
          <option>SuperAdmin</option>
        </select>

        <input name="email" type="email" placeholder="E-Mail" onChange={handleChange} value={formData.email} className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700" />

        {!editingUserId && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={passwortManuell} onChange={() => setPasswortManuell(prev => !prev)} />
              Passwort manuell erstellen
            </label>

            {passwortManuell && (
              <>
                <div className="relative">
                  <input
                    name="passwort"
                    type={zeigePasswort ? 'text' : 'password'}
                    placeholder="Passwort"
                    onChange={handleChange}
                    value={formData.passwort}
                    className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
                  />
                  <button type="button" onClick={() => setZeigePasswort(prev => !prev)} className="absolute right-2 top-2 text-sm text-gray-500">
                    👁
                  </button>
                </div>
                <input
                  name="passwortWiederholen"
                  type={zeigePasswort ? 'text' : 'password'}
                  placeholder="Passwort wiederholen"
                  onChange={handleChange}
                  value={formData.passwortWiederholen}
                  className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
                />
              </>
            )}
          </>
        )}
       {statusMessage && (
           <div className="bg-green-100 text-green-800 text-sm p-2 rounded shadow border border-green-300 mt-2">
              {statusMessage}
            </div>
        )}
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 shadow-md px-4 rounded w-full"
          disabled={ladeStatus}
        >
          {ladeStatus ? '⏳ Speichert...' : editingUserId ? '💾 Benutzer ändern' : '👑 Benutzer anlegen'}
        </button>

        {editingUserId && (
          <button type="button" onClick={onCancelEdit} className="bg-gray-600 hover:bg-gray-700 text-white shadow-md py-2 px-4 rounded w-full">
            ❌ Bearbeitung abbrechen
          </button>
        )}
      </form>
    </div>
  );
};

export default BenutzerFormular;