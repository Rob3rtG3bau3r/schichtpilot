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
   Gauge, 
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { erstelleDatenschutzPDF } from "../../utils/DatenschutzPDF";

// ⏱ Timeout & Countdown
const INAKTIV_TIMEOUT = 5 * 60 * 1000; // 5 Minuten
const COUNTDOWN_START = 10;            // Countdown läuft 10s vor Sperre

// 🔒 Background-Lock
const LOCK_KEY = "mobile_locked_at";
// 0 = immer PIN nach Wiederkehr; z. B. 10*60*1000 => erst nach 10 Min Hintergrund
const LOCK_AFTER_MS = 0;

const MobileLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthScreen =
    pathname.startsWith("/mobile/login") || pathname.startsWith("/mobile/pin");

  // 🔹 Sofort-Route-Check bei App-Start/Route-Wechsel
  useEffect(() => {
    const erlaubteSeiten = ["/mobile/login", "/mobile/pin"];
    const gespeicherterPin = localStorage.getItem("user_pin");

    // Wenn KEIN PIN gesetzt & wir sind NICHT auf Login oder PIN → zur LOGIN-Seite
    if (!gespeicherterPin && !erlaubteSeiten.includes(pathname)) {
      navigate("/mobile/login");
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

  // 🌙 Dark-Init (aus LS / System)
  useEffect(() => {
    const t = localStorage.getItem("theme_mobile");
    const wantsDark = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", wantsDark);
    setDarkMode(wantsDark);
  }, []);

  // ✅ Default-Startansicht einmalig setzen (Standard = "kalender")
  useEffect(() => {
    if (!localStorage.getItem("mobile_kalender")) {
      localStorage.setItem("mobile_kalender", "kalender");
    }
  }, []);

  const gespeicherteId = localStorage.getItem("user_id");
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // 🧹 Zentrale Logout/Lock-Funktion (Hard vs. Soft)
  const clearSession = async (
    redirectTo = "/mobile/login",
    { keepPin = false, signOut = true } = {}
  ) => {
    try {
      if (!keepPin) {
        localStorage.removeItem("user_pin");
        ["user_id", "firma_id", "unit_id", "datenschutz_einwilligung_mobile"].forEach((key) =>
          localStorage.removeItem(key)
        );
      }
      if (signOut) {
        await supabase.auth.signOut();
      }
      navigate(redirectTo);
    } catch (err) {
      console.error("Fehler beim Logout/Lock:", err);
      alert("⚠️ Fehler beim Abmelden. Bitte erneut versuchen.");
    }
  };

  // ✅ Einwilligungstatus laden
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
        localStorage.setItem("datenschutz_einwilligung_mobile", data.consent_anfragema);
      }
    };
    ladeConsent();
  }, [gespeicherteId, showConsentModal]);

  // 🌙 Dark Mode Umschalten
  const toggleDarkMode = async () => {
    const newMode = darkMode ? "light" : "dark";
    document.documentElement.classList.toggle("dark", newMode === "dark");
    setDarkMode(newMode === "dark");
    localStorage.setItem("theme_mobile", newMode);
    if (gespeicherteId) {
      await supabase.from("DB_User").update({ theme_mobile: newMode }).eq("user_id", gespeicherteId);
    }
  };

  // 🗂️ Ansicht (Kalender/Liste) setzen + persistieren + broadcasten
  const setMobileAnsicht = async (wert /* 'kalender' | 'liste' */) => {
    localStorage.setItem("mobile_kalender", wert);
    if (gespeicherteId) {
      await supabase.from("DB_User").update({ mobile_kalender: wert }).eq("user_id", gespeicherteId);
    }
    window.dispatchEvent(
      new CustomEvent("schichtpilot:prefchange", {
        detail: { key: "mobile_kalender", value: wert },
      })
    );
  };
// Aktuelle Dienste-Ansicht lokal puffern (Default = "kalender")
const [ansicht, setAnsicht] = useState(
  (localStorage.getItem("mobile_kalender") ?? "kalender")
);

