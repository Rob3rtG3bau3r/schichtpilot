import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import { useState } from 'react';
import { X, Settings } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const MobileLayout = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menueOffen, setMenueOffen] = useState(false);
  const [darkMode, setDarkMode] = useState(document.documentElement.classList.contains('dark'));

  const gespeicherteId = localStorage.getItem('user_id');

const toggleDarkMode = async () => {
  const newMode = darkMode ? 'light' : 'dark';
  document.documentElement.classList.toggle('dark');
  setDarkMode(!darkMode);
  await supabase
    .from('DB_User')
    .update({ theme_mobile: newMode })
    .eq('user_id', gespeicherteId);
};

  return (
    <div className="h-full flex flex-col">
      {/* Sticky logo-Leiste */}
      <div className="text-gray-200 sticky top-0 z-50 bg-gray-900 pr-4 py-1 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <img src={logo} alt="logo" className="h-12 object-contain" />
        </div>
        <div className="flex items-center gap-3 text-sm">
  <button
    onClick={() => navigate('/mobile')}
    className={pathname === '/mobile' ? 'bg-green-600 bg-opacity-10 border border-green-600 p-1' : ''}
  >
    Meine Dienste
  </button>
  <button
    onClick={() => navigate('/mobile/anfragen')}
    className={pathname.includes('/anfragen') ? 'bg-green-600 bg-opacity-10 border border-green-600 p-1' : ''}
  >
    Anfragen
  </button>
  <button onClick={() => setMenueOffen(true)} title="Menü">
    <Settings className="w-5 h-5 text-white" />
  </button>
</div>
        </div>

      {/* Scrollbarer Inhalt */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
      {menueOffen && (
  <div className="text-gray-900 dark:text-gray-200 fixed inset-0 bg-black bg-opacity-50  z-50 backdrop-blur-sm flex justify-center items-center">
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-[90%] max-w-sm border border-gray-300 dark:border-gray-700 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">⚙️ Einstellungen</h3>
        <button onClick={() => setMenueOffen(false)}><X className="w-5 h-5" /></button>
      </div>
      <ul className="space-y-3 text-sm">
        <li>
          <button onClick={toggleDarkMode} className="w-full text-left text-blue-600 hover:underline">
            {darkMode ? '🌞 Light Mode aktivieren' : '🌙 Dark Mode aktivieren'}
          </button>
        </li>
        <li>
          <button onClick={() => { localStorage.removeItem('pin'); alert('🔐 PIN wurde gelöscht!'); }} className="w-full text-left text-red-600 hover:underline">
            🔁 PIN zurücksetzen
          </button>
        </li>
      </ul>
</div>
</div>
)}

    </div>
  );
};

export default MobileLayout;