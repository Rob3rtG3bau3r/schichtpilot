import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";

const erstellePDF = () => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Zugangsdaten – SchichtPilot Demo", 20, 20);

  doc.setFontSize(12);
  doc.text("Nutze einen der folgenden Accounts, um die Demo zu testen:", 20, 30);

  const zeilen = [
    "Employee (nur Ansicht)",
    "Name: Buzz Lightyear",
    "E-Mail: buzz@lauter.com",
    "Passwort: buzz",
    "",
    "Team Leader (Teamleitung)",
    "Name: Pete Mitchel",
    "E-Mail: pete@lauter.com",
    "Passwort: pete",
    "",
    "Planner (Schichtplanung)",
    "Name: Clara Düsenberg",
    "E-Mail: clara@lauter.com",
    "Passwort: clara",
    "",
    "Kurzanleitung:",
    "1. Einloggen mit einem Account",
    "2. Rollen durchtesten",
    "3. SchichtPilot erleben – mobil & am PC",
  ];

  zeilen.forEach((zeile, i) => {
    doc.text(zeile, 20, 40 + i * 8);
  });

  doc.save("schichtpilot_zugangsdaten.pdf");
};

const Home = () => {
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    firma: "",
    funktion: "",
    email: "",
  });
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setSuccess(false);

    try {
      console.log("Starte Insert in db_testzugang...");

      const { data, error } = await supabase.from('db_testzugang').insert([
        {
          name: formData.name,
          firma: formData.firma,
          funktion: formData.funktion,
          mail: formData.email,
        },
      ]);

      if (error) {
        console.error("DB-Insert Fehler:", error);
        throw new Error("DB-Insert fehlgeschlagen");
      }

      console.log("Insert erfolgreich:", data);
      setSuccess(true);
      setFormData({ name: "", firma: "", funktion: "", email: "" });
    } catch (err) {
      console.error("Fehler:", err);
      alert(`Fehler beim Speichern: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center relative">
      {/* Blur-Effekt wenn Modal offen */}
      {modalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-40"></div>
      )}

      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-gray-700 z-30">
        <div className="flex items-center gap-3">
          <Link to="/">
            <img
              src={logo}
              alt="SchichtPilot Logo"
              className="h-16 cursor-pointer"
            />
          </Link>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm"
        >
          Login
        </button>
      </header>

      {/* Hero-Bereich */}
      <section className="mt-12 text-center px-6 max-w-3xl z-20">
        <h2 className="text-4xl font-bold mb-4">
          Der moderne Schichtplaner für dein Unternehmen.
        </h2>
        <p className="text-lg text-gray-300 mb-6">
          Plane smarter. Arbeite flexibler. Zugriff für dein ganzes Team – egal
          ob Büro oder Mobilgerät.
        </p>
        <button
          onClick={() => setModalOpen(true)}
          className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-2xl text-white font-semibold text-lg"
        >
          Testzugang beantragen
        </button>
      </section>

      {/* Vorteile */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 px-6 max-w-6xl text-center">
        {[
          {
            title: "Mobile App",
            text: "Schichten auf dem Handy sehen & beantragen – jederzeit.",
          },
          {
            title: "Automatische Bedarfsprüfung",
            text: "Immer sehen, ob genügend Personal eingeteilt ist.",
          },
          {
            title: "Datenschutzkonform",
            text: "Alle Daten auf EU-Servern – kein Risiko.",
          },
        ].map((vorteil, i) => (
          <div key={i} className="bg-gray-800 rounded-2xl p-6 shadow">
            <h3 className="text-xl font-semibold mb-2">{vorteil.title}</h3>
            <p className="text-gray-400">{vorteil.text}</p>
          </div>
        ))}
      </section>

      {/* Zusatzinfos */}
      <section className="mt-16 px-6 max-w-4xl text-center">
        <h2 className="text-3xl font-bold mb-6">Wofür ist SchichtPilot ideal?</h2>
        <p className="text-lg text-gray-300 mb-10">
          Perfekt für Produktion & Chemie – aber auch für Pflege, Sicherheit oder Gastronomie geeignet.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-gray-800 rounded-2xl p-6 shadow">
            <h3 className="text-xl font-semibold mb-2">Für Planer & Admins</h3>
            <p className="text-gray-400">
              Plane dein Team, prüfe Qualifikationen automatisch und erkenne sofort Personalengpässe oder Überbesetzungen.
            </p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6 shadow">
            <h3 className="text-xl font-semibold mb-2">Für Mitarbeitende</h3>
            <p className="text-gray-400">
              Sieh deine Dienste direkt auf dem Handy und stelle Freiwünsche oder biete dich an.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16 px-6 max-w-4xl text-center">
        <h2 className="text-3xl font-bold mb-4">Warum SchichtPilot?</h2>
        <p className="text-gray-300">
          Weil wir selbst aus der Praxis kommen – unsere Lösung ist für echte Anforderungen in der Schichtplanung gemacht. Einfach, schnell, mobil.
        </p>
      </section>

      <p className="mt-6 text-gray-300">
        Du willst SchichtPilot in deinem Betrieb testen?{" "}
        <a
          href="mailto:info@schichtpilot.com"
          className="underline text-blue-400 hover:text-blue-600"
        >
          Kontaktiere uns jetzt
        </a>
      </p>

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
        </Link>
      </footer>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 opacity-90 flex justify-center items-center z-50 animate-fade-in">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-lg w-full max-w-xl relative">
            <h2 className="text-2xl font-bold mb-2 text-center">
              Testzugang beantragt
            </h2>
{success ? (
  <div className="flex flex-col gap-4 text-sm text-left">
    <p className="text-green-400 text-center font-semibold">
      ✅ Danke! Deine Daten wurden gespeichert.
    </p>
    <p className="text-gray-300 text-center">
      Nutze einen der folgenden Test-Accounts, um SchichtPilot kennenzulernen:
    </p>

    <div className="bg-gray-700 rounded-xl p-4 space-y-3 shadow-xl">
      <div>
        <strong>👤 Employee – Mitarbeiter (nur Ansicht):</strong><br />
        Name: Buzz Lightyear<br />
        E-Mail: <span className="text-yellow-300">buzz@lauter.com</span><br />
        Passwort: <span className="text-yellow-300">buzz</span>
      </div>
      <div>
        <strong>👤 Team Leader – Teamleitung:</strong><br />
        Name: Pete Mitchel<br />
        E-Mail: <span className="text-yellow-300">pete@lauter.com</span><br />
        Passwort: <span className="text-yellow-300">pete</span>
      </div>
      <div>
        <strong>👤 Planner – Schichtplaner:</strong><br />
        Name: Clara Düsenberg<br />
        E-Mail: <span className="text-yellow-300">clara@lauter.com</span><br />
        Passwort: <span className="text-yellow-300">clara</span>
      </div>
    </div>

    <div className="bg-gray-800 rounded-xl px-4 mt-1 text-gray-300 space-y-2">
      <p className="font-semibold text-white text-center">Kurzanleitung</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Logge dich mit einem der Test-Accounts ein.</li>
        <li>Wechsle die Rollen, um die Funktionen zu entdecken.</li>
        <li>Erlebe, wie einfach SchichtPilot die Planung macht – mobil & am PC.</li>
      </ul>
    </div>
<button
  onClick={erstellePDF}
  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white font-semibold"
>
  📄 Zugangsdaten herunterladen
</button>

    <a
      href="/login"
      className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white font-semibold text-center"
    >
      Jetzt einloggen
    </a>

    <button
      onClick={() => setModalOpen(false)}
      className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-white"
    >
      Schließen
    </button>
  </div>
) : (


              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Dein Name"
                  value={formData.name}
                  onChange={handleChange}
                  className="p-2 rounded bg-gray-700 text-white"
                  required
                />
                <input
                  type="text"
                  name="firma"
                  placeholder="Firma"
                  value={formData.firma}
                  onChange={handleChange}
                  className="p-2 rounded bg-gray-700 text-white"
                  required
                />
                <input
                  type="text"
                  name="funktion"
                  placeholder="Funktion / Position"
                  value={formData.funktion}
                  onChange={handleChange}
                  className="p-2 rounded bg-gray-700 text-white"
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="E-Mail-Adresse"
                  value={formData.email}
                  onChange={handleChange}
                  className="p-2 rounded bg-gray-700 text-white"
                  required
                />
                <button
                  type="submit"
                  disabled={isSending}
                  className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white font-semibold"
                >
                  {isSending ? "Sende..." : "Absenden & Demo starten"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-white"
                >
                  Abbrechen
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
  Hinweis: Deine Daten werden automatisch{" "}
  <strong>6 Monate nach Registrierung</strong> gelöscht, falls du dich nicht weiter bei uns meldest oder aktiv wirst.
</p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;