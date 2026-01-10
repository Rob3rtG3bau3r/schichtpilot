import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import Navigation from './Navigation';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import AdminPanel from './AdminPanel';
import AdminPanelWrapper from './AdminPanelWrapper';
import { Inbox } from 'lucide-react'; // 📬 Briefkasten-Icon

const POLL_MS = 60_000; // 1 Minute Polling für offene Anfragen

const Layout = () => {
  const [eingeloggt, setEingeloggt] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [themeLoaded, setThemeLoaded] = useState(false); // 👈 NEU
  const [rolleGeladen, setRolleGeladen] = useState(false);
  const [umgeloggt, setUmgeloggt] = useState(false);
  const [adminPanelOffen, setAdminPanelOffen] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [dbUser, setDbUser] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [simulierterUserId, setSimulierterUserId] = useState(null);
  const [firmenName, setFirmenName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [firmenLogo, setFirmenLogo] = useState('');

  // 🔔 Offene Anfragen
  const [offeneAnfragenCount, setOffeneAnfragenCount] = useState(0);
  const pollerRef = useRef(null);

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

  // === THEME AUS DB_UserSettings LADEN ===
  useEffect(() => {
    const ladeTheme = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        const { data: settings } = await supabase
          .from('DB_UserSettings')
          .select('theme')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settings?.theme === 'light') {
          setDarkMode(false);
        } else {
          // Fallback: wenn nichts gesetzt → dark
          setDarkMode(true);
        }
      }
      setThemeLoaded(true); // 👈 Ab jetzt darf gespeichert werden
    };
    ladeTheme();
  }, []);

  // === THEME SPEICHERN (in DB_UserSettings) ===
  useEffect(() => {
    // Klasse auf <html>
    document.documentElement.classList.toggle('dark', darkMode);

    // Beim initialen Laden noch NICHT in die DB schreiben
    if (!themeLoaded) return;

    const speichereTheme = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        await supabase
          .from('DB_UserSettings')
          .upsert(
            {
              user_id: user.id,
              theme: darkMode ? 'dark' : 'light',
            },
            { onConflict: 'user_id' }
          );
      }
    };
    speichereTheme();
  }, [darkMode, themeLoaded]);

  // === AKTUELLEN USER LADEN (OHNE theme) ===
  useEffect(() => {
    const ladeUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('user_id, vorname, rolle, firma_id, unit_id') // 👈 theme entfernt
          .eq('user_id', user.id)
          .single();

        if (userDaten?.user_id) setUserId(userDaten.user_id);

        // Firma laden
        if (userDaten?.firma_id) {
          const { data: firma } = await supabase
            .from('DB_Kunden')
            .select('firmenname, logo_url')
            .eq('id', userDaten.firma_id)
            .single();
          setFirmenLogo(firma?.logo_url || '');
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
        begruessungRef.current =
          begruessungen[Math.floor(Math.random() * begruessungen.length)];
      }
      setRolleGeladen(true);
    };
    ladeUser();
  }, [setNutzerName, setRolle, setIstSuperAdmin, setUserId, setSichtFirma, setSichtUnit]);

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

  // === OFFENE ANFRAGEN POLLING ===
  useEffect(() => {
    if (!rolleGeladen) return;

    const holeOffeneAnfragen = async () => {
      try {
        let query = supabase
          .from('DB_AnfrageMA')
          .select('id', { count: 'exact', head: true })
          .is('genehmigt', null);

        if (rolle === 'Employee') {
          if (!userId) {
            setOffeneAnfragenCount(0);
            return;
          }
          query = query.eq('created_by', userId);
        } else {
          if (sichtFirma) query = query.eq('firma_id', sichtFirma);
          if (sichtUnit) query = query.eq('unit_id', sichtUnit);
        }

        const { count, error } = await query;
        if (error) {
          setOffeneAnfragenCount(0);
          return;
        }
        setOffeneAnfragenCount(count ?? 0);
      } catch {
        setOffeneAnfragenCount(0);
      }
    };

    holeOffeneAnfragen();
    pollerRef.current = setInterval(holeOffeneAnfragen, POLL_MS);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [rolleGeladen, rolle, userId, sichtFirma, sichtUnit]);

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
        .select('vorname, rolle, firma_id, unit_id') // 👈 theme entfernt
        .eq('user_id', user.id)
        .single();

      if (originalUserDaten) {
        setNutzerName(originalUserDaten.vorname);
        setRolle(originalUserDaten.rolle);
        setIstSuperAdmin(originalUserDaten.rolle === 'SuperAdmin');

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

      // 👇 Theme des echten Users wieder aus DB_UserSettings holen
      const { data: settings } = await supabase
        .from('DB_UserSettings')
        .select('theme')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settings?.theme === 'light') {
        setDarkMode(false);
      } else {
        setDarkMode(true);
      }
      setThemeLoaded(true);
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
    <div className="min-h-screen w-full">
      <header className={`flex justify-between items-center px-8 pt-2 pb-2 ${umgeloggt ? 'bg-red-700' : 'bg-gray-800'} text-white relative`}>
        <div className="flex items-center gap-4">
  <img src={logo} alt="SchichtPilot" className="h-16" />

  {firmenLogo && (
    <img
      src={firmenLogo}
      alt="Firmenlogo"
      className="h-12 max-w-[160px] object-contain"
      title={firmenName}
      onError={(e) => (e.currentTarget.style.display = 'none')}
    />
  )}
</div>

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

          {/* 📬 Briefkasten mit Badge */}
          <div className="relative">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-full p-2 bg-gray-700 hover:bg-gray-600 transition"
              title="Offene Anfragen"
              aria-label="Offene Anfragen"
            >
              <Inbox size={18} />
            </button>
            {offeneAnfragenCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px] text-white bg-red-600 rounded-full text-center font-bold">
                {offeneAnfragenCount > 99 ? '99+' : offeneAnfragenCount}
              </span>
            )}
          </div>

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

      {/* Erfolgsmeldung nach Ummelden (kurz) */}
      {meldung && (
        <div className="px-8">
          <div className="mt-2 mb-2 rounded-xl border border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-200 dark:text-emerald-900 px-4 py-2">
            <div className="text-sm font-semibold">{meldung}</div>
          </div>
        </div>
      )}

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
