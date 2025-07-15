import React, { useState, useEffect } from 'react';
import PersonalListe from '../components/Schichtzuweisen/PersonalListe';
import SchichtzuweisungFormular from '../components/Schichtzuweisen/SchichtzuweisungFormular';
import TeamVorschau from '../components/Schichtzuweisen/TeamVorschau';
import { useRollen } from '../context/RollenContext';

const Schichtzuweisen = () => {
  const { sichtFirma, sichtUnit } = useRollen(); // Firma/Unit aus RollenContext
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(Date.now());
  const [datumStart, setDatumStart] = useState('');

  const handleRefresh = () => {
    setReloadTrigger(Date.now());
  };

  return (
    <div className="px-6 pb-2 text-white">
      <div className="flex justify-center">
        <div className="grid grid-cols-12 gap-5">
          <PersonalListe
            firma={sichtFirma}
            unit={sichtUnit}
            onUserSelect={setSelectedUser}
            datumStart={datumStart} 
            className="col-span-5"
            key={`personal-${reloadTrigger}`}
          />

          <SchichtzuweisungFormular
            selectedUser={selectedUser}
            firma={sichtFirma}
            unit={sichtUnit}
            onTeamSelect={(team) => setSelectedTeam(`${team}`)}
            onRefresh={handleRefresh}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            className="col-span-3"
          />

          <TeamVorschau
            selectedTeam={selectedTeam}
            firmenId={sichtFirma}
            unitId={sichtUnit}
            anzeigeDatum={datumStart}
            className="col-span-4"
            key={`team-${reloadTrigger}`}
          />
        </div>
      </div>
    </div>
  );
};

export default Schichtzuweisen;
