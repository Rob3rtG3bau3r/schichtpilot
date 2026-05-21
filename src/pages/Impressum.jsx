// src/pages/Impressum.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

const Impressum = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Menü schließen, wenn außerhalb geklickt wird
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!menuOpen) return;

      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 border-b border-gray-700/70 z-30 backdrop-blur-sm bg-black/20">
        <div className="grid grid-cols-3 items-center gap-4">
          {/* Links: Logo */}
          <div className="flex items-center gap-3">
            <Link to="/" aria-label="Zur Startseite">
              <img
                src={logo}
                alt="SchichtPilot Logo"
                className="h-12 md:h-14 cursor-pointer"
              />
            </Link>
          </div>

          {/* Mitte: Titel */}
          <h1 className="text-center text-base md:text-2xl lg:text-3xl font-bold leading-tight">
            Impressum
          </h1>

          {/* Rechts: Menü + Login */}
          <div ref={menuRef} className="flex justify-end items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="bg-gray-800/80 hover:bg-gray-700 border border-gray-600 px-4 py-2 rounded-xl text-lg leading-none text-white"
              aria-label="Menü öffnen"
              aria-expanded={menuOpen}
              title="Menü öffnen"
            >
              ☰
            </button>

            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm"
            >
              Login
            </Link>

            {menuOpen && (
              <div className="absolute right-0 top-12 w-64 bg-gray-900/95 border border-gray-700 rounded-2xl shadow-xl p-3 z-50 text-left backdrop-blur-md">
                <div className="text-xs uppercase tracking-wide text-gray-400 px-3 pb-2">
                  SchichtPilot
                </div>

                <Link
                  to="/onboarding"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-gray-200 hover:bg-gray-800"
                >
                  Onboarding
                </Link>

                <Link
                  to="/datenschutz"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-gray-200 hover:bg-gray-800"
                >
                  Datenschutz
                </Link>

                <Link
                  to="/impressum"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 rounded-xl text-gray-200 hover:bg-gray-800"
                >
                  Impressum
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Inhalt */}
      <main className="flex-grow px-6 py-12 max-w-4xl w-full mx-auto text-left">
        <div className="bg-gray-900/70 border border-gray-700/60 rounded-2xl shadow-xl p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">Impressum</h2>

          <p className="font-semibold">Angaben gemäß § 5 DDG</p>

          <p className="mt-4 leading-relaxed text-gray-300">
            <span className="font-semibold text-white">
              SchichtPilot UG (haftungsbeschränkt)
            </span>
            <br />
            Kiefernweg 22
            <br />
            50389 Wesseling
            <br />
            Deutschland
          </p>

          <p className="font-bold mt-6">Vertreten durch:</p>
          <p className="leading-relaxed text-gray-300">
            Geschäftsführer: Robert Gebauer
          </p>

          <p className="font-bold mt-6">Kontakt:</p>
          <p className="leading-relaxed text-gray-300">
            E-Mail:{" "}
            <a
              href="mailto:info@schichtpilot.com"
              className="underline text-blue-400 hover:text-white"
            >
              info@schichtpilot.com
            </a>
          </p>

          <p className="font-bold mt-6">Registereintrag:</p>
          <p className="leading-relaxed text-gray-300">
            Registergericht: Amtsgericht Köln
            <br />
            Handelsregisternummer: HRB 125339
          </p>

          <p className="font-bold mt-6">Umsatzsteuer-ID:</p>
          <p className="leading-relaxed text-gray-300">
            Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: Wird nach Erteilung ergänzt.
            
          </p>

          <p className="font-bold mt-6">
            Inhaltlich Verantwortlicher gemäß § 18 Abs. 2 MStV:
          </p>
          <p className="leading-relaxed text-gray-300">
            Robert Gebauer
            <br />
            Kiefernweg 22
            <br />
            50389 Wesseling
            <br />
            Deutschland
          </p>

          <h3 className="text-2xl font-semibold mt-10 mb-3">Haftung für Inhalte</h3>
          <p className="leading-relaxed text-gray-300">
            Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den
            allgemeinen Gesetzen verantwortlich. Wir sind jedoch nicht verpflichtet,
            übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach
            Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
            Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen
            nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche
            Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten
            Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
            Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </p>

          <h3 className="text-2xl font-semibold mt-8 mb-3">Haftung für Links</h3>
          <p className="leading-relaxed text-gray-300">
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte
            wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch
            keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der
            jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten
            Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
            überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
            erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist
            jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar.
            Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links
            umgehend entfernen.
          </p>

          <h3 className="text-2xl font-semibold mt-8 mb-3">Urheberrecht</h3>
          <p className="leading-relaxed text-gray-300">
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
            unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
            Verbreitung und jede Art der Verwertung außerhalb der Grenzen des
            Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors
            bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten,
            nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite
            nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
            beachtet. Sollten Sie dennoch auf eine Urheberrechtsverletzung aufmerksam
            werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von
            Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
          </p>

          <h3 className="text-2xl font-semibold mt-8 mb-3">
            Verbraucherstreitbeilegung / OS-Plattform
          </h3>
          <p className="leading-relaxed text-gray-300">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung
            bereit:{" "}
            <a
              className="underline text-blue-400 hover:text-white"
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noreferrer"
            >
              https://ec.europa.eu/consumers/odr
            </a>
            . Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren
            vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>

          <p className="mt-10 text-sm text-gray-400">Stand: 20.05.2026</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-20 mb-6 text-gray-500 text-xs text-center">
        © {new Date().getFullYear()} SchichtPilot ·{" "}
        <Link to="/impressum" className="underline text-blue-400 hover:text-white">
          Impressum
        </Link>{" "}
        ·{" "}
        <Link to="/datenschutz" className="underline text-blue-400 hover:text-white">
          Datenschutz
        </Link>{" "}
        · <span className="text-gray-500">Version {__APP_VERSION__}</span>
      </footer>
    </div>
  );
};

export default Impressum;