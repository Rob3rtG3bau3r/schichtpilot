import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  NotebookPen,
  Settings2,
  X,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import SelfNotizen from './SelfNotizen';
import SelfZeitkonto from './SelfZeitkonto';
import SelfAbwesenheiten from './SelfAbwesenheiten';

const PersoenlicherBereichFloating = ({
  verfuegbar,
  settings,
  onSettingsChange,
  offen,
  onOffenChange,
  jahr,
  refreshKey,
}) => {
  const {
    sichtFirma: firma,
    sichtUnit: unit,
  } = useRollen();

  const [einstellungenOffen, setEinstellungenOffen] =
    useState(false);
  const [schichtarten, setSchichtarten] = useState([]);
  const [schichtartenLoading, setSchichtartenLoading] =
    useState(false);

  const ausgewaehlteIds = useMemo(
    () =>
      (settings?.abwesenheitIds || [])
        .map(Number)
        .filter(Number.isFinite),
    [settings?.abwesenheitIds]
  );

  useEffect(() => {
    if (
      !verfuegbar ||
      !offen ||
      !einstellungenOffen ||
      !firma ||
      !unit
    ) {
      return;
    }

    let alive = true;

    const laden = async () => {
      setSchichtartenLoading(true);

      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('id, kuerzel, beschreibung, position')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .order('position', {
          ascending: true,
          nullsFirst: false,
        })
        .order('kuerzel', { ascending: true });

      if (!alive) return;

      if (error) {
        console.error(
          '❌ Fehler beim Laden der Kürzel:',
          error.message || error
        );
        setSchichtarten([]);
      } else {
        setSchichtarten(data || []);
      }

      setSchichtartenLoading(false);
    };

    laden();

    return () => {
      alive = false;
    };
  }, [
    verfuegbar,
    offen,
    einstellungenOffen,
    firma,
    unit,
  ]);

  useEffect(() => {
    if (!offen) {
      setEinstellungenOffen(false);
    }
  }, [offen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onOffenChange?.(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!verfuegbar) return null;

  const toggleBereich = (key) => {
    onSettingsChange?.({
      [key]: !settings?.[key],
    });
  };

  const toggleSchichtart = (id) => {
    const numericId = Number(id);

    const next = ausgewaehlteIds.includes(numericId)
      ? ausgewaehlteIds.filter(
          (currentId) => currentId !== numericId
        )
      : [...ausgewaehlteIds, numericId];

    onSettingsChange?.({
      abwesenheitIds: next,
    });
  };

  const bereicheAktiv =
    settings?.notizenVisible ||
    settings?.zeitVisible ||
    settings?.abwesenheitenVisible;

  return (
    <>
      <button
        type="button"
        onClick={() => onOffenChange?.(!offen)}
        title="Persönlichen Bereich öffnen"
        aria-label="Persönlichen Bereich öffnen"
        className={`fixed right-5 top-[66vh] z-[9100] flex h-10 w-10 items-center justify-center rounded-full border shadow-xl transition-all ${
          offen
            ? 'border-blue-500 bg-blue-600 text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:-translate-y-0.5 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
        }`}
      >
        {offen ? <X size={18} /> : <NotebookPen size={16} />}
      </button>

      {offen && (
        <div
          className="fixed bottom-4 left-6 right-20 z-[9000] flex h-[50vh] flex-col overflow-hidden rounded-xl border border-gray-300 bg-gray-100/95 shadow-2xl backdrop-blur-md dark:border-gray-700 dark:bg-gray-900/95"
          role="dialog"
          aria-modal="false"
          aria-label="Persönlicher Bereich"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 px-3 py-1.5 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <NotebookPen size={18} />
              <div>
                <h2 className="text-[13px] font-semibold">
                  Persönlicher Bereich
                </h2>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Nur deine persönlichen Daten und Notizen
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setEinstellungenOffen((prev) => !prev)
                }
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                  einstellungenOffen
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Settings2 size={13} />
                Einstellungen
                <ChevronDown
                  size={12}
                  className={`transition-transform ${
                    einstellungenOffen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => onOffenChange?.(false)}
                className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                title="Schließen"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {einstellungenOffen && (
            <div className="shrink-0 border-b border-gray-300 bg-white/70 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="grid gap-3 xl:grid-cols-[240px_1fr]">
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold">
                    Sichtbare Bereiche
                  </div>

                  <div className="space-y-0.5">
                    {[
                      ['notizenVisible', 'Private Notizen'],
                      ['zeitVisible', 'Zeit & Urlaub'],
                      [
                        'abwesenheitenVisible',
                        'Kommende Abwesenheiten',
                      ],
                    ].map(([key, label]) => {
                      const aktiv = !!settings?.[key];

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleBereich(key)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[11px] hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <span>{label}</span>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              aktiv
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-400'
                            }`}
                          >
                            {aktiv && <Check size={11} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[11px] font-semibold">
                    Kürzel für kommende Abwesenheiten
                  </div>

                  {schichtartenLoading ? (
                    <div className="py-2 text-xs text-gray-500 dark:text-gray-400">
                      Kürzel werden geladen...
                    </div>
                  ) : (
                    <div className="flex max-h-[72px] flex-wrap content-start gap-1 overflow-y-auto pr-1">
                      {schichtarten.map((schichtart) => {
                        const aktiv =
                          ausgewaehlteIds.includes(
                            Number(schichtart.id)
                          );

                        return (
                          <button
                            key={schichtart.id}
                            type="button"
                            onClick={() =>
                              toggleSchichtart(schichtart.id)
                            }
                            title={
                              schichtart.beschreibung ||
                              schichtart.kuerzel
                            }
                            className={`rounded-md border px-2 py-0.5 text-[11px] ${
                              aktiv
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
                            }`}
                          >
                            {schichtart.kuerzel}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-hidden p-2">
            {!bereicheAktiv ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Aktiviere über „Einstellungen“ mindestens einen
                persönlichen Bereich.
              </div>
            ) : (
              <div className="grid h-full min-h-0 grid-cols-1 items-stretch gap-2 xl:grid-cols-5">
                {settings?.notizenVisible && (
                  <div className="min-h-0 min-w-0 overflow-hidden xl:col-span-2">
                    <SelfNotizen />
                  </div>
                )}

                {settings?.zeitVisible && (
                  <div className="min-h-0 min-w-0 overflow-hidden xl:col-span-1">
                    <SelfZeitkonto
                      jahr={jahr}
                      refreshKey={refreshKey}
                    />
                  </div>
                )}

                {settings?.abwesenheitenVisible && (
                  <div className="min-h-0 min-w-0 overflow-hidden xl:col-span-2">
                    <SelfAbwesenheiten
                      schichtartIds={ausgewaehlteIds}
                      refreshKey={refreshKey}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PersoenlicherBereichFloating;
