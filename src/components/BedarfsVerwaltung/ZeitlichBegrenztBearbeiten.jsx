import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { RotateCcw, Save, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const LEER = {
  Frueh: 0,
  Spaet: 0,
  Nacht: 0,
};

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

const blockMatchAusEintrag = (eintrag, firma, unit) => ({
  firma_id: Number(firma),
  unit_id: Number(unit),
  normalbetrieb: false,
  von: eintrag.von,
  bis: eintrag.bis,
  namebedarf: eintrag.namebedarf,
  start_schicht: eintrag.start_schicht || 'Früh',
  end_schicht: eintrag.end_schicht || 'Nacht',
});

const ZeitlichBegrenztBearbeiten = ({
  eintrag,
  refreshKey,
  onSaved,
  onClose,
}) => {
  const {
    sichtFirma: firma,
    sichtUnit: unit,
    userId,
  } = useRollen();

  const [qualifikationen, setQualifikationen] = useState([]);
  const [bestehendeRows, setBestehendeRows] = useState([]);
  const [matrix, setMatrix] = useState({});

  const [namebedarf, setNamebedarf] = useState('');
  const [farbe, setFarbe] = useState('#3b82f6');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [startSchicht, setStartSchicht] = useState('Früh');
  const [endSchicht, setEndSchicht] = useState('Nacht');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!eintrag) {
      setQualifikationen([]);
      setBestehendeRows([]);
      setMatrix({});
      setFeedback('');
      return;
    }

    setNamebedarf(eintrag.namebedarf || '');
    setFarbe(eintrag.farbe || '#3b82f6');
    setVon(eintrag.von || '');
    setBis(eintrag.bis || '');
    setStartSchicht(eintrag.start_schicht || 'Früh');
    setEndSchicht(eintrag.end_schicht || 'Nacht');
    setFeedback('');
  }, [eintrag]);

  useEffect(() => {
    let aktiv = true;

    const lade = async () => {
      if (!eintrag || !firma || !unit) return;

      setLoading(true);

      const [qualiResult, bedarfResult] = await Promise.all([
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
          .from('DB_Bedarf')
          .select('id, quali_id, schichtart, anzahl')
          .match(blockMatchAusEintrag(eintrag, firma, unit)),
      ]);

      if (!aktiv) return;

      if (qualiResult.error || bedarfResult.error) {
        console.error(
          'Zeitlichen Bedarf laden fehlgeschlagen:',
          qualiResult.error?.message || bedarfResult.error?.message
        );
        setQualifikationen([]);
        setBestehendeRows([]);
        setMatrix({});
        setFeedback('Der zeitliche Bedarf konnte nicht geladen werden.');
        setLoading(false);
        return;
      }

      const qualis = [...(qualiResult.data || [])].sort(
        sortiereQualifikationen
      );
      const rows = bedarfResult.data || [];
      const nextMatrix = {};

      qualis.forEach((quali) => {
        nextMatrix[quali.id] = { ...LEER };
      });

      rows.forEach((row) => {
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

      setQualifikationen(qualis);
      setBestehendeRows(rows);
      setMatrix(nextMatrix);
      setLoading(false);
    };

    lade();

    return () => {
      aktiv = false;
    };
  }, [eintrag, firma, unit, refreshKey]);

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
    if (!eintrag) return 'Kein zeitlicher Bedarf ausgewählt.';
    if (!namebedarf.trim()) return 'Bitte eine Bezeichnung eingeben.';
    if (!von || !bis) return 'Bitte Von und Bis angeben.';
    if (dayjs(bis).isBefore(dayjs(von), 'day')) {
      return '„Bis“ darf nicht vor „Von“ liegen.';
    }
    if (ausgefuellteQualifikationen.length === 0) {
      return 'Mindestens eine Qualifikation muss einen Bedarf größer 0 haben.';
    }

    return '';
  };

  const neuerBlock = () => ({
    firma_id: Number(firma),
    unit_id: Number(unit),
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
  });

  const handleSpeichern = async () => {
    setFeedback('');

    const fehler = validate();
    if (fehler) {
      setFeedback(fehler);
      return;
    }

    setSaving(true);

    try {
      const alterBlock = blockMatchAusEintrag(eintrag, firma, unit);
      const neuerKopf = neuerBlock();

      /*
       * Jede vorhandene Zeile wird anhand von Qualifikation und Schicht
       * aktualisiert, gelöscht oder ergänzt. Dadurch bleibt der Block auch
       * dann erhalten, wenn sich Name oder Zeitraum ändern.
       */
      const existing = new Map();

      bestehendeRows.forEach((row) => {
        const slot =
          row.schichtart === 'Früh'
            ? 'Frueh'
            : row.schichtart === 'Spät'
              ? 'Spaet'
              : row.schichtart === 'Nacht'
                ? 'Nacht'
                : 'Alle';

        existing.set(`${row.quali_id}|${slot}`, row);
      });

      const aufgaben = [];

      for (const quali of qualifikationen) {
        const werte = matrix[quali.id] || LEER;
        const ziel = {
          Frueh: zahl(werte.Frueh),
          Spaet: zahl(werte.Spaet),
          Nacht: zahl(werte.Nacht),
        };

        const allRow = existing.get(`${quali.id}|Alle`);

        if (allRow) {
          aufgaben.push(
            supabase
              .from('DB_Bedarf')
              .delete()
              .match({ id: allRow.id, ...alterBlock })
          );
        }

        for (const [slot, schichtart] of [
          ['Frueh', 'Früh'],
          ['Spaet', 'Spät'],
          ['Nacht', 'Nacht'],
        ]) {
          const existingRow = existing.get(`${quali.id}|${slot}`);
          const zielAnzahl = ziel[slot];

          if (existingRow && zielAnzahl > 0) {
            aufgaben.push(
              supabase
                .from('DB_Bedarf')
                .update({
                  ...neuerKopf,
                  quali_id: quali.id,
                  schichtart,
                  anzahl: zielAnzahl,
                })
                .match({ id: existingRow.id, ...alterBlock })
            );
          } else if (existingRow && zielAnzahl === 0) {
            aufgaben.push(
              supabase
                .from('DB_Bedarf')
                .delete()
                .match({ id: existingRow.id, ...alterBlock })
            );
          } else if (!existingRow && zielAnzahl > 0) {
            aufgaben.push(
              supabase.from('DB_Bedarf').insert({
                ...neuerKopf,
                quali_id: quali.id,
                schichtart,
                anzahl: zielAnzahl,
              })
            );
          }
        }
      }

      const ergebnisse = await Promise.all(aufgaben);
      const erstesProblem = ergebnisse.find((result) => result?.error);

      if (erstesProblem?.error) {
        throw erstesProblem.error;
      }

      setFeedback(
        `Gespeichert: ${ausgefuellteQualifikationen.length} Qualifikation(en), ${anzahlDbZeilen} Bedarfszeilen.`
      );

      onSaved?.({
        ...neuerKopf,
        anzahlQualifikationen: ausgefuellteQualifikationen.length,
        anzahlDbZeilen,
      });
    } catch (error) {
      console.error(
        'Zeitlichen Bedarf vollständig speichern fehlgeschlagen:',
        error
      );
      setFeedback(
        `Fehler beim Speichern: ${error?.message || 'Unbekannter Fehler'}`
      );
    } finally {
      setSaving(false);
    }
  };

  if (!eintrag) {
    return (
      <div className="rounded-xl border border-gray-300 p-4 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Wähle oben einen zeitlich begrenzten Bedarf aus, um ihn vollständig
          zu bearbeiten.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-300 bg-white/60 p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-md font-semibold">
            Zeitlichen Bedarf bearbeiten
          </h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Grunddaten und vollständige Bedarfsmatrix gemeinsam speichern
          </p>
        </div>

        <button
          type="button"
          onClick={() => onClose?.()}
          className="rounded-lg bg-gray-200 p-2 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          title="Bearbeitung schließen"
        >
          <X size={17} />
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Bezeichnung
          </label>
          <input
            type="text"
            value={namebedarf}
            onChange={(event) => setNamebedarf(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Von</label>
          <input
            type="date"
            value={von}
            onChange={(event) => {
              const value = event.target.value;
              setVon(value);

              if (value && (!bis || dayjs(bis).isBefore(value, 'day'))) {
                setBis(value);
              }
            }}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Bis</label>
          <input
            type="date"
            value={bis}
            min={von || undefined}
            onChange={(event) => setBis(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Startschicht
          </label>
          <select
            value={startSchicht}
            onChange={(event) => setStartSchicht(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="Früh">Früh</option>
            <option value="Spät">Spät</option>
            <option value="Nacht">Nacht</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Endschicht
          </label>
          <select
            value={endSchicht}
            onChange={(event) => setEndSchicht(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
          >
            <option value="Früh">Früh</option>
            <option value="Spät">Spät</option>
            <option value="Nacht">Nacht</option>
          </select>
        </div>

        <div className="xl:col-span-2">
          <label className="mb-1 block text-sm font-medium">Farbe</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={farbe}
              onChange={(event) => setFarbe(event.target.value)}
              className="h-10 w-14 rounded border border-gray-300 bg-transparent dark:border-gray-600"
            />
            <div
              className="h-10 flex-1 rounded-lg border border-gray-300 dark:border-gray-600"
              style={{ backgroundColor: farbe }}
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-300 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-100 px-3 py-2 dark:bg-gray-800">
          <div>
            <h4 className="text-sm font-semibold">Bedarfsmatrix</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Auch bisher nicht verwendete Qualifikationen können ergänzt
              werden
            </p>
          </div>

          <span className="text-xs text-gray-600 dark:text-gray-300">
            {ausgefuellteQualifikationen.length} Qualifikation(en) ·{' '}
            {anzahlDbZeilen} Einträge
          </span>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-gray-500">
            Bedarf wird geladen…
          </div>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="min-w-[210px] px-3 py-2 text-left">
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
            feedback.startsWith('Gespeichert')
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
          onClick={handleSpeichern}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={17} />
          {saving
            ? 'Wird gespeichert…'
            : `Alles speichern (${anzahlDbZeilen})`}
        </button>
      </div>
    </div>
  );
};

export default ZeitlichBegrenztBearbeiten;
