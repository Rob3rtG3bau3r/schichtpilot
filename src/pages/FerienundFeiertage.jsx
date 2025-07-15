// pages/FerienundFeiertage.jsx
import FerienundFeiertageFormular from '../components/FerienundFeiertage/FerienundFeiertageFormular';
import FerienundFeiertageZusammengefasst from '../components/FerienundFeiertage/FerienundFeiertageZusammengefasst';
import FerienundFeiertageAnzeige from '../components/FerienundFeiertage/FerienundFeiertageAnzeige';
import React, { useState } from 'react';

const FerienundFeiertage = () => {
  const [refreshFeiertage, setRefreshFeiertage] = useState(0);

  return (
    <div className="px-6 pb-6 text-gray-900 dark:text-gray-200">
      <div className="grid grid-cols-12 gap-4 max-w-[1600px] mx-auto">
        {/* Links: Formular */}
        <div className="col-span-4 p-4">
          <FerienundFeiertageFormular onRefresh={() => setRefreshFeiertage(prev => prev + 1)} />
        </div>

        {/* Rechts: Zusammengefasst + Anzeige */}
        <div className="col-span-8 flex flex-col gap-4">
          <FerienundFeiertageZusammengefasst refresh={refreshFeiertage} />
          <FerienundFeiertageAnzeige />
        </div>
      </div>
    </div>
  );
};

export default FerienundFeiertage;

