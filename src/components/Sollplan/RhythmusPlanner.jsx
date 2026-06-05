import React, { useEffect, useMemo, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const gruppiereIn7erBloecke = (arr) => {
  const bloecke = [];

  for (let i = 0; i < arr.length; i += 7) {
    bloecke.push(arr.slice(i, i + 7));
  }

  return bloecke;
};

    const RhythmusPlanner = ({
    firma,
    unit,
    schichtarten = [],
    rhythmus,
    setRhythmus,
    }) => {
  const [laenge, setLaenge] = useState(8);
  const [ausgewaehlteSchicht, setAusgewaehlteSchicht] = useState(null);
  const [vorlagen, setVorlagen] = useState([]);
  const [vorlagenName, setVorlagenName] = useState('');

  const bloecke = useMemo(() => gruppiereIn7erBloecke(rhythmus || []), [rhythmus]);

  useEffect(() => {
    const next = Array.from({ length: laenge }, (_, index) => ({
      tag: index + 1,
      schicht: rhythmus?.[index]?.schicht || null,
    }));

    setRhythmus(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laenge]);

    const ladeVorlagen = async () => {
    if (!firma || !unit) {
        setVorlagen([]);
        return;
    }

    const { data, error } = await supabase
        .from('DB_SollplanRhythmusVorlage')
        .select('id, name, laenge, rhythmus')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true)
        .order('name', { ascending: true });

    if (error) {
        console.error('Fehler beim Laden der Rhythmus-Vorlagen:', error.message);
        setVorlagen([]);
        return;
    }

    setVorlagen(data || []);
    };

    useEffect(() => {
    ladeVorlagen();
    }, [firma, unit]);

  const updateTag = (index, schicht) => {
    const next = [...rhythmus];

    next[index] = {
      ...next[index],
      schicht,
    };

    setRhythmus(next);
  };

  const handleSchichtDragStart = (e, schicht) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        type: 'schichtart',
        schicht,
      })
    );

    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e, index) => {
    e.preventDefault();

    try {
      const payload = JSON.parse(e.dataTransfer.getData('application/json'));

      if (payload?.type === 'schichtart' && payload.schicht) {
        updateTag(index, payload.schicht);
      }
    } catch {
      // bewusst keine Ausgabe
    }
  };

  const handleClickTag = (index) => {
    if (!ausgewaehlteSchicht) return;
    updateTag(index, ausgewaehlteSchicht);
  };

  const clearTag = (index) => {
    updateTag(index, null);
  };

  const speichernVorlage = async () => {
  const name = vorlagenName.trim();

  if (!firma || !unit) {
    alert('Bitte zuerst Firma und Unit auswählen.');
    return;
  }

  if (!name) {
    alert('Bitte einen Namen für die Vorlage eingeben.');
    return;
  }

  if (!rhythmus?.length) {
    alert('Bitte zuerst einen Rhythmus erstellen.');
    return;
  }

  const istVollstaendig = rhythmus.every((r) => r.schicht);

  if (!istVollstaendig) {
    alert('Der Rhythmus ist noch nicht vollständig. Bitte alle Tage füllen.');
    return;
  }

  const { data: authData } = await supabase.auth.getUser();

  const payload = {
    firma_id: Number(firma),
    unit_id: Number(unit),
    name,
    laenge,
    created_by: authData?.user?.id || null,
    rhythmus: rhythmus.map((r) => ({
      tag: r.tag,
      schichtart_id: r.schicht?.id || null,
    })),
    aktiv: true,
  };

  const { error } = await supabase
    .from('DB_SollplanRhythmusVorlage')
    .insert(payload);

  if (error) {
    if (error.code === '23505') {
      alert('Eine Vorlage mit diesem Namen gibt es für diese Unit bereits.');
      return;
    }

    console.error('Fehler beim Speichern der Vorlage:', error.message);
    alert(`Fehler beim Speichern der Vorlage: ${error.message}`);
    return;
  }

  setVorlagenName('');
  await ladeVorlagen();
};

