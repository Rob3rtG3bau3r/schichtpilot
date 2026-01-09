// src/pages/Aenderungsprotokoll.jsx
'use client';
import React from 'react';
import { ClipboardList } from 'lucide-react';
import { useRollen } from '../context/RollenContext';
import AenderungsprotokollTab from '../components/Aenderungsprotokoll/AenderungsprotokollTab';

/* --- gleiche Card wie du sie oft nutzt (nur Style) --- */
const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
    {children}
  </div>
);

export default function Aenderungsprotokoll() {
  const { rolle, sichtFirma: firma_id, sichtUnit: unit_id } = useRollen();

  // Optional: gleiche Rollen wie bei Stundenpflege (falls du das identisch halten willst)
  const ALLOWED_ROLES = ['Admin_Dev', 'Planner', 'Org_Admin', 'SuperAdmin'];
  const roleOk = ALLOWED_ROLES.includes(rolle);

  if (!roleOk) {
    return (
      <div className="p-3">
        <Card className="p-4">
          <div className="text-sm text-gray-700 dark:text-gray-200">Kein Zugriff.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Header */}
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-gray-700 dark:text-gray-200" />
          <div>
            <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Änderungsprotokoll
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Unit: {unit_id} · Firma: {firma_id}
            </div>
          </div>
        </div>
      </Card>

      {/* Inhalt: deine bestehende Logik 1:1 */}
      <AenderungsprotokollTab firma_id={firma_id} unit_id={unit_id} />
    </div>
  );
}
