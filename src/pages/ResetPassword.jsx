import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";
import qrCode from "../assets/qr_code_mockup.png";
import { useNavigate, Link } from "react-router-dom";

function checkPw(pw) {
  const minLen = pw.length >= 8;
  const upper = /[A-Z]/.test(pw);
  const lower = /[a-z]/.test(pw);
  const digit = /\d/.test(pw);
  const special = /[^A-Za-z0-9]/.test(pw);
  return { ok: minLen && upper && lower && digit && special, minLen, upper, lower, digit, special };
}

export default function ResetPassword() {
  const nav = useNavigate();
  const [phase, setPhase] = useState("verifying"); // verifying | ready | error | saving | done
  const [error, setError] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        // 1) Neuer Flow mit ?code=
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setPhase("ready");
          return;
        }

        // 2) Alternativer Flow mit #access_token=… (Session via Hash)
        await new Promise((r) => setTimeout(r, 400));
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setPhase("ready");
          return;
        }

        // 3) Späterer Auth-State (langsame Geräte)
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
            setPhase("ready");
          }
        });
        setTimeout(() => {
          if (sub) sub.subscription.unsubscribe();
          if (phase === "verifying") {
            setPhase("error");
            setError("Ungültiger oder fehlender Link.");
          }
        }, 2000);
      } catch (err) {
        console.warn("reset flow error:", err);
        setPhase("error");
        setError("Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (pw !== pw2) return setError("Die Passwörter stimmen nicht überein.");
    const chk = checkPw(pw);
    if (!chk.ok) return setError("Bitte ein starkes Passwort wählen (mind. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen).");

    setPhase("saving");
    setError("");

    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      console.warn("updateUser error:", error);
      setPhase("ready");
      setError("Passwort konnte nicht gespeichert werden. Bitte erneut versuchen.");
      return;
    }

    await supabase.auth.signOut();
    setPhase("done");
    setTimeout(() => nav("/login?reset=success"), 1000);
  };

  // Inhalt innerhalb der Card – abhängig von phase
  const chk = checkPw(pw);
  const renderCardContent = () => {
    if (phase === "verifying") {
      return <div className="text-gray-200">Link wird geprüft…</div>;
    }
    if (phase === "error") {
      return (
        <div className="space-y-4">
          <p className="text-red-400">{error}</p>
          <Link to="/passwort-vergessen" className="underline text-blue-300">Neuen Link anfordern</Link>
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
