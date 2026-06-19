// src/pages/Mobile/MobileLayout.jsx
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import logo from '../../assets/sp_logo.png';
import { useEffect, useState } from "react";
import { ensurePushSubscription } from "../../utils/pushClient";
import { savePushSubscriptionToDb } from "../../utils/pushSave";
import {
  X,
  Settings,
  CalendarDays,
  MailQuestion,
  LogOut,
  ShieldCheck,
  Gauge,
} from "lucide-react";
import { supabase } from "../../supabaseClient";
import { erstelleDatenschutzPDF } from "../../utils/DatenschutzPDF";

const MobileLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAuthScreen = pathname.startsWith("/mobile/login");
  const gespeicherteId = localStorage.getItem("user_id");

  const [menueOffen, setMenueOffen] = useState(false);
  const [pushMsg, setPushMsg] = useState("");
  const [darkMode, setDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );

  const [einwilligung, setEinwilligung] = useState(false);
  const [einwilligungDatum, setEinwilligungDatum] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  const [offeneAntworten, setOffeneAntworten] = useState(0);
  const [neueNachrichten, setNeueNachrichten] = useState(0);

  // 🌙 Dark-Init (aus LS / System)
  useEffect(() => {
    const t = localStorage.getItem("theme_mobile");
    const wantsDark = t
      ? t === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", wantsDark);
    setDarkMode(wantsDark);
  }, []);

  // ✅ Default-Startansicht einmalig setzen (Standard = "kalender")
  useEffect(() => {
    if (!localStorage.getItem("mobile_kalender")) {
      localStorage.setItem("mobile_kalender", "kalender");
    }
  }, []);

  // --- Zähler laden: offene Antworten (AnfrageMA) ---
  const ladeOffeneAntworten = async (userId) => {
    if (!userId) {
      setOffeneAntworten(0);
      return;
    }

    const { count, error } = await supabase
      .from("DB_AnfrageMA")
      .select("id", { count: "exact", head: true })
      .eq("created_by", userId)
      .not("genehmigt", "is", null) // beantwortet
      .eq("antwort_gesehen", false); // noch nicht gesehen

    if (error) {
      console.error("Fehler beim Laden offener Antworten:", error.message);
      return;
    }

    setOffeneAntworten(count || 0);
  };

  // --- Zähler laden: neue Nachrichten (PushInbox) ---
  const ladeNeueNachrichten = async (userId) => {
    if (!userId) {
      setNeueNachrichten(0);
      return;
    }

    const { count, error } = await supabase
      .from("db_pushinbox")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", userId)
      .is("deleted_at", null)
      .is("read_at", null);

    if (error) {
      console.error("Fehler beim Laden neuer Nachrichten:", error.message);
      return;
    }

    setNeueNachrichten(count || 0);
  };

  // 🔄 Events: Antworten gelesen
  useEffect(() => {
    const handler = () => {
      if (gespeicherteId) ladeOffeneAntworten(gespeicherteId);
    };
    window.addEventListener("schichtpilot:anfragen_gelesen", handler);
    return () => window.removeEventListener("schichtpilot:anfragen_gelesen", handler);
  }, [gespeicherteId]);

  // 🔄 Events: Nachrichten gelesen
  useEffect(() => {
    const handler = () => {
      if (gespeicherteId) ladeNeueNachrichten(gespeicherteId);
    };
    window.addEventListener("schichtpilot:nachrichten_gelesen", handler);
    return () =>
      window.removeEventListener("schichtpilot:nachrichten_gelesen", handler);
  }, [gespeicherteId]);

  // ✅ Zähler initial + bei Seitenwechsel aktualisieren
  useEffect(() => {
    if (!gespeicherteId) return;
    ladeOffeneAntworten(gespeicherteId);
    ladeNeueNachrichten(gespeicherteId);
  }, [gespeicherteId, pathname]);

  // 🚪 Zugangsschutz: Wenn nicht eingeloggt → Login
  useEffect(() => {
    if (isAuthScreen) return;
    const me = localStorage.getItem("user_id");
    if (!me) navigate("/mobile/login");
  }, [isAuthScreen, navigate, pathname]);

  // ✅ Einwilligungstatus laden
  useEffect(() => {
    if (!gespeicherteId) return;
    (async () => {
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
    })();
  }, [gespeicherteId, showConsentModal]);

  // 🌙 Dark Mode Umschalten
  const toggleDarkMode = async () => {
    const newMode = darkMode ? "light" : "dark";
    document.documentElement.classList.toggle("dark", newMode === "dark");
    setDarkMode(newMode === "dark");
    localStorage.setItem("theme_mobile", newMode);
    if (gespeicherteId) {
      await supabase
        .from("DB_User")
        .update({ theme_mobile: newMode })
        .eq("user_id", gespeicherteId);
    }
  };

  // 🗂️ Ansicht (Kalender/Liste) setzen + persistieren + broadcasten
  const [ansicht, setAnsicht] = useState(
    localStorage.getItem("mobile_kalender") ?? "kalender"
  );

  const setMobileAnsicht = async (wert /* 'kalender' | 'liste' */) => {
    localStorage.setItem("mobile_kalender", wert);
    if (gespeicherteId) {
      await supabase
        .from("DB_User")
        .update({ mobile_kalender: wert })
        .eq("user_id", gespeicherteId);
    }
    window.dispatchEvent(
      new CustomEvent("schichtpilot:prefchange", {
        detail: { key: "mobile_kalender", value: wert },
      })
    );
  };

  useEffect(() => {
    const onPrefChange = (e) => {
      if (e.detail?.key === "mobile_kalender") {
        setAnsicht(e.detail.value);
      }
    };
    window.addEventListener("schichtpilot:prefchange", onPrefChange);
    return () =>
      window.removeEventListener("schichtpilot:prefchange", onPrefChange);
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

  const [pushStatus, setPushStatus] = useState("unbekannt");
  const [pushSince, setPushSince] = useState(null);

  const checkPushStatus = async () => {
    try {
      if (!("Notification" in window)) return setPushStatus("inaktiv");
      if (Notification.permission === "denied") return setPushStatus("blocked");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushStatus(sub ? "aktiv" : "inaktiv");
    } catch {
      setPushStatus("inaktiv");
    }
  };

  const loadPushInfoFromDb = async () => {
    try {
      const userId = localStorage.getItem("user_id");
      if (!userId) return;

      const { data, error } = await supabase
        .from("db_pushsubscription")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setPushSince(null);
        return;
      }
      setPushSince(data.created_at);
    } catch (e) {
      console.error("Push-Status laden fehlgeschlagen:", e);
    }
  };

  useEffect(() => {
    if (!isAuthScreen) checkPushStatus();
  }, [isAuthScreen, pathname]);

  useEffect(() => {
    if (!isAuthScreen && menueOffen) {
      loadPushInfoFromDb();
    }
  }, [menueOffen, isAuthScreen]);

  const activatePush = async () => {
    try {
      setPushMsg("");

      if (!("Notification" in window)) {
        setPushMsg("❌ Push wird auf diesem Gerät nicht unterstützt.");
        return;
      }
      if (Notification.permission === "denied") {
        setPushStatus("blocked");
        setPushMsg("❌ Benachrichtigungen sind blockiert (Browser-Einstellung).");
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setPushMsg("❌ VAPID Public Key fehlt (ENV).");
        return;
      }

      const sub = await ensurePushSubscription({ vapidPublicKey });

      // firma/unit aus LocalStorage (Mobile nutzt das ja schon)
      const firma_id = Number(localStorage.getItem("firma_id")) || null;
      const unit_id = Number(localStorage.getItem("unit_id")) || null;

      // ✅ in DB speichern
      await savePushSubscriptionToDb(sub, { firma_id, unit_id });
      await loadPushInfoFromDb();
      setPushStatus("aktiv");
      setPushMsg("✅ Push ist aktiv (dieses Gerät ist registriert).");
    } catch (e) {
      console.error(e);
      setPushMsg(`❌ Aktivierung fehlgeschlagen: ${e?.message || e}`);
    }
  };

  // 🧹 Logout
  const logout = async () => {
    try {
      localStorage.removeItem("user_id");
      localStorage.removeItem("firma_id");
      localStorage.removeItem("unit_id");
      localStorage.removeItem("datenschutz_einwilligung_mobile");
      await supabase.auth.signOut();
      navigate("/mobile/login");
    } catch (err) {
      console.error("Fehler beim Logout:", err);
      alert("⚠️ Fehler beim Abmelden. Bitte erneut versuchen.");
    }
  };

  const badgeTotal = offeneAntworten + neueNachrichten;

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
            title="Kalender / Dienste"
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
            className={`relative flex items-center gap-2 px-2 py-1 ${
              pathname.includes("/anfragen")
                ? "bg-green-600 bg-opacity-10 border border-green-600 border-opacity-20"
                : ""
            }`}
            title="Meine Anfragen"
          >
            <MailQuestion className="w-6 h-6" />
            {badgeTotal > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold rounded-full px-1">
                {badgeTotal > 9 ? "9+" : badgeTotal}
              </span>
            )}
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
                    const istAktiv = ansicht === opt;
                    return (
                      <button
                        aria-pressed={istAktiv}
                        key={opt}
                        onClick={() => {
                          setAnsicht(opt);
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
                      {einwilligungDatum
                        ? new Date(einwilligungDatum).toLocaleDateString()
                        : "-"}
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

              {/* Pushbenachrichtigungen */}
              <li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
                <h4 className="font-bold mb-2">🔔 Push-Benachrichtigungen</h4>

                <p className="text-xs mb-2">
                  Status:{" "}
                  {pushStatus === "aktiv" ? (
                    <>
                      <span className="text-green-600">✅ aktiv</span>
                      {pushSince && (
                        <span className="text-gray-500">
                          {" "}
                          seit{" "}
                          {new Date(pushSince).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </>
                  ) : pushStatus === "blocked" ? (
                    "⛔ blockiert"
                  ) : (
                    "⚠️ nicht aktiv"
                  )}
                </p>

                <button
                  onClick={activatePush}
                  className="w-full text-left text-blue-600 hover:underline"
                >
                  {pushStatus === "aktiv" ? "🔄 Push neu verbinden" : "➕ Push aktivieren"}
                </button>

                {pushMsg ? <p className="text-xs mt-2">{pushMsg}</p> : null}

                <button
                  onClick={async () => {
                    try {
                      setPushMsg("");
                      const reg = await navigator.serviceWorker.ready;
                      const sub = await reg.pushManager.getSubscription();
                      if (sub) await sub.unsubscribe();
                      setPushStatus("inaktiv");
                      setPushSince(null);
                      setPushMsg("✅ Push wurde auf diesem Gerät deaktiviert.");
                    } catch (e) {
                      console.error(e);
                      setPushMsg("❌ Deaktivieren fehlgeschlagen.");
                    }
                  }}
                  className="w-full text-left text-red-600 hover:underline mt-2"
                >
                  ❌ Push auf diesem Gerät deaktivieren
                </button>
              </li>

              {/* Logout */}
              <li className="border border-gray-300 dark:border-gray-600 p-3 rounded-lg">
                <button
                  onClick={logout}
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
    </div>
  );
};

export default MobileLayout;
