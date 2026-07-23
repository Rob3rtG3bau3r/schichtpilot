import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { CalendarDays } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const gruppiereZeitraeume = (rows) => {
  const sortiert = [...rows].sort((a, b) =>
    String(a.datum).localeCompare(String(b.datum))
  );

  const result = [];

  for (const row of sortiert) {
    const schicht = row.ist_schicht;
    if (!schicht) continue;

    const datum = dayjs(row.datum);
    const letzter = result[result.length - 1];

    const gleicheSchicht =
      letzter &&
      Number(letzter.schicht.id) === Number(schicht.id);

    const direktDanach =
      letzter &&
      datum.diff(dayjs(letzter.bis), 'day') === 1;

    if (gleicheSchicht && direktDanach) {
      letzter.bis = row.datum;
      letzter.tage += 1;
      continue;
    }

    result.push({
      schicht,
      von: row.datum,
      bis: row.datum,
      tage: 1,
    });
  }

  return result;
};

const datumLabel = (von, bis) => {
  if (von === bis) {
    return dayjs(von).format('DD.MM.YYYY');
  }

  const gleichesJahr =
    dayjs(von).year() === dayjs(bis).year();

  if (gleichesJahr) {
    return `${dayjs(von).format('DD.MM.')} – ${dayjs(bis).format(
      'DD.MM.YYYY'
    )}`;
  }

  return `${dayjs(von).format('DD.MM.YYYY')} – ${dayjs(bis).format(
    'DD.MM.YYYY'
  )}`;
};

const SelfAbwesenheiten = ({
  schichtartIds,
  refreshKey,
}) => {
  const {
    sichtFirma: firma,
    sichtUnit: unit,
    userId,
  } = useRollen();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  const ids = useMemo(
    () =>
      (Array.isArray(schichtartIds) ? schichtartIds : [])
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id)),
    [schichtartIds]
  );

  useEffect(() => {
    let alive = true;

    const laden = async () => {
      if (!firma || !unit || !userId) return;

      if (!ids.length) {
        setRows([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const heute = dayjs().format('YYYY-MM-DD');
      const bis = dayjs().add(18, 'month').format('YYYY-MM-DD');

      const { data, error } = await supabase
        .from('DB_Kampfliste')
        .select(`
          datum,
          ist_schicht (
            id,
            kuerzel,
            beschreibung,
            farbe_bg,
            farbe_text
          )
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('user', userId)
        .gte('datum', heute)
        .lte('datum', bis)
        .in('ist_schicht', ids)
        .order('datum', { ascending: true });

      if (!alive) return;

      if (error) {
        console.error(
          '❌ Fehler beim Laden zukünftiger Abwesenheiten:',
          error.message || error
        );
        setRows([]);
      } else {
        setRows(data || []);
      }

      setLoading(false);
    };

    laden();

    return () => {
      alive = false;
    };
  }, [firma, unit, userId, ids, refreshKey]);

  const zeitraeume = useMemo(
    () => gruppiereZeitraeume(rows),
    [rows]
  );

  return (
    <section className="h-full rounded-xl border border-gray-300 bg-gray-100/80 p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900/35">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Kommende Abwesenheiten
        </h2>
      </div>

      {!ids.length && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white/40 px-3 py-8 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/20 dark:text-gray-400">
          Wähle im Persönlichen Bereich die gewünschten Kürzel aus.
        </div>
      )}

      {!!ids.length && loading && (
        <div className="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
          Abwesenheiten werden geladen...
        </div>
      )}

      {!!ids.length && !loading && !zeitraeume.length && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white/40 px-3 py-8 text-center text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/20 dark:text-gray-400">
          Keine passenden zukünftigen Einträge vorhanden.
        </div>
      )}

      {!!ids.length && !loading && !!zeitraeume.length && (
        <div
          className="space-y-2 pr-1"
          style={{
            maxHeight: 420,
            overflowY: 'auto',
            scrollbarGutter: 'stable',
          }}
        >
          {zeitraeume.map((zeitraum) => {
            const schicht = zeitraum.schicht;
            const key = `${schicht.id}-${zeitraum.von}-${zeitraum.bis}`;

            return (
              <article
                key={key}
                className="relative overflow-hidden rounded-lg border border-gray-300 bg-white/75 p-3 pl-4 shadow-sm transition hover:bg-white dark:border-gray-700 dark:bg-gray-800/55 dark:hover:bg-gray-800/80"
              >
                <div
                  className="absolute inset-y-0 left-0 w-1"
                  style={{
                    backgroundColor: schicht.farbe_bg || '#9ca3af',
                  }}
                />

                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md border px-1.5 text-xs font-semibold shadow-sm"
                    style={{
                      backgroundColor: schicht.farbe_bg || '#e5e7eb',
                      color: schicht.farbe_text || '#111827',
                      borderColor: schicht.farbe_bg || '#9ca3af',
                    }}
                  >
                    {schicht.kuerzel || (
                      <CalendarDays size={15} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {schicht.beschreibung || schicht.kuerzel}
                    </div>

                    <div className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                      {datumLabel(zeitraum.von, zeitraum.bis)}
                    </div>

                    <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                      {zeitraum.tage}{' '}
                      {zeitraum.tage === 1 ? 'Tag' : 'Tage'}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SelfAbwesenheiten;
