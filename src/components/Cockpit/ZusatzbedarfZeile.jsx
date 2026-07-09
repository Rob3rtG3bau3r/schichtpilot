import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const ZusatzbedarfZeile = ({ datum, items = [], onItemClick }) => {
  const [hoverItem, setHoverItem] = useState(null);
  const showTimerRef = useRef(null);
  const hideTimerRef = useRef(null);

  const clearShowTimer = () => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearShowTimer();
      clearHideTimer();
    };
  }, []);

  if (!items || items.length === 0) {
    return <div className="w-full h-[10px]" />;
  }

  const showNotice = (item, el) => {
    if (!el) return;

    const rect = el.getBoundingClientRect();

    const width = 288;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8
    );

    const top = rect.bottom + 8;

    setHoverItem({
      item,
      top,
      left,
      width,
    });
  };

  const scheduleShowNotice = (item, el) => {
    if (!el) return;

    clearShowTimer();
    clearHideTimer();

    showTimerRef.current = setTimeout(() => {
      showNotice(item, el);
    }, 450);
  };

  const scheduleHideNotice = () => {
    clearShowTimer();
    clearHideTimer();

    hideTimerRef.current = setTimeout(() => {
      setHoverItem(null);
    }, 120);
  };

  const hideNoticeNow = () => {
    clearShowTimer();
    clearHideTimer();
    setHoverItem(null);
  };

  return (
    <div className="w-full h-[10px] flex flex-col justify-start gap-[1px] overflow-visible">
      {items.map((item) => {
        return (
          <div
            key={`${datum}-${item.id}`}
            className="relative w-full h-[4px]"
          >
            <button
              type="button"
              onMouseEnter={(e) => scheduleShowNotice(item, e.currentTarget)}
              onMouseLeave={scheduleHideNotice}
              onClick={(e) => {
                e.stopPropagation();
                hideNoticeNow();
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
          </div>
        );
      })}

      {hoverItem &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: hoverItem.top,
              left: hoverItem.left,
              width: hoverItem.width,
              zIndex: 100000,
            }}
            className="rounded-xl shadow-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-3 text-xs pointer-events-none max-h-[70vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-bold text-sm">
                  {hoverItem.item.name || 'Zusatzbedarf'}
                </div>

                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {hoverItem.item.kuerzel || '—'} · {hoverItem.item.eingetragen}/
                  {hoverItem.item.benoetigt} Person(en)
                </div>
              </div>

              {hoverItem.item.statusText && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[10px]">
                  {hoverItem.item.statusText}
                </span>
              )}
            </div>

            <div className="space-y-1">
              {hoverItem.item.qualiName ? (
                <div>
                  <span className="font-semibold">Qualifikation: </span>
                  {hoverItem.item.qualiKuerzel ? `${hoverItem.item.qualiKuerzel} · ` : ''}
                  {hoverItem.item.qualiName}
                </div>
              ) : (
                <div>
                  <span className="font-semibold">Qualifikation: </span>
                  keine benötigt
                </div>
              )}

              <div>
                <span className="font-semibold">Fehlt: </span>
                {hoverItem.item.fehlt || 0}
              </div>

              {hoverItem.item.schichtartBeschreibung && (
                <div>
                  <span className="font-semibold">Kürzel-Info: </span>
                  {hoverItem.item.schichtartBeschreibung}
                </div>
              )}

              {hoverItem.item.raw?.beschreibung && (
                <div>
                  <span className="font-semibold">Beschreibung: </span>
                  {hoverItem.item.raw.beschreibung}
                </div>
              )}

              {hoverItem.item.raw?.hinweis && (
                <div>
                  <span className="font-semibold">Hinweis: </span>
                  {hoverItem.item.raw.hinweis}
                </div>
              )}

              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="font-semibold mb-1">
                  Bereits eingetragen:
                </div>

                {hoverItem.item.eingetrageneNamen?.length > 0 ? (
                  <div className="space-y-0.5">
                    {hoverItem.item.eingetrageneNamen.map((name) => (
                      <div key={name}>
                        • {name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">
                    Noch niemand eingetragen.
                  </div>
                )}
              </div>

              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-[11px] text-gray-500 dark:text-gray-400">
                Keine Arbeitszeit- oder Ruhezeitprüfung. Gezählt werden passende Einträge aus dem Dienstplan.
              </div>
            </div>

            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rotate-45 bg-white dark:bg-gray-900 border-l border-t border-gray-300 dark:border-gray-700" />
          </div>,
          document.body
        )}
    </div>
  );
};

export default ZusatzbedarfZeile;