// utils/DatenschutzPDF.jsx
import jsPDF from "jspdf";

/**
 * Optional: Du kannst ein Base64-Logo übergeben, z. B. aus einem Import:
 * import logoB64 from "../assets/logo_b64"; // data:image/png;base64,....
 * erstelleDatenschutzPDF({ logoBase64: logoB64 });
 */
export const erstelleDatenschutzPDF = ({ logoBase64 } = {}) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // --- Layout-Settings
  const MARGIN_L = 20;
  const MARGIN_R = 20;
  const CONTENT_W = 210 - MARGIN_L - MARGIN_R;
  let y = 20;

  // Header mit optionalem Logo
  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Datenschutzerklärung – SchichtPilot", MARGIN_L, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(
      "Diese Datenschutzerklärung informiert Sie gemäß Art. 12 ff. DSGVO über die \n" +
      "Verarbeitung personenbezogener Daten im Rahmen der Nutzung unserer Plattform \n" +
      "SchichtPilot (www.schichtpilot.com) sowie über Ihre Rechte als betroffene Person.",
      MARGIN_L,
      y
    );
    y += 12;
    doc.setTextColor(0);

    if (logoBase64) {
      try {
        // Logo rechts oben (Breite 28mm, Höhe auto)
        doc.addImage(logoBase64, "PNG", 210 - MARGIN_R - 28, 12, 28, 0);
      } catch {
        // still ok ohne Logo
      }
    }
  };

  const addPageFooter = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `Seite ${i} / ${pageCount}`,
        210 - MARGIN_R,
        297 - 10,
        { align: "right" }
      );
      doc.setTextColor(0);
    }
  };

  const ensureSpace = (minSpace = 12) => {
    if (y + minSpace > 285) {
      doc.addPage();
      y = 20;
    }
  };

  const writeParagraph = (text, options = {}) => {
    const { bold = false, lineHeight = 6, fontSize = 11 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    lines.forEach((ln) => {
      ensureSpace(lineHeight);
      doc.text(ln, MARGIN_L, y);
      y += lineHeight;
    });
  };

  const writeList = (items, options = {}) => {
    const { lineHeight = 6, indent = 4 } = options;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    items.forEach((it) => {
      const lines = doc.splitTextToSize(it, CONTENT_W - indent);
      ensureSpace(lineHeight);
      doc.text("•", MARGIN_L, y);
      doc.text(lines[0], MARGIN_L + indent, y);
      y += lineHeight;
      for (let i = 1; i < lines.length; i++) {
        ensureSpace(lineHeight);
        doc.text(lines[i], MARGIN_L + indent, y);
        y += lineHeight;
      }
    });
  };

  const writeSection = (title, paragraphs = [], lists = []) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(title, MARGIN_L, y);
    y += 8;

    paragraphs.forEach((p) => writeParagraph(p));
    lists.forEach((arr) => writeList(arr));

    y += 2; // kleiner Abstand zum nächsten Block
  };

  // --- Inhalt
  drawHeader();

  // 1. Verantwortlicher
  writeParagraph("");
  writeSection("1. Verantwortlicher", [
    "Robert Gebauer",
    "Kiefernweg 22",
    "50389 Wesseling",
    "E-Mail: info@schichtpilot.com",
  ]);
  writeParagraph(""); writeParagraph("");

  // 2. Allgemeines zur Datenverarbeitung
  writeSection("2. Allgemeines zur Datenverarbeitung", [
    "Die Verarbeitung personenbezogener Daten erfolgt ausschließlich im Rahmen der gesetzlichen Bestimmungen, insbesondere der DSGVO sowie des BDSG. Wir verarbeiten nur die Daten, die für die Erbringung unserer Leistungen erforderlich sind, oder die Sie uns freiwillig zur Verfügung stellen.",
    "Wir haben geeignete technische und organisatorische Maßnahmen (TOMs) implementiert, um ein dem Risiko angemessenes Schutzniveau zu gewährleisten. Dazu zählen insbesondere TLS/SSL-Verschlüsselung, rollenbasierte Zugriffskontrolle (Row Level Security), Protokollierung von Logins, regelmäßige Backups sowie definierte Aufbewahrungs- und Löschfristen.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 3. Hosting und Infrastruktur
  writeSection("3. Hosting und technische Infrastruktur", [
    "Die Webseite wird über Vercel Inc. (340 S Lemon Ave #4133, Walnut, CA 91789, USA) bereitgestellt. Beim Aufruf der Seite verarbeitet Vercel serverseitig technische Zugriffsdaten (z. B. IP-Adresse, Browsertyp, Betriebssystem, Referrer-URL, Zeitstempel), um die Seite auszuliefern, Angriffe abzuwehren und die Stabilität zu gewährleisten.",
    "Die Plattformdaten (z. B. Benutzerkonten, Schichtpläne, Qualifikationen, Bedarfe, Anträge) werden über Supabase in Rechenzentren innerhalb der Europäischen Union gespeichert. Supabase nutzt moderne Sicherheitsmechanismen (u. a. TLS/SSL, Row Level Security) zur Wahrung von Vertraulichkeit, Integrität und Verfügbarkeit.",
    "Sofern ausnahmsweise eine Drittlandübermittlung erforderlich wird, erfolgt diese ausschließlich auf Basis geeigneter Garantien nach Art. 46 DSGVO (insb. EU-Standardvertragsklauseln).",
  ]);
  writeParagraph(""); writeParagraph("");

  // 4. Kategorien verarbeiteter Daten
  writeSection("4. Kategorien verarbeiteter Daten", [], [
    [
      "Nutzungs- und Zugriffsdaten (IP-Adresse, Login-Logs, Browserinformationen, Zeitstempel).",
      "Stammdaten (Name, E-Mail-Adresse, Benutzerrolle, Firmen- und Unit-Zuordnung).",
      "Beschäftigtendaten im Rahmen der Schichtverwaltung (Dienstpläne, Ist-/Soll-Schichten, Abwesenheiten, Urlaubszeiten, Qualifikationen, Bedarfe).",
      "Kommunikationsdaten (freiwillige Schichtanfragen, Freiwünsche, optionale Kommentare, Entscheidungen).",
      "Organisationsdaten (Teams, Units, aktivierte/gebuchte Features).",
    ],
  ]);
  writeParagraph(""); writeParagraph("");

  // 5. Zweck und Rechtsgrundlagen
  writeSection("5. Zweck und Rechtsgrundlagen der Verarbeitung", [
    "Wir verarbeiten personenbezogene Daten ausschließlich zu festgelegten, eindeutigen und legitimen Zwecken:",
  ], [
    [
      "Bereitstellung, Betrieb und Wartung der Plattform SchichtPilot (Art. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung).",
      "Schicht- und Bedarfsplanung, Urlaubs- und Stundenverwaltung (Art. 6 Abs. 1 lit. b DSGVO).",
      "Wahrung berechtigter Interessen, insbesondere Optimierung, Stabilität und Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).",
      "Durchführung von Testzugängen/Pilotphasen (Art. 6 Abs. 1 lit. f DSGVO).",
      "Verarbeitungen auf Basis Ihrer Einwilligung (z. B. freiwillige Schichtanträge), Art. 6 Abs. 1 lit. a DSGVO – Einwilligungen können jederzeit mit Wirkung für die Zukunft widerrufen werden.",
    ],
  ]);
  writeParagraph(""); writeParagraph("");

  // 6. Erhobene Daten beim Besuch der Seite
  writeSection("6. Erhobene Daten beim Besuch der Seite", [
    "Beim Aufrufen unserer Webseite verarbeiten wir automatisch folgende Daten:",
  ], [
    [
      "IP-Adresse, Datum und Uhrzeit der Anfrage.",
      "Browsertyp und Betriebssystem.",
      "Referrer-URL.",
    ],
  ]);
  writeParagraph(
    "Diese Daten dienen der technischen Sicherheit und der Verbesserung unseres Angebots. Eine Zusammenführung mit anderen Datenquellen findet nicht statt."
  );
  writeParagraph(""); writeParagraph("");

  // 7. Speicherdauer und Löschfristen
  writeSection("7. Speicherdauer und Löschfristen", [
    "Wir speichern personenbezogene Daten nur so lange, wie es zur Zweckerreichung erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen. Im Rahmen der Plattform gelten insbesondere folgende Regelungen:",
  ], [
    [
      "DB_Kampfliste (Schichteinsätze): Löschung nach 3 Jahren (rollierend, jeweils zum 14. Januar des Folgejahres).",
      "Urlaubs- und Stundenkonten: Löschung nach 3 Jahren (rollierend, jeweils zum 14. Januar des Folgejahres).",
      "DB_AnfrageMA (freiwillige Schichtübernahmen/Freiwünsche): Löschung spätestens 3 Monate nach Entscheidung oder Ablauf.",
      "DB_Testzugang: Automatische Löschung nach 6 Monaten ohne Rückmeldung oder Aktivität.",
      "DB_FeiertageundFerien: keine personenbezogenen Daten; dauerhafte Speicherung.",
    ],
  ]);
  
  writeParagraph(""); writeParagraph("");

  // 8. Empfänger und Zugriff
  writeSection("8. Empfänger der Daten und Zugriffskontrolle", [
    "Interne Zugriffe erfolgen strikt nach dem Need-to-Know-Prinzip und rollenbasiert (z. B. Employee, Team_Leader, Planner, Org_Admin, SuperAdmin). Einsehbar sind stets nur die für die jeweilige Aufgabe notwendigen Daten.",
    "Externe Empfänger sind die in Abschnitt 3 genannten Hosting-/Cloud-Dienstleister (Vercel, Supabase). Gegebenenfalls kommen Unterauftragsverarbeiter zum Einsatz, die vertraglich auf DSGVO-Konformität verpflichtet sind. Eine Drittlandübermittlung erfolgt – sofern einschlägig – ausschließlich auf Grundlage geeigneter Garantien (Art. 46 DSGVO).",
  ]);
  writeParagraph(""); writeParagraph("");

  // 9. Testzugänge und Pilotphase
  writeSection("9. Testzugänge und Pilotphase", [
    "Für die Beantragung eines Testzugangs verarbeiten wir die von Ihnen angegebenen Daten (z. B. Name, E-Mail-Adresse, Firma, Position), um einen befristeten Zugang zur Testumgebung bereitzustellen. Rechtsgrundlage ist unser berechtigtes Interesse an Produktentwicklung und Bereitstellung eines Testsystems (Art. 6 Abs. 1 lit. f DSGVO).",
    "Ihre Testdaten werden automatisch nach 6 Monaten gelöscht, sofern keine Umwandlung in ein reguläres Konto erfolgt.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 10. Mitarbeitendenanfragen
  writeSection("10. Mitarbeitendenanfragen (freiwillige Schichtübernahmen / Freiwünsche)", [
    "Mitarbeitende können über die Plattform freiwillig Schichtübernahmen oder Freiwünsche einreichen. Diese Anfragen werden in der DB_AnfrageMA gespeichert und enthalten u. a. Benutzer, gewünschtes Datum, Schicht, optionalen Kommentar und die spätere Entscheidung (angenommen/abgelehnt).",
    "Rechtsgrundlage ist regelmäßig Art. 6 Abs. 1 lit. b DSGVO (Durchführung des Beschäftigungsverhältnisses). Die Daten werden spätestens 3 Monate nach Entscheidung oder Ablauf automatisch gelöscht.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 11. Sicherheit der Verarbeitung
  writeSection("11. Sicherheit der Verarbeitung", [], [
    [
      "TLS/SSL-Verschlüsselung sämtlicher Datenübertragungen.",
      "Row Level Security (RLS) und rollenbasierte Zugriffskontrolle (RBAC) zur mandantensicheren Trennung.",
      "Regelmäßige Backups und Wiederherstellungsoptionen.",
      "Protokollierung relevanter Zugriffe (z. B. Login-Logs) und laufende technische sowie organisatorische Maßnahmen zur Risikominimierung.",
    ],
  ]);
  writeParagraph(""); writeParagraph("");

  // 12. Rechte der betroffenen Personen
  writeSection("12. Rechte der betroffenen Personen", [
    "Sie haben nach der DSGVO insbesondere folgende Rechte:",
  ], [
    [
      "Auskunft über die verarbeiteten Daten (Art. 15 DSGVO).",
      "Berichtigung unrichtiger Daten (Art. 16 DSGVO).",
      "Löschung („Recht auf Vergessenwerden“, Art. 17 DSGVO).",
      "Einschränkung der Verarbeitung (Art. 18 DSGVO).",
      "Datenübertragbarkeit (Art. 20 DSGVO).",
      "Widerspruch gegen bestimmte Verarbeitungen (Art. 21 DSGVO).",
      "Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).",
    ],
  ]);
  writeParagraph(
    "Zur Geltendmachung Ihrer Rechte kontaktieren Sie uns bitte unter: info@schichtpilot.com. Sie haben zudem das Recht, sich bei einer Aufsichtsbehörde zu beschweren (Art. 77 DSGVO)."
  );
  writeParagraph(""); writeParagraph("");

  // 13. Änderungen dieser Datenschutzerklärung
  writeSection("13. Änderungen dieser Datenschutzerklärung", [
    "Wir behalten uns vor, diese Datenschutzerklärung jederzeit zu aktualisieren, um sie an rechtliche, technische oder organisatorische Entwicklungen anzupassen. Die jeweils aktuelle Version finden Sie auf unserer Webseite.",
  ]);
  writeParagraph(""); writeParagraph("");

  // --- NEUE ABSCHNITTE (A–I) ---

  // 14. Rollenklärung / AVV
  writeSection("14. Hinweis für Mitarbeitende von Kunden (Rollenklärung gem. Art. 28 DSGVO)", [
    "Für personenbezogene Daten, die im Rahmen des Beschäftigungsverhältnisses durch Ihren Arbeitgeber in SchichtPilot verarbeitet werden (z. B. Dienstpläne, Qualifikationen, Urlaubs- und Stundenkonten), ist Ihr Arbeitgeber der Verantwortliche im Sinne der DSGVO. Wir handeln in diesem Zusammenhang als Auftragsverarbeiter gemäß Art. 28 DSGVO auf Grundlage eines Auftragsverarbeitungsvertrags (AVV). Bitte wenden Sie sich bei datenschutzrechtlichen Anliegen, die Ihre Beschäftigtendaten betreffen, vorrangig an Ihren Arbeitgeber.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 15. Datenquelle (Art. 14)
  writeSection("15. Datenquelle (Art. 14 DSGVO)", [
    "Sofern Sie SchichtPilot als Mitarbeitende*r eines Kunden nutzen, erhalten wir Ihre personenbezogenen Daten regelmäßig von Ihrem Arbeitgeber (z. B. Stammdaten, Team-/Unit-Zuordnung, Qualifikationen, Soll-/Ist-Dienste). Die Verarbeitung erfolgt zu den in dieser Erklärung genannten Zwecken.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 16. PWA, Local Storage & Caching
  writeSection("16. PWA, Local Storage & Caching", [
    "SchichtPilot kann als Progressive Web App (PWA) genutzt werden. Hierbei werden technische Daten und Einstellungen (z. B. Sitzungs-/Rolleninformationen wie `user_id`, `firma_id`, `unit_id`) in der Local-/Session-Storage Ihres Endgeräts gespeichert, um Anmeldung, korrekte Zuordnung zu Firma/Unit und eine bessere Offline-Nutzung zu ermöglichen. Zudem speichert der Service Worker statische Ressourcen (Caching), um Ladezeiten zu verbessern und eine Nutzung mit eingeschränkter Verbindung zu ermöglichen.",
    "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) für funktional erforderliche Speicherung; soweit erforderlich Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer stabilen, performanten Bereitstellung). Es kommen keine Tracking-Cookies oder vergleichbaren Technologien zu Marketing-/Profilingzwecken zum Einsatz.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 17. E-Mail-Versanddienst
  writeSection("17. E-Mail-Versand", [
    "Für transaktionale E-Mails (z. B. Registrierungs-/Login-Mails, Testzugang) setzen wir einen E-Mail-Dienstleister als Auftragsverarbeiter ein (z. B. [E-Mail-Dienstleister/Anbieter eintragen]). Dabei werden Empfänger-E-Mail, Name (sofern angegeben) sowie Meta-Daten der Zustellung verarbeitet.",
    "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) bzw. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer verlässlichen Zustellung). Sofern eine Übermittlung in Drittländer erfolgt, erfolgt diese auf Grundlage geeigneter Garantien (Art. 46 DSGVO, Standardvertragsklauseln).",
  ]);
  writeParagraph(""); writeParagraph("");

  // 18. Login-Logs (Frist)
  writeSection("18. Protokollierung von Logins", [
    "Zur Missbrauchsvermeidung und Fehlersuche protokollieren wir Logins mit Zeitstempel und technischen Merkmalen (z. B. User-Agent). Speicherdauer: in der Regel 30 Tage, danach Löschung oder Anonymisierung. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an Sicherheit und Stabilität).",
  ]);
  writeParagraph(""); writeParagraph("");

  // 19. Pflicht zur Bereitstellung
  writeSection("19. Pflicht zur Bereitstellung", [
    "Die Bereitstellung bestimmter personenbezogener Daten (z. B. Name, E-Mail) ist für die Registrierung und Nutzung von SchichtPilot erforderlich. Ohne diese Angaben ist die Einrichtung eines Benutzerkontos und die Nutzung der Plattform nicht möglich.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 20. Automatisierte Entscheidungen
  writeSection("20. Automatisierte Entscheidungen/Profiling", [
    "Es findet keine ausschließlich automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO statt, die Ihnen gegenüber eine rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt. Analysen zur Dienst-/Bedarfsplanung dienen ausschließlich der planerischen Unterstützung.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 21. Datenschutzbeauftragte*r
  writeSection("21. Datenschutzbeauftragte*r", [
    "Ein*e Datenschutzbeauftragte*r ist derzeit nicht bestellt, da die gesetzlichen Voraussetzungen hierfür nicht vorliegen. Für alle Datenschutzanfragen kontaktieren Sie uns bitte unter info@schichtpilot.com.",
  ]);
  writeParagraph(""); writeParagraph("");

  // 22. Unterauftragsverarbeiter
  writeSection("22. Unterauftragsverarbeiter", [
    "Wir setzen – neben den in Abschnitt „Hosting und technische Infrastruktur“ genannten – ggf. weitere Auftragsverarbeiter zur Erbringung unserer Leistungen ein (z. B. E-Mail-Versanddienst). Diese sind vertraglich nach Art. 28 DSGVO verpflichtet. Eine stets aktuelle Übersicht kann auf Anfrage bereitgestellt werden [oder: wird unter /subprozessoren veröffentlicht].",
  ]);

  // Stand
  ensureSpace(12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Stand: ${new Date().toLocaleDateString("de-DE")}`, MARGIN_L, y);
  doc.setTextColor(0);

  // Footer mit Seitenzahlen
  addPageFooter();

  // Speichern
  doc.save("schichtpilot_datenschutzerklaerung.pdf");
};
