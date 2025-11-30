import React, { useState, useEffect } from 'react';
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";
import qrCode from "../assets/qr_code_mockup.png";
import { useNavigate, useLocation, Link } from "react-router-dom";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Erfolgshinweis nach Passwort-Reset
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("reset") === "success") {
      setSuccessMessage("Passwort aktualisiert – bitte neu einloggen.");
    }
  }, [location.search]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // 1️⃣ Authentifizierung bei Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Schöne deutsche Fehlermeldung
        if (authError.message?.toLowerCase().includes('invalid login credentials')) {
          setError('E-Mail oder Passwort ist falsch.');
        } else {
          setError('Login fehlgeschlagen. Bitte Eingaben prüfen oder später erneut versuchen.');
        }
        return;
      }

      const authUser = data?.user;
      if (!authUser) {
        setError('Login fehlgeschlagen. Kein Benutzerprofil gefunden.');
        return;
      }

      // 2️⃣ DB_User prüfen (aktiv / RLS)
      const { data: userRow, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, aktiv')
        .eq('user_id', authUser.id)
        .single();

      // Wenn wegen RLS oder fehlendem Datensatz nichts zurückkommt:
      if (userError || !userRow) {
        console.warn('DB_User nicht lesbar oder nicht vorhanden:', userError);
        await supabase.auth.signOut();
        setError('Ihr Zugang ist nicht (mehr) aktiv. Bitte wenden Sie sich an Ihren Administrator.');
        return;
      }

      // Wenn explizit aktiv = false
      if (userRow.aktiv === false) {
        await supabase.auth.signOut();
        setError('Ihr Zugang wurde deaktiviert. Bitte wenden Sie sich an Ihren Administrator.');
        return;
      }

      // 3️⃣ Login-Log (Fehler hier sollen NICHT auf dem Login landen)
      try {
        await supabase.from("DB_LoginLog").insert({
          user_id: authUser.id,
          user_agent: navigator.userAgent
        });
      } catch (logErr) {
        console.warn('LoginLog konnte nicht geschrieben werden:', logErr);
        // Kein UI-Fehler, nur im Hintergrund loggen
      }

      // 4️⃣ Alles gut → weiterleiten
      setSuccessMessage('Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);

    } catch (err) {
      console.error('Unerwarteter Fehler beim Login:', err);
      setError('Es ist ein unerwarteter Fehler beim Login aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-between items-center px-4 text-white">
      {/* Hauptinhalt */}
      <div className="flex flex-col md:flex-row items-center gap-10 mt-10">
        {/* LOGIN BOX */}
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-4 mb-8">
            {/* Logo mit Link */}
            <Link to="/">
              <img src={logo} alt="SchichtPilot Logo" className="h-12 cursor-pointer hover:opacity-80" />
            </Link>
            <h1 className="text-2xl font-bold text-white">SchichtPilot Login</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                E-Mail-Adresse
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Passwort
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Passwort vergessen Link */}
            <div className="flex justify-end">
              <Link to="/passwort-vergessen" className="text-sm text-blue-400 hover:underline">
                Passwort vergessen?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition disabled:opacity-50"
            >
              {loading ? 'Einloggen...' : 'Einloggen'}
            </button>

            {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
            {successMessage && <p className="text-green-500 text-sm text-center mt-2">{successMessage}</p>}
          </form>
        </div>

        {/* QR CODE */}
        <div className="flex flex-col items-center">
          <p className="text-gray-300 text-md mb-2">Direkt zur mobilen App:</p>
          <img
            src={qrCode}
            alt="QR Code zur SchichtPilot App"
            className="w-60 rounded-md shadow-lg"
          />
          <p className="text-xs text-gray-400 mt-2">Mit Handy scannen & App öffnen</p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center text-gray-400 text-xs py-4 border-t border-gray-800">
        © {new Date().getFullYear()} SchichtPilot | 
        <Link to="/impressum" className="ml-2 text-blue-400 hover:underline">Impressum</Link> | 
        <Link to="/datenschutz" className="ml-2 text-blue-400 hover:underline">Datenschutz</Link>
      </footer>
    </div>
  );
};

export default LoginPage;
