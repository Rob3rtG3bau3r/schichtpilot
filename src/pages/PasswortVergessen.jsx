import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";

// ==============================
// Helpers für State-Nonce
// ==============================
const LS_STATE_KEY = "sp_pw_reset_state";

const b64url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const genState = () => {
  const arr = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return b64url(arr);
};

const saveState = (state) => {
  const payload = { state, ts: Date.now() };
  localStorage.setItem(LS_STATE_KEY, JSON.stringify(payload));
};

const normalizeEmail = (e) => e.trim().toLowerCase();
const isLikelyValidEmail = (s) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());

const mapSupabaseAuthError = (err, redirectTo) => {
  const raw = err?.message || "";
  const msg = raw.toLowerCase();
  if (err?.status === 429 || msg.includes("rate limit"))
    return "Zu viele Anfragen. Bitte kurz warten und erneut versuchen.";
  if (msg.includes("redirect") && msg.includes("not allowed"))
    return `Die Redirect-URL ist nicht freigeschaltet: ${redirectTo}`;
  if (msg.includes("smtp") || msg.includes("email"))
    return "E-Mail-Versand fehlgeschlagen. Bitte Mail-Setup/Spam prüfen.";
  return `Senden fehlgeschlagen: ${raw || "Unbekannter Fehler"}`;
};

// ==============================
// Component
// ==============================
export default function PasswortVergessen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, msg: "", error: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, msg: "", error: "" });

    // 1) Nonce erzeugen und lokal merken (an Gerät/Browser gebunden)
    const state = genState();
    saveState(state);

    // 2) Redirect-URL MIT State
    const base = `${window.location.origin}/reset-password`;
    const redirectTo = `${base}?state=${encodeURIComponent(state)}`;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizeEmail(email),
        { redirectTo }
      );

      if (error) {
        setStatus({
          loading: false,
          msg: "",
          error: mapSupabaseAuthError(error, redirectTo),
        });
        return;
      }

      setStatus({
        loading: false,
        msg:
          "Wenn die E-Mail bei uns existiert, haben wir dir einen Link zum Zurücksetzen geschickt.",
        error: "",
      });
    } catch (err) {
      console.error(err);
      setStatus({
        loading: false,
        msg: "",
        error:
          "Unerwarteter Fehler (Netzwerk/Client). Bitte später erneut versuchen.",
      });
    }
  };

  const disabled = status.loading || !isLikelyValidEmail(email);

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
            <h1 className="text-2xl font-bold">Passwort vergessen</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm">
              E-Mail-Adresse
              <input
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded bg-gray-700 border border-gray-600 p-3 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="name@firma.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status.loading}
              />
            </label>

            <button
              type="submit"
              disabled={disabled}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition disabled:opacity-50"
            >
              {status.loading ? "Sende Link…" : "Link anfordern"}
            </button>

            {status.msg && (
              <p className="text-green-400 text-sm">{status.msg}</p>
            )}
            {status.error && (
              <p className="text-red-400 text-sm">{status.error}</p>
            )}

            <p className="text-xs text-gray-400">
              Tipp: Öffne <strong>den neuesten</strong> Link aus der E-Mail. Der
              Link ist nur kurz gültig und einmalig.
            </p>

            {process.env.NODE_ENV !== "production" && (
              <p className="text-[11px] text-gray-500 mt-2">
                Debug Redirect:&nbsp;
                {`${window.location.origin}/reset-password?state=<nonce>`}
              </p>
            )}

            <div className="text-sm text-gray-300">
              <Link to="/login" className="text-blue-400 hover:underline">
                Zurück zum Login
              </Link>
            </div>
          </form>
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
