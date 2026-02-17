import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import { supabase } from "../supabaseClient";
import jsPDF from "jspdf";
import { useLocation } from "react-router-dom";

// 👉 Produkt-Screens 
import dash from "../assets/screens/dashboard.webp";
import kampf from "../assets/screens/kampfliste.webp";
import mobile from "../assets/screens/mobile.webp";
import quali from "../assets/screens/qualimatrix.webp";
import office from "../assets/screens/SchichtPilotimBuero.png";

// ✅ Background Video 
import bgVideo from "../assets/Background_720x1280.mp4";
import bgPoster from "../assets/Background_720x1280_poster.jpg";

const erstellePDF = () => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Zugangsdaten – SchichtPilot Demo", 20, 20);

  doc.setFontSize(12);
  doc.text("Nutze einen der folgenden Accounts, um die Demo zu testen:", 20, 30);

  const zeilen = [
    "Employee (nur Ansicht; Mitarbeiter)",
    "Name: Noah Bergmann",
    "E-Mail: Noah@bluewing.com",
    "Passwort: noah",
    "",
    "Team Leader (Teamleitung; Schichtmeister)",
    "Name: Elena Petrova",
    "E-Mail: elena@bluewing.com",
    "Passwort: elena",
    "",
    "Planner (Betriebsmeister; Planner)",
    "Name: Martin Ortmann",
    "E-Mail: martin@bluewing.com",
    "Passwort: martin",
    "",
    "Kurzanleitung:",
    "1. Einloggen mit einem der Test-Accounts",
    "2. Rollen durchtesten",
    "3. SchichtPilot erleben – mobil & am PC",
  ];

  zeilen.forEach((zeile, i) => {
    doc.text(zeile, 20, 40 + i * 8);
  });

  doc.save("schichtpilot_zugangsdaten.pdf");
};

