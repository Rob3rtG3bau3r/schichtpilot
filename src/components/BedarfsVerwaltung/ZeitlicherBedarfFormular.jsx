import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Info, Save, RotateCcw } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const leereWerte = {
  Frueh: 0,
  Spaet: 0,
  Nacht: 0,
};

const normalisiereZahl = (value) => {
  const zahl = Number(value);
  if (!Number.isFinite(zahl) || zahl < 0) return 0;
  return zahl;
};

const sortiereQualifikationen = (a, b) => {
  const positionA = Number(a.position ?? 9999);
  const positionB = Number(b.position ?? 9999);

  const aIstNull = positionA === 0;
  const bIstNull = positionB === 0;

  if (aIstNull && !bIstNull) return 1;
  if (!aIstNull && bIstNull) return -1;
  if (positionA !== positionB) return positionA - positionB;

  return (a.qualifikation || '').localeCompare(
    b.qualifikation || '',
    'de'
  );
};

const ZeitlicherBedarfFormular = ({ vorlage, onSaved }) => {
  const {
    sichtFirma: firma,
    sichtUnit: unit,
    userId,
  } = useRollen();

  const heute = dayjs().format('YYYY-MM-DD');

  const [qualifikationen, setQualifikationen] = useState([]);
  const [matrix, setMatrix] = useState({});

  const [namebedarf, setNamebedarf] = useState('');
  const [farbe, setFarbe] = useState('#3b82f6');
  const [von, setVon] = useState(heute);
  const [bis, setBis] = useState(
    dayjs(heute).add(1, 'day').format('YYYY-MM-DD')
  );
  const [startSchicht, setStartSchicht] = useState('Früh');
  const [endSchicht, setEndSchicht] = useState('Nacht');

  const [alsVorlageSpeichern, setAlsVorlageSpeichern] = useState(false);
  const [vorlageName, setVorlageName] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    let aktiv = true;

    const ladeQualifikationen = async () => {
      if (!firma || !unit) {
        if (aktiv) {
          setQualifikationen([]);
          setMatrix({});
        }
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
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
        .eq('aktiv', true);

      if (!aktiv) return;

      if (error) {
        console.error(
          'Fehler beim Laden der Qualifikationen:',
          error.message
        );
        setQualifikationen([]);
        setMatrix({});
        setFeedback('Qualifikationen konnten nicht geladen werden.');
        setLoading(false);
        return;
      }

      const sortiert = [...(data || [])].sort(sortiereQualifikationen);

      const initialMatrix = {};
      sortiert.forEach((quali) => {
        initialMatrix[quali.id] = { ...leereWerte };
      });

      setQualifikationen(sortiert);
      setMatrix(initialMatrix);
      setLoading(false);
    };

    ladeQualifikationen();

    return () => {
      aktiv = false;
    };
  }, [firma, unit]);

  useEffect(() => {
    if (!vorlage || qualifikationen.length === 0) return;

    const nextMatrix = {};
    qualifikationen.forEach((quali) => {
      nextMatrix[quali.id] = { ...leereWerte };
    });

    (vorlage.positionen || []).forEach((position) => {
      if (!nextMatrix[position.quali_id]) return;

      nextMatrix[position.quali_id] = {
        Frueh: normalisiereZahl(position.anzahl_frueh),
        Spaet: normalisiereZahl(position.anzahl_spaet),
        Nacht: normalisiereZahl(position.anzahl_nacht),
      };
    });

    setMatrix(nextMatrix);
    setNamebedarf(vorlage.namebedarf || vorlage.vorlage_name || '');
    setFarbe(vorlage.farbe || '#3b82f6');
    setStartSchicht(vorlage.start_schicht || 'Früh');
    setEndSchicht(vorlage.end_schicht || 'Nacht');

    // Der konkrete Einsatzzeitraum gehört nicht zur Vorlage.
    setVon(heute);
    setBis(dayjs(heute).add(1, 'day').format('YYYY-MM-DD'));

    // Geladene Vorlage nicht automatisch erneut als neue Vorlage speichern.
    setAlsVorlageSpeichern(false);
    setVorlageName('');
    setFeedback(
      `Vorlage „${vorlage.vorlage_name || vorlage.namebedarf}“ wurde geladen. Bitte Zeitraum prüfen.`
    );
  }, [vorlage, qualifikationen, heute]);

  const ausgefuellteQualifikationen = useMemo(() => {
    return qualifikationen.filter((quali) => {
      const werte = matrix[quali.id] || leereWerte;

      return (
        normalisiereZahl(werte.Frueh) > 0 ||
        normalisiereZahl(werte.Spaet) > 0 ||
        normalisiereZahl(werte.Nacht) > 0
      );
    });
  }, [qualifikationen, matrix]);

  const anzahlDbZeilen = useMemo(() => {
    return ausgefuellteQualifikationen.reduce((summe, quali) => {
      const werte = matrix[quali.id] || leereWerte;

      return (
        summe +
        (normalisiereZahl(werte.Frueh) > 0 ? 1 : 0) +
        (normalisiereZahl(werte.Spaet) > 0 ? 1 : 0) +
        (normalisiereZahl(werte.Nacht) > 0 ? 1 : 0)
      );
    }, 0);
  }, [ausgefuellteQualifikationen, matrix]);

  const handleVonChange = (value) => {
    setVon(value);

    if (!value) return;

    setBis((aktuell) => {
      if (!aktuell || dayjs(aktuell).isBefore(dayjs(value), 'day')) {
        return value;
      }

      return aktuell;
    });
  };

  const handleMatrixChange = (qualiId, feld, value) => {
    setMatrix((aktuell) => ({
      ...aktuell,
      [qualiId]: {
        ...(aktuell[qualiId] || leereWerte),
        [feld]: normalisiereZahl(value),
      },
    }));
  };

  const handleAufAlleSchichten = (qualiId) => {
    const aktuell = matrix[qualiId] || leereWerte;

    const ausgangswert =
      normalisiereZahl(aktuell.Frueh) ||
      normalisiereZahl(aktuell.Spaet) ||
      normalisiereZahl(aktuell.Nacht) ||
      0;

    setMatrix((prev) => ({
      ...prev,
      [qualiId]: {
        Frueh: ausgangswert,
        Spaet: ausgangswert,
        Nacht: ausgangswert,
      },
    }));
  };

  const handleZeileLeeren = (qualiId) => {
    setMatrix((prev) => ({
      ...prev,
      [qualiId]: { ...leereWerte },
    }));
  };

  const resetFormular = () => {
    const resetMatrix = {};

    qualifikationen.forEach((quali) => {
      resetMatrix[quali.id] = { ...leereWerte };
    });

    setMatrix(resetMatrix);
    setNamebedarf('');
    setFarbe('#3b82f6');
    setVon(heute);
    setBis(dayjs(heute).add(1, 'day').format('YYYY-MM-DD'));
    setStartSchicht('Früh');
    setEndSchicht('Nacht');
    setAlsVorlageSpeichern(false);
    setVorlageName('');
    setFeedback('');
  };

  const validate = () => {
    if (!firma || !unit) {
      return 'Firma oder Unit ist nicht ausgewählt.';
    }

    if (!namebedarf.trim()) {
      return 'Bitte eine Bezeichnung für den zeitlichen Bedarf eingeben.';
    }

    if (!von || !bis) {
      return 'Bitte Von- und Bis-Datum angeben.';
    }

    if (dayjs(bis).isBefore(dayjs(von), 'day')) {
      return '„Bis“ darf nicht vor „Von“ liegen.';
    }

    if (ausgefuellteQualifikationen.length === 0) {
      return 'Bitte bei mindestens einer Qualifikation einen Bedarf eintragen.';
    }

    if (alsVorlageSpeichern && !vorlageName.trim()) {
      return 'Bitte einen Namen für die vollständige Vorlage eingeben.';
    }

    return '';
  };

  const buildPayload = () => {
    const gemeinsameDaten = {
      firma_id: firma,
      unit_id: unit,
      created_by: userId,
      normalbetrieb: false,
      betriebsmodus: null,
      wochen_tage: null,
      von,
      bis,
      namebedarf: namebedarf.trim(),
      farbe,
      start_schicht: startSchicht,
      end_schicht: endSchicht,
    };

    return qualifikationen.flatMap((quali) => {
      const werte = matrix[quali.id] || leereWerte;
      const rows = [];

      const frueh = normalisiereZahl(werte.Frueh);
      const spaet = normalisiereZahl(werte.Spaet);
      const nacht = normalisiereZahl(werte.Nacht);

      if (frueh > 0) {
        rows.push({
          ...gemeinsameDaten,
          quali_id: quali.id,
          schichtart: 'Früh',
          anzahl: frueh,
        });
      }

      if (spaet > 0) {
        rows.push({
          ...gemeinsameDaten,
          quali_id: quali.id,
          schichtart: 'Spät',
          anzahl: spaet,
        });
      }

      if (nacht > 0) {
        rows.push({
          ...gemeinsameDaten,
          quali_id: quali.id,
          schichtart: 'Nacht',
          anzahl: nacht,
        });
      }

      return rows;
    });
  };

  const buildVorlagenPositionen = (vorlageId) => {
    return ausgefuellteQualifikationen.map((quali, index) => {
      const werte = matrix[quali.id] || leereWerte;

      return {
        vorlage_id: vorlageId,
        firma_id: firma,
        unit_id: unit,
        quali_id: quali.id,
        anzahl_frueh: normalisiereZahl(werte.Frueh),
        anzahl_spaet: normalisiereZahl(werte.Spaet),
        anzahl_nacht: normalisiereZahl(werte.Nacht),
        position: quali.position ?? index + 1,
      };
    });
  };

  const loescheVorlageAlsRollback = async (vorlageId) => {
    if (!vorlageId) return;

    const { error } = await supabase
      .from('DB_BedarfVorlage')
      .delete()
      .eq('id', vorlageId)
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    if (error) {
      console.error(
        'Rollback der Bedarfsvorlage fehlgeschlagen:',
        error.message
      );
    }
  };

  const handleSpeichern = async () => {
    setFeedback('');

    const fehler = validate();
    if (fehler) {
      setFeedback(fehler);
      return;
    }

    const payload = buildPayload();
    let angelegteVorlageId = null;

    setSaving(true);

    try {
      if (alsVorlageSpeichern) {
        const { data: vorlage, error: vorlageError } = await supabase
          .from('DB_BedarfVorlage')
          .insert({
            created_by: userId,
            firma_id: firma,
            unit_id: unit,
            vorlage_name: vorlageName.trim(),
            namebedarf: namebedarf.trim(),
            farbe,
            start_schicht: startSchicht,
            end_schicht: endSchicht,
            aktiv: true,
            position: 0,
          })
          .select('id')
          .single();

        if (vorlageError || !vorlage?.id) {
          throw new Error(
            `Vorlagenkopf konnte nicht gespeichert werden: ${
              vorlageError?.message || 'Keine Vorlagen-ID erhalten'
            }`
          );
        }

        angelegteVorlageId = vorlage.id;

        const positionen = buildVorlagenPositionen(angelegteVorlageId);

        const { error: positionenError } = await supabase
          .from('DB_BedarfVorlagePosition')
          .insert(positionen);

        if (positionenError) {
          await loescheVorlageAlsRollback(angelegteVorlageId);
          angelegteVorlageId = null;

          throw new Error(
            `Vorlagenpositionen konnten nicht gespeichert werden: ${positionenError.message}`
          );
        }
      }

      const { error: bedarfError } = await supabase
        .from('DB_Bedarf')
        .insert(payload);

      if (bedarfError) {
        if (angelegteVorlageId) {
          await loescheVorlageAlsRollback(angelegteVorlageId);
          angelegteVorlageId = null;
        }

        throw new Error(
          `Zeitlicher Bedarf konnte nicht gespeichert werden: ${bedarfError.message}`
        );
      }

      const vorlagenHinweis = alsVorlageSpeichern
        ? ` Die vollständige Vorlage „${vorlageName.trim()}“ wurde ebenfalls gespeichert.`
        : '';

      setFeedback(
        `Zeitlicher Bedarf mit ${ausgefuellteQualifikationen.length} Qualifikation(en) erfolgreich gespeichert.${vorlagenHinweis}`
      );

      onSaved?.({
        namebedarf: namebedarf.trim(),
        von,
        bis,
        anzahlQualifikationen: ausgefuellteQualifikationen.length,
        anzahlDbZeilen: payload.length,
        vorlageGespeichert: alsVorlageSpeichern,
        vorlageId: angelegteVorlageId,
      });

      const resetMatrix = {};
      qualifikationen.forEach((quali) => {
        resetMatrix[quali.id] = { ...leereWerte };
      });

      setMatrix(resetMatrix);
      setNamebedarf('');
      setAlsVorlageSpeichern(false);
      setVorlageName('');
    } catch (error) {
      console.error('Fehler beim Gesamtspeichern:', error);
      setFeedback(
        `Fehler beim Speichern: ${error?.message || 'Unbekannter Fehler'}`
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl bg-white/60 dark:bg-gray-900/40">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold">
            Zeitlichen Bedarf erstellen
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Alle Qualifikationen zusammenstellen und anschließend gemeinsam
            speichern
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen zur Bedarfserfassung"
        >
          <Info size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
        <div className="xl:col-span-2">
          <label className="block text-sm font-medium mb-1">
            Bezeichnung
          </label>
          <input
            type="text"
            value={namebedarf}
            onChange={(event) => setNamebedarf(event.target.value)}
            placeholder="z. B. Revision Anlage 4"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Von</label>
          <input
            type="date"
            value={von}
            min={heute}
            onChange={(event) => handleVonChange(event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bis</label>
          <input
            type="date"
            value={bis}
            min={von || heute}
            onChange={(event) => setBis(event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Startschicht
          </label>
          <select
            value={startSchicht}
            onChange={(event) => setStartSchicht(event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="Früh">Früh</option>
            <option value="Spät">Spät</option>
            <option value="Nacht">Nacht</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Endschicht
          </label>
          <select
            value={endSchicht}
            onChange={(event) => setEndSchicht(event.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="Früh">Früh</option>
            <option value="Spät">Spät</option>
            <option value="Nacht">Nacht</option>
          </select>
        </div>

        <div className="xl:col-span-2">
          <label className="block text-sm font-medium mb-1">Farbe</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={farbe}
              onChange={(event) => setFarbe(event.target.value)}
              className="h-10 w-14 rounded border border-gray-300 dark:border-gray-600 bg-transparent"
            />
            <div
              className="h-10 flex-1 rounded-lg border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: farbe }}
              title={farbe}
            />
          </div>
        </div>
      </div>

      <div className="border border-gray-300 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800">
          <div>
            <h3 className="font-semibold text-sm">Bedarfsmatrix</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Nur Werte größer 0 werden gespeichert
            </p>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300">
            {ausgefuellteQualifikationen.length} Qualifikation(en) ·{' '}
            {anzahlDbZeilen} Einträge
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-500">
            Qualifikationen werden geladen…
          </div>
        ) : qualifikationen.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 italic">
            Keine aktiven Qualifikationen gefunden.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="text-left px-3 py-2 min-w-[220px]">
                    Qualifikation
                  </th>
                  <th className="text-center px-2 py-2 w-24">Früh</th>
                  <th className="text-center px-2 py-2 w-24">Spät</th>
                  <th className="text-center px-2 py-2 w-24">Nacht</th>
                  <th className="text-center px-2 py-2 min-w-[150px]">
                    Aktionen
                  </th>
                </tr>
              </thead>

              <tbody>
                {qualifikationen.map((quali) => {
                  const werte = matrix[quali.id] || leereWerte;
                  const hatWert =
                    normalisiereZahl(werte.Frueh) > 0 ||
                    normalisiereZahl(werte.Spaet) > 0 ||
                    normalisiereZahl(werte.Nacht) > 0;

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
                          <span className="inline-flex min-w-12 justify-center rounded-md bg-gray-200 dark:bg-gray-700 px-2 py-1 text-xs font-bold">
                            {quali.quali_kuerzel || '—'}
                          </span>

                          <div className="min-w-0">
                            <div className="font-medium truncate">
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
                            aria-label={`${quali.qualifikation} ${label}`}
                            value={werte[feld]}
                            onChange={(event) =>
                              handleMatrixChange(
                                quali.id,
                                feld,
                                event.target.value
                              )
                            }
                            className="w-20 px-2 py-1 text-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          />
                        </td>
                      ))}

                      <td className="px-2 py-2">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAufAlleSchichten(quali.id)}
                            className="px-2 py-1 rounded-lg text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
                            title="Ersten vorhandenen Wert auf alle Schichten übernehmen"
                          >
                            Auf alle
                          </button>

                          <button
                            type="button"
                            onClick={() => handleZeileLeeren(quali.id)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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

      <div className="mt-4 rounded-xl border border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={alsVorlageSpeichern}
            onChange={(event) => {
              setAlsVorlageSpeichern(event.target.checked);

              if (!event.target.checked) {
                setVorlageName('');
              }
            }}
            className="mt-1 h-4 w-4"
          />

          <div>
            <div className="text-sm font-medium">
              Vollständigen Bedarf zusätzlich als Vorlage speichern
            </div>
            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Gespeichert werden die Grunddaten und die komplette ausgefüllte
              Bedarfsmatrix. Der konkrete Zeitraum gehört nicht zur Vorlage.
            </div>
          </div>
        </label>

        {alsVorlageSpeichern && (
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium">
              Vorlagenname
            </label>
            <input
              type="text"
              value={vorlageName}
              onChange={(event) => setVorlageName(event.target.value)}
              placeholder="z. B. Revision Vollbetrieb"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-4 rounded-lg px-3 py-2 text-sm ${
            feedback.toLowerCase().includes('erfolgreich')
              ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
              : feedback.toLowerCase().includes('wurde geladen')
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
          }`}
        >
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <button
          type="button"
          onClick={resetFormular}
          disabled={saving}
          className="px-3 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          Zurücksetzen
        </button>

        <button
          type="button"
          onClick={handleSpeichern}
          disabled={saving || loading || qualifikationen.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={17} />
          {saving
            ? 'Wird gespeichert…'
            : `Gesamt speichern (${anzahlDbZeilen})`}
        </button>
      </div>

      {infoOffen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">
              Zeitlichen Bedarf gemeinsam erfassen
            </h3>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <p>
                Zuerst werden Bezeichnung, Zeitraum und Schichtgrenzen
                festgelegt.
              </p>
              <p>
                Danach wird der komplette Bedarf für alle Qualifikationen in
                der Matrix zusammengestellt.
              </p>
              <p>
                Erst mit „Gesamt speichern“ werden alle Werte gemeinsam in der
                Bedarfstabelle angelegt. Felder mit 0 werden ignoriert.
              </p>
              <p>
                Die vollständige Matrix ist später auch die Grundlage für eine
                komplette Bedarfsvorlage.
              </p>
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
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

export default ZeitlicherBedarfFormular;
