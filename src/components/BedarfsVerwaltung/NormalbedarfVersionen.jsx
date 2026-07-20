import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { History, Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const betriebsmodusText = (version) => {
  if (version.betriebsmodus === 'wochenbetrieb') {
    return version.wochen_tage
      ? `Wochenbetrieb · ${version.wochen_tage}`
      : 'Wochenbetrieb';
  }

  return '24/7-Betrieb';
};

const NormalbedarfVersionen = ({ refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [versionen, setVersionen] = useState([]);
  const [zeilenProVersion, setZeilenProVersion] = useState({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    let aktiv = true;

    const lade = async () => {
      if (!firma || !unit) {
        if (aktiv) {
          setVersionen([]);
          setZeilenProVersion({});
        }
        return;
      }

      setLoading(true);
      setFeedback('');

      const { data, error } = await supabase
        .from('DB_NormalbedarfVersion')
        .select(`
          id,
          created_at,
          name,
          gueltig_von,
          gueltig_bis,
          betriebsmodus,
          wochen_tage,
          aktiv
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .order('gueltig_von', { ascending: false });

      if (!aktiv) return;

      if (error) {
        console.error(
          'Normalbedarfs-Versionen laden fehlgeschlagen:',
          error.message
        );
        setVersionen([]);
        setZeilenProVersion({});
        setFeedback(`Versionen konnten nicht geladen werden: ${error.message}`);
        setLoading(false);
        return;
      }

      const liste = data || [];
      setVersionen(liste);

      const ids = liste.map((version) => version.id);

      if (ids.length === 0) {
        setZeilenProVersion({});
        setLoading(false);
        return;
      }

      const { data: bedarfsRows, error: bedarfError } = await supabase
        .from('DB_Bedarf')
        .select('id, normalbedarf_version_id')
        .in('normalbedarf_version_id', ids);

      if (!aktiv) return;

      if (bedarfError) {
        console.error(
          'Bedarfszeilen je Version laden fehlgeschlagen:',
          bedarfError.message
        );
        setZeilenProVersion({});
        setFeedback(
          `Versionen wurden geladen, die Bedarfszeilen aber nicht: ${bedarfError.message}`
        );
      } else {
        const counts = {};

        (bedarfsRows || []).forEach((row) => {
          const id = row.normalbedarf_version_id;
          counts[id] = (counts[id] || 0) + 1;
        });

        setZeilenProVersion(counts);
      }

      setLoading(false);
    };

    lade();

    return () => {
      aktiv = false;
    };
  }, [firma, unit, refreshKey]);

  const aktuelleVersion = useMemo(
    () =>
      versionen.find(
        (version) =>
          version.aktiv !== false &&
          version.gueltig_bis == null
      ) || null,
    [versionen]
  );

  return (
    <div className="rounded-xl border border-gray-300 bg-white/60 p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900/40">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History size={18} />
            <h3 className="text-md font-semibold">Versionen</h3>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Aktueller und bisheriger Normalbedarf
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen zur Versionsübersicht"
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
          Versionen werden geladen…
        </div>
      ) : versionen.length === 0 ? (
        <div className="text-sm italic text-gray-500 dark:text-gray-400">
          Noch keine Normalbedarfs-Version vorhanden.
        </div>
      ) : (
        <div className="space-y-2">
          {versionen.map((version) => {
            const istAktuell = aktuelleVersion?.id === version.id;

            return (
              <div
                key={version.id}
                className={`rounded-xl border p-3 ${
                  istAktuell
                    ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                    : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {version.name || 'Normalbetrieb'}
                    </div>

                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {dayjs(version.gueltig_von).format('DD.MM.YYYY')}
                      {' – '}
                      {version.gueltig_bis
                        ? dayjs(version.gueltig_bis).format('DD.MM.YYYY')
                        : 'offen'}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {betriebsmodusText(version)}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {zeilenProVersion[version.id] || 0} Bedarfszeilen
                    </div>
                  </div>

                  {istAktuell && (
                    <span className="shrink-0 rounded-full bg-blue-600 px-2 py-1 text-xs font-medium text-white">
                      Aktuell
                    </span>
                  )}
                </div>
              </div>
            );
          })}
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
              Normalbedarfs-Versionen
            </h3>

            <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <p>
                Jede Änderung des Normalbetriebs erzeugt eine neue vollständige
                Version.
              </p>
              <p>
                Die bisherige Version bleibt erhalten und endet automatisch am
                Tag vor dem Beginn der neuen Version.
              </p>
              <p>
                Dadurch kann später für jedes Datum der damals gültige
                Normalbedarf ermittelt werden.
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

export default NormalbedarfVersionen;
