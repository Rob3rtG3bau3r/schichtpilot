import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';
import InfoModal from './InfoModal';
import { useRollen } from '../../context/RollenContext';

/** Firma anlegen und ID zurückgeben (bei "Kunden Anlegen") */
const erstelleFirmaUndHoleId = async (firmenname) => {
  const { data, error } = await supabase
    .from('DB_Kunden')
    .insert([{ firmenname }])
    .select('id')
    .single();

  if (error) throw new Error('❌ Fehler beim Anlegen der Firma: ' + error.message);
  return data.id;
};

/** Sicheren Temp-PW-Generator (Fallback falls randomUUID fehlt) */
const genTempPassword = () =>
  (crypto?.randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36)))
    .replace(/-/g, '')
    .slice(0, 12);

/** Reset-Link verschicken, der zu /reset-password führt */
const sendeResetLink = async (email) => {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
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
  const [originalFirmaId, setOriginalFirmaId] = useState('');
  const [firmen, setFirmen] = useState([]);
  const [units, setUnits] = useState([]);
  const [passwortManuell, setPasswortManuell] = useState(false);
  const [ladeStatus, setLadeStatus] = useState(false);
  const [zeigePasswort, setZeigePasswort] = useState(false);
  const [zeigeInfo, setZeigeInfo] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [warnMessage, setWarnMessage] = useState('');

  const { userId } = useRollen();

  /** Firmen/Units laden */
  useEffect(() => {
    const ladeFirmenUndUnits = async () => {
      const { data: firmenData } = await supabase.from('DB_Kunden').select('id, firmenname');
      // 👇 wichtig: firma_id mitladen, damit gefiltert werden kann
      const { data: unitsData } = await supabase.from('DB_Unit').select('id, unitname, firma');
      setFirmen(firmenData || []);
      setUnits(unitsData || []);
    };
    ladeFirmenUndUnits();
  }, []);

  /** Default-Rolle/Funktion je nach "typ" einstellen */
  useEffect(() => {
    if (formData.typ === 'User Anlegen') {
      setFormData(prev => ({ ...prev, funktion: 'Mitarbeiter', rolle: 'Employee' }));
    } else if (formData.typ === 'Kunden Anlegen') {
      setFormData(prev => ({ ...prev, funktion: 'Kostenverantwortlich', rolle: 'Org_Admin' }));
    } else if (formData.typ === 'Entwickler Anlegen') {
      setFormData(prev => ({ ...prev, funktion: 'Entwickler', rolle: 'SuperAdmin' }));
    }
  }, [formData.typ]);

  /** In den Bearbeiten-Modus übernehmen */
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
      setOriginalFirmaId(selectedUser.firma_id || '');
    } else {
      setEditingUserId(null);
      setOriginalFirmaId('');
    }
  }, [selectedUser]);

  /** Units gefiltert nach aktueller Firma */
