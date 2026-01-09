// src/components/Dashboard/BAM_MitarbeiterimDienst.jsx
import React from 'react';

export default function BAM_MitarbeiterimDienst({ mitarbeiter = [] }) {
  return (
    <div>
      <h3 className="font-bold mb-2">Mitarbeiter im Dienst</h3>
      <ul className="text-sm list-disc list-inside">
        {mitarbeiter.length > 0
          ? mitarbeiter.map((m, i) => <li key={i}>{m.nachname}, {m.vorname}</li>)
          : <li className="italic">Keine gefunden</li>}
      </ul>
    </div>
  );
}
