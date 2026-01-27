// src/pages/Mobile/MobileLogin.jsx
import React, { useState , useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import InstallButton from "../../components/InstallButton";

const MobileLogin = () => {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState('');
  const navigate = useNavigate();
  // ✅ TEST: Service Worker & Notification Status (nur Debug)
  useEffect(() => {
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        console.log("[TEST_SW] active script:", reg?.active?.scriptURL || "NONE");
        console.log("[TEST_SW] permission:", Notification.permission);
      } catch (e) {
        console.log("[TEST_SW] error:", e);
      }
    })();
  }, []);

  const handleLogin = async () => {
    setFehler('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: passwort,
    });

    if (error) {
      setFehler('Login fehlgeschlagen. Bitte überprüfe deine Daten.');
      return;
    }

    const user = data?.user || data?.session?.user;
    if (!user?.id) {
      setFehler('Benutzer konnte nicht geladen werden.');
      return;
    }

    try {
      // 1) Firma & Unit laden
      const { data: userDetails, error: userErr } = await supabase
        .from('DB_User')
        .select('firma_id, unit_id')
        .eq('user_id', user.id)
        .single();

      if (userErr) {
        console.error('❌ DB_User Fehler:', userErr.message || userErr);
        setFehler('Fehler: Benutzerdaten konnten nicht geladen werden.');
        return;
      }

      const firmaId = userDetails?.firma_id ?? null;
      const unitId = userDetails?.unit_id ?? null;

      if (!firmaId || !unitId) {
        setFehler('Fehler: Firma/Unit fehlt im Benutzerprofil.');
        return;
      }

      // 2) Land + Bundesland aus DB_Unit laden
      const { data: unitData, error: unitErr } = await supabase
        .from('DB_Unit')
        .select('land, bundesland')
        .eq('id', unitId)
        .single();

      if (unitErr) {
        console.error('❌ DB_Unit Fehler:', unitErr.message || unitErr);
        setFehler('Fehler: Unit-Daten konnten nicht geladen werden.');
        return;
      }

      const land = (unitData?.land || '').trim();
      const bundesland = (unitData?.bundesland || '').trim();

      if (!land) {
        setFehler('Fehler: In der Unit ist noch kein Land hinterlegt.');
        return;
      }
      if (!bundesland) {
        setFehler('Fehler: In der Unit ist noch kein Bundesland hinterlegt.');
        return;
      }

      // 3) Login-Log & LocalStorage
      await Promise.all([
        supabase.from('DB_LoginLog').insert({
          user_id: user.id,
          user_agent: navigator.userAgent,
        }),
        Promise.resolve().then(() => {
          localStorage.setItem('user_id', user.id);
          localStorage.setItem('firma_id', String(firmaId));
          localStorage.setItem('unit_id', String(unitId));

          // ✅ NEU für Feiertage/Ferien
          localStorage.setItem('land', land);
          localStorage.setItem('bundesland', bundesland);
        }),
      ]);

      // Direkt in die App
      navigate('/mobile/dienste');
    } catch (err) {
      console.error('Fehler beim Login-Tracking:', err);
      setFehler('Es ist ein Fehler beim Login-Tracking aufgetreten.');
    }
  };

  return (
    <div className="p-6 text-center">
      <div className="max-w-sm mx-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl shadow">
        {/* Header */}
        <div className="bg-gray-800 text-white rounded-t-xl px-3 py-2 flex items-center justify-between">
          <img src={logo} alt="logo" className="h-8" />
          <h2 className="text-xl font-bold">Login</h2>
          <InstallButton />
        </div>

        {/* Formular */}
        <div className="p-6 text-left">
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            inputMode="email"
            className="w-full p-3 rounded mb-3 border border-gray-300 text-gray-900 placeholder-gray-500 bg-white
                       dark:border-gray-600 dark:text-white dark:placeholder-gray-300 dark:bg-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <input
            type="password"
            placeholder="Passwort"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            autoComplete="current-password"
            className="w-full p-3 rounded mb-3 border border-gray-300 text-gray-900 placeholder-gray-500 bg-white
                       dark:border-gray-600 dark:text-white dark:placeholder-gray-300 dark:bg-gray-700
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white p-3 rounded mt-1"
          >
            Einloggen
          </button>
<button
  onClick={async () => {
    try {
      const reg = await navigator.serviceWorker.ready;

      // Wenn Permission noch nicht granted ist, einmal fragen
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if (Notification.permission !== "granted") {
        alert("❌ Notification Permission ist NICHT erlaubt: " + Notification.permission);
        return;
      }

      await reg.showNotification("SchichtPilot TEST", {
        body: "Wenn du das siehst, funktioniert der Service Worker + Notification.",
      });

      alert("✅ TEST gesendet (Notification sollte jetzt erscheinen).");
    } catch (e) {
      console.log("[TEST_NOTIFY] error:", e);
      alert("❌ TEST FEHLER: " + (e?.message || e));
    }
  }}
  className="w-full bg-green-600 text-white p-3 rounded mt-2"
>
  🔔 Test Notification
</button>

          {/* Fehleranzeige */}
          {fehler && <p className="text-red-600 mt-2">{fehler}</p>}
        </div>
      </div>
    </div>
  );
};

export default MobileLogin;
