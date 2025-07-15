import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import CryptoJS from 'crypto-js';

const MobileLogin = () => {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [pin, setPin] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const savedPin = localStorage.getItem('user_pin');
    if (savedPin) {
      navigate('/mobile/pin');
    }
  }, []);

  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: passwort,
    });

    if (error) {
      setFehler('Login fehlgeschlagen. Bitte überprüfe deine Daten.');
    } else {
      setFehler('');
      const user = data?.user || data?.session?.user;
if (user?.id) {
  localStorage.setItem('user_id', user.id);

  // ➕ Firma & Unit des Users laden
  const { data: userDetails, error: userDetailsError } = await supabase
    .from('DB_User')
    .select('firma_id, unit_id')
    .eq('user_id', user.id)
    .single();

  if (!userDetailsError && userDetails) {
    localStorage.setItem('firma_id', userDetails.firma_id);
    localStorage.setItem('unit_id', userDetails.unit_id);
    console.log('✅ Firma & Unit gespeichert:', userDetails);
  } else {
    console.warn('⚠️ Firma oder Unit konnten nicht geladen werden:', userDetailsError?.message);
  }
}

      setShowPinSetup(true);
    }
  };

  const handleSavePin = () => {
    if (pin.length < 4 || pin.length > 6) {
      setFehler('Der PIN muss zwischen 4 und 6 Ziffern lang sein.');
      return;
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(pin, 'geheimerKey').toString();
      localStorage.setItem('user_pin', encrypted);
      navigate('/mobile/dienste');
    } catch (err) {
      console.error('Fehler beim Speichern des PIN:', err);
      setFehler('PIN konnte nicht gespeichert werden.');
    }
  };

  return (
    <div className="p-6 text-center">
      <div className="max-w-sm mx-auto bg-white rounded-xl shadow">
        {/* Header oben */}
        <div className="bg-gray-800 text-white rounded-t-xl px-3 py-2 flex items-center justify-between">
          <img src={logo} alt="logo" className="h-8" />
          <h2 className="text-xl font-bold">Login</h2>
        </div>

        {/* Formular */}
        <div className="p-6 text-center">
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="password"
            placeholder="Passwort"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white p-2 rounded mt-2"
          >
            Einloggen
          </button>

          {showPinSetup && (
            <div className="mt-4">
              <p className="mb-2 font-semibold">PIN festlegen (4–6 Ziffern):</p>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full p-2 border rounded mb-2"
              />
              <button
                onClick={handleSavePin}
                className="w-full bg-green-600 text-white p-2 rounded"
              >
                PIN speichern & App starten
              </button>
            </div>
          )}

          {fehler && <p className="text-red-600 mt-2">{fehler}</p>}
        </div>
      </div>
    </div>
  );
};

export default MobileLogin;
