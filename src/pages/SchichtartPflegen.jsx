import React, { useState, useEffect } from 'react';
import SchichtartFormular from '../components/Schichtart/SchichtartFormular';
import SchichtartTabelle from '../components/Schichtart/SchichtartTabelle';
import { useRollen } from '../context/RollenContext';

const SchichtartPflegen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedSchichtart, setSelectedSchichtart] = useState(null);

  // ✅ NEU: Refresh-Trigger für Tabelle
  const [refreshKey, setRefreshKey] = useState(0);

  const { sichtFirma, sichtUnit, istSuperAdmin } = useRollen();

  useEffect(() => {
    const dark = document.documentElement.classList.contains('dark');
    setDarkMode(dark);

    const observer = new MutationObserver(() => {
      const updatedDark = document.documentElement.classList.contains('dark');
      setDarkMode(updatedDark);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // ✅ NEU: Erhöht refreshKey → Tabelle lädt neu
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div
      className={`min-h-screen px-6 pb-2 ${
        darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-200 text-gray-900'
      }`}
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Linker Bereich: Formular */}
        <SchichtartFormular
          schichtart={selectedSchichtart}
          onReset={() => setSelectedSchichtart(null)}
          onSaved={triggerRefresh}   // ✅ NEU
          darkMode={darkMode}
        />

        {/* Rechter Bereich: Tabelle */}
        <SchichtartTabelle
          onBearbeiten={setSelectedSchichtart}
          refreshKey={refreshKey}    // ✅ NEU
          sichtFirma={sichtFirma}
          sichtUnit={sichtUnit}
          istSuperAdmin={istSuperAdmin}
          darkMode={darkMode}
        />
      </div>
    </div>
  );
};

export default SchichtartPflegen;