const ladeVorlage = (vorlage) => {
  const neueLaenge = vorlage.laenge || 8;

  const geladenerRhythmus = Array.from(
    { length: neueLaenge },
    (_, index) => {
      const tag = index + 1;

      const gespeicherterTag = (vorlage.rhythmus || []).find(
        (r) => Number(r.tag) === tag
      );

      const schicht = schichtarten.find(
        (s) => Number(s.id) === Number(gespeicherterTag?.schichtart_id)
      );

      return {
        tag,
        schicht: schicht || null,
      };
    }
  );

  setLaenge(neueLaenge);
  setRhythmus(geladenerRhythmus);
};

    const loescheVorlage = async (id) => {
    const bestaetigt = window.confirm('Vorlage wirklich löschen?');

    if (!bestaetigt) return;

    const { error } = await supabase
        .from('DB_SollplanRhythmusVorlage')
        .update({ aktiv: false })
        .eq('id', id);

    if (error) {
        console.error('Fehler beim Löschen der Vorlage:', error.message);
        alert('Fehler beim Löschen der Vorlage.');
        return;
    }

    await ladeVorlagen();
    };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md w-full border border-gray-300 dark:border-gray-700">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg text-gray-900 dark:text-white">
            Rhythmusplanner
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Baue hier den Schichtrhythmus. Die Anzeige ist nur optisch in 7er-Zeilen gruppiert.
          </p>
        </div>

        <div className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
          {laenge} Tage
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
          Rhythmuslänge
        </label>

        <select
          value={laenge}
          onChange={(e) => setLaenge(Number(e.target.value))}
          className="w-full p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
        >
          {Array.from({ length: 56 }, (_, i) => i + 1).map((zahl) => (
            <option key={zahl} value={zahl}>
              {zahl} Tage
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="text-xs mb-2 text-gray-600 dark:text-gray-300">
          Schichtarten
        </div>

        {schichtarten.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Wähle zuerst Firma und Unit.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {schichtarten.map((s) => (
              <button
                key={s.id}
                type="button"
                draggable
                onDragStart={(e) => handleSchichtDragStart(e, s)}
                onClick={() => setAusgewaehlteSchicht(s)}
                className={[
                  'h-9 min-w-[48px] px-2 rounded-lg font-bold border transition cursor-grab active:cursor-grabbing',
                  ausgewaehlteSchicht?.id === s.id
                    ? 'ring-2 ring-blue-500 scale-105'
                    : 'border-gray-300 dark:border-gray-600',
                ].join(' ')}
                style={{
                  backgroundColor: s.farbe_bg || '#d1d5db',
                  color: s.farbe_text || s.farbe_schrift || '#000',
                }}
                title={`${s.beschreibung || s.kuerzel}
${s.startzeit || '-'} bis ${s.endzeit || '-'}
Dauer: ${s.dauer ?? '-'} h`}
              >
                {s.kuerzel}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Ziehe eine Schicht in einen Rhythmustag oder klicke erst eine Schicht und dann einen Tag.
        </div>
      </div>

      <div className="space-y-4">
        {bloecke.map((block, blockIndex) => {
          const startTag = blockIndex * 7 + 1;
          const endTag = startTag + block.length - 1;

          return (
            <div key={blockIndex}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Tage {startTag}–{endTag}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {block.map((item) => {
                  const realIndex = item.tag - 1;
                  const s = item.schicht;

                  return (
                    <div
                      key={item.tag}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, realIndex)}
                      onClick={() => handleClickTag(realIndex)}
                      className="relative h-14 rounded-lg border border-dashed border-gray-400 dark:border-gray-600 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={
                        s
                          ? `${s.beschreibung || s.kuerzel}
${s.startzeit || '-'} bis ${s.endzeit || '-'}
Dauer: ${s.dauer ?? '-'} h`
                          : 'Schicht hier ablegen'
                      }
                    >
                      <div className="absolute top-1 left-1 text-[10px] text-gray-500 dark:text-gray-400">
                        {item.tag}
                      </div>

                      {s ? (
                        <>
                          <span
                            className="px-2 py-1 rounded font-bold text-sm"
                            style={{
                              backgroundColor: s.farbe_bg || '#d1d5db',
                              color: s.farbe_text || s.farbe_schrift || '#000',
                            }}
                          >
                            {s.kuerzel}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearTag(realIndex);
                            }}
                            className="absolute top-1 right-1 text-gray-400 hover:text-red-500"
                            title="Tag leeren"
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
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

      <div className="mt-5 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">
          Vorlage speichern
        </div>

        <div className="flex gap-2">
          <input
            value={vorlagenName}
            onChange={(e) => setVorlagenName(e.target.value)}
            placeholder="z. B. Vollkonti 28 Tage"
            className="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-sm text-gray-900 dark:text-white"
          />

          <button
            type="button"
            onClick={speichernVorlage}
            disabled={!vorlagenName.trim()}
            className="px-3 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            title="Vorlage speichern"
          >
            <Save size={18} />
          </button>
        </div>

        {vorlagen.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              Vorlagen
            </div>

            {vorlagen.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded bg-gray-100 dark:bg-gray-700 px-2 py-2"
              >
                <button
                  type="button"
                  onClick={() => ladeVorlage(v)}
                  className="text-left text-sm flex-1 hover:underline text-gray-900 dark:text-white"
                >
                  {v.name}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    ({v.laenge} Tage)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => loescheVorlage(v.id)}
                  className="text-gray-400 hover:text-red-500"
                  title="Vorlage löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RhythmusPlanner;