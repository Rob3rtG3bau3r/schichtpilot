import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { Eye, Save, X, RotateCcw } from 'lucide-react';

const addYearsEndOfYear = (startIso, years) => {
  const start = dayjs(startIso);
  return start.add(years, 'year').endOf('year').format('YYYY-MM-DD');
};

const mod = (n, m) => ((n % m) + m) % m;

const chunkArray = (arr, size) => {
  const out = [];

  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }

  return out;
};

const gruppiereIn7erBloecke = (arr) => {
  const bloecke = [];

  for (let i = 0; i < arr.length; i += 7) {
    bloecke.push(arr.slice(i, i + 7));
  }

  return bloecke;
};

const zaehleKuerzel = (rhythmus) => {
  const map = {};

  for (const item of rhythmus || []) {
    const kuerzel = item.schicht?.kuerzel || '-';
    map[kuerzel] = (map[kuerzel] || 0) + 1;
  }

  return map;
};

const SollplanGenerator = ({
  firma,
  unit,
  gruppen = [],
  schichtarten = [],
  rhythmus = [],
  onSaveSuccess,
}) => {
  const heute = dayjs().format('YYYY-MM-DD');

  const [startdatum, setStartdatum] = useState(heute);
  const [enddatum, setEnddatum] = useState(() => addYearsEndOfYear(heute, 10));
  const [jahre, setJahre] = useState(10);

  const [gruppenStarts, setGruppenStarts] = useState({});
  const [vorschauOffen, setVorschauOffen] = useState(false);
  const [rhythmusDetailsOffen, setRhythmusDetailsOffen] = useState(false);
  const [vorschauMonat, setVorschauMonat] = useState(() => dayjs().startOf('month'));

  const [speichernLaeuft, setSpeichernLaeuft] = useState(false);
  const [meldung, setMeldung] = useState('');

    const rhythmusIstVollstaendig = useMemo(() => {
    return rhythmus.length > 0 && rhythmus.every((r) => r.schicht);
    }, [rhythmus]);

    const rhythmusHatInhalt = useMemo(() => {
    return rhythmus.length > 0 && rhythmus.some((r) => r.schicht);
    }, [rhythmus]);

    const rhythmusIstNutzbar = rhythmusIstVollstaendig;

  const rhythmusBloecke = useMemo(() => gruppiereIn7erBloecke(rhythmus || []), [rhythmus]);
  const rhythmusZaehler = useMemo(() => zaehleKuerzel(rhythmus || []), [rhythmus]);

  const rhythmusKurztext = useMemo(() => {
    if (!rhythmus?.length) return 'Kein Rhythmus gewählt';

    const teile = Object.entries(rhythmusZaehler)
      .map(([kuerzel, anzahl]) => `${kuerzel}: ${anzahl}`)
      .join(' · ');

    return `${rhythmus.length} Tage${teile ? ` · ${teile}` : ''}`;
  }, [rhythmus, rhythmusZaehler]);

  const sichtbareTage = useMemo(() => {
    const start = dayjs(startdatum);
    const end = start.add(59, 'day');
    const arr = [];

    for (
      let d = start;
      d.isSame(end, 'day') || d.isBefore(end, 'day');
      d = d.add(1, 'day')
    ) {
      arr.push(d.format('YYYY-MM-DD'));
    }

    return arr;
  }, [startdatum]);

  const monatstagePreview = useMemo(() => {
    const start = vorschauMonat.startOf('month');
    const end = vorschauMonat.endOf('month');
    const arr = [];

    for (
      let d = start;
      d.isSame(end, 'day') || d.isBefore(end, 'day');
      d = d.add(1, 'day')
    ) {
      arr.push(d.format('YYYY-MM-DD'));
    }

    return arr;
  }, [vorschauMonat]);

  const setEndeNachJahren = (value) => {
    const zahl = Number(value);

    setJahre(zahl);
    setEnddatum(addYearsEndOfYear(startdatum, zahl));
  };

  const handleStartChange = (value) => {
    setStartdatum(value);
    setEnddatum(addYearsEndOfYear(value, jahre));
    setVorschauMonat(dayjs(value).startOf('month'));
  };

  const handleRhythmusDragStart = (e) => {
    if (!rhythmusIstNutzbar) return;

    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'rhythmus',
      })
    );

    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropAufGruppe = (e, gruppe, datum) => {
    e.preventDefault();

    if (!rhythmusIstNutzbar) return;

    let payload = null;

    try {
      payload = JSON.parse(e.dataTransfer.getData('application/json'));
    } catch {
      payload = null;
    }

    if (payload?.type && payload.type !== 'rhythmus') return;

    setGruppenStarts((prev) => ({
      ...prev,
      [gruppe]: datum,
    }));

    setMeldung('');
  };

  const setStartFuerGruppePerKlick = (gruppe, datum) => {
    if (!rhythmusIstNutzbar) return;

    setGruppenStarts((prev) => ({
      ...prev,
      [gruppe]: datum,
    }));

    setMeldung('');
  };

  const resetGruppe = (gruppe) => {
    setGruppenStarts((prev) => {
      const next = { ...prev };
      delete next[gruppe];
      return next;
    });

    setMeldung('');
  };

  const resetAlleGruppen = () => {
    setGruppenStarts({});
    setMeldung('');
  };

  const berechneSchichtFuer = (gruppe, datumIso) => {
    const anchor = gruppenStarts[gruppe];

    if (!anchor || !rhythmusIstNutzbar) return null;

    const diff = dayjs(datumIso).diff(dayjs(anchor), 'day');
    const index = mod(diff, rhythmus.length);

    return rhythmus[index]?.schicht || null;
  };

  const baueEintraege = () => {
    const result = [];
    const start = dayjs(startdatum);
    const end = dayjs(enddatum);

    for (const gruppe of gruppen) {
      if (!gruppenStarts[gruppe]) continue;

      for (
        let d = start;
        d.isSame(end, 'day') || d.isBefore(end, 'day');
        d = d.add(1, 'day')
      ) {
        const datumIso = d.format('YYYY-MM-DD');
        const schicht = berechneSchichtFuer(gruppe, datumIso);

        if (!schicht) continue;

        result.push({
          datum: datumIso,
          startzeit: schicht.startzeit,
          endzeit: schicht.endzeit,
          dauer: schicht.dauer,
          kuerzel: schicht.kuerzel,
          schichtart_id: schicht.id,
          schichtgruppe: gruppe,
          firma_id: firma,
          unit_id: unit,
        });
      }
    }

    return result;
  };

  const vorschauEintraege = useMemo(() => {
    if (!firma || !unit) return [];
    return baueEintraege();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, unit, startdatum, enddatum, gruppenStarts, rhythmus]);

  const gruppenMitStart = useMemo(() => {
    return gruppen.filter((g) => gruppenStarts[g]);
  }, [gruppen, gruppenStarts]);

  const pruefeUndSpeichere = async () => {
    if (speichernLaeuft) return;
    setMeldung('');

    if (!firma || !unit) {
      setMeldung('Bitte Firma und Unit auswählen.');
      return;
    }

    if (!rhythmusIstVollstaendig) {
    setMeldung('Bitte den Rhythmus vollständig füllen. Es darf kein Tag leer sein.');
    return;
    }

    if (gruppenMitStart.length === 0) {
      setMeldung('Bitte den Rhythmus mindestens auf eine Schichtgruppe anwenden.');
      return;
    }

    const neueEintraege = baueEintraege();

    if (neueEintraege.length === 0) {
      setMeldung('Es wurden keine Einträge erzeugt.');
      return;
    }

    setSpeichernLaeuft(true);

    try {
      const { data: existing, error: checkError } = await supabase
        .from('DB_SollPlan')
        .select('id, datum, schichtgruppe')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .gte('datum', startdatum)
        .lte('datum', enddatum)
        .in('schichtgruppe', gruppenMitStart);

      if (checkError) {
        console.error(checkError);
        setMeldung('Fehler bei der Duplikatprüfung.');
        return;
      }

      const existingSet = new Set(
        (existing || []).map((e) => `${e.datum}|${e.schichtgruppe}`)
      );

      const zuSpeichern = neueEintraege.filter(
        (e) => !existingSet.has(`${e.datum}|${e.schichtgruppe}`)
      );

      const uebersprungen = neueEintraege.length - zuSpeichern.length;

      if (zuSpeichern.length > 0) {
        const chunks = chunkArray(zuSpeichern, 500);

        for (const chunk of chunks) {
            const { error } = await supabase
            .from('DB_SollPlan')
            .upsert(chunk, {
                onConflict: 'firma_id,unit_id,schichtgruppe,datum',
                ignoreDuplicates: true,
            });

          if (error) {
            console.error(error);
            setMeldung('Fehler beim Speichern.');
            return;
          }
        }
      }

      setMeldung(
        `✅ ${zuSpeichern.length} Einträge gespeichert, ${uebersprungen} vorhandene Einträge übersprungen.`
      );

      if (onSaveSuccess) onSaveSuccess();
    } finally {
      setSpeichernLaeuft(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-xl shadow-md w-full border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-lg">
              Sollplan-Generator
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ziehe den aktiven Rhythmus auf den Starttag einer Schichtgruppe.
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
        <div className="flex gap-2">
            <button
            type="button"
            onClick={() => setVorschauOffen(true)}
            disabled={!firma || !unit || !rhythmusIstNutzbar}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm"
            >
            <Eye size={16} />
            Vorschau
            </button>

            <button
            type="button"
            onClick={pruefeUndSpeichere}
            disabled={speichernLaeuft || !firma || !unit || !rhythmusIstNutzbar}
            className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 text-sm"
            >
            <Save size={16} />
            {speichernLaeuft ? 'Speichern...' : 'Speichern'}
            </button>
        </div>

        {meldung && (
            <div
            className={[
                'max-w-[420px] text-xs px-3 py-1 rounded border text-right',
                meldung.startsWith('✅')
                ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800'
                : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
            ].join(' ')}
            >
            {meldung}
            </div>
        )}
        </div>
        </div>

        <div className="mb-4 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Aktiver Rhythmus
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRhythmusDetailsOffen(true)}
              disabled={!rhythmusIstNutzbar}
              className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
            >
              Details anzeigen
            </button>
          </div>

          {rhythmusIstVollstaendig ? (
            <div
            draggable
            onDragStart={handleRhythmusDragStart}
            className="mt-2 rounded-lg border border-dashed border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-800 px-3 py-2 cursor-grab active:cursor-grabbing"
            title="Diesen kompletten Rhythmus auf einen Starttag ziehen"
            >
            <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                Rhythmus ziehen:      
                </span>

                <span className="text-xs text-gray-600 dark:text-gray-300 truncate">
                {rhythmusKurztext}
                </span>
            </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg bg-white dark:bg-gray-800 p-3 text-sm text-gray-500 dark:text-gray-400">
              {rhythmusHatInhalt
                ? 'Der Rhythmus ist noch nicht vollständig. Bitte alle leeren Tage füllen.'
                : 'Baue links zuerst einen Rhythmus.'}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-2">
        <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
            Startdatum
            </label>

            <input
            type="date"
            value={startdatum}
            onChange={(e) => handleStartChange(e.target.value)}
            className="w-[145px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
            />
        </div>

        <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
            Zeitraum
            </label>

            <select
            value={jahre}
            onChange={(e) => setEndeNachJahren(e.target.value)}
            className="w-[115px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
            >
            <option value={5}>5 Jahre</option>
            <option value={10}>10 Jahre</option>
            <option value={15}>15 Jahre</option>
            </select>
        </div>

        <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
            Enddatum
            </label>

            <input
            type="date"
            value={enddatum}
            onChange={(e) => setEnddatum(e.target.value)}
            className="w-[145px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
            />
        </div>
        </div>

        {gruppenMitStart.length > 0 && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Rhythmus angewendet auf {gruppenMitStart.length} Gruppe(n):{' '}
              <span className="font-semibold">
                {gruppenMitStart.join(', ')}
              </span>
            </div>

            <button
              type="button"
              onClick={resetAlleGruppen}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
            >
              <RotateCcw size={13} />
              Alle zurücksetzen
            </button>
          </div>
        )}

        {!firma || !unit ? (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-3 text-sm">
            Bitte zuerst oben Firma und Unit auswählen.
          </div>
        ) : gruppen.length === 0 ? (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 p-3 text-sm">
            Für diese Unit wurden keine Schichtgruppen gefunden.
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-350px)] border border-gray-300 dark:border-gray-700 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-200 dark:bg-gray-700">
                <tr>
                  <th className="px-2 py-1 text-left min-w-[110px]">
                    Datum
                  </th>

                  {gruppen.map((gruppe) => (
                    <th key={gruppe} className="px-2 py-1 text-center min-w-[140px]">
                      <div className="font-semibold">
                        {gruppe}
                      </div>

                      {gruppenStarts[gruppe] ? (
                        <div className="mt-1 space-y-1">
                          <div className="text-[10px] text-blue-600 dark:text-blue-300">
                            Start: {dayjs(gruppenStarts[gruppe]).format('DD.MM.YYYY')}
                          </div>

                          <button
                            type="button"
                            onClick={() => resetGruppe(gruppe)}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50"
                          >
                            <RotateCcw size={11} />
                            Zurücksetzen
                          </button>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] text-gray-400">
                          Rhythmus hier starten
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {sichtbareTage.map((datum) => (
                  <tr
                    key={datum}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="px-2 py-1  whitespace-nowrap text-gray-700 dark:text-gray-200">
                      <div>{dayjs(datum).format('DD.MM.YYYY')}</div>
                      <div className="text-[10px] text-gray-500">
                        {dayjs(datum).format('dd')}
                      </div>
                    </td>

                    {gruppen.map((gruppe) => {
                      const schicht = berechneSchichtFuer(gruppe, datum);
                      const istStart = gruppenStarts[gruppe] === datum;

                      return (
                        <td
                          key={`${gruppe}-${datum}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => handleDropAufGruppe(e, gruppe, datum)}
                          onClick={() => setStartFuerGruppePerKlick(gruppe, datum)}
                          className={[
                            'p-2 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30',
                            istStart ? 'ring-2 ring-blue-500 ring-inset bg-blue-50 dark:bg-blue-900/20' : '',
                          ].join(' ')}
                          title={
                            schicht
                              ? `${schicht.beschreibung || schicht.kuerzel}
${schicht.startzeit || '-'} bis ${schicht.endzeit || '-'}
Dauer: ${schicht.dauer ?? '-'} h`
                              : 'Rhythmus hier starten'
                          }
                        >
                          {schicht ? (
                            <span
                              className="inline-flex items-center justify-center rounded font-bold text-xs w-12 h-7"
                              style={{
                                backgroundColor: schicht.farbe_bg || '#d1d5db',
                                color: schicht.farbe_text || schicht.farbe_schrift || '#000',
                              }}
                            >
                              {schicht.kuerzel}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">leer</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Vorschau aktuell: {vorschauEintraege.length} mögliche Einträge.
        </div>
      </div>

      {rhythmusDetailsOffen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRhythmusDetailsOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-2xl w-[95vw] max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  Aktiver Rhythmus
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {rhythmusKurztext}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRhythmusDetailsOffen(false)}
                className="text-gray-500 hover:text-red-500"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-4 overflow-auto">
              <div className="space-y-4">
                {rhythmusBloecke.map((block, blockIndex) => {
                  const startTag = blockIndex * 7 + 1;
                  const endTag = startTag + block.length - 1;

                  return (
                    <div key={blockIndex}>
                      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                        Tage {startTag}–{endTag}
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {block.map((item) => {
                          const s = item.schicht;

                          return (
                            <div
                              key={item.tag}
                              className="relative h-14 rounded-lg border border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800"
                            >
                              <div className="absolute top-1 left-1 text-[10px] text-gray-500 dark:text-gray-400">
                                {item.tag}
                              </div>

                              {s ? (
                                <span
                                  className="px-2 py-1 rounded font-bold text-sm"
                                  style={{
                                    backgroundColor: s.farbe_bg || '#d1d5db',
                                    color: s.farbe_text || s.farbe_schrift || '#000',
                                  }}
                                  title={`${s.beschreibung || s.kuerzel}
${s.startzeit || '-'} bis ${s.endzeit || '-'}
Dauer: ${s.dauer ?? '-'} h`}
                                >
                                  {s.kuerzel}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">leer</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {vorschauOffen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setVorschauOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-xl shadow-2xl w-[95vw] max-w-7xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  Sollplan-Vorschau
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {vorschauEintraege.length} Einträge im Zeitraum{' '}
                  {dayjs(startdatum).format('DD.MM.YYYY')} bis{' '}
                  {dayjs(enddatum).format('DD.MM.YYYY')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setVorschauOffen(false)}
                className="text-gray-500 hover:text-red-500"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-4 flex items-center justify-between border-b border-gray-300 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setVorschauMonat((m) => m.subtract(1, 'month'))}
                className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                ← Monat zurück
              </button>

              <div className="font-bold">
                {vorschauMonat.format('MMMM YYYY')}
              </div>

              <button
                type="button"
                onClick={() => setVorschauMonat((m) => m.add(1, 'month'))}
                className="px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Monat vor →
              </button>
            </div>

            <div className="overflow-auto p-4">
              <table className="min-w-full text-sm border border-gray-300 dark:border-gray-700">
                <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="p-2 text-left min-w-[110px]">
                      Datum
                    </th>

                    {gruppen.map((gruppe) => (
                      <th key={gruppe} className="p-2 text-center min-w-[100px]">
                        {gruppe}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {monatstagePreview.map((datum) => (
                    <tr
                      key={datum}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <td className="p-2 whitespace-nowrap">
                        {dayjs(datum).format('DD.MM.YYYY')}
                        <div className="text-[10px] text-gray-500">
                          {dayjs(datum).format('dd')}
                        </div>
                      </td>

                      {gruppen.map((gruppe) => {
                        const schicht = berechneSchichtFuer(gruppe, datum);

                        return (
                          <td key={`${gruppe}-${datum}`} className="p-2 text-center">
                            {schicht ? (
                              <span
                                className="inline-flex items-center justify-center rounded font-bold text-xs w-12 h-7"
                                style={{
                                  backgroundColor: schicht.farbe_bg || '#d1d5db',
                                  color: schicht.farbe_text || schicht.farbe_schrift || '#000',
                                }}
                                title={`${schicht.beschreibung || schicht.kuerzel}
${schicht.startzeit || '-'} bis ${schicht.endzeit || '-'}
Dauer: ${schicht.dauer ?? '-'} h`}
                              >
                                {schicht.kuerzel}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

        <div className="p-4 border-t border-gray-300 dark:border-gray-700 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-500 dark:text-gray-400">
            Standard: vorhandene Sollplan-Einträge werden übersprungen.
        </div>

        <div className="flex flex-col items-end gap-1">
            <button
            type="button"
            onClick={pruefeUndSpeichere}
            disabled={speichernLaeuft}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
            <Save size={16} />
            {speichernLaeuft ? 'Speichern...' : 'Aus Vorschau speichern'}
            </button>

            {meldung && (
            <div
                className={[
                'max-w-[460px] text-xs px-3 py-1 rounded border text-right',
                meldung.startsWith('✅')
                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800'
                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
                ].join(' ')}
            >
                {meldung}
            </div>
            )}
        </div>
        </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SollplanGenerator;