const Home = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    firma: "",
    funktion: "",
    email: "",
    website: "", // Honeypot (bot-falle)
  });

  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const forcePoster = params.get("bg") === "poster";

  // Lightbox
  const screens = [
    { src: dash, alt: "Die persönliche Übersicht eines Planers." },
    { src: office, alt: "SchichtPilot am Arbeitsplatz (Mockup)" },
    { src: kampf, alt: "Dienstplan des gesamten Teams im Überblick." },
    { src: mobile, alt: "Mitarbeitende behalten mobil den Überblick." },
    { src: quali, alt: "Qualifikationen einfach zuweisen." },
  ];

  const [lightboxIndex, setLightboxIndex] = useState(null);
  const lightboxOpen = lightboxIndex !== null;

  // ✅ prefers-reduced-motion: Video bei "Bewegung reduzieren" deaktivieren
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(!!mq.matches);
    apply();
    // Safari fallback: addListener/removeListener
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, []);

  // ESC schließt Modal/Lightbox, Pfeiltasten für Lightbox
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        if (lightboxOpen) setLightboxIndex(null);
        else if (modalOpen) closeModal();
      }
      if (lightboxOpen && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        if (e.key === "ArrowRight") {
          setLightboxIndex((prev) => (prev + 1) % screens.length);
        } else {
          setLightboxIndex((prev) => (prev - 1 + screens.length) % screens.length);
        }
      }
    };
    if (modalOpen || lightboxOpen) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalOpen, lightboxOpen, screens.length]);

  const openModal = () => {
    setSuccess(false);
    setErrorMsg("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSuccess(false);
    setIsSending(false);
    setErrorMsg("");
    setFormData({ name: "", firma: "", funktion: "", email: "", website: "" });
  };

  const handleChange = (e) => {
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);
    setErrorMsg("");
    setSuccess(false);

    // Honeypot: wenn Bots das Feld füllen, stoppen
    if (formData.website) {
      setIsSending(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("db_testzugang")
        .insert([
          {
            name: formData.name,
            firma: formData.firma,
            funktion: formData.funktion,
            mail: formData.email,
          },
        ]);

      if (error) throw error;

      setSuccess(true);
      setFormData({ name: "", firma: "", funktion: "", email: "", website: "" });
    } catch (err) {
      console.error("DB-Insert Fehler:", err);
      setErrorMsg("Speichern fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col items-center relative overflow-hidden bg-gray-900 z-10">
      {/* ✅ Background Video Layer (robust) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        {/* Standbild (immer sichtbar, lädt sofort) */}
        <img
          src={bgPoster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />

        {/* Video darüber (nur wenn motion erlaubt) */}
        {!reduceMotion && !forcePoster && (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={bgVideo}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster={bgPoster}
          />
        )}

        {/* Overlay für Lesbarkeit */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60" />
      </div>

      {/* Blur-Effekt wenn Modal offen */}
      {modalOpen && (
        <div className="absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm z-40"></div>
      )}

      {/* Header mit Headline in der Mitte */}
      <header className="w-full px-6 py-4 border-b border-gray-700/70 z-30 backdrop-blur-sm bg-black/20">
        <div className="grid grid-cols-3 items-center gap-4">
          {/* Links: Logo */}
          <div className="flex items-center gap-3">
            <Link to="/">
              <img
                src={logo}
                alt="SchichtPilot Logo"
                className="h-12 md:h-14 cursor-pointer"
              />
            </Link>
          </div>

          {/* Mitte: Headline */}
          <h1 className="text-center text-base md:text-2xl lg:text-3xl font-bold leading-tight">
            Der moderne Schichtplaner für dein Unternehmen.
          </h1>

          {/* Rechts: Login */}
          <div className="flex justify-end">
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero (ohne H1, weil im Header) */}
      <section className="mt-6 text-center px-6 max-w-3xl z-20">
        <p className="text-lg text-gray-200 mb-6">
          Plane smarter. Arbeite flexibler. Zugriff für dein ganzes Team egal
          ob Büro oder Mobilgerät.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={openModal}
            className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-2xl text-white font-semibold text-lg"
          >
            Unverbindlicher Testzugang
          </button>
        </div>
      </section>

      {/* Vorteile */}
      <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 px-6 max-w-6xl text-center z-20">
        {[
          {
            title: "Mobile App",
            text: "Schichten auf dem Handy sehen & beantragen jederzeit.",
          },
          {
            title: "Automatische Bedarfsprüfung",
            text: "Klarheit über Besetzung und Personalbedarf in Echtzeit.",
          },
          {
            title: "Datenschutzkonform",
            text: "Alle Daten auf EU-Servern kein Risiko.",
          },
        ].map((v, i) => (
          <div
            key={i}
            className="bg-gray-900/55 backdrop-blur-md rounded-2xl p-6 shadow border border-gray-700/40"
          >
            <h3 className="text-lg font-semibold mb-1">{v.title}</h3>
            <p className="text-gray-200/80 text-sm">{v.text}</p>
          </div>
        ))}
      </section>

      {/* Produktbilder / Galerie */}
      <section className="mt-12 px-6 max-w-6xl z-20">
        <h2 className="text-3xl font-bold mb-4 text-center">So sieht SchichtPilot aus</h2>
        <p className="text-gray-200/80 text-center mb-8">
          Ein kurzer Einblick in das Dashboard, den Dienstplan, die Mobile-Ansicht & die Qualifikations Verwaltung.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {screens.map((it, i) => (
            <button
              key={i}
              onClick={() => setLightboxIndex(i)}
              className="group w-full text-left"
              aria-label={`Bild öffnen: ${it.alt}`}
            >
              <div className="bg-gray-900/55 backdrop-blur-md rounded-2xl p-3 shadow overflow-hidden border border-gray-700/40">
                {/* kleiner „Browser“-Rahmen */}
                <div className="flex gap-1 mb-2">
                  <span className="w-2 h-2 bg-gray-600 rounded-full" />
                  <span className="w-2 h-2 bg-gray-600 rounded-full" />
                  <span className="w-2 h-2 bg-gray-600 rounded-full" />
                </div>
                <img
                  src={it.src}
                  alt={it.alt}
                  loading="lazy"
                  className="rounded-lg w-full aspect-[16/10] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              </div>
              <div className="mt-2 text-sm text-gray-200/85">{it.alt}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Compliance / Trust */}
      <section className="mt-12 px-6 max-w-6xl w-full z-20">
        <div className="bg-gray-900/55 backdrop-blur-md rounded-2xl p-6 shadow border border-gray-700/40">
          <h2 className="text-xl md:text-2xl font-bold mb-2 text-center">
            Compliance & Sicherheit
          </h2>

          <p className="text-gray-200/80 text-center mb-6 text-sm md:text-base">
            SchichtPilot ist für den professionellen Einsatz in der Schichtplanung gebaut – transparent, nachvollziehbar und datenschutzkonform.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            {[
              { title: "DSGVO-konform", text: "Auftragsverarbeitung (AVV) verfügbar, Datensparsamkeit & klare Prozesse." },
              { title: "EU-Hosting & TLS", text: "Datenübertragung verschlüsselt (TLS) und Hosting in der EU." },
              { title: "Rollen & Rechte", text: "Granulare Zugriffe nach Rollen (z. B. Employee, Team Leader, Planner)." },
              { title: "Nachvollziehbarkeit", text: "Plan/Ist-Änderungen können protokolliert und nachvollzogen werden." },
              { title: "Export & Audit", text: "Daten lassen sich für Prüfungen/Reports strukturiert ausgeben." },
              { title: "Löschkonzept", text: "Daten werden nur so lange gespeichert, wie es für den jeweiligen Zweck erforderlich ist." },
            ].map((it, i) => (
              <div key={i} className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/40">
                <div className="font-semibold text-white mb-1">{it.title}</div>
                <div className="text-gray-200/70">{it.text}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 text-center text-xs text-gray-200/60">
            Hinweis: SchichtPilot ist kein Zeiterfassungssystem, sondern eine Planungs- und Transparenzlösung für Teams im Schichtbetrieb.
          </div>
        </div>
      </section>

      {/* Zielgruppen-Infos */}
      <section className="mt-16 px-6 max-w-4xl text-center z-20">
        <h2 className="text-3xl font-bold mb-6">Wofür ist SchichtPilot ideal?</h2>
        <p className="text-lg text-gray-200/80 mb-10">
          Perfekt für alle, die im vollkontinuierlichen Schichtsystem arbeiten und den nächsten Schritt in der Planung gehen wollen.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-gray-900/55 backdrop-blur-md rounded-2xl p-6 shadow border border-gray-700/40">
            <h3 className="text-xl font-semibold mb-2">Für Planer & Admins</h3>
            <p className="text-gray-200/70">
              Plane dein Team, prüfe Qualifikationen automatisch und erkenne sofort Personalengpässe oder Überbesetzungen.
            </p>
          </div>
          <div className="bg-gray-900/55 backdrop-blur-md rounded-2xl p-6 shadow border border-gray-700/40">
            <h3 className="text-xl font-semibold mb-2">Für Mitarbeitende</h3>
            <p className="text-gray-200/70">
              Sieh deine Dienste direkt auf dem Handy und stelle Freiwünsche oder biete dich an.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-16 px-6 max-w-4xl text-center z-20">
        <h2 className="text-3xl font-bold mb-4">Warum SchichtPilot?</h2>
        <p className="text-gray-200/80">
          Weil wir selbst aus der Praxis kommen, unsere Lösung ist für echte Anforderungen in der Schichtplanung gemacht.
          <h3 className="text-xl font-semibold"> Einfach, schnell, mobil. </h3>
        </p>
      </section>

      <p className="mt-6 text-gray-200/80 z-20">
        Du willst SchichtPilot in deinem Betrieb testen?{" "}
        <a
          href="mailto:info@schichtpilot.com"
          className="underline text-blue-300 hover:text-blue-200"
        >
          Kontaktiere uns jetzt
        </a>
      </p>

      {/* Footer */}
      <footer className="mt-20 mb-6 text-gray-200/50 text-xs text-center z-20">
        © {new Date().getFullYear()} SchichtPilot ·{" "}
        <Link
          to="/impressum"
          className="underline text-blue-300 hover:text-white"
        >
          Impressum
        </Link>{" "}
        ·{" "}
        <Link
          to="/datenschutz"
          className="underline text-blue-300 hover:text-white"
        >
          Datenschutz
        </Link>{" "}
        · <span className="text-gray-200/50">Version {__APP_VERSION__}</span>
      </footer>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex justify-center items-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="testzugang-title"
            className="bg-gray-800 rounded-2xl p-8 shadow-lg w-full max-w-xl relative"
          >
            <h2 id="testzugang-title" className="text-2xl font-bold mb-2 text-center">
              {success ? "Testzugang beantragt" : "Testzugang"}
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
                    Name: Noah Bergmann<br />
                    E-Mail: <span className="text-yellow-300">noah@bluewing.com</span><br />
                    Passwort: <span className="text-yellow-300">noah</span>
                  </div>
                  <div>
                    <strong>👤 Team Leader – Teamleitung:</strong><br />
                    Name: Elena Petrova<br />
                    E-Mail: <span className="text-yellow-300">elena@bluewing.com</span><br />
                    Passwort: <span className="text-yellow-300">elena</span>
                  </div>
                  <div>
                    <strong>👤 Planner – Betriebsmeister:</strong><br />
                    Name: Martin Ortmann<br />
                    E-Mail: <span className="text-yellow-300">martin@bluewing.com</span><br />
                    Passwort: <span className="text-yellow-300">martin</span>
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

                <Link
                  to="/login"
                  className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white font-semibold text-center"
                >
                  Jetzt einloggen
                </Link>

                <button
                  onClick={closeModal}
                  className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded text-white"
                >
                  Schließen
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* Labels für Barrierefreiheit */}
                <div className="text-left">
                  <label htmlFor="name" className="block text-sm mb-1">Dein Name</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    placeholder="Max Mustermann"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full p-2 rounded bg-gray-700 text-white"
                    required
                  />
                </div>

                <div className="text-left">
                  <label htmlFor="firma" className="block text-sm mb-1">Firma</label>
                  <input
                    id="firma"
                    type="text"
                    name="firma"
                    placeholder="Firma GmbH"
                    value={formData.firma}
                    onChange={handleChange}
                    className="w-full p-2 rounded bg-gray-700 text-white"
                    required
                  />
                </div>

                <div className="text-left">
                  <label htmlFor="funktion" className="block text-sm mb-1">Funktion / Position</label>
                  <input
                    id="funktion"
                    type="text"
                    name="funktion"
                    placeholder="Schichtplaner / Teamleitung"
                    value={formData.funktion}
                    onChange={handleChange}
                    className="w-full p-2 rounded bg-gray-700 text-white"
                    required
                  />
                </div>

                <div className="text-left">
                  <label htmlFor="email" className="block text-sm mb-1">E-Mail-Adresse</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="name@firma.de"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full p-2 rounded bg-gray-700 text-white"
                    required
                  />
                </div>

                {/* Honeypot (unsichtbar für Nutzer) */}
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="hidden"
                  tabIndex="-1"
                  autoComplete="off"
                />

                {errorMsg && (
                  <p className="text-red-400 text-sm text-center">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded text-white font-semibold disabled:opacity-60"
                >
                  {isSending ? "Sende..." : "Absenden & Demo starten"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
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

      {/* Lightbox */}
      {lightboxOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/70 z-50"
            onClick={() => setLightboxIndex(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl p-3 max-w-6xl w-full shadow-lg">
              <img
                src={screens[lightboxIndex].src}
                alt={screens[lightboxIndex].alt}
                className="w-full rounded-lg"
              />
              <div className="mt-3 flex justify-between items-center">
                <div className="text-sm text-gray-300">{screens[lightboxIndex].alt}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setLightboxIndex((prev) => (prev - 1 + screens.length) % screens.length)
                    }
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white"
                  >
                    ◀︎
                  </button>
                  <button
                    onClick={() =>
                      setLightboxIndex((prev) => (prev + 1) % screens.length)
                    }
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white"
                  >
                    ▶︎
                  </button>
                  <button
                    onClick={() => setLightboxIndex(null)}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Home;