const filteredUnits = useMemo(() => {
  const fId = String(formData.firma_id || '');
  if (!fId) return [];
  return (units || []).filter(u => String(u.firma) === fId);
}, [units, formData.firma_id]);

  /** Wenn Firma wechselt (nur im Neu-Modus sinnvoll), Unit zurücksetzen */
  useEffect(() => {
    // Wenn die aktuell gesetzte Unit nicht zur (neuen) Firma passt, leeren
    if (formData.unit_id && filteredUnits.length > 0) {
      const ok = filteredUnits.some(u => String(u.id) === String(formData.unit_id));
      if (!ok) {
        setFormData(prev => ({ ...prev, unit_id: '' }));
      }
    }
  }, [formData.firma_id, filteredUnits]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Firma im Bearbeiten-Modus sperren
    if (name === 'firma_id' && editingUserId) {
      setWarnMessage('Die Firma eines bestehenden Nutzers kann nicht geändert werden.');
      // Optional: kurze visuelle Bestätigung, dann Hinweis wieder ausblenden
      setTimeout(() => setWarnMessage(''), 3500);
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Komfort: separater Handler, falls du später andere Logik brauchst
  const handleFirmaNeuSetzen = (e) => {
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      firma_id: value,
      unit_id: '', // beim Wechsel Firma immer Unit leeren
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLadeStatus(true);

    // Pflichtfelder
    if (!formData.email || !formData.vorname || !formData.nachname || !formData.rolle) {
      alert('Bitte alle Pflichtfelder ausfüllen.');
      setLadeStatus(false);
      return;
    }

    // Nur bei manueller Vergabe: Gleichheits-Check (keine weiteren Regeln)
    if (!editingUserId && passwortManuell && formData.passwort !== formData.passwortWiederholen) {
      alert('Die beiden Passwörter stimmen nicht überein.');
      setLadeStatus(false);
      return;
    }

    const passwort = passwortManuell ? formData.passwort : genTempPassword();

    // Firma-ID ggf. anlegen/ermitteln
    let firmaId = formData.firma_id;
    if (formData.typ === 'Kunden Anlegen') {
      try {
        // hier ist in formData.firma_id der FREITEXT-FIRMENNAME
        firmaId = await erstelleFirmaUndHoleId(formData.firma_id);
      } catch (error) {
        alert(error.message);
        setLadeStatus(false);
        return;
      }
    }

    // ❗ Validierung: Unit muss zur Firma gehören (sofern gesetzt & nicht Kunden-Anlegen)
if (firmaId && formData.unit_id && formData.typ !== 'Kunden Anlegen') {
  const unitObj = units.find(u => String(u.id) === String(formData.unit_id));
  if (unitObj && String(unitObj.firma) !== String(firmaId)) {
    alert('Die gewählte Unit gehört nicht zur ausgewählten Firma.');
    setLadeStatus(false);
    return;
  }
}

    // ❗ Firma im Edit-Modus nicht ändern (Sicherheitsnetz auf Submit-Ebene)
    if (editingUserId && String(firmaId) !== String(originalFirmaId)) {
      alert('Die Firma eines bestehenden Nutzers kann nicht geändert werden.');
      setLadeStatus(false);
      return;
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
      const res = await fetch(
        editingUserId
          ? 'https://schicht-pilot-backend.vercel.app/api/update-user'
          : 'https://schicht-pilot-backend.vercel.app/api/create-user',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            editingUserId
              ? { id: editingUserId, updateData: userPayload, updateAuthEmail: formData.email }
              : { email: formData.email, password: passwort, userData: userPayload }
          ),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        alert('❌ Fehler: ' + (result?.error || 'Unbekannter Fehler'));
        setLadeStatus(false);
        return;
      }

      // Erfolg
      if (onUserUpdated) onUserUpdated();

      if (!editingUserId) {
        if (passwortManuell) {
          setStatusMessage('✅ Benutzer angelegt. Passwort wurde manuell gesetzt.');
        } else {
          try {
            await sendeResetLink(formData.email);
            setStatusMessage('📧 Benutzer angelegt. Ein Link zum Passwort-Setzen wurde per E-Mail verschickt.');
          } catch (mailErr) {
            console.warn('resetPasswordForEmail error:', mailErr);
            setStatusMessage('⚠️ Benutzer angelegt, aber E-Mail konnte nicht gesendet werden. Bitte später erneut versuchen.');
          }
        }
      } else {
        setStatusMessage('✅ Benutzer erfolgreich geändert.');
      }

      // Nach Erfolg Formular zurücksetzen (Firma/Unit bei "User Anlegen" behalten)
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
      setOriginalFirmaId('');

      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      alert('❌ Netzwerkfehler oder API nicht erreichbar.');
    } finally {
      setLadeStatus(false);
      if (onCancelEdit) onCancelEdit();
    }
  };

  const istKunde = formData.typ === 'Kunden Anlegen';

  return (
    <div className="bg-gray-200 dark:bg-gray-800 p-6 rounded-xl shadow-xl text-gray-900 dark:text-white w-full relative border border-gray-300 dark:border-gray-700">
      {/* Info-Button */}
      <button
        onClick={() => setZeigeInfo(true)}
        className="absolute top-4 right-4 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
        title="Info"
        type="button"
      >
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

        <select
          name="typ"
          value={formData.typ}
          onChange={handleChange}
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
          disabled={ladeStatus}
        >
          <option>User Anlegen</option>
          <option>Kunden Anlegen</option>
          <option>Entwickler Anlegen</option>
          <option>User Ändern</option>
        </select>

        <input
          name="vorname"
          placeholder="Vorname"
          onChange={handleChange}
          value={formData.vorname}
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
          disabled={ladeStatus}
        />
        <input
          name="nachname"
          placeholder="Nachname"
          onChange={handleChange}
          value={formData.nachname}
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
          disabled={ladeStatus}
        />

        <select
          name="funktion"
          value={formData.funktion}
          onChange={handleChange}
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
          disabled={ladeStatus}
        >
          <option>Kostenverantwortlich</option>
          <option>Mitarbeiter</option>
          <option>Auszubildender</option>
          <option>Entwickler</option>
        </select>

        {istKunde ? (
          // Kunden anlegen: freier Firmenname
          <input
            name="firma_id"
            placeholder="Firma (frei eingeben)"
            onChange={handleChange}
            value={formData.firma_id}
            className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
            disabled={ladeStatus}
          />
        ) : (
          // Normal: Firma auswählen (im Edit-Modus gesperrt)
          <div>
            <select
              name="firma_id"
              value={formData.firma_id}
              onChange={editingUserId ? handleChange : handleFirmaNeuSetzen}
              className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
              disabled={ladeStatus || !!editingUserId}
            >
              <option value="">Wähle Firma</option>
              {firmen.map((firma) => (
                <option key={firma.id} value={firma.id}>
                  {firma.firmenname}
                </option>
              ))}
            </select>
            {editingUserId && (
              <p className="mt-1 text-xs text-amber-600">
                Hinweis: Die Firma eines bestehenden Nutzers kann nicht geändert werden.
              </p>
            )}
            {warnMessage && (
              <p className="mt-1 text-xs text-amber-600">{warnMessage}</p>
            )}
          </div>
        )}

        {!istKunde && (
          <div>
            <select
              name="unit_id"
              value={formData.unit_id}
              onChange={handleChange}
              className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
              disabled={ladeStatus || !formData.firma_id}
              title={!formData.firma_id ? 'Bitte zuerst Firma wählen' : 'Unit (nach Firma gefiltert)'}
            >
              {!formData.firma_id ? (
                <option value="">Bitte zuerst Firma wählen</option>
              ) : filteredUnits.length === 0 ? (
                <option value="">Keine Units für diese Firma</option>
              ) : (
                <>
                  <option value="">Wähle Unit</option>
                  {filteredUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.unitname}
                    </option>
                  ))}
                </>
              )}
            </select>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Units werden automatisch nach der ausgewählten Firma gefiltert.
            </p>
          </div>
        )}

        <select
          name="rolle"
          value={formData.rolle}
          onChange={handleChange}
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
          disabled={ladeStatus}
        >
          <option>Employee</option>
          <option>Team_Leader</option>
          <option>Planner</option>
          <option>Admin_Dev</option>
          <option>Org_Admin</option>
          <option>SuperAdmin</option>
        </select>

        <input
          name="email"
          type="email"
          placeholder="E-Mail"
          onChange={handleChange}
          value={formData.email}
          className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
          disabled={ladeStatus}
        />

        {!editingUserId && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={passwortManuell}
                onChange={() => setPasswortManuell(prev => !prev)}
                disabled={ladeStatus}
              />
              Passwort manuell erstellen
            </label>

            {passwortManuell && (
              <>
                <div className="relative">
                  <input
                    name="passwort"
                    type={zeigePasswort ? 'text' : 'password'}
                    placeholder="Passwort (frei, ohne Regeln)"
                    onChange={handleChange}
                    value={formData.passwort}
                    className="w-full p-2 rounded bg-gray-200 dark:bg-gray-700"
                    disabled={ladeStatus}
                  />
                  <button
                    type="button"
                    onClick={() => setZeigePasswort(prev => !prev)}
                    className="absolute right-2 top-2 text-sm text-gray-500"
                    disabled={ladeStatus}
                  >
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
                  disabled={ladeStatus}
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
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 shadow-md px-4 rounded w-full disabled:opacity-50"
          disabled={ladeStatus}
        >
          {ladeStatus ? '⏳ Speichert...' : editingUserId ? '💾 Benutzer ändern' : '👑 Benutzer anlegen'}
        </button>

        {editingUserId && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="bg-gray-600 hover:bg-gray-700 text-white shadow-md py-2 px-4 rounded w-full"
            disabled={ladeStatus}
          >
            ❌ Bearbeitung abbrechen
          </button>
        )}
      </form>
    </div>
  );
};

export default BenutzerFormular;