// Auf externe Änderungen reagieren (falls eine andere Seite die Ansicht umstellt)
useEffect(() => {
  const onPrefChange = (e) => {
    if (e.detail?.key === "mobile_kalender") {
      setAnsicht(e.detail.value);
    }
  };
  window.addEventListener("schichtpilot:prefchange", onPrefChange);
  return () => window.removeEventListener("schichtpilot:prefchange", onPrefChange);
}, []);

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

  // 🔁 PIN zurücksetzen (Hard-Logout)
  const handlePinReset = async () => {
    const bestaetigt = window.confirm(
      "Bist du sicher, dass du deinen PIN zurücksetzen möchtest?\n\n" +
        "⚠️ Danach wirst du automatisch ausgeloggt und musst dich neu anmelden."
    );
    if (!bestaetigt) return;
    clearSession("/mobile/login", { keepPin: false, signOut: true });
  };

  // ⏳ Auto-Inaktivität → Soft-Lock (nur wenn „echte“ Session)
  const handleAutoLogout = async () => {
    const hasUser = !!localStorage.getItem("user_id");
    const hasPin = !!localStorage.getItem("user_pin");
    if (!hasUser && !hasPin) return; // nichts zu sperren
    if (isAuthScreen) return;        // auf Login/PIN nie sperren
    clearSession("/mobile/pin", { keepPin: true, signOut: false });
  };

  // ⏲️ Inaktivitätsüberwachung mit Countdown (auf Login/PIN aus)
  const stopTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  const resetTimer = () => {
    if (isAuthScreen) {
      stopTimers();
      setShowCountdown(false);
      return;
    }

    stopTimers();
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
    }, Math.max(0, INAKTIV_TIMEOUT - COUNTDOWN_START * 1000));
  };

  // 🎧 Timer-Events + auf Routenwechsel reagieren
  useEffect(() => {
    resetTimer();
    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("touchstart", resetTimer);
    return () => {
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
      stopTimers();
    };
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔒 Background-Lock nur bei „echter“ Session; nie auf Login/PIN
  useEffect(() => {
    const hasSessionOrPin = () =>
      !!localStorage.getItem("user_id") || !!localStorage.getItem("user_pin");

    const lockNow = () => {
      if (!hasSessionOrPin()) return;
      sessionStorage.setItem(LOCK_KEY, String(Date.now()));
    };

    const maybeRequirePin = () => {
      const lockedAt = Number(sessionStorage.getItem(LOCK_KEY) || "0");
      if (!lockedAt) return;
      sessionStorage.removeItem(LOCK_KEY);
      if (isAuthScreen) return; // Auth-Screens nicht überschreiben
      if (Date.now() - lockedAt >= LOCK_AFTER_MS) {
        navigate("/mobile/pin");
      }
    };

    const onVisibility = () => (document.hidden ? lockNow() : maybeRequirePin());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", lockNow);
    window.addEventListener("pageshow", maybeRequirePin);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", lockNow);
      window.removeEventListener("pageshow", maybeRequirePin);
    };
  }, [navigate, isAuthScreen]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
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
   onClick={() => navigate("/mobile/uebersicht")}
   className={`flex items-center gap-2 px-2 py-1 ${
     pathname.includes("/uebersicht")
       ? "bg-green-600 bg-opacity-10 border border-green-600 border-opacity-20"
       : ""
   }`}
   title="Meine Übersicht"
 >
   <Gauge className="w-6 h-6" />
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
                  {darkMode ? "🌞 Light Mode aktivieren" : "🌙 Dark Mode aktivieren"}
                </button>
              </li>

              {/* 🗂️ Startansicht (Kalender/Liste) */}
<li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
  <h4 className="font-bold mb-2">🗂️ Dienste Ansicht</h4>
  <div className="flex gap-2">
    {["kalender", "liste"].map((opt) => {
      const istAktiv = ansicht === opt;   // <-- statt localStorage hier den State nutzen
      return (
        <button
        aria-pressed={istAktiv}
          key={opt}
          onClick={() => {
            // sofort visuell umschalten
            setAnsicht(opt);
            // dann persistieren + Broadcast (deine Funktion bleibt gleich)
            setMobileAnsicht(opt);
          }}
          className={`px-3 py-1 rounded-lg border ${
            istAktiv
              ? "bg-green-900 text-gray-200 border-green-500"
              : "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
          }`}
          title={opt === "kalender" ? "Kalender-Ansicht" : "Listen-Ansicht"}
        >
          {opt === "kalender" ? "Kalender" : "Liste"}
        </button>
      );
    })}
  </div>
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
                      {einwilligungDatum ? new Date(einwilligungDatum).toLocaleDateString() : "-"}
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
                  onClick={() => clearSession("/mobile/login", { keepPin: false, signOut: true })}
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
              benötigen wir deine Einwilligung. Du kannst sie jederzeit im Menü widerrufen.
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
      {showCountdown && !isAuthScreen && (
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

