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
  const [PlanungOpen, setPlanungOpen] = useState(false);
  const [canSeeWochenplaner, setCanSeeWochenplaner] = useState(false);

  const { rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [canSeeCompanyPage, setCanSeeCompanyPage] = useState(false);

  const verwaltungTimeout = useRef(null);
  const reportTimeout = useRef(null);
  const adminTimeout = useRef(null);
  const PlanungTimeout = useRef(null);
  const delay = 300;

  // ---------- Feature Gate: top_report (nur für Linkanzeige) ----------
  const [canSeeTopReport, setCanSeeTopReport] = useState(false);

  useEffect(() => {
    if (!unit) {
      setCanSeeWochenplaner(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('DB_Unit')
          .select('wochenplanung_aktiv')
          .eq('id', unit)
          .maybeSingle();

        if (error || !data) {
          setCanSeeWochenplaner(false);
        } else {
          setCanSeeWochenplaner(!!data.wochenplanung_aktiv);
        }
      } catch (e) {
        console.error('wochenplanung_aktiv check error:', e);
        setCanSeeWochenplaner(false);
      }
    })();
  }, [unit]);

  useEffect(() => {
    // Nur für Rollen mit Reports-Menü prüfen
    if (!['SuperAdmin', 'Admin_Dev'].includes(rolle) || !unit) {
      setCanSeeTopReport(false);
      return;
    }
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

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setCanSeeCompanyPage(false);
          return;
        }

        const { data, error } = await supabase
          .from('DB_User')
          .select('can_see_company_page')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error || !data) {
          setCanSeeCompanyPage(false);
        } else {
          setCanSeeCompanyPage(!!data.can_see_company_page);
        }
      } catch (e) {
        console.error('can_see_company_page check error:', e);
        setCanSeeCompanyPage(false);
      }
    })();
  }, []);

  const openVerwaltung = () => {
    clearTimeout(verwaltungTimeout.current);
    setVerwaltungOpen(true);
  };
  const closeVerwaltung = () => {
    verwaltungTimeout.current = setTimeout(() => setVerwaltungOpen(false), delay);
  };

  const openPlanung = () => {
    clearTimeout(PlanungTimeout.current);
    setPlanungOpen(true);
  };
  const closePlanung = () => {
    PlanungTimeout.current = setTimeout(() => setPlanungOpen(false), delay);
  };

  const openReport = () => {
    clearTimeout(reportTimeout.current);
    setReportOpen(true);
  };
  const closeReport = () => {
    reportTimeout.current = setTimeout(() => setReportOpen(false), delay);
  };

  const openAdmin = () => {
    clearTimeout(adminTimeout.current);
    setAdminOpen(true);
  };
  const closeAdmin = () => {
    adminTimeout.current = setTimeout(() => setAdminOpen(false), delay);
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const pfadZuTitel = {
    '/dashboard': 'Übersicht',
    '/schichtcockpit': 'Cockpit',
    '/kundenverwaltung': 'Unternehmen',
    '/schichtart-pflegen': 'Schichtarten bearbeiten',
    '/schichtzuweisen': 'Schicht zuweisen',
    '/user-anlegen': 'Benutzerverwaltung',
    '/sollplan-editor': 'Sollplan erstellen',
    '/bedarfsverwaltung': 'Bedarf Verwalten',
    '/qualifikationenverwalten': 'Qualifikationen zuweisen',
    '/qualifikationsmatrix': 'Qualifikationen bearbeiten',
    '/ferienundfeiertage': 'Ferien & Feiertage',
    '/termineverwaltung': 'Termine',
    '/stunden-pflege': 'Zeitkonten bearbeiten', 
    '/system-tools': 'System-Tools',
    '/unit-reports': 'Unit bericht',
    '/userpflege': 'User bearbeiten',
    '/top-report': 'Top bericht',
    '/wochenplaner': 'Wochenplaner',
    '/user-report': 'Mitarbeiter-Report',
    '/aenderungsprotokoll': 'Änderungsprotokoll',

  };

  const aktuellerTitel = pfadZuTitel[location.pathname] || '';

  return (
    <nav className="relative flex items-center justify-between text-sm font-semibold text-white dark:text-white px-2">
      {/* LINKE SEITE: Navigation-Links */}
      <div className="flex gap-8 items-center">
        {/* Übersicht: Alle außer Org_Admin */}
        {rolle !== 'Org_Admin' && (
          <Link to="/dashboard" className="hover:underline">
            Übersicht
          </Link>
        )}

        {/* Cockpit: Alle außer Org_Admin */}
        {rolle !== 'Org_Admin' && (
          <Link to="/schichtcockpit" className="hover:underline">
            Cockpit
          </Link>
        )}

        {/* Planner-Menü: Nur SuperAdmin, Admin_Dev, Planner */}
        {['SuperAdmin', 'Admin_Dev', 'Planner'].includes(rolle) && (
          <div className="relative" onMouseEnter={openPlanung} onMouseLeave={closePlanung}>
            <span className="cursor-pointer">Planung ▾</span>
            {PlanungOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-md p-0 z-50 flex flex-col gap-1">
                <Link to="/bedarfsverwaltung" className="hover:bg-gray-700 rounded px-2 py-1">
                  Bedarf Verwalten
                </Link>
                <Link to="/termineverwaltung" className="hover:bg-gray-700 rounded px-2 py-1">
                  Termine
                </Link>

                {(rolle === 'SuperAdmin' || canSeeWochenplaner) && (
                  <Link to="/wochenplaner" className="hover:bg-gray-700 rounded px-2 py-1">
                    Wochenplaner
                  </Link>
                )}
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
                <Link to="/schichtart-pflegen" className="hover:bg-gray-700 rounded px-2 py-1">
                  Schichtarten bearbeiten
                </Link>
                <Link to="/qualifikationsmatrix" className="hover:bg-gray-700 rounded px-2 py-1">
                  Qualifikation bearbeiten
                </Link>
                <Link to="/qualifikationenverwalten" className="hover:bg-gray-700 rounded px-2 py-1">
                  Qualifikationen zuweisen
                </Link>
                <Link to="/schichtzuweisen" className="hover:bg-gray-700 rounded px-2 py-1">
                  Schicht zuweisen
                </Link>
                <Link to="/userpflege" className="hover:bg-gray-700 rounded px-2 py-1">
                  User bearbeiten
                </Link>
                <Link to="/stunden-pflege" className="hover:bg-gray-700 rounded px-2 py-1">
                  Zeitkonten bearbeiten
                </Link>
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
                <Link to="/unit-reports" className="hover:bg-gray-700 rounded px-2 py-1">
                  Unit bericht
                </Link>
                <Link to="/user-report" className="hover:bg-gray-700 rounded px-2 py-1">
                  Mitarbeiter-Report
                </Link>
                
                {canSeeTopReport && (
                  <Link to="/top-report" className="hover:bg-gray-700 rounded px-2 py-1">
                    Top bericht
                  </Link>
                )}
                <Link to="/aenderungsprotokoll" className="hover:bg-gray-700 rounded px-2 py-1">
                  Änderungsprotokoll
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Kundenverwaltung: Org_Admin, SuperAdmin oder User mit Flag */}
        {(['SuperAdmin', 'Org_Admin'].includes(rolle) || canSeeCompanyPage) && (
          <Link to="/kundenverwaltung" className="hover:underline">
            Unternehmen
          </Link>
        )}

        {/* Admin-Menü: Nur SuperAdmin */}
        {rolle === 'SuperAdmin' && (
          <div className="relative" onMouseEnter={openAdmin} onMouseLeave={closeAdmin}>
            <span className="cursor-pointer">Admin ▾</span>
            {adminOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-md p-0 z-50 flex flex-col gap-1">
                <Link to="/sollplan-editor" className="hover:bg-gray-700 rounded px-2 py-1">
                  Sollplan erstellen
                </Link>
                <Link to="/user-anlegen" className="hover:bg-gray-700 rounded px-2 py-1">
                  User verwalten
                </Link>
                <Link to="/ferienundfeiertage" className="hover:bg-gray-700 rounded px-2 py-1">
                  Ferien & Feiertage
                </Link>
                <Link to="/system-tools" className="hover:bg-gray-700 rounded px-2 py-1">
                  System-Tools
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MITTE: Titel-Zeile */}
      <div className="absolute left-1/2 transform -translate-x-1/2 text-lg font-bold pointer-events-none whitespace-nowrap">
        {aktuellerTitel}
      </div>

      {/* RECHTS: Darkmode-Switch */}
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
