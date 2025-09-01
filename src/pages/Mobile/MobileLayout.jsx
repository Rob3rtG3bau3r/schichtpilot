import { Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useEffect, useState, useRef } from "react";
import {
  X,
  Settings,
  CalendarDays,
  MailQuestion,
  LogOut,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { erstelleDatenschutzPDF } from "../../utils/DatenschutzPDF";

const INAKTIV_TIMEOUT = 10 * 60 * 1000; // 10 Minuten
const COUNTDOWN_START = 10; // Countdown startet 10 Sekunden vor Logout

const MobileLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // 🔹 Sofort-PIN-Check bei App-Start
  useEffect(() => {
    const erlaubteSeiten = ["/mobile/login", "/mobile/pin"];
    const gespeicherterPin = localStorage.getItem("user_pin");

    // Wenn kein PIN gesetzt & wir sind nicht auf Login oder PIN → weiterleiten
    if (!gespeicherterPin && !erlaubteSeiten.includes(pathname)) {
      navigate("/mobile/pin");
    }
  }, [pathname, navigate]);

  const [menueOffen, setMenueOffen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );
  const [einwilligung, setEinwilligung] = useState(false);
  const [einwilligungDatum, setEinwilligungDatum] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_START);

  const gespeicherteId = localStorage.getItem("user_id");
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // 🧹 Zentrale Logout/PIN-Reset Funktion
  const clearSession = async (redirectTo = "/mobile/login") => {
    try {
      [
        "user_pin",
        "user_id",
        "firma_id",
        "unit_id",
        "datenschutz_einwilligung_mobile",
      ].forEach((key) => localStorage.removeItem(key));

      await supabase.auth.signOut();
      navigate(redirectTo);
    } catch (err) {
      console.error("Fehler beim Logout:", err);
      alert("⚠️ Fehler beim Abmelden. Bitte erneut versuchen.");
    }
  };

  // ✅ Lade Einwilligungsstatus aus DB
  useEffect(() => {
    const ladeConsent = async () => {
      if (!gespeicherteId) return;
      const { data, error } = await supabase
        .from("DB_User")
        .select("consent_anfragema, consent_anfragema_at")
        .eq("user_id", gespeicherteId)
        .single();

      if (!error && data) {
        setEinwilligung(data.consent_anfragema);
        setEinwilligungDatum(data.consent_anfragema_at);
        localStorage.setItem(
          "datenschutz_einwilligung_mobile",
          data.consent_anfragema
        );
      }
    };
    ladeConsent();
  }, [gespeicherteId, showConsentModal]);

  // 🌙 Dark Mode Umschalten
  const toggleDarkMode = async () => {
    const newMode = darkMode ? "light" : "dark";
    document.documentElement.classList.toggle("dark");
    setDarkMode(!darkMode);
    await supabase
      .from("DB_User")
      .update({ theme_mobile: newMode })
      .eq("user_id", gespeicherteId);
  };

  // 🛡️ Einwilligung widerrufen
  const widerrufeEinwilligung = async () => {
    const bestaetigt = window.confirm(
      "Bist du sicher, dass du deine Datenschutzeinwilligung widerrufen möchtest?\n\n" +
        "⚠️ Ohne Einwilligung kannst du keine Urlaubsanträge stellen oder dich für Schichten anbieten!"
    );
    if (!bestaetigt) return;

    const { error } = await supabase
      .from("DB_User")
      .update({ consent_anfragema: false, consent_anfragema_at: null })
      .eq("user_id", gespeicherteId);

    if (error) {
      alert("Fehler beim Widerrufen der Einwilligung.");
      return;
    }

    setEinwilligung(false);
    setEinwilligungDatum(null);
    localStorage.removeItem("datenschutz_einwilligung_mobile");
    alert("Deine Einwilligung wurde widerrufen. Anträge sind jetzt gesperrt.");
  };

  // ✅ Einwilligung erteilen
  const zustimmeEinwilligung = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("DB_User")
      .update({ consent_anfragema: true, consent_anfragema_at: now })
      .eq("user_id", gespeicherteId);

    if (error) {
      alert("Fehler beim Speichern der Einwilligung.");
      return;
    }

    setEinwilligung(true);
    setEinwilligungDatum(now);
    localStorage.setItem("datenschutz_einwilligung_mobile", true);
    setShowConsentModal(false);
    alert("Vielen Dank! Deine Einwilligung wurde gespeichert.");
  };

  // 🔁 PIN zurücksetzen
  const handlePinReset = async () => {
    const bestaetigt = window.confirm(
      "Bist du sicher, dass du deinen PIN zurücksetzen möchtest?\n\n" +
        "⚠️ Danach wirst du automatisch ausgeloggt und musst dich neu anmelden."
    );
    if (!bestaetigt) return;
    clearSession("/mobile/login");
  };

  // ⏳ Automatischer Logout nach Inaktivität
  const handleAutoLogout = async () => {
    clearSession("/mobile/pin");
  };

  // ⏲️ Inaktivitätsüberwachung mit Countdown
  const resetTimer = () => {
    if (showCountdown) return; // Countdown läuft bereits

    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    setShowCountdown(false);
    setCountdown(COUNTDOWN_START);

    timerRef.current = setTimeout(() => {
      setShowCountdown(true);
      let sec = COUNTDOWN_START;
      setCountdown(sec);

      countdownRef.current = setInterval(() => {
        sec--;
        setCountdown(sec);

        if (sec <= 0) {
          clearInterval(countdownRef.current);
          clearTimeout(timerRef.current);
          handleAutoLogout();
        }
      }, 1000);
    }, INAKTIV_TIMEOUT - COUNTDOWN_START * 1000);
  };

  // 🎧 Timer-Events überwachen
  useEffect(() => {
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("touchstart", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Sticky Header */}
      <div className="text-gray-200 sticky top-0 z-50 bg-gray-900 pr-4 py-1 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={logo} alt="logo" className="h-12 object-contain" />
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={() => navigate("/mobile")}
            className={`flex items-center gap-2 px-2 py-1 ${
              pathname === "/mobile"
                ? "bg-green-600 bg-opacity-10 border border-green-600 border-opacity-20"
                : ""
            }`}
          >
            <CalendarDays className="w-6 h-6" />
          </button>

          <button
            onClick={() => navigate("/mobile/anfragen")}
            className={`flex items-center gap-2 px-2 py-1 ${
              pathname.includes("/anfragen")
                ? "bg-green-600 bg-opacity-10 border border-green-600 border-opacity-20"
                : ""
            }`}
          >
            <MailQuestion className="w-6 h-6" />
          </button>

          <button onClick={() => setMenueOffen(true)} title="Menü">
            <Settings className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Scrollbarer Inhalt */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* ⚙️ Menü */}
      {menueOffen && (
        <div className="text-gray-900 dark:text-gray-200 fixed inset-0 bg-black bg-opacity-50 z-50 backdrop-blur-sm flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-[90%] max-w-sm border border-gray-300 dark:border-gray-700 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">⚙️ Einstellungen</h3>
              <button onClick={() => setMenueOffen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-3 text-sm">
              {/* Dark Mode */}
              <li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
                <button
                  onClick={toggleDarkMode}
                  className="w-full text-left text-blue-600 hover:underline"
                >
                  {darkMode
                    ? "🌞 Light Mode aktivieren"
                    : "🌙 Dark Mode aktivieren"}
                </button>
              </li>

              {/* Datenschutzerklärung */}
              <li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Datenschutzerklärung
                </h4>
                {einwilligung ? (
                  <>
                    <p className="text-green-600 mb-2">
                      ✅ Einwilligung erteilt am:{" "}
                      {new Date(einwilligungDatum).toLocaleDateString()}
                    </p>
                    <button
                      onClick={widerrufeEinwilligung}
                      className="w-full text-left text-red-600 hover:underline"
                    >
                      ❌ Einwilligung widerrufen
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowConsentModal(true)}
                    className="w-full text-left text-blue-600 hover:underline"
                  >
                    ➕ Einwilligung erteilen
                  </button>
                )}
                <button
                  onClick={erstelleDatenschutzPDF}
                  className="w-full text-left text-blue-600 hover:underline mt-2"
                >
                  📄 Datenschutzerklärung PDF
                </button>
              </li>

              {/* PIN zurücksetzen */}
              <li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
                <button
                  onClick={handlePinReset}
                  className="w-full text-left text-red-600 hover:underline flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4" /> PIN zurücksetzen
                </button>
              </li>

              {/* Logout */}
              <li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
                <button
                  onClick={() => clearSession("/mobile/login")}
                  className="w-full text-left text-red-600 hover:underline flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Abmelden
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Modal zur Einwilligung */}
      {showConsentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-[90%] max-w-md shadow-lg border border-gray-300 dark:border-gray-700">
            <h3 className="text-lg font-bold mb-4">📜 Datenschutzerklärung</h3>
            <p className="text-sm mb-4">
              Um Anfragen stellen oder dich für Schichten anbieten zu können,
              benötigen wir deine Einwilligung. Du kannst sie jederzeit im Menü
              widerrufen.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConsentModal(false)}
                className="px-3 py-2 bg-gray-300 dark:bg-gray-700 rounded-lg text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={zustimmeEinwilligung}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
              >
                Zustimmen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown vor Logout */}
      {showCountdown && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
          <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg text-center">
            <p className="text-lg font-bold">Automatischer Logout</p>
            <p className="mt-2">
              in <span className="text-2xl">{countdown}</span> Sekunden
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileLayout;
