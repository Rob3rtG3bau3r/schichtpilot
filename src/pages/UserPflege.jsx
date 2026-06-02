'use client';

import React, { useState } from 'react';
import Personalliste from '../components/UserPflege/PersonalListe';
import Stammdaten from '../components/UserPflege/Stammdaten';
import UserAnlegenAdminDev from '../components/UserPflege/UserAnlegenAdminDev';

export default function UserPflegen() {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modus, setModus] = useState('stammdaten'); // 'stammdaten' | 'anlegen'

  const handleUserClick = (row) => {
    setSelectedUserId(row?.user_id ?? null);
    setModus('stammdaten');
  };

  const handleMitarbeiterHinzufuegen = () => {
    setSelectedUserId(null);
    setModus('anlegen');
  };

  const handleCreated = () => {
    setRefreshKey((k) => k + 1);
    setSelectedUserId(null);
    setModus('stammdaten');
  };

  const handleCancelAnlegen = () => {
    setSelectedUserId(null);
    setModus('stammdaten');
  };

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Personalliste
        onUserClick={handleUserClick}
        refreshKey={refreshKey}
        onAddUser={handleMitarbeiterHinzufuegen}
      />

      {modus === 'anlegen' ? (
        <UserAnlegenAdminDev
          onCreated={handleCreated}
          onCancel={handleCancelAnlegen}
        />
      ) : (
        <Stammdaten
          userId={selectedUserId}
          onSaved={() => setRefreshKey((k) => k + 1)}
          onCancel={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}