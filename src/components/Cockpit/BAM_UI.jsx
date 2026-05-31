// src/components/Dashboard/BAM_UI.jsx
import React from 'react';
import { Info, X } from 'lucide-react';

export const BAM_UI = ({
  offen,
  onClose,
  onInfo,
  onOpenAnfrage,
  title,
  subtitle,
  children,
}) => {
  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-2xl w-full max-w-6xl max-h-[92vh] shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-fade-in"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Bedarfsanalyse
              </div>
              <h2 className="text-xl font-bold leading-tight truncate">
                {title}
              </h2>
              {subtitle ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {subtitle}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2 items-center shrink-0">
              {onOpenAnfrage && (
                <button
                  type="button"
                  onClick={onOpenAnfrage}
                  title="Anfrage stellen"
                  className="text-xs px-3 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-sm"
                >
                  Anfrage
                </button>
              )}

              <button
                type="button"
                onClick={onInfo}
                title="Info"
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
              >
                <Info size={18} />
              </button>

              <button
                type="button"
                onClick={onClose}
                title="Schließen"
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export const BAM_InfoModal = ({ offen, onClose }) => {
  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm z-[80] p-3"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-gray-900 p-6 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100"
      >
        <h3 className="text-lg font-bold mb-2">Regeln zur Anzeige</h3>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
          aria-label="Schließen"
        >
          ×
        </button>

        <ul className="space-y-2 mt-4">
          <li><span className="inline-block min-w-16 bg-green-500 px-2 py-0.5 rounded-lg text-white text-center">Grün</span> Sehr gute Kombination</li>
          <li><span className="inline-block min-w-16 bg-yellow-500 px-2 py-0.5 rounded-lg text-black text-center">Gelb</span> Gute Kombination</li>
          <li><span className="inline-block min-w-16 bg-amber-500 px-2 py-0.5 rounded-lg text-red-700 text-center">Amber</span> Arbeitszeitverstoß</li>
          <li><span className="inline-block min-w-16 bg-red-500 px-2 py-0.5 rounded-lg text-white text-center">Rot</span> Kollision</li>
        </ul>
      </div>
    </div>
  );
};
