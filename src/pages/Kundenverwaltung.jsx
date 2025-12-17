// src/pages/Kundenverwaltung.jsx
import React, { useState } from 'react';
import KundenInfo from '../components/Kunden/KundenInfo';
//import KundenUnit from '../components/Kunden/KundenUnit';
import KundenFeatureUebersicht from '../components/Kunden/KundenFeatureUebersicht';
import KundenUnitTabelle from '../components/Kunden/KundenUnitTabelle';
import KundenRechnungen from '../components/Kunden/KundenRechnungen';
import { useRollen } from '../context/RollenContext';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, RotateCw } from 'lucide-react';

// ------------- kleine UI-Bausteine (wie im Systemtool) -------------------

const Panel = ({ title, right, children, open = true, setOpen }) => {
  const clickable = !!setOpen;
  return (
    <div className="rounded-2xl border border-gray-700 bg-gray-300 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 mb-3 shadow-sm">
      <div
        className={`flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 ${
          clickable ? 'cursor-pointer hover:bg-gray-800/70' : ''
        }`}
        onClick={clickable ? () => setOpen(!open) : undefined}
      >
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
          {clickable && (
            <span className="text-gray-400">
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          )}
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-300">
          {right}
        </div>
      </div>
      {(!clickable || open) && <div className="px-3 py-3 text-sm">{children}</div>}
    </div>
  );
};

const Badge = ({ children }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-700 text-gray-100">
    {children}
  </span>
);

// ------------------------------------------------------------------------

const Kundenverwaltung = () => {
  const [showFeatures, setShowFeatures] = useState(false);
  const [showTabelle, setShowTabelle] = useState(true);
  const { sichtFirma } = useRollen();
  const navigate = useNavigate();

  return (
    <div className=" pb-3">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
        {/* LINKE SEITE: Unternehmen & Rechnungen */}
        <div className="lg:col-span-5">

          <Panel
            title="Unternehmen"
            right={sichtFirma ? <Badge>Firma #{sichtFirma}</Badge> : null}
          >
            <KundenInfo firma={sichtFirma} />

            {/* Trennlinie */}
            <div className="border-t border-gray-800 my-3" />

            <KundenRechnungen />
          </Panel>
        </div>

        {/* RECHTE SEITE: Unit / Features / Units-Tabelle */}
        <div className="lg:col-span-7">
          <Panel
            title="Vorhandene Units"
            open={showTabelle}
            setOpen={setShowTabelle}
            right={
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-600 text-xs text-gray-200 bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-900/50"
                onClick={() => window.dispatchEvent(new CustomEvent('SP_REFRESH_UNITS'))}
                title="Liste neu laden"
              >
                <RotateCw size={14} />
                Aktualisieren
              </button>
            }
          >
            <KundenUnitTabelle
  onOpenUnitReport={(unit) => {
    navigate(
      `/unit-reports?firma_id=${sichtFirma}&unit_id=${unit.id}&jahr=${new Date().getFullYear()}`
    );
  }}
/>

          </Panel>
          <Panel
            title="Feature-Übersicht (Plan)"
            open={showFeatures}
            setOpen={setShowFeatures}
            right={<Badge>Nur Anzeige</Badge>}
          >
            <KundenFeatureUebersicht />
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default Kundenverwaltung;
