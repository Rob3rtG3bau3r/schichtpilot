import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";

// ---------------------------
// Passwort-Checks
// ---------------------------
function checkPw(pw) {
  const minLen = pw.length >= 8;
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return { ok: minLen && upper && lower && digit && special, minLen, upper, lower, digit, special };
}

// --- Heuristik: bekannte Preview-/Scanner-UserAgents ausfiltern ---
function isLikelyScannerUA() {
  const ua = (navigator.userAgent || "").toLowerCase();
  const hints = [
    "safelinks",         // Defender Safe Links
    "microsoft office",  // Outlook desktop fetch
    "urlpreview",
    "linkpreview",
    "link checker",
    "bots", "crawler",
    "headlesschrome",
    "puppeteer",
    "vkshare",
    "facebookexternalhit",
    "slackbot",
    "twitterbot",
    "whatsapp",
  ];
  return hints.some(h => ua.includes(h));
}

// --- Human-Signal: Wir lösen automatisch ein,
//     sobald es sehr wahrscheinlich ein echter Nutzer ist.
function humanSignal(cb) {
  let fired = false;
  const fire = () => {
    if (!fired) { fired = true; cleanup(); cb(); }
  };

  const onFocus = () => {
    // Nur wenn die Seite sichtbar und im Top-Level ist
    if (document.visibilityState === "visible" && window.top === window.self) {
      // Minimal warten, damit "instant fetcher" nicht durchrutschen
      setTimeout(() => {
        if (document.hasFocus()) fire();
      }, 120);
    }
  };

  const onPointer = () => fire();
  const onKey = () => fire();
  const onWheel = () => fire();
  const onTouch = () => fire();
  const onVisibility = () => {
    if (document.visibilityState === "visible") onFocus();
  };

  document.addEventListener("visibilitychange", onVisibility, { passive: true });
  window.addEventListener("focus", onFocus, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  window.addEventListener("mousemove", onPointer, { passive: true, once: true });
  window.addEventListener("keydown", onKey, { passive: true });
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("touchstart", onTouch, { passive: true });

  // Fallback: wenn nach kurzer Zeit echte Umgebung (fokussiert, sichtbar, nicht Bot) → auto
  const fallbackId = setTimeout(() => {
    if (!fired &&
        !isLikelyScannerUA() &&
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        window.top === window.self &&
        !navigator.webdriver) {
      fire();
    }
  }, 1200);

  const cleanup = () => {
    clearTimeout(fallbackId);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pointerdown", onPointer);
    window.removeEventListener("mousemove", onPointer);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouch);
  };

  return cleanup;
}

const mapExchangeError = (err) => {
  const raw = err?.message || "";
  const msg = raw.toLowerCase();
  if (msg.includes("expired") || msg.includes("invalid") || msg.includes("used") || msg.includes("grant")) {
    return "Der Link ist abgelaufen oder wurde bereits benutzt. Bitte fordere einen neuen an.";
  }
  return raw || "Unbekannter Fehler beim Bestätigen des Links.";
};

