// src/pages/SystemTools.jsx
import React, { useEffect, useState } from 'react';
import { Wrench, Users, Settings } from 'lucide-react';

// Tabs aus deinem components-Ordner
import SystemTab from '../components/SystemTools/SystemTab';
import KundenTab from '../components/SystemTools/KundenTab';
import FeaturesTab from '../components/SystemTools/FeaturesTab';

const TabButton = ({ active, onClick, icon: Icon, children, edge }) => (
  <button
    onClick={onClick}
    className={[
      'px-3 py-2 border border-gray-700 text-sm',
      active ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-200 hover:bg-gray-800',
      edge === 'left' ? 'rounded-l' : edge === 'right' ? 'rounded-r' : '',
    ].join(' ')}
  >
    <Icon size={16} className="inline -mt-0.5 mr-1" />
    {children}
  </button>
);

export default function SystemTools() {
  // Tab-Auswahl (persistiert in localStorage)
  const [tab, setTab] = useState(() => localStorage.getItem('sys_tools_tab') || 'system');
  useEffect(() => { localStorage.setItem('sys_tools_tab', tab); }, [tab]);

  return (
    <div className="min-h-screen bg-gray-800 text-white p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">System-Tools</h1>
        <div className="flex">
          <TabButton edge="left"  active={tab==='system'}   onClick={() => setTab('system')}   icon={Wrench}>System</TabButton>
          <TabButton               active={tab==='kunden'}   onClick={() => setTab('kunden')}   icon={Users}>Kunden</TabButton>
          <TabButton edge="right" active={tab==='features'} onClick={() => setTab('features')} icon={Settings}>Features</TabButton>
        </div>
      </div>

      {tab === 'system'   && <SystemTab />}
      {tab === 'kunden'   && <KundenTab />}
      {tab === 'features' && <FeaturesTab />}
    </div>
  );
}
