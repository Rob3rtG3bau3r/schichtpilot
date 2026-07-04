// src/components/Dashboard/BAM_BewertungInfoModal.jsx
import React from 'react';
import { X } from 'lucide-react';

const STUFEN_STYLE = {
  grün: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  gelb: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
  amber: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  rot: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
};

const STUFEN_LABEL = {
  grün: 'Grün – optimal',
  gelb: 'Gelb – okay',
  amber: 'Amber – nicht optimal',
  rot: 'Rot – Kollision',
};

export default function BAM_BewertungInfoModal({
  offen,
  onClose,
  kandidat,
  details,
  modalSchicht,
  modalDatum,
}) {
  if (!offen || !kandidat) return null;

  const stufe = details?.stufe || '—';
  const gruende = Array.isArray(details?.gruende) ? details.gruende : [];

  const schichtLabel =
    modalSchicht === 'F'
      ? 'Früh'
      : modalSchicht === 'S'
        ? 'Spät'
        : modalSchicht === 'N'
          ? 'Nacht'
          : modalSchicht || '—';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100">
              Bewertung erklären
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {kandidat.name} · {schichtLabel} · {modalDatum}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Schließen"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-1">
              Ergebnis
            </div>

            <span
              className={[
                'inline-flex px-3 py-1 rounded-full text-sm font-semibold',
                STUFEN_STYLE[stufe] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
              ].join(' ')}
            >
              {STUFEN_LABEL[stufe] || stufe}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/70 px-3 py-2">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Ruhe vorher
              </div>
              <div className="font-semibold">
                {kandidat.ruheVorherStunden != null
                  ? `${Number(kandidat.ruheVorherStunden).toFixed(1)} Std.`
                  : '—'}
              </div>
            </div>

            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/70 px-3 py-2">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Ruhe nachher
              </div>
              <div className="font-semibold">
                {kandidat.ruheNachherStunden != null
                  ? `${Number(kandidat.ruheNachherStunden).toFixed(1)} Std.`
                  : '—'}
              </div>
            </div>
          </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/70 px-3 py-3 text-xs space-y-2">
            <div className="font-semibold text-gray-700 dark:text-gray-200">
                Debug Zeitberechnung
            </div>

            <div>
                <span className="text-gray-500 dark:text-gray-400">Zielschicht: </span>
                <span className="font-medium">
                {kandidat.zielSchichtIntervall?.kuerzel || '—'}
                {' '}
                {kandidat.zielSchichtIntervall?.startText || '—'}
                –
                {kandidat.zielSchichtIntervall?.endeText || '—'}
                </span>
            </div>

            <div>
                <span className="text-gray-500 dark:text-gray-400">Letzter Dienst vorher: </span>
                <span className="font-medium">
                {kandidat.letzteSchichtVorher?.kuerzel || '—'}
                {' '}
                {kandidat.letzteSchichtVorher?.startText || '—'}
                –
                {kandidat.letzteSchichtVorher?.endeText || '—'}
                </span>
            </div>

            <div>
                <span className="text-gray-500 dark:text-gray-400">Nächster Dienst nachher: </span>
                <span className="font-medium">
                {kandidat.naechsteSchichtNachher?.kuerzel || '—'}
                {' '}
                {kandidat.naechsteSchichtNachher?.startText || '—'}
                –
                {kandidat.naechsteSchichtNachher?.endeText || '—'}
                </span>
            </div>

            <div>
                <span className="text-gray-500 dark:text-gray-400">Nächster relevanter Eintrag nachher: </span>
                <span className="font-medium">
                {kandidat.naechsterRelevanterEintragNachher?.kuerzel || '—'}
                {' '}
                {kandidat.naechsterRelevanterEintragNachher?.datum || ''}
                </span>
            </div>
            </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
              Gründe
            </div>

            {gruende.length > 0 ? (
              <ul className="space-y-2">
                {gruende.map((grund, index) => (
                  <li
                    key={`${grund}-${index}`}
                    className="rounded-xl bg-gray-50 dark:bg-gray-800/70 px-3 py-2 text-sm text-gray-800 dark:text-gray-100"
                  >
                    {grund}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-4 text-sm text-gray-500 dark:text-gray-400 italic">
                Keine Begründung vorhanden.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60 px-3 py-2 text-xs text-blue-900 dark:text-blue-200">
            Hinweis: Die Bewertung ist eine Entscheidungshilfe. Die endgültige Entscheidung trifft weiterhin der Planer.
          </div>
        </div>
      </div>
    </div>
  );
}