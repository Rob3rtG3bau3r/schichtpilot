import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import CryptoJS from 'crypto-js';

const MobilePinEntry = () => {
  const [pin, setPin] = useState('');
  const [fehler, setFehler] = useState('');
  const [merken, setMerken] = useState(false);
  const navigate = useNavigate();

  // Automatisch weiterleiten, wenn PIN gemerkt wurde
  useEffect(() => {
    const merkenGespeichert = localStorage.getItem('pin_merken');
    if (merkenGespeichert === 'true') {
      navigate('/mobile/dienste');
    }
  }, []);

  const handleCheckPin = () => {
    const encrypted = localStorage.getItem('user_pin');

    if (!encrypted) {
      setFehler('Kein PIN gespeichert. Bitte über Login festlegen.');
      return;
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(encrypted, 'geheimerKey').toString(CryptoJS.enc.Utf8);

      if (decrypted === pin) {
        setFehler('');
        if (merken) {
          localStorage.setItem('pin_merken', 'true');
        } else {
          localStorage.removeItem('pin_merken');
        }
        navigate('/mobile/dienste');
      } else {
        setFehler('Falscher PIN. Bitte erneut versuchen.');
      }
    } catch (err) {
      setFehler('Fehler beim Entschlüsseln des PIN.');
    }
  };

  const handlePinVergessen = () => {
    localStorage.removeItem('user_pin');
    localStorage.removeItem('pin_merken');
    navigate('/mobile/login');
  };

  return (
    <div className="p-6 text-center">
      {/* Header */}
      <div className="bg-gray-800 text-white rounded-t-xl px-3 py-2 flex items-center justify-between mb-4">
        <img src={logo} alt="Logo" className="h-8" />
        <h2 className="text-xl font-bold">PIN eingeben</h2>
      </div>

      {/* PIN Eingabe */}
      <input
        type="password"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="w-full p-2 border rounded mb-2"
      />

      {/* PIN merken */}
      <div className="flex items-center justify-center gap-2 mb-2">
        <input
          type="checkbox"
          id="pinmerken"
          checked={merken}
          onChange={(e) => setMerken(e.target.checked)}
        />
        <label htmlFor="pinmerken" className="text-sm text-gray-700 dark:text-gray-300">
          PIN merken
        </label>
      </div>

      {/* Buttons */}
      <button
        onClick={handleCheckPin}
        className="w-full bg-blue-600 text-white p-2 rounded mt-2"
      >
        Entsperren
      </button>

      <button
        onClick={handlePinVergessen}
        className="w-full bg-gray-300 text-gray-800 p-2 rounded mt-2"
      >
        PIN vergessen
      </button>

      {/* Fehlermeldung */}
      {fehler && <p className="text-red-600 mt-2">{fehler}</p>}
    </div>
  );
};

export default MobilePinEntry;
