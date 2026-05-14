import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Download, X, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const ROLLEN_MAPPING = {
  E: 'Employee',
  T: 'Team_Leader',
  P: 'Planner',
};

const genTempPassword = () =>
  (crypto?.randomUUID?.() ?? (Math.random().toString(36).slice(2) + Date.now().toString(36)))
    .replace(/-/g, '')
    .slice(0, 12);

const sendeResetLink = async (email) => {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
};

const normalisiere = (wert) =>
  String(wert || '')
    .trim()
    .toLowerCase();

const cleanCsvText = (wert) =>
  String(wert || '')
    .trim()
    .replace(/^'/, '');

const holeEmailDomain = (email) => {
  const parts = String(email || '').trim().toLowerCase().split('@');
  return parts.length === 2 ? parts[1] : '';
};

const parseCSV = (text) => {
  const cleanText = text.replace(/^\uFEFF/, '');

  const lines = cleanText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (lines.length < 2) return [];

  const headers = lines[0].split(';').map(h => h.trim().toLowerCase());

  return lines.slice(1).map((line, index) => {
    const values = line.split(';').map(v => v.trim());

    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });

    const rollenKuerzel = String(row.rolle || '').trim().toUpperCase();
    const rolleFinal = ROLLEN_MAPPING[rollenKuerzel] || '';

    return {
      zeile: index + 2,
      vorname: row.vorname || '',
      nachname: row.nachname || '',
      email: row.email || '',
      rollenKuerzel,
      rolle: rolleFinal,
      funktion: 'Mitarbeiter',

      // Optional
      personal_nummer: cleanCsvText(row.personal_nummer),
      tel_number1: cleanCsvText(row.tel_number1),
      tel_number2: cleanCsvText(row.tel_number2),
    };
  });
};

