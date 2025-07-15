import React, { useState } from 'react';

const FEATURES = [
  { key: 'schichtplannung', label: 'Schichtplannung' },
  { key: 'schichtstatistik', label: 'Schichtstatistik' },
  { key: 'handyapp', label: 'Handy App' }
];

const KundenFeatureUebersicht = () => {
  const [selected, setSelected] = useState({});

  const toggleFeature = (key) => {
    setSelected(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleSave = () => {
    console.log('Aktivierte Features:', selected);
    // TODO: speichern in DB oder Backend-Call planen
  };

  const handleReset = () => {
    setSelected({});
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Features auswählen</h2>
      <div className="space-y-2">
        {FEATURES.map(f => (
          <div key={f.key} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={!!selected[f.key]}
              onChange={() => toggleFeature(f.key)}
            />
            <label>{f.label}</label>
          </div>
        ))}
      </div>
      <div className="pt-4 flex space-x-4">
        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
        >
          Speichern
        </button>
        <button
          onClick={handleReset}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default KundenFeatureUebersicht;
