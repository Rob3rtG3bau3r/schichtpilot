import React from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo.png";

const Impressum = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Link to="/" aria-label="Zur Startseite">
            <img src={logo} alt="SchichtPilot Logo" className="h-16 cursor-pointer" />
          </Link>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm"
        >
          Login
        </button>
      </header>

      {/* Inhalt */}
      <main className="flex-grow px-6 py-12 flex flex-col items-center">
        <div className="max-w-3xl w-full">
          <h1 className="text-3xl font-bold mb-6">Impressum</h1>

          <p className="font-semibold">Angaben gemäß § 5 TMG</p>
          <p className="mt-4 leading-relaxed">
            <span className="font-semibold">SchichtPilot UG (haftungsbeschränkt) i. Gr.</span><br />
            Kiefernweg 22<br />
            50389 Wesseling<br />
            Deutschland
          </p>

          <p className="font-bold mt-6">Vertreten durch:</p>
          <p className="leading-relaxed">Geschäftsführer: Robert Gebauer</p>

          <p className="font-bold mt-6">Kontakt:</p>
          <p className="leading-relaxed">
            E-Mail:{" "}
            <a href="mailto:info@schichtpilot.com" className="underline text-blue-400 hover:text-white">
              info@schichtpilot.com
            </a>
            {/* Optional:
            <br />Telefon: +49&nbsp;XXX&nbsp;XXX&nbsp;XXXX */}
          </p>

          <p className="font-bold mt-6">Registereintrag:</p>
          <p className="leading-relaxed">
            Das Unternehmen befindet sich in Gründung. Die Eintragung in das Handelsregister wird nachgereicht.
            {/* Nach Eintragung aktivieren:
            <br />Registergericht: Amtsgericht Köln
            <br />Handelsregisternummer: HRB XXXXX */}
          </p>

          <p className="font-bold mt-6">Umsatzsteuer-ID:</p>
          <p className="leading-relaxed">
            Wird beantragt und nachgereicht.
            {/* Nach Zuteilung aktivieren:
            <br />USt-IdNr.: DEXXXXXXXXX */}
          </p>

          <p className="font-bold mt-6">Inhaltlich Verantwortlicher gemäß § 18 Abs. 2 MStV:</p>
          <p className="leading-relaxed">
            Robert Gebauer, Kiefernweg 22, 50389 Wesseling, Deutschland
          </p>

          {/* Haftungshinweise */}
          <h2 className="text-2xl font-semibold mt-10 mb-3">Haftung für Inhalte</h2>
          <p className="leading-relaxed text-gray-300">
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den
            allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
            verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
            forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung
            der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche
            Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
            Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">Haftung für Links</h2>
          <p className="leading-relaxed text-gray-300">
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
            Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
            Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten
            wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum
            Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist
            jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von
            Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">Urheberrecht</h2>
          <p className="leading-relaxed text-gray-300">
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
            Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
            Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
            Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
            beachtet. Solltest du dennoch auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
            entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend
            entfernen.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">Verbraucher­streit­beilegung / OS-Plattform</h2>
          <p className="leading-relaxed text-gray-300">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a
              className="underline text-blue-400 hover:text-white"
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noreferrer"
            >
              https://ec.europa.eu/consumers/odr
            </a>. Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
            Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-gray-500 text-xs py-4">
        © {new Date().getFullYear()} SchichtPilot ·{" "}
        <Link to="/" className="underline text-blue-400 hover:text-white">Zur Startseite</Link>{" "}
        | <Link to="/datenschutz" className="underline text-blue-400 hover:text-white">Datenschutzerklärung</Link>
      </footer>
    </div>
  );
};

export default Impressum;
