import React, { useState } from 'react';

const ZusatzbedarfZeile = ({ datum, items = [], onItemClick }) => {
  const [hoverItemId, setHoverItemId] = useState(null);

  if (!items || items.length === 0) {
    return <div className="w-full h-[10px]" />;
  }

  return (
    <div className="w-full h-[10px] flex flex-col justify-start gap-[1px] overflow-visible">
      {items.map((item) => {
        const isHover = hoverItemId === item.id;

        return (
          <div
            key={`${datum}-${item.id}`}
            className="relative w-full h-[4px]"
            onMouseEnter={() => setHoverItemId(item.id)}
            onMouseLeave={() => setHoverItemId(null)}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onItemClick?.(item);
              }}
              className={[
                'block w-full h-[6px]',
                'rounded-full',
                'opacity-85 hover:opacity-100',
                'transition-opacity',
                item.statusClass || 'bg-gray-300 dark:bg-gray-700',
              ].join(' ')}
            />

            {isHover && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-72 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 text-xs pointer-events-none">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-bold text-sm">
                      {item.name || 'Zusatzbedarf'}
                    </div>

                    <div className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.kuerzel || '—'} · {item.eingetragen}/{item.benoetigt} Person(en)
                    </div>
                  </div>

                  {item.statusText && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px]">
                      {item.statusText}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {item.qualiName ? (
                    <div>
                      <span className="font-semibold">Qualifikation: </span>
                      {item.qualiKuerzel ? `${item.qualiKuerzel} · ` : ''}
                      {item.qualiName}
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold">Qualifikation: </span>
                      keine benötigt
                    </div>
                  )}

                  <div>
                    <span className="font-semibold">Fehlt: </span>
                    {item.fehlt || 0}
                  </div>

                  {item.schichtartBeschreibung && (
                    <div>
                      <span className="font-semibold">Kürzel-Info: </span>
                      {item.schichtartBeschreibung}
                    </div>
                  )}

                  {item.raw?.beschreibung && (
                    <div>
                      <span className="font-semibold">Beschreibung: </span>
                      {item.raw.beschreibung}
                    </div>
                  )}

                  {item.raw?.hinweis && (
                    <div>
                      <span className="font-semibold">Hinweis: </span>
                      {item.raw.hinweis}
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
                    Keine Arbeitszeit- oder Ruhezeitprüfung. Gezählt werden passende Einträge aus dem Dienstplan.
                  </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-2 h-2 rotate-45 bg-white dark:bg-gray-900 border-l border-t border-gray-300 dark:border-gray-700" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ZusatzbedarfZeile;