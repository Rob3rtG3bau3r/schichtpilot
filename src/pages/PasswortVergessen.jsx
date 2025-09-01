import React, { useState } from "react";
import { supabase } from "../supabaseClient";
import logo from "../assets/logo.png";
import qrCode from "../assets/qr_code_mockup.png";
import { Link } from "react-router-dom";

export default function PasswortVergessen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, msg: "", error: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, msg: "", error: "" });

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });

      if (error) console.warn("resetPasswordForEmail error:", error);
      setStatus({
        loading: false,
        msg: "Wenn die E-Mail bei uns existiert, haben wir dir einen Link zum Zurücksetzen geschickt.",
        error: "",
      });
    } catch (err) {
      console.error(err);
      setStatus({ loading: false, msg: "", error: "Unerwarteter Fehler. Bitte später erneut versuchen." });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-between items-center px-4 text-white">
      {/* Hauptinhalt */}
      <div className="flex flex-col md:flex-row items-center gap-10 mt-10">
        {/* CARD */}
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/"><img src={logo} alt="SchichtPilot Logo" className="h-12 cursor-pointer hover:opacity-80" /></Link>
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
              disabled={status.loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition disabled:opacity-50"
            >
              {status.loading ? "Sende Link…" : "Link anfordern"}
            </button>

            {status.msg && <p className="text-green-400 text-sm">{status.msg}</p>}
            {status.error && <p className="text-red-400 text-sm">{status.error}</p>}

            <p className="text-xs text-gray-400">
              Tipp: Öffne **den neuesten** Link aus der E-Mail. Der Link ist nur kurz gültig und einmalig.
            </p>

            <div className="text-sm text-gray-300">
              <Link to="/login" className="text-blue-400 hover:underline">Zurück zum Login</Link>
            </div>
          </form>
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

