import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
//import kundenlogo from '../assets/kundenlogo.png';
import Navigation from './Navigation';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import dayjs from 'dayjs';

const Layout = () => {
  const [eingeloggt, setEingeloggt] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [rolleGeladen, setRolleGeladen] = useState(false);
  const [adminPanelOffen, setAdminPanelOffen] = useState(false);
  const [umgeloggt, setUmgeloggt] = useState(false);
  const [meldung, setMeldung] = useState('');
  const [dbUser, setDbUser] = useState([]);
  const [selectedFirma, setSelectedFirma] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
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

  const [offeneAnfragenZahl, setOffeneAnfragenZahl] = useState(0);


  const ladeOffeneAnfragen = async () => {
  if (!sichtUnit) return;

  const dreiTageZurueck = dayjs().subtract(3, 'day').startOf('day').format('YYYY-MM-DD');

  const { data, error } = await supabase
    .from('DB_AnfrageMA')
    .select('id, created_at')
    .eq('unit_id', sichtUnit)
    .is('genehmigt', null) // Null = nicht entschieden
    .gte('created_at', dreiTageZurueck); // Nur Anträge der letzten 3 Tage

  if (!error && data) {
    setOffeneAnfragenZahl(data.length);
  }
};

useEffect(() => {
  document.documentElement.classList.toggle('dark', darkMode);

  // Theme in DB speichern
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

  useEffect(() => {
    const ladeUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;

      if (user) {
        const { data: userDaten } = await supabase
          .from('DB_User')
          .select('user_id, vorname, rolle, firma_id, unit_id')
          .eq('user_id', user.id)
          .single();
      if (userDaten?.user_id) setUserId(userDaten.user_id);
if (userDaten?.theme === 'dark') {
  setDarkMode(true);
} else {
  setDarkMode(false);
}
        // Firma über ID laden
if (userDaten?.firma_id) {
  const { data: firma } = await supabase
    .from('DB_Kunden')
    .select('firmenname')
    .eq('id', userDaten.firma_id)
    .single();

  if (firma?.firmenname) setFirmenName(firma.firmenname);
  setSichtFirma(userDaten.firma_id); // wichtig für spätere Umstellung
}

// Unit über ID laden
if (userDaten?.unit_id) {
  const { data: unit } = await supabase
    .from('DB_Unit')
    .select('unitname')
    .eq('id', userDaten.unit_id)
    .single();
  if (unit?.unitname) setUnitName(unit.unitname);
  setSichtUnit(userDaten.unit_id); // wichtig für spätere Umstellung
}
        if (userDaten?.vorname) setNutzerName(userDaten.vorname);
        if (userDaten?.rolle) setRolle(userDaten.rolle);
        setIstSuperAdmin(userDaten.rolle === 'SuperAdmin');
        if (userDaten?.firma) setSichtFirma(userDaten.firma);
        if (userDaten?.unit) setSichtUnit(userDaten.unit);
        if (userDaten?.rolle === 'SuperAdmin') setIstSuperAdmin(true);

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

       // console.log('🎯 Aktiver Nutzer (echt):', userDaten);
      }

      setRolleGeladen(true);
    };

    ladeUser();
  }, [setNutzerName, setRolle, setIstSuperAdmin]);

  //console.log('🌍 Sichtbare Firma/Unit:', sichtFirma, sichtUnit);

  useEffect(() => {
  if (sichtFirma && sichtUnit) {
  //  console.log('🌍 Angemeldet in Firma:', sichtFirma, ' | Unit:', sichtUnit);
  }
}, [sichtFirma, sichtUnit]);

  useEffect(() => {
    const ladeAlleUser = async () => {
      try {
        const { data, error } = await supabase.from('DB_User').select('*');
        if (error) {
          console.error('Fehler beim Laden aller User:', error);
          return;
        }
        setDbUser(data || []);
      } catch (err) {
        console.error('Unerwarteter Fehler beim Laden aller User:', err);
      }
    };
    ladeAlleUser();
  }, []);

useEffect(() => {
  if (!rolleGeladen || !sichtUnit) return;

  ladeOffeneAnfragen(); // beim Start

  const interval = setInterval(() => {
    ladeOffeneAnfragen();
  }, 15 * 60 * 1000); // alle 15 Minuten

  return () => clearInterval(interval);
}, [rolleGeladen, sichtUnit]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEingeloggt(false);
    navigate('/login');
  };

const toggleAdminPanel = async () => {
  if (adminPanelOffen && umgeloggt) {
    const erfolgreichZurück = await handleReset();
    if (!erfolgreichZurück) return; // ❌ Nicht schließen, falls Rückkehr fehlschlägt
  }
  setAdminPanelOffen(!adminPanelOffen);
};

  const handleChangeUser = () => {
    if (selectedUser) {
      setUmgeloggt(true);
      const userDaten = dbUser.find((u) => u.user_id === selectedUser);
      if (userDaten?.vorname) setNutzerName(userDaten.vorname);
      if (userDaten?.rolle) setRolle(userDaten.rolle);
      setIstSuperAdmin(userDaten.rolle === 'SuperAdmin');
      setSimulierterUserId(selectedUser);
      console.log('🧪 Simulierter Nutzer:', userDaten);
      setMeldung('Ummeldung erfolgreich ✅');
      setTimeout(() => setMeldung(''), 1000);
    }
  };

  const handleReset = async () => {
    setUmgeloggt(false);
    setSelectedFirma('');
    setSelectedUnit('');
    setSelectedUser('');
    setSimulierterUserId(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (user) {
        const { data: originalUserDaten, error } = await supabase
          .from('DB_User')
          .select('vorname, rolle')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Fehler beim Zurücksetzen auf echten Nutzer:', error);
          return;
        }

        if (originalUserDaten?.vorname) setNutzerName(originalUserDaten.vorname);
        if (originalUserDaten?.rolle) setRolle(originalUserDaten.rolle);
        setIstSuperAdmin(originalUserDaten.rolle === 'SuperAdmin');
        console.log('🔁 Zurück auf echten Nutzer:', originalUserDaten);
      }
    } catch (err) {
      console.error('Unerwarteter Fehler beim Reset:', err);
    }
  };

  if (!rolleGeladen) return <div className="text-white p-4">Lade Benutzerdaten...</div>;

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-200 text-black'}`}>
      <header className="flex justify-between items-center px-8 pt-2 pb-2 bg-gray-800 text-white relative">
        <img src={logo} alt="logo" className="h-16" />
        <div className="absolute left-1/2 transform -translate-x-1/2 text-lg font-semibold">
          {begruessungRef.current}
        </div>
        <div className="flex items-center gap-6">
          {istSuperAdmin && (
            <div className="text-right text-sm">
              <div className="cursor-pointer" onClick={toggleAdminPanel}>
                SuperAdmin 👑
              </div>
              {umgeloggt && !adminPanelOffen && (
  <button
    className="bg-yellow-400 text-black px-2 py-1 rounded text-xs"
    onClick={() => setAdminPanelOffen(true)}
  >
    Admin-Panel öffnen
  </button>
)}
{adminPanelOffen && (
  <div className={`mt-2 p-2 rounded shadow-lg ${umgeloggt ? 'bg-red-600' : 'bg-green-200'} text-black w-64 text-xs`}>
    
    {/* Buttons oben */}
    <div className="flex justify-between mb-2">
      <button className="bg-blue-500 text-white px-4 rounded text-[10px]" onClick={handleChangeUser}>Change</button>
      <button className="bg-blue-500 text-white px-4 rounded text-[10px]" onClick={handleReset}>Reset</button>
      <button className="bg-blue-500 text-white px-4 rounded text-[10px]" onClick={toggleAdminPanel}>Close</button>
    </div>

    {meldung && (
      <div className="text-green-800 bg-green-100 p-1 rounded text-center mb-2">
        {meldung}
      </div>
    )}

    {/* === Bereich 1: Nutzer simulieren === */}
    <div className=" border-gray-400 ">
<select
  className="w-full mb-1 rounded border"
  value={selectedUser}
  onChange={(e) => setSelectedUser(e.target.value)}
>
  <option value="">Nutzer wählen</option>
  {dbUser.map((user) => (
    <option key={user.user_id} value={user.user_id}>
      {user.vorname} {user.nachname} ({user.email})
    </option>
  ))}
</select>
    </div>
  </div>
)}
            </div>
          )}
          {offeneAnfragenZahl > 0 && rolle !== 'Employee' && (
  <div
    title="Offene Anfragen"
    className="relative cursor-pointer text-xs bg-green-600 text-white rounded-md px-1 py-1 hover:bg-green-700"
    onClick={() => navigate('/dashboard')}
  >
    📨 {offeneAnfragenZahl}
  </div>
)}

          {eingeloggt && (
            <button onClick={handleLogout} className="bg-red-600 text-white px-1 py-1 rounded text-xs hover:bg-red-700">
              Logout
            </button>
          )}
<div className="text-xs leading-tight">
  <ul className="space-y-1">
    <li className="flex items-center gap-2">
      <span className="w-4">👤</span>
      <span>{nutzerName}</span>
    </li>
        <li className="flex items-center gap-2 group relative">
      <span className="w-4">🏢</span>
      <span className="truncate max-w-[100px]">{firmenName || '–'}</span>
      <span className="absolute -top-5 left-6 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">
        Firma-ID: {sichtFirma}
      </span>
    </li>
    <li className="flex items-center gap-2 group relative">
      <span className="w-4">🏭</span>
      <span className="truncate max-w-[100px]">{unitName || '–'}</span>
      <span className="absolute -top-5 left-6 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">
        Unit-ID: {sichtUnit}
      </span>
    </li>
  </ul>
</div>
          {/*logo logik kommt etwas später!
          <img src={kundenlogo} alt="kundenlogo" className="h-16" />*/}
        </div>
      </header>

      <div className="bg-gray-800 py-1 rounded dark:bg-gray-700 border-t border-gray-600 px-8 py-3">
        <Navigation darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      <main className="pt-2 px-4 pb-8 overflow-y-visible">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;