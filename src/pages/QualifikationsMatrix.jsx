import React, { useState } from 'react';
import QualifikationsFormular from '../components/QualifikationsMatrix/QualifikationsFormular.jsx';
import QualifikationsAnzeige from '../components/QualifikationsMatrix/QualifikationsAnzeige.jsx';

const QualifikationsMatrix = () => {
const [refreshKey, setRefreshKey] = useState(0);
const [bearbeitung, setBearbeitung] = useState(null);

const handleRefresh = () => setRefreshKey((prev) => prev + 1);
const handleEdit = (eintrag) => setBearbeitung(eintrag);
const resetBearbeitung = () => setBearbeitung(null);

return (
  <div className="flex flex-col items-center">
    <div className="grid grid-cols-12 gap-5 w-full max-w-7xl">
      <div className="col-span-3">
        <QualifikationsFormular
          bearbeitung={bearbeitung}
          setBearbeitung={setBearbeitung}
          onReload={handleRefresh}
        />
      </div>
      <div className="col-span-9">
        <QualifikationsAnzeige
          onEdit={handleEdit}
          onReload={handleRefresh}
          refreshKey={refreshKey}
        />
      </div>
    </div>
  </div>
);
};

export default QualifikationsMatrix;
