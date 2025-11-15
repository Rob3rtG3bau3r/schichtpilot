// src/pages/SystemTools.jsx
import React, { useEffect, useState } from 'react';
import { Wrench, Users, Settings, Clock, Database, UserPlus, BadgeEuro } from 'lucide-react';
import SystemTab from '../components/SystemTools/SystemTab';
import KundenTab from '../components/SystemTools/KundenTab';
import FeaturesTab from '../components/SystemTools/FeaturesTab';
import LoginTab from '../components/SystemTools/LoginTab';
import DataCleanUpTab from '../components/SystemTools/DataCleanUpTab';
import TestzugangTab from '../components/SystemTools/TestzugangTab';
import SystemAbrechnungTab from '../components/SystemTools/SystemAbrechnungTab';


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

        <div className="flex flex-wrap gap-1">
          <TabButton edge="left"  active={tab==='system'}   onClick={() => setTab('system')}   icon={Wrench}>System</TabButton>
          <TabButton               active={tab==='kunden'}   onClick={() => setTab('kunden')}   icon={Users}>Kunden</TabButton>
          <TabButton               active={tab==='abrechnung'}  onClick={() => setTab('abrechnung')}  icon={BadgeEuro}   edge="right">Abrechnung</TabButton>
          <TabButton               active={tab==='features'} onClick={() => setTab('features')} icon={Settings}>Features</TabButton>
          <TabButton               active={tab==='login'}    onClick={() => setTab('login')}    icon={Clock}>Login-Logs</TabButton>
          <TabButton               active={tab==='cleanup'}  onClick={() => setTab('cleanup')}  icon={Database}>Data Cleanup</TabButton>
          <TabButton edge="right" active={tab==='testzugang'} onClick={() => setTab('testzugang')} icon={UserPlus}>Testzugang</TabButton>
        </div>
      </div>

      {tab === 'system'      && <SystemTab />}
      {tab === 'kunden'      && <KundenTab />}
      {tab === 'abrechnung' && <SystemAbrechnungTab />}
      {tab === 'features'    && <FeaturesTab />}
      {tab === 'login'       && <LoginTab />}
      {tab === 'cleanup'     && <DataCleanUpTab />}
      {tab === 'testzugang'  && <TestzugangTab />}
    </div>
  );
}
