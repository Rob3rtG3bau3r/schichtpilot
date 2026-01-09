// src/pages/UnitUserStundenPflege.jsx
'use client';
import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useRollen } from '../context/RollenContext';
import UeberstundenTab from '../components/UnitUserStundenPflege/UeberstundenTab';
import VorgabestundenTab from '../components/UnitUserStundenPflege/VorgabestundenTab';
import AbzugstundenTab from '../components/UnitUserStundenPflege/AbzugstundenTab';
import VorgabeurlaubTab from '../components/UnitUserStundenPflege/VorgabeurlaubTab';
const ALLOWED_ROLES = ['Admin_Dev', 'Planner', 'Org_Admin', 'SuperAdmin'];

/* ---------------- UI Helpers (nur Style) ---------------- */
const Card = ({ className = '', children }) => (
  <div className={`rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
    {children}
  </div>
);

export default function UnitUserStundenPflege() {
  const { rolle, sichtFirma: firma_id, sichtUnit: unit_id } = useRollen();
  const roleOk = ALLOWED_ROLES.includes(rolle);

  // Parent nur Struktur: Tabwahl ist ok
  const [tab, setTab] = useState('vorgabe');

  if (!roleOk) {
    return (
      <Card className="p-4">
        <div className="text-sm text-gray-700 dark:text-gray-200">Kein Zugriff.</div>
      </Card>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Header + Tabs (nur Struktur) */}
      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gray-700 dark:text-gray-200" />
            <div>
              <div className="text-base font-semibold text-gray-900 dark:text-gray-100">Stunden bearbeiten</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                Unit: {unit_id} · Firma: {firma_id}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setTab('vorgabe')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'vorgabe'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Vorgabestunden
          </button>
                   <button
            onClick={() => setTab('ueberstunden')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'ueberstunden'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Überstunden
          </button>

          
          <button
            onClick={() => setTab('abzugstunden')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'abzugstunden'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Abzugstunden
          </button>
          <button
            onClick={() => setTab('vorgabeurlaub')}
            className={`px-3 py-2 rounded-xl text-sm font-semibold border
              ${tab === 'vorgabeurlaub'
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-100 dark:bg-gray-900/40 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
          >
            Vorgabeurlaub
          </button>
        </div>
      </Card>

      {/* Content: jedes Tab macht seine komplette Logik selbst */}
      {tab === 'ueberstunden' ? (
  <UeberstundenTab firma_id={firma_id} unit_id={unit_id} />
) : tab === 'vorgabe' ? (
  <VorgabestundenTab firma_id={firma_id} unit_id={unit_id} />
) : tab === 'vorgabeurlaub' ? (
  <VorgabeurlaubTab firma_id={firma_id} unit_id={unit_id} />
) : tab === 'abzugstunden' ? (  
  <AbzugstundenTab firma_id={firma_id} unit_id={unit_id} />
) : null}
    </div>
  );
}
