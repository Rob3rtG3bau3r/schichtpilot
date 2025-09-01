import React, { useState, useMemo } from 'react';

const AdminPanel = ({
  dbUser,
  selectedUser,
  setSelectedUser,
  handleChangeUser,
  handleReset,
  umgeloggt,
  meldung,
  setAdminPanelOffen
}) => {
  const [search, setSearch] = useState('');

  // Gefilterte User nach Suche
  const filteredUsers = useMemo(() => {
    return dbUser.filter(
      (user) =>
        user.vorname.toLowerCase().includes(search.toLowerCase()) ||
        user.nachname.toLowerCase().includes(search.toLowerCase())
    );
  }, [dbUser, search]);

  const selectedUserData = dbUser.find((u) => u.user_id === selectedUser);

  return (
    <div
      className={`py-3 px-4 rounded-xl shadow-xl transition-all duration-300 ${
        umgeloggt ? 'bg-red-600' : 'bg-gray-700'
      } text-white w-80 text-sm`}
    >
      {meldung && (
        <div className="text-green-200 bg-green-800 p-1.5 rounded text-center mb-2 text-xs">
          {meldung}
        </div>
      )}

      {/* Suchfeld */}
      <input
        type="text"
        placeholder="Nutzer suchen..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-gray-500 bg-gray-800 text-white px-2 py-1 text-xs focus:ring-2 focus:ring-blue-400 mb-2"
      />

      {/* User Dropdown */}
      <select
        className="w-full rounded-md border border-gray-500 bg-gray-800 text-white px-2 py-1 text-xs mb-2"
        value={selectedUser}
        onChange={(e) => setSelectedUser(e.target.value)}
      >
        <option value="">-- Nutzer auswählen --</option>
        {filteredUsers.map((user) => (
          <option key={user.user_id} value={user.user_id}>
            {user.vorname} {user.nachname} ({user.email})
          </option>
        ))}
      </select>

      {/* Rolle des Users */}
      {selectedUserData && (
        <div className="mb-2 text-xs text-gray-200">
          Rolle: <span className="font-semibold">{selectedUserData.rolle}</span>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-2">
        <button
          className="bg-blue-500 hover:bg-blue-600 transition-colors text-white px-2 py-1 rounded-md text-xs shadow"
          onClick={handleChangeUser}
        >
          Change
        </button>

        <button
          className="bg-yellow-500 hover:bg-yellow-600 transition-colors text-black px-2 py-1 rounded-md text-xs shadow"
          onClick={() => handleReset(false)}
        >
          Reset
        </button>

        <button
          className="bg-gray-500 hover:bg-gray-600 transition-colors text-white px-2 py-1 rounded-md text-xs shadow"
          onClick={() => handleReset(true)}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AdminPanel;
