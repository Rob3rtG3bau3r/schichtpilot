import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import Navigation from './Navigation';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import AdminPanel from './AdminPanel';
import AdminPanelWrapper from './AdminPanelWrapper';

const Layout = () => {
  const [eingeloggt, setEingeloggt] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [rolleGeladen, setRolleGeladen] = useState(false);
  const [umgeloggt, setUmgeloggt] = useState(false);
  const [adminPanelOffen, setAdminPanelOffen] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [dbUser, setDbUser] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [simulierterUserId, setSimulierterUserId] = useState(null);
  const [firmenName, setFirmenName] = useState('');
  const [unitName, setUnitName] = useState('');

  const {
    rolle,
    setRolle,
    nutzerName,
    setNutzerName,
    istSuperAdmin,
    setIstSuperAdmin,
    sichtFirma,
    setSichtFirma,
    sichtUnit,
    setSichtUnit,
    userId,
    setUserId,
  } = useRollen();

  const begruessungRef = useRef('');
  const navigate = useNavigate();

  // === DARK/LIGHT MODE ===
  useEffect(() => {
    const ladeTheme = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('theme')
          .eq('user_id', user.id)
          .single();
        setDarkMode(userDaten?.theme === 'dark');
      }
    };
    ladeTheme();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    const speichereTheme = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        await supabase
          .from('DB_User')
          .update({ theme: darkMode ? 'dark' : 'light' })
          .eq('user_id', user.id);
      }
    };
    speichereTheme();
  }, [darkMode]);

  // === AKTUELLEN USER LADEN ===
  useEffect(() => {
    const ladeUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('user_id, vorname, rolle, firma_id, unit_id, theme')
          .eq('user_id', user.id)
          .single();

        if (userDaten?.user_id) setUserId(userDaten.user_id);
        setDarkMode(userDaten?.theme === 'dark');

        // Firma laden
        if (userDaten?.firma_id) {
          const { data: firma } = await supabase
            .from('DB_Kunden')
            .select('firmenname')
            .eq('id', userDaten.firma_id)
            .single();
          setFirmenName(firma?.firmenname || '');
          setSichtFirma(userDaten.firma_id);
        } else {
          setFirmenName('');
          setSichtFirma(null);
        }

        // Unit laden
        if (userDaten?.unit_id) {
          const { data: unit } = await supabase
            .from('DB_Unit')
            .select('unitname')
            .eq('id', userDaten.unit_id)
            .single();
          setUnitName(unit?.unitname || '');
          setSichtUnit(userDaten.unit_id);
        } else {
          setUnitName('');
          setSichtUnit(null);
        }

        if (userDaten?.vorname) setNutzerName(userDaten.vorname);
        if (userDaten?.rolle) setRolle(userDaten.rolle);
        setIstSuperAdmin(userDaten.rolle === 'SuperAdmin');

        const begruessungen = [
          `Hey ${userDaten?.vorname}, was machen wir heute?`,
          `Hallo ${userDaten?.vorname}, wie geht es dir heute?`,
          `Hi ${userDaten?.vorname}, was hast du heute vor?`,
          `${userDaten?.vorname}, was liegt an?`,
          `Alles gut bei dir ${userDaten?.vorname}?`,
          `${userDaten?.vorname}, alles gut bei dir?`,
        ];
        begruessungRef.current = begruessungen[Math.floor(Math.random() * begruessungen.length)];
      }
      setRolleGeladen(true);
    };
    ladeUser();
  }, [setNutzerName, setRolle, setIstSuperAdmin]);

  // === USERLISTE LADEN ===
  useEffect(() => {
    const ladeAlleUser = async () => {
      const { data, error } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, email, rolle, firma_id, unit_id');
      if (!error && data) setDbUser(data);
    };
    ladeAlleUser();
  }, []);

  // === USER WECHSELN (Admin Panel) ===
  const handleChangeUser = async () => {
    if (!selectedUser) return;
    setUmgeloggt(true);
    setAdminPanelOffen(true);

    const userDaten = dbUser.find((u) => u.user_id === selectedUser);
    if (userDaten) {
      if (userDaten.vorname) setNutzerName(userDaten.vorname);
      if (userDaten.rolle) setRolle(userDaten.rolle);
      setSimulierterUserId(selectedUser);

      // Firma laden
      if (userDaten.firma_id) {
        const { data: firma } = await supabase
          .from('DB_Kunden')
          .select('firmenname')
          .eq('id', userDaten.firma_id)
          .single();
        setFirmenName(firma?.firmenname || '');
        setSichtFirma(userDaten.firma_id);
      } else {
        setFirmenName('');
        setSichtFirma(null);
      }

      // Unit laden
      if (userDaten.unit_id) {
        const { data: unit } = await supabase
          .from('DB_Unit')
          .select('unitname')
          .eq('id', userDaten.unit_id)
          .single();
        setUnitName(unit?.unitname || '');
        setSichtUnit(userDaten.unit_id);
      } else {
        setUnitName('');
        setSichtUnit(null);
      }

      setMeldung('Ummeldung erfolgreich ✅');
      setTimeout(() => setMeldung(''), 1000);
    }
  };

  // === RESET / CLOSE ===
  const handleReset = async (closePanel = false) => {
    setUmgeloggt(false);
    setSelectedUser('');
    setSimulierterUserId(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (user) {
      const { data: originalUserDaten } = await supabase
        .from('DB_User')
        .select('vorname, rolle, firma_id, unit_id, theme')
        .eq('user_id', user.id)
        .single();

      if (originalUserDaten) {
        setNutzerName(originalUserDaten.vorname);
        setRolle(originalUserDaten.rolle);
        setIstSuperAdmin(originalUserDaten.rolle === 'SuperAdmin');
        setDarkMode(originalUserDaten.theme === 'dark');

        // Firma + Unit zurücksetzen
        if (originalUserDaten.firma_id) {
          const { data: firma } = await supabase
            .from('DB_Kunden')
            .select('firmenname')
            .eq('id', originalUserDaten.firma_id)
            .single();
          setFirmenName(firma?.firmenname || '');
          setSichtFirma(originalUserDaten.firma_id);
        } else {
          setFirmenName('');
          setSichtFirma(null);
        }

        if (originalUserDaten.unit_id) {
          const { data: unit } = await supabase
            .from('DB_Unit')
            .select('unitname')
            .eq('id', originalUserDaten.unit_id)
            .single();
          setUnitName(unit?.unitname || '');
          setSichtUnit(originalUserDaten.unit_id);
        } else {
          setUnitName('');
          setSichtUnit(null);
        }
      }
    }
    setAdminPanelOffen(!closePanel);
  };

  // === LOGOUT ===
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSichtFirma(null);
    setSichtUnit(null);
    setFirmenName('');
    setUnitName('');
    setSelectedUser('');
    setUmgeloggt(false);
    setAdminPanelOffen(false);
    localStorage.clear();
    setEingeloggt(false);
    navigate('/login');
  };

  if (!rolleGeladen) return <div className="text-white p-4">Lade Benutzerdaten...</div>;

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'}`}>
      <header className={`flex justify-between items-center px-8 pt-2 pb-2 ${umgeloggt ? 'bg-red-700' : 'bg-gray-800'} text-white relative`}>
        <img src={logo} alt="logo" className="h-16" />
        <div className="absolute left-1/2 transform -translate-x-1/2 text-lg font-semibold">
          {begruessungRef.current}
        </div>
        <div className="flex items-center gap-6">
          {istSuperAdmin && (
            <div className="text-right text-sm">
              {!umgeloggt && (
                <div className="cursor-pointer" onClick={() => setAdminPanelOffen(!adminPanelOffen)}>
                  SuperAdmin 👑
                </div>
              )}
              {umgeloggt && !adminPanelOffen && (
                <button
                  className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-1 rounded-md text-xs font-semibold shadow mt-1"
                  onClick={() => setAdminPanelOffen(true)}
                >
                  Admin Panel öffnen
                </button>
              )}
            </div>
          )}

          {eingeloggt && (
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-1 py-1 rounded text-xs hover:bg-red-700"
            >
              Logout
            </button>
          )}

          <div className="text-14px] leading-tight">
            <ul className="space-y-1">
              <li className="flex items-center gap-2">
                <span className="w-4">👤</span>
                <span>{nutzerName}</span>
              </li>
              <li className="flex items-center gap-2 text-xs">
                <span className="w-4">🏢</span>
                <span className="truncate max-w-[100px]">{firmenName || '–'}</span>
              </li>
              <li className="flex items-center gap-2 text-xs">
                <span className="w-4">🏭</span>
                <span className="truncate max-w-[100px]">{unitName || '–'}</span>
              </li>
            </ul>
          </div>
        </div>
      </header>

      <div className="bg-gray-800 py-1 rounded dark:bg-gray-700 border-t border-gray-600 px-8 py-3">
        <Navigation darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <main className="pt-2 px-4 pb-8 overflow-y-visible">
        <Outlet />
      </main>

      {(adminPanelOffen || umgeloggt) && (
        <AdminPanelWrapper>
          <AdminPanel
            dbUser={dbUser}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            handleChangeUser={handleChangeUser}
            handleReset={handleReset}
            umgeloggt={umgeloggt}
            meldung={meldung}
            setAdminPanelOffen={setAdminPanelOffen}
          />
        </AdminPanelWrapper>
      )}
    </div>
  );
};

export default Layout;

