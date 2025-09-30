import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";

// ==============================
// Helpers
// ==============================
const LS_STATE_KEY = "sp_pw_reset_state";
const STATE_TTL_MS = 30 * 60 * 1000; // 30 Minuten gültig

function loadSavedState() {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.state || !obj?.ts) return null;
    if (Date.now() - Number(obj.ts) > STATE_TTL_MS) return null;
    return obj;
  } catch {
    return null;
  }
}

function checkPw(pw) {
  const minLen = pw.length >= 8;
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return { ok: minLen && upper && lower && digit && special, minLen, upper, lower, digit, special };
}

const mapExchangeError = (err) => {
  const raw = err?.message || "";
  const msg = raw.toLowerCase();
  if (msg.includes("expired") || msg.includes("invalid") || msg.includes("used") || msg.includes("grant"))
    return "Der Link ist abgelaufen oder wurde bereits benutzt. Bitte fordere einen neuen an.";
  return raw || "Unbekannter Fehler beim Bestätigen des Links.";
};

// ==============================
// Component
// ==============================
export default function ResetPassword() {
  const nav = useNavigate();

  // waiting: prüfen/evtl. auto; verifying: tauscht; ready: Formular; saving/done/error
  const [phase, setPhase] = useState("waiting");
  const [error, setError] = useState("");

  const [code, setCode] = useState(null);
  const [stateParam, setStateParam] = useState(null);
  const [stateOk, setStateOk] = useState(false);

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  const cleanupRef = useRef(null);

  useEffect(() => {
    // 0) Hash-Fehler (#error=...) sofort anzeigen
    if (window.location.hash.includes("error=")) {
      const p = new URLSearchParams(window.location.hash.slice(1));
      setPhase("error");
      setError(decodeURIComponent(p.get("error_description") || "Ungültiger Link."));
      return;
    }

    // 1) ?code=… & ?state=… einsammeln
    const qs = new URLSearchParams(window.location.search);
    const c = qs.get("code");
    const s = qs.get("state");
    setCode(c || null);
    setStateParam(s || null);

    // 2) Prüfe lokalen State
    const saved = loadSavedState();
    const ok = !!(saved && s && saved.state === s);
    setStateOk(ok);

    // 3) Wenn Code vorhanden:
    if (c) {
      if (ok) {
        // gleicher Browser + gültiger State → wie „früher“: automatisch einlösen
        setTimeout(() => doExchange(c), 50);
      } else {
        // anderer Client/kein State → Button anbieten (ein Klick)
        setPhase("waiting");
      }
    } else {
      // Fallback: evtl. bereits eingeloggt (implicit flow)
      checkExistingSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkExistingSession = async () => {
    try {
      await new Promise((r) => setTimeout(r, 200));
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setPhase("ready");
        return;
      }
      // Letzte Chance: kurzes Listen auf Auth-Event
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setPhase("ready");
        }
      });
      setTimeout(() => {
        if (sub) sub.subscription.unsubscribe();
        if (phase === "waiting") {
          setPhase("error");
          setError("Ungültiger oder fehlender Link. Bitte fordere einen neuen an.");
        }
      }, 1500);
    } catch {
      setPhase("error");
      setError("Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.");
    }
  };

  const doExchange = async (c) => {
    setPhase("verifying");
    setError("");
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(c);
      if (error) {
        setPhase("error");
        setError(mapExchangeError(error));
        return;
      }
      setPhase("ready");
    } catch (e) {
      setPhase("error");
      setError("Der Link konnte nicht bestätigt werden.");
    }
  };

  const handleManualContinue = async () => {
    if (!code) {
      setError("Es wurde kein Bestätigungs-Code gefunden.");
      return;
    }
    await doExchange(code);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    if (pw !== pw2) return setError("Die Passwörter stimmen nicht überein.");
    const chk = checkPw(pw);
    if (!chk.ok)
      return setError(
        "Bitte ein starkes Passwort wählen (mind. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen)."
      );

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

  // UI
  const chk = checkPw(pw);

  const renderCardContent = () => {
    // Fall: Code vorhanden, aber State-Mismatch → Button zeigen
    if (code && !stateOk && (phase === "waiting" || phase === "verifying")) {
      return (
        <div className="space-y-4">
          <p className="text-gray-200">
            Link geöffnet. Um fortzufahren, bestätige kurz:
          </p>
          <button
            onClick={handleManualContinue}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
          >
            Fortfahren
          </button>
          <p className="text-xs text-gray-400">
            Hinweis: Aus Sicherheitsgründen wird der Link nur automatisch eingelöst,
            wenn du ihn im gleichen Browser öffnest, in dem du ihn angefordert hast.
          </p>
          <div className="text-sm text-gray-300 flex items-center justify-between">
            <Link to="/passwort-vergessen" className="text-blue-400 hover:underline">
              Neuen Link anfordern
            </Link>
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

    if (phase === "ready") {
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
            <Link to="/login" className="text-blue-400 hover:underline">
              Zurück zum Login
            </Link>
          </div>
        </form>
      );
    }

    // phase === "waiting" ohne Code → allgemeiner Hinweis
    return <div className="text-gray-200">Link wird geprüft…</div>;
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-between items-center px-4 text-white">
      {/* Hauptinhalt */}
      <div className="flex flex-col md:flex-row items-center gap-10 mt-10">
        {/* CARD */}
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/">
              <img
                src={logo}
                alt="SchichtPilot Logo"
                className="h-12 cursor-pointer hover:opacity-80"
              />
            </Link>
            <h1 className="text-2xl font-bold">Neues Passwort setzen</h1>
          </div>
          {renderCardContent()}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center text-gray-400 text-xs py-4 border-t border-gray-800">
        © {new Date().getFullYear()} SchichtPilot |{" "}
        <Link to="/impressum" className="ml-1 text-blue-400 hover:underline">
          Impressum
        </Link>{" "}
        |{" "}
        <Link to="/datenschutz" className="ml-1 text-blue-400 hover:underline">
          Datenschutz
        </Link>
      </footer>
    </div>
  );
}
