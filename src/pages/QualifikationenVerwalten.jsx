// pages/QualifikationsVerwaltung.jsx
import React, { useState } from 'react';
import PersonalListe from '../components/QualifikationsVerwaltung/PersonalListe';
import QualiZuweisung from '../components/QualifikationsVerwaltung/QualiZuweisung';


const QualifikationsVerwaltung = () => {
    const [ausgewaehlterUser, setAusgewaehlterUser] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="px-6 pb-2 space-y-6">
      <div className="flex justify-center">
        <div className="grid grid-cols-12 gap-4 w-full mx-auto">
  <div className="col-span-4 min-w-[400px]">
    <PersonalListe onUserClick={setAusgewaehlterUser} refreshKey={refreshKey}/>
  </div>
  <div className="col-span-8 min-w-[900px]">
    <QualiZuweisung user={ausgewaehlterUser} triggerRefresh={() => setRefreshKey(prev => prev + 1)}/>
  </div>
</div>

      </div>
    </div>
  );
};

export default QualifikationsVerwaltung;