export default function ResetPassword() {
  const nav = useNavigate();

  // waiting = auf Human-Signal warten (quasi auto)
  // verifying = tauscht Code ein
  // ready = Passwort-Formular
  // saving/done/error wie gehabt
  const [phase, setPhase] = useState("verifying");
  const [error, setError] = useState("");

  const [code, setCode] = useState(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const cleanupRef = useRef(null);

  useEffect(() => {
    // 1) Hash-Fehler (z. B. #error=...) früh anzeigen
    if (window.location.hash.includes("error=")) {
      const p = new URLSearchParams(window.location.hash.slice(1));
      setPhase("error");
      setError(decodeURIComponent(p.get("error_description") || "Ungültiger Link."));
      return;
    }

    // 2) PKCE ?code=... vorhanden?
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) {
      setCode(c);
      // Kein Auto-Exchange sofort—zuerst auf Human-Signal warten:
      setPhase("waiting");

      // Starte Human-Signal-Listener
      cleanupRef.current = humanSignal(async () => {
        try {
          setPhase("verifying");
          const { error } = await supabase.auth.exchangeCodeForSession(c);
          if (error) {
            setPhase("error");
            setError(mapExchangeError(error));
            return;
          }
          setPhase("ready");
        } catch (err) {
          setPhase("error");
          setError("Der Link konnte nicht bestätigt werden.");
        }
      });
      return;
    }

    // 3) Implicit/Hash-Flow (Session schon aktiv)?
    (async () => {
      try {
        await new Promise(r => setTimeout(r, 250));
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setPhase("ready");
          return;
        }
        // Letzte Chance: kurze Wartezeit auf Auth-Event
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
            setPhase("ready");
          }
        });
        setTimeout(() => {
          if (sub) sub.subscription.unsubscribe();
          if (phase === "verifying") {
            setPhase("error");
            setError("Ungültiger oder fehlender Link. Bitte fordere einen neuen an.");
          }
        }, 1500);
      } catch (e) {
        setPhase("error");
        setError("Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.");
      }
    })();

    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) return setError("Die Passwörter stimmen nicht überein.");
    const chk = checkPw(pw);
    if (!chk.ok) return setError("Bitte ein starkes Passwort wählen (mind. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen).");

    setPhase("saving");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setPhase("ready");
      setError("Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.");
      return;
    }
    await supabase.auth.signOut();
    setPhase("done");
    setTimeout(() => nav("/login?reset=success"), 1000);
  };

  const chk = checkPw(pw);

  const renderCardContent = () => {
    if (phase === "waiting") {
      return (
        <div className="space-y-3 text-gray-200">
          <div>Link geöffnet – kurze Sicherheitsprüfung…</div>
          <div className="text-xs text-gray-400">Tipp: Bewege Maus/Tippe/Drücke eine Taste, falls es nicht automatisch weitergeht.</div>
          <div className="text-sm">
            <button
              onClick={async () => {
                if (cleanupRef.current) cleanupRef.current();
                setPhase("verifying");
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                  setPhase("error");
                  setError(mapExchangeError(error));
                } else {
                  setPhase("ready");
                }
              }}
              className="mt-2 underline text-blue-300"
            >
              Oder hier klicken, um fortzufahren
            </button>
          </div>
        </div>
      );
    }

    if (phase === "verifying") {
      return <div className="text-gray-200">Bestätige…</div>;
    }

    if (phase === "error") {
      return (
        <div className="space-y-4">
          <p className="text-red-400">{error}</p>
          <Link to="/passwort-vergessen" className="underline text-blue-300">
            Neuen Link anfordern
          </Link>
        </div>
      );
    }

    if (phase === "done") {
      return <div className="text-green-400">Passwort aktualisiert! Weiterleitung…</div>;
    }

    // phase === "ready" | "saving"
    return (
      <form onSubmit={handleSave} className="space-y-5">
        <label className="block text-sm">
          Neues Passwort
          <input
            type="password"
            className="mt-1 w-full rounded bg-gray-700 border border-gray-600 p-3 outline-none focus:ring-2 focus:ring-blue-500"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            disabled={phase === "saving"}
          />
        </label>

        <label className="block text-sm">
          Passwort wiederholen
          <input
            type="password"
            className="mt-1 w-full rounded bg-gray-700 border border-gray-600 p-3 outline-none focus:ring-2 focus:ring-blue-500"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            disabled={phase === "saving"}
          />
        </label>

        <ul className="text-xs text-gray-300 space-y-1">
          <li className={chk.minLen ? "text-green-400" : ""}>• mind. 8 Zeichen</li>
          <li className={chk.upper ? "text-green-400" : ""}>• mindestens 1 Großbuchstabe</li>
          <li className={chk.lower ? "text-green-400" : ""}>• mindestens 1 Kleinbuchstabe</li>
          <li className={chk.digit ? "text-green-400" : ""}>• mindestens 1 Zahl</li>
          <li className={chk.special ? "text-green-400" : ""}>• mindestens 1 Sonderzeichen</li>
        </ul>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={phase === "saving"}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition disabled:opacity-50"
        >
          {phase === "saving" ? "Speichere…" : "Passwort ändern"}
        </button>

        <div className="text-sm text-gray-300">
          <Link to="/login" className="text-blue-400 hover:underline">Zurück zum Login</Link>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-between items-center px-4 text-white">
      {/* Hauptinhalt */}
      <div className="flex flex-col md:flex-row items-center gap-10 mt-10">
        {/* CARD */}
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/"><img src={logo} alt="SchichtPilot Logo" className="h-12 cursor-pointer hover:opacity-80" /></Link>
            <h1 className="text-2xl font-bold">Neues Passwort setzen</h1>
          </div>
          {renderCardContent()}
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
}
