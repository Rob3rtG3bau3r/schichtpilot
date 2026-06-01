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
  const [securityInfo, setSecurityInfo] = useState('');

  // Erfolgshinweis nach Passwort-Reset
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    if (params.get("reset") === "success") {
      setSuccessMessage("Passwort aktualisiert – bitte neu einloggen.");
    }
  }, [location.search]);

  // -------------------------------------------------
  // Loginversuch protokollieren
  // Wichtig:
  // - Passwort wird niemals gespeichert
  // - Fehler beim Logging dürfen den Login nicht blockieren
  // -------------------------------------------------
  const schreibeLoginAttempt = async ({
    loginEmail,
    success,
    errorCode = null,
    errorMessage = null,
    source = 'web',
  }) => {
    try {
      await supabase.rpc('log_login_attempt', {
        p_email: loginEmail,
        p_success: success,
        p_error_code: errorCode,
        p_error_message: errorMessage,
        p_user_agent: navigator.userAgent,
        p_source: source,
      });
    } catch (logErr) {
      console.warn('LoginAttempt konnte nicht geschrieben werden:', logErr);
    }
  };

  // -------------------------------------------------
  // Fehlversuche seit letztem erfolgreichen Login ermitteln
  // Wird erst NACH erfolgreicher Auth ausgeführt.
  // Dadurch verraten wir vor dem Login keine Infos über E-Mail-Adressen.
  // -------------------------------------------------
  const ladeFehlversucheSeitLetztemLogin = async (loginEmail) => {
    try {
      const cleanEmail = loginEmail.trim().toLowerCase();

      // 1) Letzten erfolgreichen Login VOR dem aktuellen Login suchen
      // Wichtig: Diese Funktion wird aufgerufen, BEVOR wir den aktuellen Erfolg speichern.
      const { data: lastSuccessRows, error: lastSuccessErr } = await supabase
        .from('DB_LoginAttemptLog')
        .select('created_at')
        .eq('email', cleanEmail)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastSuccessErr) throw lastSuccessErr;

      const lastSuccessAt = lastSuccessRows?.[0]?.created_at || null;

      // Wenn es noch keinen vorherigen erfolgreichen Login gibt:
      // Dann betrachten wir nur den heutigen Tag, damit beim ersten Login
      // nicht uralte Testfehler angezeigt werden.
      let fromISO = lastSuccessAt;

      if (!fromISO) {
        const startToday = new Date();
        startToday.setHours(0, 0, 0, 0);
        fromISO = startToday.toISOString();
      }

      // 2) Fehlversuche seit diesem Zeitpunkt laden
      const { data: failedRows, error: failedErr } = await supabase
        .from('DB_LoginAttemptLog')
        .select('id, created_at')
        .eq('email', cleanEmail)
        .eq('success', false)
        .gte('created_at', fromISO)
        .order('created_at', { ascending: false });

      if (failedErr) throw failedErr;

      const count = failedRows?.length || 0;

      if (count <= 0) {
        return '';
      }

      const letzterVersuch = failedRows?.[0]?.created_at
        ? new Date(failedRows[0].created_at).toLocaleString('de-DE')
        : null;

      const zeitraumText = lastSuccessAt
        ? 'seit deinem letzten erfolgreichen Login'
        : 'heute';

      return letzterVersuch
        ? `${count} fehlgeschlagene Loginversuch${count === 1 ? '' : 'e'} ${zeitraumText}. Letzter Versuch: ${letzterVersuch}.`
        : `${count} fehlgeschlagene Loginversuch${count === 1 ? '' : 'e'} ${zeitraumText}.`;

    } catch (e) {
      console.warn('Fehlversuche konnten nicht geprüft werden:', e);
      return '';
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    setError('');
    setSuccessMessage('');
    setSecurityInfo('');
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1️⃣ Authentifizierung bei Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        // Fehlgeschlagenen Auth-Login protokollieren
        await schreibeLoginAttempt({
          loginEmail: cleanEmail,
          success: false,
          errorCode: authError.code || null,
          errorMessage: authError.message || 'Login fehlgeschlagen',
          source: 'web',
        });

        if (authError.message?.toLowerCase().includes('invalid login credentials')) {
          setError('E-Mail oder Passwort ist falsch.');
        } else {
          setError('Login fehlgeschlagen. Bitte Eingaben prüfen oder später erneut versuchen.');
        }

        return;
      }

      const authUser = data?.user;

      if (!authUser) {
        await schreibeLoginAttempt({
          loginEmail: cleanEmail,
          success: false,
          errorCode: 'no_auth_user',
          errorMessage: 'Supabase hat keinen authUser zurückgegeben.',
          source: 'web',
        });

        setError('Login fehlgeschlagen. Kein Benutzerprofil gefunden.');
        return;
      }

      // 2️⃣ DB_User prüfen (aktiv / RLS)
      const { data: userRow, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, aktiv')
        .eq('user_id', authUser.id)
        .single();

      if (userError || !userRow) {
        console.warn('DB_User nicht lesbar oder nicht vorhanden:', userError);

        await schreibeLoginAttempt({
          loginEmail: cleanEmail,
          success: false,
          errorCode: userError?.code || 'db_user_missing',
          errorMessage: userError?.message || 'DB_User nicht lesbar oder nicht vorhanden.',
          source: 'web',
        });

        await supabase.auth.signOut();

        setError('Ihr Zugang ist nicht (mehr) aktiv. Bitte wenden Sie sich an Ihren Administrator.');
        return;
      }

      if (userRow.aktiv === false) {
        await schreibeLoginAttempt({
          loginEmail: cleanEmail,
          success: false,
          errorCode: 'user_inactive',
          errorMessage: 'Benutzer ist in DB_User deaktiviert.',
          source: 'web',
        });

        await supabase.auth.signOut();

        setError('Ihr Zugang wurde deaktiviert. Bitte wenden Sie sich an Ihren Administrator.');
        return;
      }

      // 3️⃣ Fehlversuche prüfen, BEVOR wir den aktuellen Erfolg speichern
      const hinweis = await ladeFehlversucheSeitLetztemLogin(cleanEmail);

      if (hinweis) {
        setSecurityInfo(hinweis);
      }

      // 4️⃣ Aktuellen Loginversuch als erfolgreich protokollieren
      await schreibeLoginAttempt({
        loginEmail: cleanEmail,
        success: true,
        errorCode: null,
        errorMessage: null,
        source: 'web',
      });

      // 5️⃣ Bisheriger Login-Log für erfolgreiche Logins
      // Fehler hier sollen NICHT auf dem Login landen.
      try {
        await supabase.from("DB_LoginLog").insert({
          user_id: authUser.id,
          user_agent: navigator.userAgent,
        });
      } catch (logErr) {
        console.warn('LoginLog konnte nicht geschrieben werden:', logErr);
      }

      // 6️⃣ Alles gut → Info anzeigen und weiterleiten
      setSuccessMessage('Login erfolgreich! Weiterleitung...');

      setTimeout(() => {
        navigate("/dashboard");
      }, hinweis ? 1800 : 1000);

    } catch (err) {
      console.error('Unerwarteter Fehler beim Login:', err);

      await schreibeLoginAttempt({
        loginEmail: cleanEmail,
        success: false,
        errorCode: err?.code || 'unexpected_login_error',
        errorMessage: err?.message || 'Unerwarteter Fehler beim Login.',
        source: 'web',
      });

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
            <Link to="/">
              <img
                src={logo}
                alt="SchichtPilot Logo"
                className="h-12 cursor-pointer hover:opacity-80"
              />
            </Link>

            <h1 className="text-2xl font-bold text-white">
              SchichtPilot Login
            </h1>
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
                autoComplete="email"
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
                autoComplete="current-password"
                className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

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

            {error && (
              <p className="text-red-500 text-sm text-center mt-2">
                {error}
              </p>
            )}

            {securityInfo && (
              <div className="text-yellow-200 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2 text-sm text-center mt-2">
                {securityInfo}
              </div>
            )}

            {successMessage && (
              <p className="text-green-500 text-sm text-center mt-2">
                {successMessage}
              </p>
            )}
          </form>
        </div>

        {/* QR CODE */}
        <div className="flex flex-col items-center">
          <p className="text-gray-300 text-md mb-2">
            Direkt zur mobilen App:
          </p>

          <img
            src={qrCode}
            alt="QR Code zur SchichtPilot App"
            className="w-60 rounded-md shadow-lg"
          />

          <p className="text-xs text-gray-400 mt-2">
            Mit Handy scannen & App öffnen
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 mb-6 text-gray-500 text-xs text-center">
        © {new Date().getFullYear()} SchichtPilot ·{" "}
        <Link
          to="/impressum"
          className="underline text-blue-400 hover:text-white"
        >
          Impressum
        </Link>{" "}
        ·{" "}
        <Link
          to="/datenschutz"
          className="underline text-blue-400 hover:text-white"
        >
          Datenschutz
        </Link>{" "}
        · <span className="text-gray-500">Version {__APP_VERSION__}</span>
      </footer>
    </div>
  );
};

export default LoginPage;