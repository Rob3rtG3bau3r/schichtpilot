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

const App = () => {
  if (window.matchMedia('(display-mode: standalone)').matches && !window.location.pathname.startsWith('/mobile')) {
  window.location.href = '/mobile';
}

  return (
    <Routes>
      {/* Login separat */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/mobile/*" element={<MobileRouter />} />

      {/* Alle geschützten Routen im Layout */}
      <Route path="/" element={<Layout />}>
        <Route
          index
          element={
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner','Team_Leader','Employee', 'SuperAdmin']}>
              <Dashboard />
            </RollenCheckRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner','Team_Leader','Employee', 'SuperAdmin']}>
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
            <RollenCheckRoute erlaubteRollen={['Admin_Dev', 'Planner','Team_Leader','Employee', 'SuperAdmin']}>
              <SchichtCockpit />
            </RollenCheckRoute>
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
            path="/qualifikationsmatrix"
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
      </Route>
    </Routes>
  );
};

export default App;