import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRollen } from '../context/RollenContext';
import { Sun, Moon } from 'lucide-react';
import { supabase } from '../supabaseClient'; // ✨ NEU

const Navigation = ({ darkMode, setDarkMode }) => {
  const location = useLocation();
  const [verwaltungOpen, setVerwaltungOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [plannungOpen, setPlannungOpen] = useState(false);

  const { rolle, sichtFirma: firma, sichtUnit: unit } = useRollen(); // ✨ firma & unit hinzu
  const verwaltungTimeout = useRef(null);
  const reportTimeout = useRef(null);
  const adminTimeout = useRef(null);
  const plannungTimeout = useRef(null);
  const delay = 300;

  // ---------- Feature Gate: top_report (nur für Linkanzeige) ----------
  const [canSeeTopReport, setCanSeeTopReport] = useState(false);

  useEffect(() => {
    // Nur für Rollen mit Reports-Menü prüfen
    if (!['SuperAdmin', 'Admin_Dev'].includes(rolle) || !unit) {
      setCanSeeTopReport(false);
      return;
    }
    // leichte, schnelle Abfrage: rufe top_report mit Mini-Zeitraum auf und lese "enabled"
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('top_report', {
          p_unit_id: unit,
          p_from: today,
          p_to: today,
          p_limit: 1,
        });
        if (error) {
          console.error('feature gate (top_report) check error:', error);
          setCanSeeTopReport(false);
        } else {
          setCanSeeTopReport(!!data?.enabled);
        }
      } catch (e) {
        console.error('feature gate (top_report) check ex:', e);
        setCanSeeTopReport(false);
      }
    })();
  }, [rolle, unit]);
  // -------------------------------------------------------------------

  const openVerwaltung = () => { clearTimeout(verwaltungTimeout.current); setVerwaltungOpen(true); };
  const closeVerwaltung = () => { verwaltungTimeout.current = setTimeout(() => setVerwaltungOpen(false), delay); };

  const openPlannung = () => { clearTimeout(plannungTimeout.current); setPlannungOpen(true); };
  const closePlannung = () => { plannungTimeout.current = setTimeout(() => setPlannungOpen(false), delay); };

  const openReport = () => { clearTimeout(reportTimeout.current); setReportOpen(true); };
  const closeReport = () => { reportTimeout.current = setTimeout(() => setReportOpen(false), delay); };

  const openAdmin = () => { clearTimeout(adminTimeout.current); setAdminOpen(true); };
  const closeAdmin = () => { adminTimeout.current = setTimeout(() => setAdminOpen(false), delay); };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const pfadZuTitel = {
    '/dashboard': 'Übersicht',
    '/schichtcockpit': 'Cockpit',
    '/kundenverwaltung': 'Unternehmen',
    '/schichtart-pflegen': 'Schichtarten einpflegen',
    '/schichtzuweisen': 'Schicht zuweisen',
    '/user-anlegen': 'Benutzerverwaltung',
    '/sollplan-editor': 'Sollplan erstellen',
    '/bedarfsverwaltung': 'Bedarf Verwalten',
    '/qualifikationenverwalten': 'Qualifikationen zuweisen',
    '/qualifikationsmatrix': 'Qualifikationen einpflegen',
    '/ferienundfeiertage': 'Ferien & Feiertage',
    '/termineverwaltung': 'Termine',
    '/system-tools': 'System-Tools',
    '/unit-reports': 'Unit bericht',
    '/userpflege': 'UserPflege',
    '/top-report': 'Top bericht',
  };

  const aktuellerTitel = pfadZuTitel[location.pathname] || '';

  return (
    <nav className="relative flex items-center justify-between text-sm font-semibold text-white dark:text-white px-2">
      <div className="flex gap-8 items-center">
        {/* Übersicht: Alle außer Org_Admin */}
        {rolle !== 'Org_Admin' && (
          <Link to="/dashboard" className="hover:underline">Übersicht</Link>
        )}

        {/* Cockpit: Alle außer Org_Admin */}
        {rolle !== 'Org_Admin' && (
          <Link to="/schichtcockpit" className="hover:underline">Cockpit</Link>
        )}

        {/* Planner-Menü: Nur SuperAdmin, Admin_Dev, Planner */}
        {['SuperAdmin', 'Admin_Dev', 'Planner'].includes(rolle) && (
          <div className="relative" onMouseEnter={openPlannung} onMouseLeave={closePlannung}>
            <span className="cursor-pointer">Plannung ▾</span>
            {plannungOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-md p-0 z-50 flex flex-col gap-1">
                <Link to="/bedarfsverwaltung" className="hover:bg-gray-700 rounded px-2 py-1">Bedarf Verwalten</Link>
                <Link to="/termineverwaltung" className="hover:bg-gray-700 rounded px-2 py-1">Termine</Link>
              </div>
            )}
          </div>
        )}

        {/* Verwaltung-Menü: Nur SuperAdmin, Admin_Dev */}
        {['SuperAdmin', 'Admin_Dev'].includes(rolle) && (
          <div className="relative" onMouseEnter={openVerwaltung} onMouseLeave={closeVerwaltung}>
            <span className="cursor-pointer">Verwaltung ▾</span>
            {verwaltungOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-md p-0 z-50 flex flex-col gap-1">
                <Link to="/schichtart-pflegen" className="hover:bg-gray-700 rounded px-2 py-1">Schichtarten einpflegen</Link>
                <Link to="/qualifikationsmatrix" className="hover:bg-gray-700 rounded px-2 py-1">Qualifikation einpflegen</Link>
                <Link to="/qualifikationenverwalten" className="hover:bg-gray-700 rounded px-2 py-1">Qualifikationen zuweisen</Link>
                <Link to="/schichtzuweisen" className="hover:bg-gray-700 rounded px-2 py-1">Schicht zuweisen</Link>
                <Link to="/userpflege" className="hover:bg-gray-700 rounded px-2 py-1">User Pflegen</Link>
              </div>
            )}
          </div>
        )}

        {/* Reports-Menü: Nur SuperAdmin, Admin_Dev */}
        {['SuperAdmin', 'Admin_Dev'].includes(rolle) && (
          <div className="relative" onMouseEnter={openReport} onMouseLeave={closeReport}>
            <span className="cursor-pointer">Berichte ▾</span>
            {reportOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-md p-0 z-50 flex flex-col gap-1">
                <Link to="/unit-reports" className="hover:bg-gray-700 rounded px-2 py-1">Unit bericht</Link>
                {/* ✨ Nur anzeigen, wenn Feature wirklich aktiv */}
                {canSeeTopReport && (
                  <Link to="/top-report" className="hover:bg-gray-700 rounded px-2 py-1">Top bericht</Link>
                )}
              </div>
            )}
          </div>
        )}

        {/* Admin-Menü: Nur SuperAdmin */}
        {rolle === 'SuperAdmin' && (
          <div className="relative" onMouseEnter={openAdmin} onMouseLeave={closeAdmin}>
            <span className="cursor-pointer">Admin ▾</span>
            {adminOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-md p-0 z-50 flex flex-col gap-1">
                <Link to="/sollplan-editor" className="hover:bg-gray-700 rounded px-2 py-1">Sollplan erstellen</Link>
                <Link to="/user-anlegen" className="hover:bg-gray-700 rounded px-2 py-1">User verwalten</Link>
                <Link to="/ferienundfeiertage" className="hover:bg-gray-700 rounded px-2 py-1">Ferien & Feiertage</Link>
                <Link to="/system-tools" className="hover:bg-gray-700 rounded px-2 py-1">System-Tools</Link>
              </div>
            )}
          </div>
        )}

        {/* Kundenverwaltung: Nur Org_Admin & SuperAdmin */}
        {['SuperAdmin', 'Org_Admin'].includes(rolle) && (
          <Link to="/kundenverwaltung" className="hover:underline">Unternehmen</Link>
        )}
      </div>

      {/* Titel-Zeile in der Mitte */}
      <div className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold pointer-events-none whitespace-nowrap">
        {aktuellerTitel}
      </div>

      {/* Darkmode-Switch */}
      <div>
        <button
          onClick={toggleDarkMode}
          className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
          title="Dark / Light Mode"
        >
        {darkMode ? <Moon size={18} /> : <Sun size={18} />}
          <span>{darkMode ? 'Dark' : 'Light'}</span>
        </button>
      </div>
    </nav>
  );
};

export default Navigation;

