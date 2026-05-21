// src/pages/Datenschutz.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";
import { erstelleDatenschutzPDF } from "../utils/DatenschutzPDF";

const Datenschutz = () => {
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
            Datenschutz
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
      <main className="flex-grow px-6 py-10 max-w-4xl w-full mx-auto text-left">
        <div className="bg-gray-900/70 border border-gray-700/60 rounded-2xl shadow-xl p-6 md:p-8">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Datenschutzerklärung – SchichtPilot
          </h2>

          <p className="mb-6 text-gray-200 leading-relaxed">
            Diese Datenschutzerklärung informiert Sie gemäß Art. 12 ff. DSGVO über die
            Verarbeitung personenbezogener Daten im Rahmen der Nutzung unserer Plattform
            SchichtPilot (<span className="whitespace-nowrap">www.schichtpilot.com</span>) sowie über Ihre Rechte als betroffene Person.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">1. Verantwortlicher</h3>
          <p className="text-gray-300 leading-relaxed">
            SchichtPilot UG (haftungsbeschränkt)<br />
            Robert Gebauer<br />
            Kiefernweg 22<br />
            50389 Wesseling<br />
            Deutschland<br />
            E-Mail:{" "}
            <a className="underline text-blue-300 hover:text-white" href="mailto:info@schichtpilot.com">
              info@schichtpilot.com
            </a>
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">2. Allgemeines zur Datenverarbeitung</h3>
          <p className="text-gray-300 leading-relaxed">
            Die Verarbeitung personenbezogener Daten erfolgt ausschließlich im Rahmen der gesetzlichen
            Bestimmungen, insbesondere der DSGVO sowie des BDSG. Wir verarbeiten nur die Daten, die für
            die Erbringung unserer Leistungen erforderlich sind, oder die Sie uns freiwillig zur Verfügung
            stellen.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Wir haben geeignete technische und organisatorische Maßnahmen (TOMs) implementiert, um ein
            dem Risiko angemessenes Schutzniveau zu gewährleisten. Dazu zählen insbesondere
            TLS/SSL-Verschlüsselung, rollenbasierte Zugriffskontrolle, Row Level Security, Protokollierung
            von Logins, regelmäßige Backups sowie definierte Aufbewahrungs- und Löschfristen.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">3. Hosting und technische Infrastruktur</h3>
          <p className="text-gray-300 leading-relaxed">
            Die Webseite wird über Vercel Inc. bereitgestellt. Beim Aufruf der Seite verarbeitet Vercel
            serverseitig technische Zugriffsdaten, z. B. IP-Adresse, Browsertyp, Betriebssystem,
            Referrer-URL und Zeitstempel, um die Seite auszuliefern, Angriffe abzuwehren und die
            Stabilität zu gewährleisten.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Die Plattformdaten, z. B. Benutzerkonten, Schichtpläne, Qualifikationen, Bedarfe und Anträge,
            werden über Supabase in Rechenzentren innerhalb der Europäischen Union gespeichert.
            Supabase nutzt moderne Sicherheitsmechanismen, u. a. TLS/SSL und Row Level Security,
            zur Wahrung von Vertraulichkeit, Integrität und Verfügbarkeit.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Sofern ausnahmsweise eine Drittlandübermittlung erforderlich wird, erfolgt diese ausschließlich
            auf Basis geeigneter Garantien nach Art. 46 DSGVO, insbesondere EU-Standardvertragsklauseln.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">4. Kategorien verarbeiteter Daten</h3>
          <ul className="list-disc list-inside text-gray-300 ml-4 mt-2 space-y-1">
            <li>Nutzungs- und Zugriffsdaten, z. B. IP-Adresse, Login-Logs, Browserinformationen und Zeitstempel.</li>
            <li>Stammdaten, z. B. Name, E-Mail-Adresse, Benutzerrolle, Firmen- und Unit-Zuordnung.</li>
            <li>Beschäftigtendaten im Rahmen der Schichtverwaltung, z. B. Dienstpläne, Ist-/Soll-Schichten, Abwesenheiten, Urlaubszeiten, Qualifikationen und Bedarfe.</li>
            <li>Kommunikationsdaten, z. B. freiwillige Schichtanfragen, Freiwünsche, optionale Kommentare und Entscheidungen.</li>
            <li>Organisationsdaten, z. B. Teams, Units und aktivierte oder gebuchte Features.</li>
            <li>
              Betriebs- und Nutzungsdaten für Reporting und Lizenzverwaltung, z. B. aggregierte Kennzahlen je Unit, Monat oder Jahr aus <code>db_report_ytd</code>, <code>db_report_monthly</code>, <code>db_report_config</code> sowie aktivierte Funktionspakete oder Feature-Flags aus <code>DB_Features</code> und <code>DB_PlanFeatures</code>. Grundsätzlich ohne Mitarbeiter-Einzelbezug; falls ausnahmsweise personenbeziehbar, dann pseudonymisiert oder minimiert.
            </li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-2">5. Zweck und Rechtsgrundlagen der Verarbeitung</h3>
          <p className="text-gray-300 leading-relaxed">
            Wir verarbeiten personenbezogene Daten ausschließlich zu festgelegten, eindeutigen und legitimen Zwecken:
          </p>
          <ul className="list-disc list-inside text-gray-300 ml-4 mt-2 space-y-1">
            <li>Bereitstellung, Betrieb und Wartung der Plattform SchichtPilot, Art. 6 Abs. 1 lit. b DSGVO.</li>
            <li>Schicht- und Bedarfsplanung, Urlaubs- und Stundenverwaltung, Art. 6 Abs. 1 lit. b DSGVO.</li>
            <li>Wahrung berechtigter Interessen, insbesondere Optimierung, Stabilität und Sicherheit, Art. 6 Abs. 1 lit. f DSGVO.</li>
            <li>Durchführung von Testzugängen und Pilotphasen, Art. 6 Abs. 1 lit. f DSGVO.</li>
            <li>Verarbeitungen auf Basis Ihrer Einwilligung, z. B. freiwillige Schichtanträge, Art. 6 Abs. 1 lit. a DSGVO. Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.</li>
          </ul>
          <p className="mt-2 text-gray-300 leading-relaxed">
            <strong>Interne Berichte, Controlling und Lizenz-/Featureverwaltung:</strong> Zur Erbringung der
            vertraglichen Leistungen, Anzeige von Kennzahlen, Abrechnung, Funktionsfreischaltungen und
            zur Produktstabilität/Optimierung. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO und
            Art. 6 Abs. 1 lit. f DSGVO. <strong>Kein Marketing-Tracking.</strong>
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">6. Erhobene Daten beim Besuch der Seite</h3>
          <p className="text-gray-300 leading-relaxed">Beim Aufrufen unserer Webseite verarbeiten wir automatisch folgende Daten:</p>
          <ul className="list-disc list-inside text-gray-300 ml-4 mt-2 space-y-1">
            <li>IP-Adresse, Datum und Uhrzeit der Anfrage.</li>
            <li>Browsertyp und Betriebssystem.</li>
            <li>Referrer-URL.</li>
          </ul>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Diese Daten dienen der technischen Sicherheit und der Verbesserung unseres Angebots. Eine
            Zusammenführung mit anderen Datenquellen findet nicht statt.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">7. Speicherdauer und Löschfristen</h3>
          <p className="text-gray-300 leading-relaxed">
            Wir speichern personenbezogene Daten nur so lange, wie es zur Zweckerreichung erforderlich ist
            oder gesetzliche Aufbewahrungsfristen bestehen. Im Rahmen der Plattform gelten insbesondere
            folgende Regelungen:
          </p>
          <ul className="list-disc list-inside text-gray-300 ml-4 mt-2 space-y-1">
            <li>DB_Kampfliste, Schichteinsätze: Löschung nach 3 Jahren, rollierend jeweils zum 14. Januar des Folgejahres.</li>
            <li>Urlaubs- und Stundenkonten: Löschung nach 3 Jahren, rollierend jeweils zum 14. Januar des Folgejahres.</li>
            <li>DB_AnfrageMA, freiwillige Schichtübernahmen/Freiwünsche: Löschung spätestens 3 Monate nach Entscheidung oder Ablauf.</li>
            <li>DB_Testzugang: Automatische Löschung nach 6 Monaten ohne Rückmeldung oder Aktivität.</li>
            <li>DB_FeiertageundFerien: keine personenbezogenen Daten; dauerhafte Speicherung.</li>
            <li>Reportdaten, <code>db_report_*</code>: Speicherung grundsätzlich aggregiert und ohne Personenbezug; Aufbewahrung bis zu 24 Monaten, danach Löschung oder Aggregation auf höherer Ebene.</li>
            <li>Feature-/Plan-Konfiguration, <code>DB_Features</code>, <code>DB_PlanFeatures</code>: Speicherung für die Vertragslaufzeit; Löschung spätestens 12 Monate nach Vertragsende bzw. Umwandlung in nicht personenbezogene Archivdaten.</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-2">8. Empfänger der Daten und Zugriffskontrolle</h3>
          <p className="text-gray-300 leading-relaxed">
            Interne Zugriffe erfolgen strikt nach dem Need-to-Know-Prinzip und rollenbasiert. Einsehbar
            sind stets nur die für die jeweilige Aufgabe notwendigen Daten.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Externe Empfänger sind die in Abschnitt 3 genannten Hosting- und Cloud-Dienstleister.
            Gegebenenfalls kommen Unterauftragsverarbeiter zum Einsatz, die vertraglich auf
            DSGVO-Konformität verpflichtet sind. Eine Drittlandübermittlung erfolgt, sofern einschlägig,
            ausschließlich auf Grundlage geeigneter Garantien nach Art. 46 DSGVO.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">9. Testzugänge und Pilotphase</h3>
          <p className="text-gray-300 leading-relaxed">
            Für die Beantragung eines Testzugangs verarbeiten wir die von Ihnen angegebenen Daten,
            z. B. Name, E-Mail-Adresse, Firma und Position, um einen befristeten Zugang zur Testumgebung
            bereitzustellen. Rechtsgrundlage ist unser berechtigtes Interesse an Produktentwicklung und
            Bereitstellung eines Testsystems, Art. 6 Abs. 1 lit. f DSGVO.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Ihre Testdaten werden automatisch nach 6 Monaten gelöscht, sofern keine Umwandlung in ein
            reguläres Konto erfolgt.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">
            10. Mitarbeitendenanfragen, freiwillige Schichtübernahmen und Freiwünsche
          </h3>
          <p className="text-gray-300 leading-relaxed">
            Mitarbeitende können über die Plattform freiwillig Schichtübernahmen oder Freiwünsche
            einreichen. Diese Anfragen werden in der DB_AnfrageMA gespeichert und enthalten u. a.
            Benutzer, gewünschtes Datum, Schicht, optionalen Kommentar und die spätere Entscheidung.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Rechtsgrundlage ist regelmäßig Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden spätestens
            3 Monate nach Entscheidung oder Ablauf automatisch gelöscht.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">11. Sicherheit der Verarbeitung</h3>
          <ul className="list-disc list-inside text-gray-300 ml-4 mt-2 space-y-1">
            <li>TLS/SSL-Verschlüsselung sämtlicher Datenübertragungen.</li>
            <li>Row Level Security und rollenbasierte Zugriffskontrolle zur mandantensicheren Trennung.</li>
            <li>Regelmäßige Backups und Wiederherstellungsoptionen.</li>
            <li>Protokollierung relevanter Zugriffe, z. B. Login-Logs, und laufende technische sowie organisatorische Maßnahmen zur Risikominimierung.</li>
          </ul>

          <h3 className="text-xl font-semibold mt-6 mb-2">12. Rechte der betroffenen Personen</h3>
          <p className="text-gray-300 leading-relaxed">Sie haben nach der DSGVO insbesondere folgende Rechte:</p>
          <ul className="list-disc list-inside text-gray-300 ml-4 mt-2 space-y-1">
            <li>Auskunft über die verarbeiteten Daten, Art. 15 DSGVO.</li>
            <li>Berichtigung unrichtiger Daten, Art. 16 DSGVO.</li>
            <li>Löschung, Recht auf Vergessenwerden, Art. 17 DSGVO.</li>
            <li>Einschränkung der Verarbeitung, Art. 18 DSGVO.</li>
            <li>Datenübertragbarkeit, Art. 20 DSGVO.</li>
            <li>Widerspruch gegen bestimmte Verarbeitungen, Art. 21 DSGVO.</li>
            <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft, Art. 7 Abs. 3 DSGVO.</li>
          </ul>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Zur Geltendmachung Ihrer Rechte kontaktieren Sie uns bitte unter:{" "}
            <strong>info@schichtpilot.com</strong>. Sie haben zudem das Recht, sich bei einer
            Aufsichtsbehörde zu beschweren, Art. 77 DSGVO.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">13. Änderungen dieser Datenschutzerklärung</h3>
          <p className="text-gray-300 leading-relaxed">
            Wir behalten uns vor, diese Datenschutzerklärung jederzeit zu aktualisieren, um sie an rechtliche,
            technische oder organisatorische Entwicklungen anzupassen. Die jeweils aktuelle Version finden
            Sie auf unserer Webseite.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">
            14. Hinweis für Mitarbeitende von Kunden, Rollenklärung gemäß Art. 28 DSGVO
          </h3>
          <p className="text-gray-300 leading-relaxed">
            Für personenbezogene Daten, die im Rahmen des Beschäftigungsverhältnisses durch Ihren
            Arbeitgeber in SchichtPilot verarbeitet werden, z. B. Dienstpläne, Qualifikationen, Urlaubs- und
            Stundenkonten, ist Ihr Arbeitgeber der Verantwortliche im Sinne der DSGVO. Wir handeln in
            diesem Zusammenhang als Auftragsverarbeiter gemäß Art. 28 DSGVO auf Grundlage eines
            Auftragsverarbeitungsvertrags. Bitte wenden Sie sich bei datenschutzrechtlichen Anliegen,
            die Ihre Beschäftigtendaten betreffen, vorrangig an Ihren Arbeitgeber.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">15. Datenquelle, Art. 14 DSGVO</h3>
          <p className="text-gray-300 leading-relaxed">
            Sofern Sie SchichtPilot als Mitarbeitende*r eines Kunden nutzen, erhalten wir Ihre
            personenbezogenen Daten regelmäßig von Ihrem Arbeitgeber, z. B. Stammdaten,
            Team-/Unit-Zuordnung, Qualifikationen sowie Soll- und Ist-Dienste. Die Verarbeitung erfolgt
            zu den in dieser Erklärung genannten Zwecken.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">16. PWA, Local Storage und Caching</h3>
          <p className="text-gray-300 leading-relaxed">
            SchichtPilot kann als Progressive Web App genutzt werden. Hierbei werden technische Daten
            und Einstellungen, z. B. Sitzungs- oder Rolleninformationen wie <code>user_id</code>,{" "}
            <code>firma_id</code> und <code>unit_id</code>, im Local-/Session-Storage Ihres Endgeräts
            gespeichert, um Anmeldung, korrekte Zuordnung zu Firma/Unit und eine bessere Nutzung zu
            ermöglichen. Zudem speichert der Service Worker statische Ressourcen, um Ladezeiten zu
            verbessern und eine Nutzung mit eingeschränkter Verbindung zu ermöglichen.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO für funktional erforderliche Speicherung;
            soweit erforderlich Art. 6 Abs. 1 lit. f DSGVO. Es kommen keine Tracking-Cookies oder
            vergleichbaren Technologien zu Marketing- oder Profilingzwecken zum Einsatz.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">17. E-Mail-Versand</h3>
          <p className="text-gray-300 leading-relaxed">
            Für transaktionale E-Mails, z. B. Registrierungs-/Login-Mails oder Testzugang, setzen wir einen
            E-Mail-Dienstleister als Auftragsverarbeiter ein. Dabei werden Empfänger-E-Mail, Name, sofern
            angegeben, sowie Meta-Daten der Zustellung verarbeitet.
          </p>
          <p className="mt-2 text-gray-300 leading-relaxed">
            Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO bzw. Art. 6 Abs. 1 lit. f DSGVO. Sofern eine
            Übermittlung in Drittländer erfolgt, erfolgt diese auf Grundlage geeigneter Garantien,
            insbesondere Standardvertragsklauseln.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">18. Protokollierung von Logins</h3>
          <p className="text-gray-300 leading-relaxed">
            Zur Missbrauchsvermeidung und Fehlersuche protokollieren wir Logins mit Zeitstempel und
            technischen Merkmalen, z. B. User-Agent. Speicherdauer: in der Regel 30 Tage, danach
            Löschung oder Anonymisierung. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">19. Pflicht zur Bereitstellung</h3>
          <p className="text-gray-300 leading-relaxed">
            Die Bereitstellung bestimmter personenbezogener Daten, z. B. Name und E-Mail, ist für die
            Registrierung und Nutzung von SchichtPilot erforderlich. Ohne diese Angaben ist die Einrichtung
            eines Benutzerkontos und die Nutzung der Plattform nicht möglich.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">20. Automatisierte Entscheidungen/Profiling</h3>
          <p className="text-gray-300 leading-relaxed">
            Es findet keine ausschließlich automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO
            statt, die Ihnen gegenüber eine rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich
            beeinträchtigt. Analysen zur Dienst- und Bedarfsplanung dienen ausschließlich der planerischen
            Unterstützung. Report- und Nutzungsdaten werden ausschließlich aggregiert ausgewertet; kein
            individuelles Profiling von Mitarbeitenden.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">21. Datenschutzbeauftragte*r</h3>
          <p className="text-gray-300 leading-relaxed">
            Ein*e Datenschutzbeauftragte*r ist derzeit nicht bestellt, da die gesetzlichen Voraussetzungen
            hierfür nach aktueller Einschätzung nicht vorliegen. Für alle Datenschutzanfragen kontaktieren
            Sie uns bitte unter <strong>info@schichtpilot.com</strong>.
          </p>

          <h3 className="text-xl font-semibold mt-6 mb-2">22. Unterauftragsverarbeiter</h3>
          <p className="text-gray-300 leading-relaxed">
            Wir setzen neben den in Abschnitt „Hosting und technische Infrastruktur“ genannten ggf.
            weitere Auftragsverarbeiter zur Erbringung unserer Leistungen ein, z. B. für den E-Mail-Versand.
            Diese sind vertraglich nach Art. 28 DSGVO verpflichtet. Eine aktuelle Übersicht kann auf Anfrage
            bereitgestellt werden.
          </p>

          <p className="mt-10 text-sm text-gray-400">Stand: 20.05.2026</p>

          <button
            onClick={erstelleDatenschutzPDF}
            className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            📄 Datenschutzerklärung als PDF herunterladen
          </button>
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

export default Datenschutz;