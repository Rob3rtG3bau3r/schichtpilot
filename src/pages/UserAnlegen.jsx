import React, { useState } from 'react';
import BenutzerFormular from '../components/User/BenutzerFormular';
import BenutzerTabelle from '../components/User/BenutzerTabelle';

const UserAnlegen = () => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [refresh, setRefresh] = useState(false);

  const ladeTabelleNeu = () => {
    setRefresh(prev => !prev); // Toggle-Wert zum Triggern des Reloads
  };

  return (
    <div className="px-6 pb-2  text-white">

      {/* Zwei-Spalten-Layout */}
      <div className="grid grid-cols-12 gap-5">
        {/* Linke Spalte: Formular */}
        <div className="col-span-3">
          <BenutzerFormular
            selectedUser={selectedUser}
            onUserUpdated={ladeTabelleNeu}
            onCancelEdit={() => setSelectedUser(null)}
          />
        </div>

        {/* Rechte Spalte: Tabelle */}
        <div className="col-span-9">
          <BenutzerTabelle 
            onEditUser={(user) => setSelectedUser(user)} 
            refresh={refresh}
          />
        </div>
      </div>
    </div>
  );
};

export default UserAnlegen;
