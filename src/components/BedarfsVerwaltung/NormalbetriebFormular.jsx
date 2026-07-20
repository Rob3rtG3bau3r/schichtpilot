import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Info, RotateCcw, Save } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const LEER = {
  Frueh: 0,
  Spaet: 0,
  Nacht: 0,
};

const WOCHENMODELLE = [
  { value: 'MO_FR', label: 'Montag bis Freitag' },
  { value: 'MO_FR_SA_F', label: 'Montag bis Freitag + Samstag Früh' },
  { value: 'MO_SA', label: 'Montag bis Samstag' },
  { value: 'MO_SO', label: 'Montag bis Sonntag' },
];

const zahl = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const sortiereQualifikationen = (a, b) => {
  const pa = Number(a.position ?? 9999);
  const pb = Number(b.position ?? 9999);

  if (pa === 0 && pb !== 0) return 1;
  if (pa !== 0 && pb === 0) return -1;
  if (pa !== pb) return pa - pb;

  return (a.qualifikation || '').localeCompare(
    b.qualifikation || '',
    'de'
  );
};

const NormalbetriebFormular = ({ onSaved }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const heute = dayjs().format('YYYY-MM-DD');

  const [qualifikationen, setQualifikationen] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [aktuelleVersion, setAktuelleVersion] = useState(null);

  const [name, setName] = useState('Normalbetrieb');
  const [gueltigAb, setGueltigAb] = useState(heute);
  const [betriebsmodus, setBetriebsmodus] = useState('24_7');
  const [wochenTage, setWochenTage] = useState('MO_FR');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [bestaetigungOffen, setBestaetigungOffen] = useState(false);
  const [bestaetigungsCode, setBestaetigungsCode] = useState('');
  const [codeEingabe, setCodeEingabe] = useState('');
  const [bestaetigungsFehler, setBestaetigungsFehler] = useState('');

  useEffect(() => {
    let aktiv = true;

    const lade = async () => {
      if (!firma || !unit) {
        if (aktiv) {
          setQualifikationen([]);
          setMatrix({});
          setAktuelleVersion(null);
        }
        return;
      }

      setLoading(true);
      setFeedback('');

      const [qualiResult, versionResult] = await Promise.all([
        supabase
          .from('DB_Qualifikationsmatrix')
          .select(`
            id,
            qualifikation,
            quali_kuerzel,
            position,
            betriebs_relevant,
            aktiv
          `)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('aktiv', true),

        supabase
          .from('DB_NormalbedarfVersion')
          .select(`
            id,
            name,
            gueltig_von,
            gueltig_bis,
            betriebsmodus,
            wochen_tage,
            aktiv
          `)
          .eq('firma_id', firma)
          .eq('unit_id', unit)
          .eq('aktiv', true)
          .is('gueltig_bis', null)
          .order('gueltig_von', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!aktiv) return;

      if (qualiResult.error || versionResult.error) {
        console.error(
          'Normalbetrieb laden fehlgeschlagen:',
          qualiResult.error?.message || versionResult.error?.message
        );
        setFeedback('Normalbetrieb konnte nicht geladen werden.');
        setLoading(false);
        return;
      }

      const qualis = [...(qualiResult.data || [])].sort(
        sortiereQualifikationen
      );
      const version = versionResult.data || null;

      const nextMatrix = {};
      qualis.forEach((quali) => {
        nextMatrix[quali.id] = { ...LEER };
      });

      if (version?.id) {
        const { data: rows, error: bedarfError } = await supabase
          .from('DB_Bedarf')
          .select('id, quali_id, schichtart, anzahl')
          .eq('normalbedarf_version_id', version.id);

        if (!aktiv) return;

        if (bedarfError) {
          console.error(
            'Normalbedarfszeilen laden fehlgeschlagen:',
            bedarfError.message
          );
          setFeedback('Die aktuelle Normalbedarfsmatrix konnte nicht geladen werden.');
          setLoading(false);
          return;
        }

        (rows || []).forEach((row) => {
          if (!nextMatrix[row.quali_id]) {
            nextMatrix[row.quali_id] = { ...LEER };
          }

          const anzahl = zahl(row.anzahl);

          if (row.schichtart === 'Früh') {
            nextMatrix[row.quali_id].Frueh += anzahl;
          } else if (row.schichtart === 'Spät') {
            nextMatrix[row.quali_id].Spaet += anzahl;
          } else if (row.schichtart === 'Nacht') {
            nextMatrix[row.quali_id].Nacht += anzahl;
          } else {
            nextMatrix[row.quali_id].Frueh += anzahl;
            nextMatrix[row.quali_id].Spaet += anzahl;
            nextMatrix[row.quali_id].Nacht += anzahl;
          }
        });
      }

      setQualifikationen(qualis);
      setMatrix(nextMatrix);
      setAktuelleVersion(version);

      setName(version?.name || 'Normalbetrieb');
      setBetriebsmodus(version?.betriebsmodus || '24_7');
      setWochenTage(version?.wochen_tage || 'MO_FR');

      const minStart = version?.gueltig_von
        ? dayjs(version.gueltig_von).add(1, 'day')
        : dayjs();

      setGueltigAb(
        minStart.isAfter(dayjs(), 'day')
          ? minStart.format('YYYY-MM-DD')
          : heute
      );

      setLoading(false);
    };

    lade();

    return () => {
      aktiv = false;
    };
  }, [firma, unit, heute]);

  const ausgefuellteQualifikationen = useMemo(() => {
    return qualifikationen.filter((quali) => {
      const werte = matrix[quali.id] || LEER;

      return (
        zahl(werte.Frueh) > 0 ||
        zahl(werte.Spaet) > 0 ||
        zahl(werte.Nacht) > 0
      );
    });
  }, [qualifikationen, matrix]);

  const anzahlDbZeilen = useMemo(() => {
    return ausgefuellteQualifikationen.reduce((summe, quali) => {
      const werte = matrix[quali.id] || LEER;

      return (
        summe +
        (zahl(werte.Frueh) > 0 ? 1 : 0) +
        (zahl(werte.Spaet) > 0 ? 1 : 0) +
        (zahl(werte.Nacht) > 0 ? 1 : 0)
      );
    }, 0);
  }, [ausgefuellteQualifikationen, matrix]);

  const minGueltigAb = useMemo(() => {
    if (!aktuelleVersion?.gueltig_von) return heute;

    const morgenNachVersionsstart = dayjs(aktuelleVersion.gueltig_von)
      .add(1, 'day')
      .format('YYYY-MM-DD');

    return dayjs(morgenNachVersionsstart).isAfter(dayjs(heute), 'day')
      ? morgenNachVersionsstart
      : heute;
  }, [aktuelleVersion, heute]);

  const handleMatrixChange = (qualiId, feld, value) => {
    setMatrix((prev) => ({
      ...prev,
      [qualiId]: {
        ...(prev[qualiId] || LEER),
        [feld]: Math.max(0, Number(value || 0)),
      },
    }));
  };

  const handleAufAlle = (qualiId) => {
    const werte = matrix[qualiId] || LEER;
    const basis =
      zahl(werte.Frueh) ||
      zahl(werte.Spaet) ||
      zahl(werte.Nacht) ||
      0;

    setMatrix((prev) => ({
      ...prev,
      [qualiId]: {
        Frueh: basis,
        Spaet: basis,
        Nacht: basis,
      },
    }));
  };

  const handleZeileLeeren = (qualiId) => {
    setMatrix((prev) => ({
      ...prev,
      [qualiId]: { ...LEER },
    }));
  };

  const validate = () => {
    if (!firma || !unit) return 'Firma oder Unit ist nicht ausgewählt.';
    if (!name.trim()) return 'Bitte eine Bezeichnung eingeben.';
    if (!gueltigAb) return 'Bitte ein Gültig-ab-Datum angeben.';

    if (
      aktuelleVersion?.gueltig_von &&
      !dayjs(gueltigAb).isAfter(
        dayjs(aktuelleVersion.gueltig_von),
        'day'
      )
    ) {
      return 'Die neue Version muss nach dem Start der aktuellen Version beginnen.';
    }

    if (
      betriebsmodus === 'wochenbetrieb' &&
      !wochenTage
    ) {
      return 'Bitte ein Wochenmodell auswählen.';
    }

    if (ausgefuellteQualifikationen.length === 0) {
      return 'Bitte mindestens eine Qualifikation mit Bedarf größer 0 eintragen.';
    }

    return '';
  };

  const buildPositionen = () => {
    return ausgefuellteQualifikationen.map((quali) => {
      const werte = matrix[quali.id] || LEER;

      return {
        quali_id: quali.id,
        anzahl_frueh: zahl(werte.Frueh),
        anzahl_spaet: zahl(werte.Spaet),
        anzahl_nacht: zahl(werte.Nacht),
      };
    });
  };

  const handleSpeichernVorbereiten = () => {
    setFeedback('');

    const fehler = validate();
    if (fehler) {
      setFeedback(fehler);
      return;
    }

    setBestaetigungsCode(
      String(Math.floor(1000 + Math.random() * 9000))
    );
    setCodeEingabe('');
    setBestaetigungsFehler('');
    setBestaetigungOffen(true);
  };

  const handleVerbindlichSpeichern = async () => {
    if (codeEingabe.trim() !== bestaetigungsCode) {
      setBestaetigungsFehler(
        'Die eingegebene Zahl stimmt nicht mit dem Bestätigungscode überein.'
      );
      return;
    }

    setSaving(true);
    setBestaetigungsFehler('');

    const { data, error } = await supabase.rpc(
      'normalbedarf_neue_version',
      {
        p_firma_id: Number(firma),
        p_unit_id: Number(unit),
        p_name: name.trim(),
        p_gueltig_von: gueltigAb,
        p_betriebsmodus: betriebsmodus,
        p_wochen_tage:
          betriebsmodus === 'wochenbetrieb'
            ? wochenTage
            : null,
        p_positionen: buildPositionen(),
      }
    );

    if (error) {
      console.error(
        'Neue Normalbedarf-Version speichern fehlgeschlagen:',
        error
      );
      setBestaetigungsFehler(
        `Fehler beim Speichern: ${error.message}`
      );
      setSaving(false);
      return;
    }

    setBestaetigungOffen(false);
    setBestaetigungsCode('');
    setCodeEingabe('');

    setFeedback(
      `Neue Normalbedarfs-Version ab ${dayjs(gueltigAb).format(
        'DD.MM.YYYY'
      )} erfolgreich gespeichert.`
    );

    setSaving(false);

    onSaved?.({
      versionId: data,
      gueltigAb,
      anzahlQualifikationen: ausgefuellteQualifikationen.length,
      anzahlDbZeilen,
    });
  };

  return (
    <div className="relative rounded-xl border border-gray-300 bg-white/60 p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            Normalbetrieb
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Aktuelle Matrix übernehmen, anpassen und als neue Version speichern
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen zur Versionierung"
        >
          <Info size={20} />
        </button>
      </div>

      {aktuelleVersion && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
          <div className="font-medium">
            Aktuelle Version: {aktuelleVersion.name}
          </div>
          <div className="mt-1 text-xs">
            Gültig seit{' '}
            {dayjs(aktuelleVersion.gueltig_von).format('DD.MM.YYYY')}
            {aktuelleVersion.gueltig_bis
              ? ` bis ${dayjs(aktuelleVersion.gueltig_bis).format(
                  'DD.MM.YYYY'
                )}`
              : ' · aktuell offen'}
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Bezeichnung
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Neue Version gültig ab
          </label>
          <input
            type="date"
            value={gueltigAb}
            min={minGueltigAb}
            onChange={(event) => setGueltigAb(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Betriebsmodus
          </label>
          <select
            value={betriebsmodus}
            onChange={(event) =>
              setBetriebsmodus(event.target.value)
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="24_7">24/7-Betrieb</option>
            <option value="wochenbetrieb">Wochenbetrieb</option>
          </select>
        </div>

        {betriebsmodus === 'wochenbetrieb' && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              Wochenmodell
            </label>
            <select
              value={wochenTage}
              onChange={(event) => setWochenTage(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
              {WOCHENMODELLE.map((modell) => (
                <option key={modell.value} value={modell.value}>
                  {modell.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-100 px-3 py-2 dark:bg-gray-800">
          <div>
            <h3 className="text-sm font-semibold">
              Normalbedarfsmatrix
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Die aktuelle Matrix dient als Ausgangspunkt
            </p>
          </div>

          <span className="text-xs text-gray-600 dark:text-gray-300">
            {ausgefuellteQualifikationen.length} Qualifikation(en) ·{' '}
            {anzahlDbZeilen} Einträge
          </span>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-500">
            Normalbetrieb wird geladen…
          </div>
        ) : (
          <div className="max-h-[620px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="min-w-[220px] px-3 py-2 text-left">
                    Qualifikation
                  </th>
                  <th className="w-24 px-2 py-2 text-center">Früh</th>
                  <th className="w-24 px-2 py-2 text-center">Spät</th>
                  <th className="w-24 px-2 py-2 text-center">Nacht</th>
                  <th className="min-w-[145px] px-2 py-2 text-center">
                    Aktionen
                  </th>
                </tr>
              </thead>

              <tbody>
                {qualifikationen.map((quali) => {
                  const werte = matrix[quali.id] || LEER;
                  const hatWert =
                    zahl(werte.Frueh) > 0 ||
                    zahl(werte.Spaet) > 0 ||
                    zahl(werte.Nacht) > 0;

                  return (
                    <tr
                      key={quali.id}
                      className={`border-t border-gray-200 dark:border-gray-700 ${
                        hatWert
                          ? 'bg-blue-50/70 dark:bg-blue-950/20'
                          : 'bg-white/40 dark:bg-gray-900/20'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex min-w-12 justify-center rounded-md bg-gray-200 px-2 py-1 text-xs font-bold dark:bg-gray-700">
                            {quali.quali_kuerzel || '—'}
                          </span>

                          <div>
                            <div className="font-medium">
                              {quali.qualifikation}
                            </div>
                            {quali.betriebs_relevant && (
                              <div className="text-xs text-green-600 dark:text-green-400">
                                Betriebsrelevant
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {[
                        ['Frueh', 'Früh'],
                        ['Spaet', 'Spät'],
                        ['Nacht', 'Nacht'],
                      ].map(([feld, label]) => (
                        <td key={feld} className="px-2 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={werte[feld] ?? 0}
                            aria-label={`${quali.qualifikation} ${label}`}
                            onChange={(event) =>
                              handleMatrixChange(
                                quali.id,
                                feld,
                                event.target.value
                              )
                            }
                            className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-center dark:border-gray-600 dark:bg-gray-800"
                          />
                        </td>
                      ))}

                      <td className="px-2 py-2">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAufAlle(quali.id)}
                            className="rounded-lg bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                          >
                            Auf alle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleZeileLeeren(quali.id)}
                            className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                            title="Zeile leeren"
                          >
                            <RotateCcw size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            feedback.toLowerCase().includes('erfolgreich')
              ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
              : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSpeichernVorbereiten}
          disabled={saving || loading || qualifikationen.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={17} />
          {saving
            ? 'Neue Version wird gespeichert…'
            : `Neue Version prüfen (${anzahlDbZeilen})`}
        </button>
      </div>

      {bestaetigungOffen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!saving) {
              setBestaetigungOffen(false);
              setBestaetigungsFehler('');
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              Neue Normalbedarfs-Version bestätigen
            </h3>

            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="font-medium">
                Diese Änderung wirkt sich auf die Bedarfsbewertung ab dem gewählten Datum aus.
              </p>

              <div className="mt-3 space-y-1">
                <div><span className="font-medium">Neue Version:</span> {name.trim()}</div>
                <div><span className="font-medium">Gültig ab:</span> {dayjs(gueltigAb).format('DD.MM.YYYY')}</div>
                {aktuelleVersion && (
                  <div>
                    <span className="font-medium">Bisherige Version endet:</span>{' '}
                    {dayjs(gueltigAb).subtract(1, 'day').format('DD.MM.YYYY')}
                  </div>
                )}
                <div><span className="font-medium">Qualifikationen:</span> {ausgefuellteQualifikationen.length}</div>
                <div><span className="font-medium">Bedarfszeilen:</span> {anzahlDbZeilen}</div>
                <div>
                  <span className="font-medium">Betriebsmodus:</span>{' '}
                  {betriebsmodus === '24_7'
                    ? '24/7-Betrieb'
                    : `Wochenbetrieb · ${wochenTage}`}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium">
                Bitte zur Bestätigung die Zahl{' '}
                <span className="rounded bg-gray-200 px-2 py-1 font-mono text-base dark:bg-gray-700">
                  {bestaetigungsCode}
                </span>{' '}
                eingeben
              </label>

              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={codeEingabe}
                onChange={(event) => {
                  setCodeEingabe(
                    event.target.value.replace(/\D/g, '').slice(0, 4)
                  );
                  setBestaetigungsFehler('');
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === 'Enter' &&
                    codeEingabe.trim() === bestaetigungsCode &&
                    !saving
                  ) {
                    handleVerbindlichSpeichern();
                  }
                }}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center font-mono text-xl tracking-[0.35em] dark:border-gray-600 dark:bg-gray-900"
                placeholder="0000"
              />
            </div>

            {bestaetigungsFehler && (
              <div className="mt-3 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-300">
                {bestaetigungsFehler}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setBestaetigungOffen(false);
                  setBestaetigungsFehler('');
                }}
                className="rounded-lg bg-gray-200 px-4 py-2 text-gray-900 hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                Abbrechen
              </button>

              <button
                type="button"
                disabled={saving || codeEingabe.trim() !== bestaetigungsCode}
                onClick={handleVerbindlichSpeichern}
                className="rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? 'Wird verbindlich gespeichert…'
                  : 'Neue Version verbindlich speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {infoOffen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-semibold">
              Versionierter Normalbetrieb
            </h3>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <p>
                Die aktuell gültige Bedarfsmatrix wird als Ausgangspunkt
                geladen.
              </p>
              <p>
                Änderungen werden nicht rückwirkend in die alte Version
                geschrieben. Stattdessen entsteht ab dem gewählten Datum eine
                neue vollständige Version.
              </p>
              <p>
                Die bisherige Version endet automatisch am Vortag. Dadurch
                bleiben frühere Dienstpläne mit dem damals gültigen Bedarf
                nachvollziehbar.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setInfoOffen(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalbetriebFormular;
