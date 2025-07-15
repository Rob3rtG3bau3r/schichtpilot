import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SchichtartPflegen from "./pages/SchichtartPflegen";
import KundenVerwaltung from './pages/kundenverwaltung';
import UserAnlegen from './pages/UserAnlegen';
import SollplanSeite from './pages/SollplanSeite';
import Schichtzuweisen from './pages/Schichtzuweisen';
import SchichtCockpit from './pages/SchichtCockpit';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import RollenCheckRoute from './components/RollenCheckRoute';

const App = () => {
  return (
    <Routes>
      {/* Login separat */}
      <Route path="/login" element={<LoginPage />} />

      {/* Alle geschützten Routen im Layout */}
      <Route path="/" element={<Layout />}>
        {/* Dashboard – alle eingeloggten */}
        <Route
          index
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Schichtarten – nur SuperAdmin & Admin_Dev */}
        <Route
          path="schichtart-pflegen"
          element={
            <ProtectedRoute>
              <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev']}>
                <SchichtartPflegen />
              </RollenCheckRoute>
            </ProtectedRoute>
          }
        />

        {/* Kundenverwaltung – nur SuperAdmin & Org_Admin */}
        <Route
          path="kundenverwaltung"
          element={
            <ProtectedRoute>
              <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Org_Admin']}>
                <KundenVerwaltung />
              </RollenCheckRoute>
            </ProtectedRoute>
          }
        />

        {/* Benutzer anlegen – nur SuperAdmin */}
        <Route
          path="user-anlegen"
          element={
            <ProtectedRoute>
              <RollenCheckRoute erlaubteRollen={['SuperAdmin']}>
                <UserAnlegen />
              </RollenCheckRoute>
            </ProtectedRoute>
          }
        />

        {/* Sollplan – SuperAdmin, Admin_Dev, Planner */}
        <Route
          path="sollplan-editor"
          element={
            <ProtectedRoute>
              <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner']}>
                <SollplanSeite />
              </RollenCheckRoute>
            </ProtectedRoute>
          }
        />

        {/* Schicht zuweisen – SuperAdmin, Admin_Dev, Planner */}
        <Route
          path="schichtzuweisen"
          element={
            <ProtectedRoute>
              <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner']}>
                <Schichtzuweisen />
              </RollenCheckRoute>
            </ProtectedRoute>
          }
        />

        {/* Cockpit – alle Rollen */}
        <Route
          path="schichtcockpit"
          element={
            <ProtectedRoute>
              <RollenCheckRoute erlaubteRollen={['SuperAdmin', 'Admin_Dev', 'Planner', 'Employee', 'Team_Leader']}>
                <SchichtCockpit />
              </RollenCheckRoute>
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
};

export default App;
