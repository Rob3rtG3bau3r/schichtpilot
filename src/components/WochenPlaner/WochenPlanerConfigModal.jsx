// src/components/WochenPlaner/WochenPlanerConfigModal.jsx
import React, { useEffect, useState } from 'react';

const WochenPlanerConfigModal = ({
  open,
  onClose,
  gruppen = [],
  config,
  onSave,
  loading = false,
}) => {
  const [localConfig, setLocalConfig] = useState({ F: '', S: '', N: '' });

  // Wenn Modal geöffnet oder externe Config geändert → lokale Kopie setzen
  useEffect(() => {
    if (!open) return;
    setLocalConfig({
      F: config?.F || '',
      S: config?.S || '',
      N: config?.N || '',
    });
  }, [open, config]);

  if (!open) return null;

  const handleChange = (feld, value) => {
    setLocalConfig((prev) => ({ ...prev, [feld]: value }));
  };

  const handleSaveClick = () => {
    if (!localConfig.F || !localConfig.S || !localConfig.N) {
      alert('Bitte Früh-, Spät- und Nachtschicht jeweils einer Schichtgruppe zuordnen.');
      return;
    }
    onSave?.(localConfig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-100 dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-4 border border-gray-500">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">
            Schichtgruppen-Konfiguration
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-white hover:bg-gray-600"
          >
            X
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
          Lege fest, welche <span className="font-semibold">Schichtgruppe</span> im
          Sollplan für Früh-, Spät- und Nachtschicht steht.
          Diese Zuordnung wird für die Wochenplanung und die
          Schichtzuweisungen verwendet.
        </p>

        {gruppen.length === 0 ? (
          <p className="text-xs text-red-500 mb-3">
            Es wurden keine Schichtgruppen im Sollplan gefunden. Bitte zuerst
            in <span className="font-semibold">DB_SollPlan</span> Schichtgruppen
            anlegen.
          </p>
        ) : null}

        <div className="space-y-3 mb-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="w-24 font-medium">Frühschicht</span>
            <select
              value={localConfig.F}
              onChange={(e) => handleChange('F', e.target.value)}
              className="flex-1 border rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              <option value="">– Schichtgruppe wählen –</option>
              {gruppen.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="w-24 font-medium">Spätschicht</span>
            <select
              value={localConfig.S}
              onChange={(e) => handleChange('S', e.target.value)}
              className="flex-1 border rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              <option value="">– Schichtgruppe wählen –</option>
              {gruppen.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="w-24 font-medium">Nachtschicht</span>
            <select
              value={localConfig.N}
              onChange={(e) => handleChange('N', e.target.value)}
              className="flex-1 border rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              <option value="">– Schichtgruppe wählen –</option>
              {gruppen.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="text-[10px] text-gray-500">
            Änderungen wirken sich auf zukünftige Zuweisungen aus.
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-xs rounded bg-gray-500 text-white hover:bg-gray-400"
              disabled={loading}
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={loading || gruppen.length === 0}
            >
              {loading ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WochenPlanerConfigModal;