const BenutzerCSVImport = ({ onImportDone }) => {
  const { userId } = useRollen();

  const [firmen, setFirmen] = useState([]);
  const [units, setUnits] = useState([]);
  const [existingEmails, setExistingEmails] = useState([]);

  const [firmaId, setFirmaId] = useState('');
  const [unitId, setUnitId] = useState('');

  const [domainPruefungAktiv, setDomainPruefungAktiv] = useState(false);
  const [erlaubteDomain, setErlaubteDomain] = useState('');

  const [previewRows, setPreviewRows] = useState([]);
  const [zeigeModal, setZeigeModal] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    const ladeStammdaten = async () => {
      const { data: firmenData } = await supabase
        .from('DB_Kunden')
        .select('id, firmenname')
        .order('firmenname', { ascending: true });

      const { data: unitsData } = await supabase
        .from('DB_Unit')
        .select('id, unitname, firma')
        .order('unitname', { ascending: true });

      const { data: userData } = await supabase
        .from('DB_User')
        .select('email');

      setFirmen(firmenData || []);
      setUnits(unitsData || []);
      setExistingEmails((userData || []).map(u => normalisiere(u.email)));
    };

    ladeStammdaten();
  }, []);

  const filteredUnits = useMemo(() => {
    if (!firmaId) return [];
    return units.filter(u => String(u.firma) === String(firmaId));
  }, [units, firmaId]);

  const firmaName = useMemo(() => {
    return firmen.find(f => String(f.id) === String(firmaId))?.firmenname || '–';
  }, [firmen, firmaId]);

  const unitName = useMemo(() => {
    return units.find(u => String(u.id) === String(unitId))?.unitname || '–';
  }, [units, unitId]);

  const domainSoll = useMemo(() => {
    return erlaubteDomain.trim().toLowerCase().replace(/^@/, '');
  }, [erlaubteDomain]);

  const downloadVorlage = () => {
    const csv = [
      '# WICHTIG: Bitte diese Datei im Vier-Augen-Prinzip prüfen.',
      '# Falsch angelegte Mitarbeiter können später großen Korrekturaufwand verursachen.',
      '# Rollen-Kürzel: E = Employee, T = Team_Leader, P = Planner',
      '# Admin-Rollen dürfen nicht per CSV importiert werden',
      '# Pflichtfelder: vorname, nachname, email, rolle',
      '# Optional: personal_nummer, tel_number1, tel_number2',
      '# Hinweis Excel: Telefonnummern bitte als Text formatieren oder mit führendem Apostroph eingeben, z.B. \'01711234567',
      '# Optional kann SchichtPilot beim Upload prüfen, ob alle E-Mail-Adressen zur gewünschten Firmen-Domain passen.',
      'vorname;nachname;email;rolle;personal_nummer;tel_number1;tel_number2',
      'Max;Mustermann;max.mustermann@testfirma.de;E;1001;\'01711234567;',
      'Erika;Musterfrau;erika.musterfrau@testfirma.de;T;1002;\'01719876543;\'022361234',
      'Paul;Planer;paul.planer@testfirma.de;P;1003;;',
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'schichtpilot_benutzer_vorlage.csv';
    a.click();

    URL.revokeObjectURL(url);
  };

  const pruefeRows = (rows) => {
    const emailsInDatei = new Set();

    // Wenn irgendwo eine Personalnummer eingetragen wurde,
    // prüfen wir fehlende Personalnummern als Hinweis.
    const personalnummerWirdGenutzt = rows.some(r => String(r.personal_nummer || '').trim());

    return rows.map(row => {
      const fehler = [];
      const hinweise = [];
      const emailClean = normalisiere(row.email);

      if (personalnummerWirdGenutzt && !String(row.personal_nummer || '').trim()) {
        hinweise.push('Personalnummer fehlt, obwohl sie bei anderen eingetragen ist');
      }

      if (!firmaId) fehler.push('Firma wurde im Importbereich nicht ausgewählt');
      if (!unitId) fehler.push('Unit wurde im Importbereich nicht ausgewählt');

      if (!row.vorname) fehler.push('Vorname fehlt');
      if (!row.nachname) fehler.push('Nachname fehlt');

      if (!row.email) {
        fehler.push('E-Mail fehlt');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        fehler.push('E-Mail ist ungültig');
      }

      if (
        domainPruefungAktiv &&
        domainSoll &&
        row.email &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
      ) {
        const domainIst = holeEmailDomain(row.email);

        if (domainIst !== domainSoll) {
          fehler.push(`E-Mail-Domain passt nicht. Erwartet: @${domainSoll}`);
        }
      }

      if (!row.rollenKuerzel) {
        fehler.push('Rollen-Kürzel fehlt');
      } else if (!ROLLEN_MAPPING[row.rollenKuerzel]) {
        fehler.push('Rollen-Kürzel ungültig. Erlaubt sind E, T oder P');
      }

      if (emailClean && existingEmails.includes(emailClean)) {
        fehler.push('E-Mail existiert bereits');
      }

      if (emailClean && emailsInDatei.has(emailClean)) {
        fehler.push('E-Mail doppelt in CSV');
      }

      if (emailClean) emailsInDatei.add(emailClean);

      return {
        ...row,
        firma_id: firmaId || null,
        unit_id: unitId || null,
        firmaName,
        unitName,
        fehler,
        hinweise,
        status: fehler.length === 0 ? 'OK' : 'FEHLER',
      };
    });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!firmaId || !unitId) {
      alert('Bitte zuerst Firma und Unit auswählen.');
      e.target.value = '';
      return;
    }

    if (domainPruefungAktiv && !domainSoll) {
      alert('Bitte eine erlaubte E-Mail-Domain eintragen oder die Domain-Prüfung deaktivieren.');
      e.target.value = '';
      return;
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) {
      alert('Die CSV-Datei enthält keine gültigen Daten.');
      e.target.value = '';
      return;
    }

    const geprueft = pruefeRows(rows);
    setPreviewRows(geprueft);
    setZeigeModal(true);

    e.target.value = '';
  };

  const fehlerCount = useMemo(
    () => previewRows.filter(r => r.fehler.length > 0).length,
    [previewRows]
  );

  const okCount = useMemo(
    () => previewRows.filter(r => r.fehler.length === 0).length,
    [previewRows]
  );

  const hinweisCount = useMemo(
    () => previewRows.filter(r => r.hinweise?.length > 0).length,
    [previewRows]
  );

  const speichern = async () => {
    const gueltigeRows = previewRows.filter(r => r.fehler.length === 0);

    if (gueltigeRows.length === 0) {
      alert('Es gibt keine gültigen Zeilen zum Speichern.');
      return;
    }

    setSpeichert(true);
    setStatusText(`Starte Import von ${gueltigeRows.length} Benutzern...`);

    let erfolgreich = 0;
    let fehlgeschlagen = 0;

    for (const row of gueltigeRows) {
      try {
        setStatusText(`Speichere ${row.vorname} ${row.nachname}...`);

        const passwort = genTempPassword();

        const userPayload = {
          vorname: row.vorname,
          nachname: row.nachname,
          rolle: row.rolle,
          firma_id: row.firma_id,
          unit_id: row.unit_id,
          funktion: 'Mitarbeiter',
          email: row.email.trim(),
          erstellt_von: userId,

          // Optionale Zusatzdaten nur für DB_User
          personal_nummer: row.personal_nummer?.trim() || null,
          tel_number1: row.tel_number1?.trim() || null,
          tel_number2: row.tel_number2?.trim() || null,
        };

        const res = await fetch('https://schicht-pilot-backend.vercel.app/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: row.email.trim(),
            password: passwort,
            userData: userPayload,
          }),
        });

        const result = await res.json();

        if (!res.ok) {
          throw new Error(result?.error || 'Unbekannter Fehler beim Anlegen');
        }

        await sendeResetLink(row.email);

        erfolgreich++;
      } catch (error) {
        console.error('CSV Import Fehler:', row, error);
        fehlgeschlagen++;

        setPreviewRows(prev =>
          prev.map(r =>
            r.zeile === row.zeile
              ? {
                  ...r,
                  fehler: [`Speichern fehlgeschlagen: ${error.message}`],
                  status: 'FEHLER',
                }
              : r
          )
        );
      }
    }

    setStatusText(`Import fertig: ${erfolgreich} erfolgreich, ${fehlgeschlagen} fehlgeschlagen.`);

    if (onImportDone) onImportDone();

    setSpeichert(false);

    if (fehlgeschlagen === 0) {
      setTimeout(() => {
        setZeigeModal(false);
        setPreviewRows([]);
        setStatusText('');
      }, 2500);
    }
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 mb-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-lg">CSV-Onboarding</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Mitarbeiter per CSV prüfen, anzeigen und erst nach Bestätigung anlegen.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Rollen-Kürzel: E = Employee, T = Team_Leader, P = Planner. Admins werden nicht per CSV angelegt.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={downloadVorlage}
            className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            <Download size={16} />
            CSV-Vorlage
          </button>

          <label className={`flex items-center gap-2 px-4 py-2 rounded text-white ${
            !firmaId || !unitId
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}>
            <Upload size={16} />
            CSV hochladen
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleUpload}
              className="hidden"
              disabled={!firmaId || !unitId}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Firma für diesen Import
          </label>
          <select
            value={firmaId}
            onChange={(e) => {
              setFirmaId(e.target.value);
              setUnitId('');
            }}
            className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700"
          >
            <option value="">Firma wählen</option>
            {firmen.map(firma => (
              <option key={firma.id} value={firma.id}>
                {firma.firmenname} — ID: {firma.id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
            Unit für diesen Import
          </label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700"
            disabled={!firmaId}
          >
            {!firmaId ? (
              <option value="">Bitte zuerst Firma wählen</option>
            ) : filteredUnits.length === 0 ? (
              <option value="">Keine Unit für diese Firma gefunden</option>
            ) : (
              <>
                <option value="">Unit wählen</option>
                {filteredUnits.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unitname} — ID: {unit.id}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>

      <div className="mt-3 bg-gray-100 dark:bg-gray-900/40 border border-gray-300 dark:border-gray-700 rounded-lg p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={domainPruefungAktiv}
            onChange={() => setDomainPruefungAktiv(prev => !prev)}
          />
          E-Mail-Domain für diesen Import prüfen
        </label>

        {domainPruefungAktiv && (
          <div className="mt-2">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Erlaubte E-Mail-Domain
            </label>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">@</span>
              <input
                type="text"
                value={erlaubteDomain}
                onChange={(e) => setErlaubteDomain(e.target.value)}
                placeholder="meinedomain.com"
                className="w-full p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
              />
            </div>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Wenn aktiv, werden nur E-Mail-Adressen mit dieser Domain akzeptiert. Eingabe mit oder ohne @ möglich.
            </p>
          </div>
        )}
      </div>

      {firmaId && unitId && (
        <div className="mt-3 text-sm bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 p-2 rounded">
          Dieser Import wird gespeichert für: <strong>{firmaName}</strong> / <strong>{unitName}</strong>
          {domainPruefungAktiv && domainSoll && (
            <span className="block mt-1 text-amber-700 dark:text-amber-300">
              Domain-Prüfung aktiv: erlaubt ist <strong>@{domainSoll}</strong>
            </span>
          )}
        </div>
      )}

      {zeigeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-between py-2 px-4 border-b border-gray-300 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold">CSV-Prüfung Benutzerimport</h2>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Erst mit „OK, speichern“ werden Benutzer angelegt und Passwort-Mails verschickt.
                </p>

                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 font-medium">
                  Bitte prüfe die Daten nach dem Vier-Augen-Prinzip. Falsch angelegte Mitarbeiter können später großen Korrekturaufwand verursachen.
                </p>

                <p className="text-xl text-blue-700 dark:text-blue-300 mt-1">
                  Ziel: {firmaName} / {unitName}
                </p>

                {domainPruefungAktiv && domainSoll && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Domain-Prüfung aktiv: erlaubt ist @{domainSoll}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setZeigeModal(false)}
                disabled={speichert}
                className="text-gray-500 hover:text-red-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-4 py-2 flex gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-green-100 text-green-800 dark:text-green-500 px-3 py-2 rounded">
                <CheckCircle size={18} />
                Gültig: {okCount}
              </div>

              <div className="flex items-center gap-2 bg-red-100 text-red-800 px-3 py-2 rounded">
                <AlertTriangle size={18} />
                Fehler: {fehlerCount}
              </div>

              <div className="flex items-center gap-2 bg-amber-100 text-amber-800 px-3 py-2 rounded">
                <AlertTriangle size={18} />
                Hinweise: {hinweisCount}
              </div>

              {fehlerCount > 0 && (
                <div className="text-sm text-red-600 flex items-center">
                  Bitte korrigiere die CSV-Datei und lade sie erneut hoch.
                </div>
              )}
            </div>

            <div className="overflow-auto px-4 flex-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                    <th className="p-2 text-left">Zeile</th>
                    <th className="p-2 text-left">Vorname</th>
                    <th className="p-2 text-left">Nachname</th>
                    <th className="p-2 text-left">E-Mail</th>
                    <th className="p-2 text-left">Erkannte Rolle</th>
                    <th className="p-2 text-left">Funktion</th>
                    <th className="p-2 text-left">Personalnr.</th>
                    <th className="p-2 text-left">Telefon 1</th>
                    <th className="p-2 text-left">Telefon 2</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map(row => (
                    <tr
                      key={row.zeile}
                      className={`border-b border-gray-200 dark:border-gray-700 ${
                        row.fehler.length > 0
                          ? 'bg-red-500/40 dark:bg-red-900/40'
                          : row.hinweise?.length > 0
                            ? 'bg-amber-200/50 dark:bg-amber-900/30'
                            : 'bg-green-500/40 dark:bg-green-900/40'
                      }`}
                    >
                      <td className="p-2">{row.zeile}</td>
                      <td className="p-2">{row.vorname}</td>
                      <td className="p-2">{row.nachname}</td>
                      <td className="p-2">{row.email}</td>
                      <td className="p-2">{row.rolle || '–'}</td>
                      <td className="p-2">{row.funktion}</td>
                      <td className="p-2">{row.personal_nummer || '–'}</td>
                      <td className="p-2">{row.tel_number1 || '–'}</td>
                      <td className="p-2">{row.tel_number2 || '–'}</td>
                      <td className="p-2">
                        {row.fehler.length === 0 ? (
                          <div>
                            <span className="text-green-700 dark:text-green-300 font-semibold">
                              OK
                            </span>

                            {row.hinweise?.length > 0 && (
                              <div className="mt-1 text-amber-700 dark:text-amber-300">
                                {row.hinweise.map((h, i) => (
                                  <div key={i}>⚠️ {h}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="text-red-700 dark:text-red-300">
                              {row.fehler.map((f, i) => (
                                <div key={i}>• {f}</div>
                              ))}
                            </div>

                            {row.hinweise?.length > 0 && (
                              <div className="mt-1 text-amber-700 dark:text-amber-300">
                                {row.hinweise.map((h, i) => (
                                  <div key={i}>⚠️ {h}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-300 dark:border-gray-700">
              {statusText && (
                <div className="mb-3 text-sm bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 p-2 rounded">
                  {statusText}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setZeigeModal(false)}
                  disabled={speichert}
                  className="px-4 py-2 rounded bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-50"
                >
                  Abbrechen
                </button>

                <button
                  type="button"
                  onClick={speichern}
                  disabled={speichert || fehlerCount > 0 || okCount === 0}
                  className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  {speichert ? 'Speichert...' : 'OK, speichern & Mails senden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BenutzerCSVImport;