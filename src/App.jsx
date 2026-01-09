import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import SchichtCockpit from './pages/SchichtCockpit';
import SchichtartPflegen from "./pages/SchichtartPflegen";
import KundenVerwaltung from './pages/Kundenverwaltung';
import UserAnlegen from './pages/UserAnlegen';
import SollplanSeite from './pages/SollplanSeite';
import Schichtzuweisen from './pages/Schichtzuweisen';
import BedarfsVerwaltung from './pages/BedarfsVerwaltung';
import QualifikationsMatrix from './pages/QualifikationsMatrix';
import RollenCheckRoute from './components/RollenCheckRoute'; 
import QualifikationsVerwaltung from './pages/QualifikationenVerwalten';
import FerienundFeiertage from './pages/FerienundFeiertage';
import Termine from './pages/TermineVerwaltung';
import MobileRouter from './pages/Mobile/MobileRouter';
import Home from "./pages/Home";
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import SystemTools from './pages/SystemTools';
import Pricing from './pages/Pricing';
import PasswortVergessen from "./pages/PasswortVergessen";
import ResetPassword from "./pages/ResetPassword";
import UnitReports from './pages/UnitReports';
import TopReport from './pages/TopReport';
import UserPflege from './pages/UserPflege';
import WochenPlaner from './pages/WochenPlaner';
import DesktopOnlyRoute from './routes/DesktopOnlyRoute';
import UserReport from './pages/UserReport.jsx';
import UnitUserStundenPflege from './pages/UnitUserStundenPflege';
import DesktopOnlyProtectedLayout from './routes/DesktopOnlyProtectedLayout';
import Aenderungsprotokoll from './pages/Aenderungsprotokoll';


const App = () => {
const isMobileNow =
  window.matchMedia?.('(max-width: 1023px)')?.matches ||
  /Mobi|Android|iPhone|iPad|iPod|Windows Phone|BlackBerry|webOS/i.test(navigator.userAgent);

if (
  window.matchMedia('(display-mode: standalone)').matches &&
  isMobileNow &&
  !window.location.pathname.startsWith('/mobile')
) {
  window.location.href = '/mobile';
}

  return (
    <Routes>
  {/* Login separat */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/mobile/*" element={<MobileRouter />} />
  <Route path="/" element={<Home />} /> 
  <Route path="/impressum" element={<Impressum />} />
  <Route path="/datenschutz" element={<Datenschutz />} />
  <Route path="/pricing" element={<Pricing />} />
  <Route path="/passwort-vergessen" element={<PasswortVergessen />} />
  <Route path="/reset-password" element={<ResetPassword />} />


  {/* Alle geschützten Routen im Layout */}
  <Route
  path="/"
  element={
    <DesktopOnlyProtectedLayout>
      <Layout />
    </DesktopOnlyProtectedLayout>
  }
>
    <Route
    path="wochenplaner"
    element={
      <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner']}>
        <WochenPlaner />
      </RollenCheckRoute>
    }
  />
    <Route
      path="dashboard"
      element={
        <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner', 'Team_Leader', 'Employee', 'SuperAdmin']}>
          <Dashboard />
        </RollenCheckRoute>
          }
        />
        <Route
  path="ferienundfeiertage"
  element={
    <RollenCheckRoute erlaubteRollen={['SuperAdmin']}>
      <FerienundFeiertage />
    </RollenCheckRoute>
  }
/>
        <Route
          path="schichtcockpit"
          element={
            <DesktopOnlyRoute>
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner','Team_Leader','Employee', 'SuperAdmin']}>
              <SchichtCockpit />
            </RollenCheckRoute>
            </DesktopOnlyRoute>
          }
        />
        <Route
          path="qualifikationenverwalten"
          element={
            <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner']}>
              <QualifikationsVerwaltung />
            </RollenCheckRoute>
          }
        />
        <Route path="bedarfsverwaltung" 
        element={
            <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner']}>
              <BedarfsVerwaltung />
            </RollenCheckRoute>
          }
          />
                  <Route path="termineverwaltung" 
        element={
            <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner']}>
              <Termine />
            </RollenCheckRoute>
          }
          />
        <Route
          path="schichtart-pflegen"
          element={
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner', 'SuperAdmin']}>
              <SchichtartPflegen />
            </RollenCheckRoute>
          }
          />
          <Route 
            path="qualifikationsmatrix"
            element={
              <RollenCheckRoute erlaubteRollen={['Admin_Dev','Planner', 'SuperAdmin']}>
                <QualifikationsMatrix />
              </RollenCheckRoute>
          }
        />
        <Route
          path="kundenverwaltung"
          element={
            <RollenCheckRoute erlaubteRollen={['Org_Admin', 'Admin_Dev', 'SuperAdmin']}>
              <KundenVerwaltung />
            </RollenCheckRoute>
          }
        />
        <Route
          path="user-anlegen"
          element={
            <RollenCheckRoute erlaubteRollen={['SuperAdmin']}>
              <UserAnlegen />
            </RollenCheckRoute>
          }
        />
        <Route
          path="sollplan-editor"
          element={
            <RollenCheckRoute erlaubteRollen={['SuperAdmin']}>
              <SollplanSeite />
            </RollenCheckRoute>
          }
        />
        <Route
          path="schichtzuweisen"
          element={
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner', 'SuperAdmin']}>
              <Schichtzuweisen />
            </RollenCheckRoute>
          }
        />
          <Route
          path="userpflege"
          element={
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner', 'SuperAdmin']}>
              <UserPflege />
            </RollenCheckRoute>
          }
        />
           <Route
      path="unit-reports"
       element={
       <RollenCheckRoute erlaubteRollen={['Org_Admin', 'Admin_Dev', 'Planner', 'SuperAdmin']}>
         <UnitReports />
       </RollenCheckRoute>
        }
       />
       <Route
      path="user-report"
       element={
       <RollenCheckRoute erlaubteRollen={['Org_Admin', 'Admin_Dev', 'Planner', 'SuperAdmin']}>
         <UserReport />
       </RollenCheckRoute>
        }
       />
       <Route
  path="stunden-pflege"
  element={
    <RollenCheckRoute erlaubteRollen={['Org_Admin', 'Admin_Dev', 'Planner', 'SuperAdmin']}>
      <UnitUserStundenPflege />
    </RollenCheckRoute>
  }
/>
        <Route
      path="top-report"
       element={
       <RollenCheckRoute erlaubteRollen={['Org_Admin', 'Admin_Dev', 'Planner', 'SuperAdmin']}>
         <TopReport />
       </RollenCheckRoute>
        }
       />
       <Route
  path="aenderungsprotokoll"
  element={
    <RollenCheckRoute erlaubteRollen={['Org_Admin', 'Admin_Dev', 'Planner', 'SuperAdmin']}>
      <Aenderungsprotokoll />
    </RollenCheckRoute>
  }
/>
        <Route
  path="system-tools"
  element={
    <RollenCheckRoute erlaubteRollen={['SuperAdmin']}>
      <SystemTools />
    </RollenCheckRoute>
  }
/>
      </Route>
    </Routes>
  );
};

export default App;