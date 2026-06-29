import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import logo from '../assets/sp_logo.png';
import Navigation from './Navigation';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import AdminPanel from './AdminPanel';
import AdminPanelWrapper from './AdminPanelWrapper';
import { Inbox } from 'lucide-react'; // 📬 Briefkasten-Icon

const POLL_MS = 60_000; // 1 Minute Polling für offene Anfragen

const pickRandom = (arr) => {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
};

const rollenMatch = (rollenArray, aktuelleRolle) => {
  if (!rollenArray || rollenArray.length === 0) return true;
  return rollenArray.includes('all') || rollenArray.includes(aktuelleRolle);
};

const scopeMatch = (item, sichtFirma, sichtUnit) => {
  const firmaOk = !item.firma_id || String(item.firma_id) === String(sichtFirma);
  const unitOk = !item.unit_id || String(item.unit_id) === String(sichtUnit);
  return firmaOk && unitOk;
};

const findeText = (texte = [], sprache = 'de') => {
  return (
    texte.find((t) => t.sprache === sprache) ||
    texte.find((t) => t.sprache === 'de') ||
    texte.find((t) => t.sprache === 'en') ||
    texte[0] ||
    null
  );
};

const Layout = () => {
  const [eingeloggt, setEingeloggt] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [themeLoaded, setThemeLoaded] = useState(false);
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

  // 💡 Begrüßung / ToolTipp / ToolInfo
  const [headerHinweis, setHeaderHinweis] = useState(null);

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
          setDarkMode(true);
        }
      }

      setThemeLoaded(true);
    };

    ladeTheme();
  }, []);

  // === THEME SPEICHERN (in DB_UserSettings) ===
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);

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

  // === AKTUELLEN USER LADEN ===
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
          setFirmenLogo('');
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

        setIstSuperAdmin(userDaten?.rolle === 'SuperAdmin');

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

  // === TOOLINFO / TOOLTIP FÜR HEADER LADEN ===
  useEffect(() => {
    if (!rolleGeladen || !rolle) return;

    const ladeHeaderHinweis = async () => {
      try {
        const sprache = 'de';
        const nowIso = new Date().toISOString();

        // Zähler für "jedes 2. / jedes 3. Mal"
        const counterKey = 'sp_header_hinweis_counter';
        const currentCounter = Number(localStorage.getItem(counterKey) || 0) + 1;
        localStorage.setItem(counterKey, String(currentCounter));

        // 1. ToolInfos haben Vorrang
        const { data: infos, error: infoError } = await supabase
          .from('DB_ToolInfo')
          .select(`
            *,
            texte:DB_ToolInfo_Text(*)
          `)
          .eq('aktiv', true)
          .lte('anzeige_ab', nowIso)
          .gte('anzeige_bis', nowIso)
          .order('prioritaet', { ascending: false });

        if (!infoError) {
          const passendeInfos = (infos || []).filter((item) => {
            return (
              rollenMatch(item.rollen, rolle) &&
              scopeMatch(item, sichtFirma, sichtUnit)
            );
          });

          // 1a. "Immer"-Infos je Ebene sammeln:
          // maximal 1x global, 1x Firma, 1x Unit.
          // Wenn mehrere Ebenen passen, rotieren sie untereinander.
          const immerInfos = passendeInfos.filter((i) => i.rotation_modus === 'immer');

          const globaleImmerInfo = immerInfos.find((i) => !i.firma_id && !i.unit_id);

          const firmenImmerInfo = immerInfos.find((i) =>
            i.firma_id &&
            !i.unit_id &&
            String(i.firma_id) === String(sichtFirma)
          );

          const unitImmerInfo = immerInfos.find((i) =>
            i.unit_id &&
            String(i.unit_id) === String(sichtUnit)
          );

          const immerKandidaten = [
            globaleImmerInfo,
            firmenImmerInfo,
            unitImmerInfo,
          ].filter(Boolean);

          if (immerKandidaten.length > 0) {
            const selectedInfo =
              immerKandidaten[(currentCounter - 1) % immerKandidaten.length];

            const text = findeText(selectedInfo.texte, sprache);

            if (text?.text) {
              setHeaderHinweis({
                typ: 'info',
                titel: text.titel || 'Info',
                text: text.text,
                darstellung: selectedInfo.darstellung || 'normal',
              });
              return;
            }
          }

          // 1b. Rotierende Infos
          const rotierendeInfos = passendeInfos.filter((i) => i.rotation_modus !== 'immer');

          const erlaubteInfos = rotierendeInfos.filter((i) => {
            if (i.rotation_modus === 'rotation') return true;
            if (i.rotation_modus === 'jedes_2_mal') return currentCounter % 2 === 0;
            if (i.rotation_modus === 'jedes_3_mal') return currentCounter % 3 === 0;
            return false;
          });

          const selectedInfo = pickRandom(erlaubteInfos);
          const infoText = findeText(selectedInfo?.texte, sprache);

          if (infoText?.text) {
            setHeaderHinweis({
              typ: 'info',
              titel: infoText.titel || 'Info',
              text: infoText.text,
              darstellung: selectedInfo.darstellung || 'normal',
            });
            return;
          }
        }

        // 2. Wenn keine ToolInfo greift: ToolTipp laden
        const { data: tipps, error: tippError } = await supabase
          .from('DB_ToolTipp')
          .select(`
            *,
            texte:DB_ToolTipp_Text(*)
          `)
          .eq('aktiv', true)
          .order('prioritaet', { ascending: false });

        if (!tippError) {
          const heute = new Date();

          const passendeTipps = (tipps || []).filter((item) => {
            const rolleOk = rollenMatch(item.rollen, rolle);
            const scopeOk = scopeMatch(item, sichtFirma, sichtUnit);

            const vonOk = !item.gueltig_von || new Date(item.gueltig_von) <= heute;
            const bisOk = !item.gueltig_bis || new Date(item.gueltig_bis) >= heute;

            return rolleOk && scopeOk && vonOk && bisOk;
          });

          const selectedTipp = pickRandom(passendeTipps);
          const tippText = findeText(selectedTipp?.texte, sprache);

          if (tippText?.text) {
            setHeaderHinweis({
              typ: 'tipp',
              titel: tippText.titel || 'Tipp',
              text: tippText.text,
              darstellung: 'normal',
            });
            return;
          }
        }

        // 3. Fallback
        setHeaderHinweis(null);
      } catch {
        setHeaderHinweis(null);
      }
    };

    ladeHeaderHinweis();
  }, [rolleGeladen, rolle, sichtFirma, sichtUnit, nutzerName]);

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
          .select('firmenname, logo_url')
          .eq('id', userDaten.firma_id)
          .single();

        setFirmenLogo(firma?.logo_url || '');
        setFirmenName(firma?.firmenname || '');
        setSichtFirma(userDaten.firma_id);
      } else {
        setFirmenLogo('');
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
        .select('vorname, rolle, firma_id, unit_id')
        .eq('user_id', user.id)
        .single();

      if (originalUserDaten) {
        setNutzerName(originalUserDaten.vorname);
        setRolle(originalUserDaten.rolle);
        setIstSuperAdmin(originalUserDaten.rolle === 'SuperAdmin');

        if (originalUserDaten.firma_id) {
          const { data: firma } = await supabase
            .from('DB_Kunden')
            .select('firmenname, logo_url')
            .eq('id', originalUserDaten.firma_id)
            .single();

          setFirmenLogo(firma?.logo_url || '');
          setFirmenName(firma?.firmenname || '');
          setSichtFirma(originalUserDaten.firma_id);
        } else {
          setFirmenLogo('');
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
    setFirmenLogo('');
    setSelectedUser('');
    setUmgeloggt(false);
    setAdminPanelOffen(false);
    setHeaderHinweis(null);

    localStorage.clear();
    setEingeloggt(false);
    navigate('/login');
  };

  if (!rolleGeladen) {
    return <div className="text-white p-4">Lade Benutzerdaten...</div>;
  }

  const headerHinweisStyle = (() => {
    if (!headerHinweis || headerHinweis.typ !== 'info') {
      return 'text-white';
    }

    if (headerHinweis.darstellung === 'kritisch') {
      return 'bg-red-700/20 text-white border border-red-400 shadow-lg rounded-xl px-3 py-1.5';
    }

    if (headerHinweis.darstellung === 'warnung') {
      return 'bg-yellow-400/20 text-gray-100 border border-yellow-300 shadow-lg rounded-xl px-3 py-1.5';
    }

    if (headerHinweis.darstellung === 'hinweis') {
      return 'bg-blue-800/20 text-white border border-blue-400 shadow-md rounded-xl px-3 py-1.5';
    }

    return 'text-white';
  })();

  return (
    <div className="min-h-screen w-full">
      <header
        className={`flex justify-between items-center px-4 pt-2 pb-2 ${
          umgeloggt ? 'bg-red-700' : 'bg-gray-800'
        } text-white relative`}
      >
        <div className="flex items-center gap-2">
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

        {/* Begrüßung + ToolTipp / ToolInfo */}
        <div className="absolute left-1/2 transform -translate-x-1/2 text-center max-w-[760px] px-4">
          {headerHinweis ? (
            <div
              className={`text-sm font-semibold leading-snug max-w-[760px] mx-auto overflow-hidden ${headerHinweisStyle}`}
              title={`Hallo ${nutzerName || 'Pilot'}, ${headerHinweis.text}`}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
        <span className="mr-1">
          {headerHinweis.typ === 'info'
            ? headerHinweis.darstellung === 'kritisch'
              ? '🔴'
              : headerHinweis.darstellung === 'warnung'
                ? '⚠️'
                : 'ℹ️'
            : '💡'}
        </span>
              Hallo {nutzerName || 'Pilot'}, {headerHinweis.text}
            </div>
          ) : (
            <div className="text-lg font-semibold">
              {begruessungRef.current}
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          {istSuperAdmin && (
            <div className="text-right text-sm">
              {!umgeloggt && (
                <div
                  className="cursor-pointer"
                  onClick={() => setAdminPanelOffen(!adminPanelOffen)}
                >
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

          <div className="text-[14px] leading-tight">
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

      <div className="bg-gray-800 rounded dark:bg-gray-700 border-t border-gray-600 px-8 py-3">
        <Navigation darkMode={darkMode} setDarkMode={setDarkMode} />
      </div>

      {/* Erfolgsmeldung nach Ummelden */}
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

      {/* Footer */}
      <footer className="mt-20 mb-6 text-gray-500 text-xs text-center">
        © {new Date().getFullYear()} SchichtPilot ·{' '}
        <Link
          to="/impressum"
          className="underline text-blue-400 hover:text-white"
        >
          Impressum
        </Link>{' '}
        ·{' '}
        <Link
          to="/datenschutz"
          className="underline text-blue-400 hover:text-white"
        >
          Datenschutz
        </Link>{' '}
        · <span className="text-gray-500">Version {__APP_VERSION__}</span>
      </footer>

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