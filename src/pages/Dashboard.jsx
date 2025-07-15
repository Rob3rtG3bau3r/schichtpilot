import React from 'react';
import { useRollen } from '../context/RollenContext';
import MeineDienste from '../components/Dashboard/MeineDienste';
import AnfragenMitarbeiter from '../components/Dashboard/AnfragenMitarbeiter';

const Dashboard = () => {
  const { rolle } = useRollen();

  return (
    <div className="p-4">
      <div className="grid grid-cols-12 gap-4">
        {/* Linke Spalte – 5/12 */}
        <div className="col-span-12 md:col-span-4">
          <MeineDienste />
        </div>

        {/* Rechte Spalte – 7/12 */}
        <div className="col-span-12 md:col-span-8">
          <AnfragenMitarbeiter />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

