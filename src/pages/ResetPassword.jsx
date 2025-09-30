import React, { useEffect, useState } from "react";
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
const isSixDigit = (s) => /^[0-9]{6}$/.test(String(s || "").trim());

// ---------------------------
// Component
// ---------------------------
export default function ResetPassword() {
  const nav = useNavigate();

  // Phasen:
  // otp       -> Code-Eingabe
  // verifying -> prüft Code / speichert Passwort
  // ready     -> Passwort-Formular
  // saving    -> speichert Passwort
  // done      -> fertig
  // error     -> Fehler (zeigt unten Text)
  const [phase, setPhase] = useState("otp");
  const [error, setError] = useState("");

  // OTP-Form
  const [otpEmail, setOtpEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");

  // Passwort-Form
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  // Link-Parameter komplett ignorieren (Scanner-sicher)
  useEffect(() => {
    // Falls du *aus Versehen* ?code= drin hast: wir nutzen ihn absichtlich NICHT.
    // Optional: vorbefüllte E-Mail aus Query übernehmen:
    const p = new URLSearchParams(window.location.search);
    const mail = p.get("email");
    if (mail) setOtpEmail(mail);
  }, []);

  // --- OTP verifizieren (E-Mail + 6-stellig) ---
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (!otpEmail || !isSixDigit(otpToken)) {
      setError("Bitte E-Mail und den 6-stelligen Code eingeben.");
      return;
    }
    setPhase("verifying");

    const { error } = await supabase.auth.verifyOtp({
      email: otpEmail.trim().toLowerCase(),
      token: otpToken.trim(),
      type: "recovery",
    });

    if (error) {
      setPhase("otp");
      setError(error.message || "OTP ungültig/abgelaufen. Bitte erneut versuchen.");
      return;
    }

    // Erfolg: User ist damit angemeldet → Passwort ändern erlauben
    setPhase("ready");
  };

  // --- Passwort speichern ---
  const handleSave = async (e) => {
    e.preventDefault();
    setError("");

    if (pw !== pw2) return setError("Die Passwörter stimmen nicht überein.");
    const chk = checkPw(pw);
    if (!chk.ok) {
      return setError("Bitte ein starkes Passwort wählen (mind. 8 Zeichen, Groß-/Kleinbuchstaben, Zahl, Sonderzeichen).");
    }

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

  // ---- UI ----
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-between items-center px-4 text-white">
      {/* Hauptinhalt */}
      <div className="flex flex-col md:flex-row items-center gap-10 mt-10">
        {/* CARD */}
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/">
              <img src={logo} alt="SchichtPilot Logo" className="h-12 cursor-pointer hover:opacity-80" />
            </Link>
            <h1 className="text-2xl font-bold">Neues Passwort setzen</h1>
          </div>

          {/* Phase: OTP zuerst */}
          {phase === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-gray-200">
                Bitte gib die E-Mail und den <strong>6-stelligen Code</strong> aus der E-Mail ein.
              </p>

              <label className="block text-sm">
                E-Mail
                <input
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded bg-gray-700 border border-gray-600 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={otpEmail}
                  onChange={(e) => setOtpEmail(e.target.value)}
                />
              </label>

              <label className="block text-sm">
                Code (6 Ziffern)
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="mt-1 w-full rounded bg-gray-700 border border-gray-600 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                />
              </label>

              {error && <p className="text-red-400 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition"
              >
                Code prüfen
              </button>

              <div className="text-sm text-gray-300 flex items-center justify-between">
                <Link to="/passwort-vergessen" className="text-blue-400 hover:underline">
                  Neuen Code anfordern
                </Link>
                <Link to="/login" className="text-blue-400 hover:underline">
                  Zurück zum Login
                </Link>
              </div>
            </form>
          )}

          {phase === "verifying" && <div className="text-gray-200">Prüfe Code…</div>}

          {/* Phase: Passwort setzen */}
          {(phase === "ready" || phase === "saving") && (
            <form onSubmit={handleSave} className="space-y-5">
              <p className="text-sm text-gray-300">
                Code akzeptiert. Jetzt neues Passwort vergeben:
              </p>

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
          )}

          {phase === "done" && <div className="text-green-400">Passwort aktualisiert! Weiterleitung…</div>}
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
