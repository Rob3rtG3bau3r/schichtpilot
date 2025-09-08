'use client';
import React, { useState } from 'react';
import Personalliste from '../components/UserPflege/PersonalListe';
import Stammdaten from '../components/UserPflege/Stammdaten';

export default function UserPflegen() {
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Personalliste onUserClick={(row) => setSelectedUserId(row?.user_id ?? null)} />
      <Stammdaten
        userId={selectedUserId}                 // <— Stammdaten bekommt nur die ID
        onSaved={() => setRefreshKey(k => k + 1)}
        onCancel={() => setSelectedUserId(null)}
      />
    </div>
  );
}
