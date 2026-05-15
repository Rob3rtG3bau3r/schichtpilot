import React from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo.png";

const Onboarding = () => {
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
          <h1 className="text-3xl font-bold mb-6">Onboarding & Sicherheit</h1>

          <p className="leading-relaxed text-gray-300">
            SchichtPilot setzt auf ein geführtes Onboarding mit Vier-Augen-Prinzip,
            reduzierten Fehlkonfigurationen und datenschutzfreundlichen
            Standardeinstellungen. Ziel ist es, Unternehmen nicht nur technisch
            einzurichten, sondern von Anfang an sichere und nachvollziehbare Prozesse
            in der Schichtplanung zu schaffen.
          </p>

          <p className="mt-6 leading-relaxed text-gray-300">
            <span className="font-semibold text-white">
              Sicherheit und Service in einem:
            </span>{" "}
            SchichtPilot übernimmt die datenschutzkritische Erstkonfiguration,
            damit Rollen, Units, Berechtigungen und Mitarbeitendenzuordnung von Anfang
            an korrekt eingerichtet sind.
          </p>

          <h2 className="text-2xl font-semibold mt-10 mb-3">
            Geführte Erstkonfiguration
          </h2>

          <p className="leading-relaxed text-gray-300">
            Zu Beginn richtet SchichtPilot die sicherheitskritischen Stammdaten
            gemeinsam mit dem Kunden ein. Dazu gehören unter anderem die grundlegende
            Organisationsstruktur, Zugriffsrechte, betriebliche Planungsgrundlagen
            und die erste Mitarbeitendenzuordnung.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            Diese geführte Einrichtung reduziert Fehler, die besonders beim Start
            eines neuen Systems entstehen können. Dazu zählen zum Beispiel falsche
            Rollen, falsche Unit-Zuordnungen, zu breite Zugriffsrechte oder
            unvollständige Schicht- und Qualifikationsdaten.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Datenschutzfreundliche Standardeinstellungen
          </h2>

          <p className="leading-relaxed text-gray-300">
            SchichtPilot ist darauf ausgelegt, dass Mitarbeitende nur die Daten sehen,
            die sie für ihre Rolle benötigen. Dadurch wird vermieden, dass Dienstpläne,
            Stundenkonten, Urlaubsinformationen oder andere personenbezogene Daten
            unnötig breit im Unternehmen sichtbar sind.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            Rollen und Rechte werden im Rahmen des Onboardings bewusst vorbereitet.
            So entsteht eine klare Struktur, in der administrative, planerische und
            operative Berechtigungen sauber voneinander getrennt sind.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Ablauf des Onboardings
          </h2>

          <p className="leading-relaxed text-gray-300">
            Das Onboarding erfolgt strukturiert und wird gemeinsam mit dem Kunden
            vorbereitet. Der Kunde erhält dafür passende Vorlagen, zum Beispiel für
            Mitarbeitende, Units, Funktionen und weitere Grunddaten.
          </p>

          <div className="mt-5 space-y-5 text-gray-300">
            <div>
              <p className="font-semibold text-white">
                1. Vorbereitung der Grunddaten
              </p>
              <p className="leading-relaxed">
                Der Kunde stellt die notwendigen Informationen in vorbereiteten
                CSV-Dateien oder abgestimmten Vorlagen bereit. Dadurch können Daten
                sauber geprüft und strukturiert übernommen werden.
              </p>
            </div>

            <div>
              <p className="font-semibold text-white">
                2. Einrichtung durch SchichtPilot
              </p>
              <p className="leading-relaxed">
                SchichtPilot richtet die initialen Stammdaten ein und achtet darauf,
                dass Rollen, Units, Berechtigungen, Schichtsysteme und Zuordnungen
                korrekt angelegt werden.
              </p>
            </div>

            <div>
              <p className="font-semibold text-white">
                3. Onboarding-Termine und Einweisung
              </p>
              <p className="leading-relaxed">
                In zwei bis drei Onboarding-Terminen werden die wichtigsten Funktionen
                erklärt. Zusätzlich wird der verantwortungsvolle Umgang mit Dienstplan-,
                Stunden-, Urlaubs- und Personaldaten thematisiert.
              </p>
            </div>

            <div>
            <p className="font-semibold text-white">
                4. Übergabe in die Selbstverwaltung
            </p>
            <p className="leading-relaxed">
                Nach der Erstkonfiguration erhält der Kunde abgestufte
                Selbstverwaltungsrechte. Berechtigte Personen können anschließend
                definierte Stammdaten und betriebliche Einstellungen eigenständig
                pflegen.
            </p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Vier-Augen-Prinzip bei sensiblen Änderungen
          </h2>

          <p className="leading-relaxed text-gray-300">
            Sensible Änderungen sollen nicht unkontrolliert direkt aktiv werden.
            Dazu gehören insbesondere neue Mitarbeitende, Rollenänderungen,
            Unit-Wechsel oder administrative Berechtigungen.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            Ein möglicher Ablauf ist: Eine berechtigte Person bereitet eine Änderung
            vor und wählt eine weitere berechtigte Person als Prüfer aus.
            SchichtPilot löst eine Benachrichtigung zur Freigabe aus. Erst wenn die
            Freigabe bestätigt wurde, wird die Änderung im System aktiv.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            Dadurch entsteht ein nachvollziehbarer Freigabeprozess, ohne dass der
            Kunde dauerhaft vollständig von SchichtPilot abhängig ist. SchichtPilot
            bleibt auf Wunsch unterstützend eingebunden.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Protokollierung und Nachvollziehbarkeit
          </h2>

          <p className="leading-relaxed text-gray-300">
            Änderungen an Rollen, Units, Mitarbeitenden, Schichtsystemen oder
            Qualifikationen sollten nachvollziehbar dokumentiert werden. So ist später
            erkennbar, wer eine Änderung vorbereitet, geprüft und freigegeben hat.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            Diese Nachvollziehbarkeit unterstützt Unternehmen bei internen Kontrollen,
            Datenschutzfragen und möglichen Audits.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Selbstverwaltung nach dem Start
          </h2>

          <p className="leading-relaxed text-gray-300">
            SchichtPilot richtet sicherheitskritische Stammdaten initial selbst ein.
            Danach bekommt der Kunde abgestufte Selbstverwaltungsrechte. Sensible
            Änderungen laufen über Freigabe, Protokoll und optionalen
            SchichtPilot-Support.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            So verbindet SchichtPilot eine professionelle Einführung mit langfristig
            praktikabler Selbstverwaltung im Unternehmen.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Feedback, Support und Probleme melden
          </h2>

          <p className="leading-relaxed text-gray-300">
            Während und nach dem Onboarding können Feedback, Fragen und Probleme
            strukturiert an SchichtPilot übermittelt werden. Dafür ist ein Feedback-
            und Problem-Melden-Bereich vorgesehen.
          </p>

          <p className="mt-4 leading-relaxed text-gray-300">
            Je nach Berechtigung kann dieser Bereich unterschiedlich freigeschaltet
            werden. So können einfache Hinweise, Supportfragen oder weitergehende
            Konfigurationsthemen strukturiert und nachvollziehbar eingereicht werden.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Offboarding und Datenübergabe
          </h2>

          <p className="leading-relaxed text-gray-300">
            Beim Offboarding-Prozess werden dem Kunden auf Wunsch alle verfügbaren
            und exportierbaren Daten als CSV-Dateien zur Verfügung gestellt. Dadurch
            kann der Kunde relevante Informationen sichern, bevor Zugänge deaktiviert
            oder Daten gemäß Löschkonzept entfernt werden.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-3">
            Kurz zusammengefasst
          </h2>

          <p className="leading-relaxed text-gray-300">
            SchichtPilot verbindet Service-Onboarding mit Sicherheitsprinzip:
            sensible Grundkonfigurationen werden geführt, geprüft und dokumentiert
            eingerichtet – für weniger Fehler, klare Verantwortlichkeiten und besseren
            Datenschutz ab dem ersten Tag.
          </p>
        </div>
      </main>

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
        </Link>{" "}
        · <span className="text-gray-500">Version {__APP_VERSION__}</span>
      </footer>
    </div>
  );
};

export default Onboarding;