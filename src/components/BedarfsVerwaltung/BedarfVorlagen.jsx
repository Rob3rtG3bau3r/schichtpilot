import React, { useEffect, useMemo, useState } from 'react';
import { Info, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const BedarfVorlagen = ({ refreshKey, onVorlageWaehlen }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [infoOffen, setInfoOffen] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    let aktiv = true;

    const lade = async () => {
      if (!firma || !unit) {
        if (aktiv) setRows([]);
        return;
      }

      setLoading(true);
      setFeedback('');

      const { data, error } = await supabase
        .from('DB_BedarfVorlage')
        .select(`
          id,
          created_at,
          created_by,
          firma_id,
          unit_id,
          vorlage_name,
          namebedarf,
          farbe,
          start_schicht,
          end_schicht,
          aktiv,
          position,
          DB_BedarfVorlagePosition (
            id,
            vorlage_id,
            quali_id,
            anzahl_frueh,
            anzahl_spaet,
            anzahl_nacht,
            position
          )
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true)
        .order('position', { ascending: true })
        .order('vorlage_name', { ascending: true });

      if (!aktiv) return;

      if (error) {
        console.error('Fehler beim Laden der Bedarfsvorlagen:', error.message);
        setRows([]);
        setFeedback(`Vorlagen konnten nicht geladen werden: ${error.message}`);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    };

    lade();

    return () => {
      aktiv = false;
    };
  }, [firma, unit, refreshKey]);

  const sichtbareRows = useMemo(() => {
    return rows.map((row) => {
      const positionen = [...(row.DB_BedarfVorlagePosition || [])].sort(
        (a, b) =>
          Number(a.position ?? 9999) - Number(b.position ?? 9999)
      );

      const summen = positionen.reduce(
        (acc, pos) => ({
          frueh: acc.frueh + Number(pos.anzahl_frueh || 0),
          spaet: acc.spaet + Number(pos.anzahl_spaet || 0),
          nacht: acc.nacht + Number(pos.anzahl_nacht || 0),
        }),
        { frueh: 0, spaet: 0, nacht: 0 }
      );

      return {
        ...row,
        positionen,
        summen,
      };
    });
  }, [rows]);

  const handleVorlageWaehlen = async (row) => {
    setLoadingId(row.id);
    setFeedback('');

    try {
      const qualiIds = [
        ...new Set(row.positionen.map((pos) => pos.quali_id).filter(Boolean)),
      ];

      let qualiMap = {};

      if (qualiIds.length > 0) {
        const { data: qualis, error: qualiError } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, quali_kuerzel, position, aktiv')
          .in('id', qualiIds);

        if (qualiError) throw qualiError;

        (qualis || []).forEach((quali) => {
          qualiMap[quali.id] = quali;
        });
      }

      onVorlageWaehlen?.({
        ...row,
        positionen: row.positionen.map((pos) => ({
          ...pos,
          quali: qualiMap[pos.quali_id] || null,
        })),
      });
    } catch (error) {
      console.error('Bedarfsvorlage laden fehlgeschlagen:', error);
      setFeedback(
        `Vorlage konnte nicht geladen werden: ${
          error?.message || 'Unbekannter Fehler'
        }`
      );
    } finally {
      setLoadingId(null);
    }
  };

  const handleLoeschen = async (row) => {
    const bestaetigt = window.confirm(
      `Vorlage „${row.vorlage_name || row.namebedarf}“ vollständig löschen?`
    );

    if (!bestaetigt) return;

    setDeletingId(row.id);
    setFeedback('');

    const { error } = await supabase
      .from('DB_BedarfVorlage')
      .delete()
      .eq('id', row.id)
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    if (error) {
      console.error('Bedarfsvorlage löschen fehlgeschlagen:', error.message);
      setFeedback(`Vorlage konnte nicht gelöscht werden: ${error.message}`);
    } else {
      setRows((aktuell) => aktuell.filter((item) => item.id !== row.id));
    }

    setDeletingId(null);
  };

  return (
    <div className="relative rounded-xl border border-gray-300 bg-white/60 p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-md font-semibold">Vorlagen</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Vollständige Bedarfsmatrix übernehmen
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen zu Bedarfsvorlagen"
        >
          <Info size={20} />
        </button>
      </div>

      {feedback && (
        <div className="mb-3 rounded-lg bg-red-100 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-300">
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Vorlagen werden geladen…
        </div>
      ) : sichtbareRows.length === 0 ? (
        <div className="text-sm italic text-gray-500 dark:text-gray-400">
          Noch keine vollständige Vorlage gespeichert.
        </div>
      ) : (
        <div className="max-h-[720px] space-y-2 overflow-y-auto pr-1">
          {sichtbareRows.map((row) => (
            <div
              key={row.id}
              className="rounded-xl border border-gray-300 bg-gray-50 p-3 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <button
                type="button"
                disabled={loadingId === row.id || deletingId === row.id}
                onClick={() => handleVorlageWaehlen(row)}
                className="w-full text-left disabled:opacity-50"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 h-9 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.farbe || '#3b82f6' }}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {row.vorlage_name || row.namebedarf || 'Ohne Namen'}
                    </div>

                    {row.namebedarf &&
                      row.namebedarf !== row.vorlage_name && (
                        <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                          {row.namebedarf}
                        </div>
                      )}

                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                      {row.positionen.length} Qualifikation(en)
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      F {row.summen.frueh} · S {row.summen.spaet} · N{' '}
                      {row.summen.nacht}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {row.start_schicht || 'Früh'} bis{' '}
                      {row.end_schicht || 'Nacht'}
                    </div>
                  </div>
                </div>
              </button>

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  disabled={deletingId === row.id || loadingId === row.id}
                  onClick={() => handleLoeschen(row)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30"
                  title="Vorlage löschen"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {infoOffen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-semibold">
              Vollständige Bedarfsvorlagen
            </h3>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <p>
                Eine Vorlage enthält Bezeichnung, Farbe, Schichtgrenzen und
                die komplette Bedarfsmatrix mit allen Qualifikationen.
              </p>
              <p>
                Beim Auswählen werden die Werte in die neue Erfassung geladen.
                Von und Bis werden bewusst neu gesetzt.
              </p>
              <p>
                Das Auswählen einer Vorlage erzeugt noch keinen echten Bedarf.
                Dieser entsteht erst mit „Gesamt speichern“.
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

export default BedarfVorlagen;
