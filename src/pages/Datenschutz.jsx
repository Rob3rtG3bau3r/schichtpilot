// src/pages/Datenschutz.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import logo from "../assets/logo.png";
import { erstelleDatenschutzPDF } from "../utils/DatenschutzPDF"; // optional: auf finalen Inhalt anpassen

const Datenschutz = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Link to="/">
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
      <main className="flex-grow px-6 py-10 max-w-3xl w-full mx-auto text-left">
        <h1 className="text-2xl font-bold mb-4">Datenschutzerklärung – SchichtPilot</h1>
        <p className="mb-6">
          Diese Datenschutzerklärung informiert Sie gemäß Art. 12 ff. DSGVO über die
          Verarbeitung personenbezogener Daten im Rahmen der Nutzung unserer Plattform
          SchichtPilot (<span className="whitespace-nowrap">www.schichtpilot.com</span>) sowie über Ihre Rechte als betroffene Person.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">1. Verantwortlicher</h2>
        <p>
          Robert Gebauer<br />
          Kiefernweg 22<br />
          50389 Wesseling<br />
          E-Mail:{" "}
          <a className="underline" href="mailto:info@schichtpilot.com">
            info@schichtpilot.com
          </a>
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">2. Allgemeines zur Datenverarbeitung</h2>
        <p>
          Die Verarbeitung personenbezogener Daten erfolgt ausschließlich im Rahmen der gesetzlichen
          Bestimmungen, insbesondere der DSGVO sowie des BDSG. Wir verarbeiten nur die Daten, die für
          die Erbringung unserer Leistungen erforderlich sind, oder die Sie uns freiwillig zur Verfügung
          stellen.
        </p>
        <p className="mt-2">
          Wir haben geeignete technische und organisatorische Maßnahmen (TOMs) implementiert, um ein
          dem Risiko angemessenes Schutzniveau zu gewährleisten. Dazu zählen insbesondere
          TLS/SSL-Verschlüsselung, rollenbasierte Zugriffskontrolle (Row Level Security), Protokollierung
          von Logins, regelmäßige Backups sowie definierte Aufbewahrungs- und Löschfristen.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">3. Hosting und technische Infrastruktur</h2>
        <p>
          Die Webseite wird über Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA)
          bereitgestellt. Beim Aufruf der Seite verarbeitet Vercel serverseitig technische Zugriffsdaten (z. B.
          IP-Adresse, Browsertyp, Betriebssystem, Referrer-URL, Zeitstempel), um die Seite auszuliefern,
          Angriffe abzuwehren und die Stabilität zu gewährleisten.
        </p>
        <p className="mt-2">
          Die Plattformdaten (z. B. Benutzerkonten, Schichtpläne, Qualifikationen, Bedarfe, Anträge) werden
          über Supabase in Rechenzentren innerhalb der Europäischen Union gespeichert. Supabase nutzt
          moderne Sicherheitsmechanismen (u. a. TLS/SSL, Row Level Security) zur Wahrung von
          Vertraulichkeit, Integrität und Verfügbarkeit.
        </p>
        <p className="mt-2">
          Sofern ausnahmsweise eine Drittlandübermittlung erforderlich wird, erfolgt diese ausschließlich auf
          Basis geeigneter Garantien nach Art. 46 DSGVO (insb. EU-Standardvertragsklauseln).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">4. Kategorien verarbeiteter Daten</h2>
        <ul className="list-disc list-inside text-gray-300 ml-4 mt-2">
          <li>Nutzungs- und Zugriffsdaten (IP-Adresse, Login-Logs, Browserinformationen, Zeitstempel).</li>
          <li>Stammdaten (Name, E-Mail-Adresse, Benutzerrolle, Firmen- und Unit-Zuordnung).</li>
          <li>
            Beschäftigtendaten im Rahmen der Schichtverwaltung (Dienstpläne, Ist-/Soll-Schichten,
            Abwesenheiten, Urlaubszeiten, Qualifikationen, Bedarfe).
          </li>
          <li>
            Kommunikationsdaten (freiwillige Schichtanfragen, Freiwünsche, optionale Kommentare,
            Entscheidungen).
          </li>
          <li>Organisationsdaten (Teams, Units, aktivierte/gebuchte Features).</li>
          <li>
            <strong>Betriebs-/Nutzungsdaten für Reporting &amp; Lizenzverwaltung</strong> (z. B. aggregierte
            Kennzahlen je Unit/Monat/Jahr aus <code>db_report_ytd</code>, <code>db_report_monthly</code>,
            <code>db_report_config</code> sowie aktivierte Funktionspakete/Feature-Flags aus{" "}
            <code>DB_Features</code>, <code>DB_PlanFeatures</code>). Grundsätzlich ohne
            Mitarbeiter-Einzelbezug; falls ausnahmsweise personenbeziehbar, dann
            pseudonymisiert/minimiert.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">5. Zweck und Rechtsgrundlagen der Verarbeitung</h2>
        <p>Wir verarbeiten personenbezogene Daten ausschließlich zu festgelegten, eindeutigen und legitimen Zwecken:</p>
        <ul className="list-disc list-inside text-gray-300 ml-4 mt-2">
          <li>
            Bereitstellung, Betrieb und Wartung der Plattform SchichtPilot (Art. 6 Abs. 1 lit. b DSGVO
            Vertragserfüllung).
          </li>
          <li>Schicht- und Bedarfsplanung, Urlaubs- und Stundenverwaltung (Art. 6 Abs. 1 lit. b DSGVO).</li>
          <li>Wahrung berechtigter Interessen, insbesondere Optimierung, Stabilität und Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).</li>
          <li>Durchführung von Testzugängen/Pilotphasen (Art. 6 Abs. 1 lit. f DSGVO).</li>
          <li>
            Verarbeitungen auf Basis Ihrer Einwilligung (z. B. freiwillige Schichtanträge), Art. 6 Abs. 1 lit. a
            DSGVO – Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.
          </li>
        </ul>
        <p className="mt-2">
          <strong>Interne Berichte/Controlling &amp; Lizenz-/Featureverwaltung:</strong> Zur Erbringung der
          vertraglichen Leistungen (Anzeige von Kennzahlen, Abrechnung, Funktionsfreischaltungen) und
          zur Produktstabilität/Optimierung. <em>Rechtsgrundlage:</em> Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und
          Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse). <strong>Kein Marketing-Tracking.</strong>
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">6. Erhobene Daten beim Besuch der Seite</h2>
        <p>Beim Aufrufen unserer Webseite verarbeiten wir automatisch folgende Daten:</p>
        <ul className="list-disc list-inside text-gray-300 ml-4 mt-2">
          <li>IP-Adresse, Datum und Uhrzeit der Anfrage.</li>
          <li>Browsertyp und Betriebssystem.</li>
          <li>Referrer-URL.</li>
        </ul>
        <p className="mt-2">
          Diese Daten dienen der technischen Sicherheit und der Verbesserung unseres Angebots. Eine
          Zusammenführung mit anderen Datenquellen findet nicht statt.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">7. Speicherdauer und Löschfristen</h2>
        <p>
          Wir speichern personenbezogene Daten nur so lange, wie es zur Zweckerreichung erforderlich ist
          oder gesetzliche Aufbewahrungsfristen bestehen. Im Rahmen der Plattform gelten insbesondere
          folgende Regelungen:
        </p>
        <ul className="list-disc list-inside text-gray-300 ml-4 mt-2">
          <li>DB_Kampfliste (Schichteinsätze): Löschung nach 3 Jahren (rollierend, jeweils zum 14. Januar des Folgejahres).</li>
          <li>Urlaubs- und Stundenkonten: Löschung nach 3 Jahren (rollierend, jeweils zum 14. Januar des Folgejahres).</li>
          <li>DB_AnfrageMA (freiwillige Schichtübernahmen/Freiwünsche): Löschung spätestens 3 Monate nach Entscheidung oder Ablauf.</li>
          <li>DB_Testzugang: Automatische Löschung nach 6 Monaten ohne Rückmeldung oder Aktivität.</li>
          <li>DB_FeiertageundFerien: keine personenbezogenen Daten; dauerhafte Speicherung.</li>
          <li>
            <strong>Reportdaten (<code>db_report_*</code>):</strong> Speicherung grundsätzlich aggregiert und ohne Personenbezug;
            Aufbewahrung bis zu 24 Monaten, danach Löschung oder Aggregation auf höherer Ebene.
          </li>
          <li>
            <strong>Feature-/Plan-Konfiguration (<code>DB_Features</code>, <code>DB_PlanFeatures</code>):</strong> Speicherung für die
            Vertragslaufzeit; Löschung spätestens 12 Monate nach Vertragsende bzw. Umwandlung in nicht
            personenbezogene Archivdaten.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">8. Empfänger der Daten und Zugriffskontrolle</h2>
        <p>
          Interne Zugriffe erfolgen strikt nach dem Need-to-Know-Prinzip und rollenbasiert (z. B. Employee,
          Team_Leader, Planner, Org_Admin, SuperAdmin). Einsehbar sind stets nur die für die jeweilige
          Aufgabe notwendigen Daten.
        </p>
        <p className="mt-2">
          Externe Empfänger sind die in Abschnitt 3 genannten Hosting-/Cloud-Dienstleister (Vercel,
          Supabase). Gegebenenfalls kommen Unterauftragsverarbeiter zum Einsatz, die vertraglich auf
          DSGVO-Konformität verpflichtet sind. Eine Drittlandübermittlung erfolgt – sofern einschlägig –
          ausschließlich auf Grundlage geeigneter Garantien (Art. 46 DSGVO).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">9. Testzugänge und Pilotphase</h2>
        <p>
          Für die Beantragung eines Testzugangs verarbeiten wir die von Ihnen angegebenen Daten (z. B.
          Name, E-Mail-Adresse, Firma, Position), um einen befristeten Zugang zur Testumgebung
          bereitzustellen. Rechtsgrundlage ist unser berechtigtes Interesse an Produktentwicklung und
          Bereitstellung eines Testsystems (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p className="mt-2">
          Ihre Testdaten werden automatisch nach 6 Monaten gelöscht, sofern keine Umwandlung in ein
          reguläres Konto erfolgt.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">
          10. Mitarbeitendenanfragen (freiwillige Schichtübernahmen / Freiwünsche)
        </h2>
        <p>
          Mitarbeitende können über die Plattform freiwillig Schichtübernahmen oder Freiwünsche
          einreichen. Diese Anfragen werden in der DB_AnfrageMA gespeichert und enthalten u. a.
          Benutzer, gewünschtes Datum, Schicht, optionalen Kommentar und die spätere Entscheidung
          (angenommen/abgelehnt).
        </p>
        <p className="mt-2">
          Rechtsgrundlage ist regelmäßig Art. 6 Abs. 1 lit. b DSGVO (Durchführung des
          Beschäftigungsverhältnisses). Die Daten werden spätestens 3 Monate nach Entscheidung oder
          Ablauf automatisch gelöscht.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">11. Sicherheit der Verarbeitung</h2>
        <ul className="list-disc list-inside text-gray-300 ml-4 mt-2">
          <li>TLS/SSL-Verschlüsselung sämtlicher Datenübertragungen.</li>
          <li>Row Level Security (RLS) und rollenbasierte Zugriffskontrolle (RBAC) zur mandantensicheren Trennung.</li>
          <li>Regelmäßige Backups und Wiederherstellungsoptionen.</li>
          <li>
            Protokollierung relevanter Zugriffe (z. B. Login-Logs) und laufende technische sowie
            organisatorische Maßnahmen zur Risikominimierung.
          </li>
        </ul>

        <h2 className="text-xl font-semibold mt-6 mb-2">12. Rechte der betroffenen Personen</h2>
        <p>Sie haben nach der DSGVO insbesondere folgende Rechte:</p>
        <ul className="list-disc list-inside text-gray-300 ml-4 mt-2">
          <li>Auskunft über die verarbeiteten Daten (Art. 15 DSGVO).</li>
          <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO).</li>
          <li>Löschung („Recht auf Vergessenwerden“, Art. 17 DSGVO).</li>
          <li>Einschränkung der Verarbeitung (Art. 18 DSGVO).</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO).</li>
          <li>Widerspruch gegen bestimmte Verarbeitungen (Art. 21 DSGVO).</li>
          <li>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</li>
        </ul>
        <p className="mt-2">
          Zur Geltendmachung Ihrer Rechte kontaktieren Sie uns bitte unter:{" "}
          <strong>info@schichtpilot.com</strong>. Sie haben zudem das Recht, sich bei einer Aufsichtsbehörde
          zu beschweren (Art. 77 DSGVO).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">13. Änderungen dieser Datenschutzerklärung</h2>
        <p>
          Wir behalten uns vor, diese Datenschutzerklärung jederzeit zu aktualisieren, um sie an rechtliche,
          technische oder organisatorische Entwicklungen anzupassen. Die jeweils aktuelle Version finden
          Sie auf unserer Webseite.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">
          14. Hinweis für Mitarbeitende von Kunden (Rollenklärung gem. Art. 28 DSGVO)
        </h2>
        <p>
          Für personenbezogene Daten, die im Rahmen des Beschäftigungsverhältnisses durch Ihren
          Arbeitgeber in SchichtPilot verarbeitet werden (z. B. Dienstpläne, Qualifikationen, Urlaubs- und
          Stundenkonten), ist Ihr Arbeitgeber der Verantwortliche im Sinne der DSGVO. Wir handeln in
          diesem Zusammenhang als Auftragsverarbeiter gemäß Art. 28 DSGVO auf Grundlage eines
          Auftragsverarbeitungsvertrags (AVV). Bitte wenden Sie sich bei datenschutzrechtlichen Anliegen,
          die Ihre Beschäftigtendaten betreffen, vorrangig an Ihren Arbeitgeber.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">15. Datenquelle (Art. 14 DSGVO)</h2>
        <p>
          Sofern Sie SchichtPilot als Mitarbeitende*r eines Kunden nutzen, erhalten wir Ihre
          personenbezogenen Daten regelmäßig von Ihrem Arbeitgeber (z. B. Stammdaten,
          Team-/Unit-Zuordnung, Qualifikationen, Soll-/Ist-Dienste). Die Verarbeitung erfolgt zu den in dieser
          Erklärung genannten Zwecken.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">16. PWA, Local Storage &amp; Caching</h2>
        <p>
          SchichtPilot kann als Progressive Web App (PWA) genutzt werden. Hierbei werden technische
          Daten und Einstellungen (z. B. Sitzungs-/Rolleninformationen wie <code>user_id</code>,{" "}
          <code>firma_id</code>, <code>unit_id</code>) in der Local-/Session-Storage Ihres Endgeräts gespeichert, um Anmeldung,
          korrekte Zuordnung zu Firma/Unit und eine bessere Offline-Nutzung zu ermöglichen. Zudem
          speichert der Service Worker statische Ressourcen (Caching), um Ladezeiten zu verbessern und
          eine Nutzung mit eingeschränkter Verbindung zu ermöglichen.
        </p>
        <p className="mt-2">
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) für funktional erforderliche
          Speicherung; soweit erforderlich Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer
          stabilen, performanten Bereitstellung). Es kommen keine Tracking-Cookies oder vergleichbaren
          Technologien zu Marketing-/Profilingzwecken zum Einsatz.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">17. E-Mail-Versand</h2>
        <p>
          Für transaktionale E-Mails (z. B. Registrierungs-/Login-Mails, Testzugang) setzen wir einen
          E-Mail-Dienstleister als Auftragsverarbeiter ein (z. B. [E-Mail-Dienstleister/Anbieter eintragen]).
          Dabei werden Empfänger-E-Mail, Name (sofern angegeben) sowie Meta-Daten der Zustellung
          verarbeitet.
        </p>
        <p className="mt-2">
          Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. Art. 6 Abs. 1 lit. f DSGVO
          (berechtigtes Interesse an einer verlässlichen Zustellung). Sofern eine Übermittlung in Drittländer
          erfolgt, erfolgt diese auf Grundlage geeigneter Garantien (Art. 46 DSGVO,
          Standardvertragsklauseln).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">18. Protokollierung von Logins</h2>
        <p>
          Zur Missbrauchsvermeidung und Fehlersuche protokollieren wir Logins mit Zeitstempel und
          technischen Merkmalen (z. B. User-Agent). Speicherdauer: in der Regel 30 Tage, danach
          Löschung oder Anonymisierung. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes
          Interesse an Sicherheit und Stabilität).
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">19. Pflicht zur Bereitstellung</h2>
        <p>
          Die Bereitstellung bestimmter personenbezogener Daten (z. B. Name, E-Mail) ist für die
          Registrierung und Nutzung von SchichtPilot erforderlich. Ohne diese Angaben ist die Einrichtung
          eines Benutzerkontos und die Nutzung der Plattform nicht möglich.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">20. Automatisierte Entscheidungen/Profiling</h2>
        <p>
          Es findet keine ausschließlich automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO
          statt, die Ihnen gegenüber eine rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich
          beeinträchtigt. Analysen zur Dienst-/Bedarfsplanung dienen ausschließlich der planerischen
          Unterstützung. Report-/Nutzungsdaten werden ausschließlich aggregiert ausgewertet; kein
          individuelles Profiling von Mitarbeitenden.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">21. Datenschutzbeauftragte*r</h2>
        <p>
          Ein*e Datenschutzbeauftragte*r ist derzeit nicht bestellt, da die gesetzlichen Voraussetzungen
          hierfür nicht vorliegen. Für alle Datenschutzanfragen kontaktieren Sie uns bitte unter{" "}
          <strong>info@schichtpilot.com</strong>.
        </p>

        <h2 className="text-xl font-semibold mt-6 mb-2">22. Unterauftragsverarbeiter</h2>
        <p>
          Wir setzen – neben den in Abschnitt „Hosting und technische Infrastruktur“ genannten – ggf.
          weitere Auftragsverarbeiter zur Erbringung unserer Leistungen ein (z. B. E-Mail-Versanddienst).
          Diese sind vertraglich nach Art. 28 DSGVO verpflichtet. Eine stets aktuelle Übersicht kann auf
          Anfrage bereitgestellt werden [oder: wird unter <code>/subprozessoren</code> veröffentlicht].
        </p>

        <p className="mt-10 text-sm text-gray-400">Stand: 21.09.2025</p>

        <button
          onClick={erstelleDatenschutzPDF}
          className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          📄 Datenschutzerklärung als PDF herunterladen
        </button>
      </main>

      {/* Footer */}
      <footer className="text-center text-gray-500 text-xs py-4">
        © {new Date().getFullYear()} SchichtPilot ·{" "}
        <Link to="/" className="underline text-blue-400 hover:text-white">
          Zur Startseite
        </Link>{" "}
        |{" "}
        <Link to="/impressum" className="underline text-blue-400 hover:text-white">
          Impressum
        </Link>
      </footer>
    </div>
  );
};

export default Datenschutz;
