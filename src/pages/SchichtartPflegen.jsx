import React, { useState, useEffect } from 'react';
import SchichtartFormular from '../components/Schichtart/SchichtartFormular';
import SchichtartTabelle from '../components/Schichtart/SchichtartTabelle';
import { useRollen } from '../context/RollenContext';

const SchichtartPflegen = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [selectedSchichtart, setSelectedSchichtart] = useState(null);
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

  return (
    <div className={`min-h-screen px-6 pb-2 ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'}`}>
      {/* Hauptbereich */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Linker Bereich: Formular */}
        <SchichtartFormular
          schichtart={selectedSchichtart}
          onReset={() => setSelectedSchichtart(null)}
          darkMode={darkMode}
        />

        {/* Rechter Bereich: Tabelle */}
        <SchichtartTabelle
          onBearbeiten={setSelectedSchichtart}
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
