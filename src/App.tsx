import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { theme } from './theme';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EnterpriseProvider } from './contexts/EnterpriseContext';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Hospitals from './pages/Hospitals';
import HospitalDetail from './pages/HospitalDetail';
import Users from './pages/Users';
import Financial from './pages/Financial';
import Prices from './pages/Prices';
import Settings from './pages/Settings';
import Documents from './pages/Documents';
import Registrations from './pages/Registrations';
import DoctorLinks from './pages/DoctorLinks';
import Benefits from './pages/Benefits';
import Communications from './pages/Communications';
import PayoutMonitoring from './pages/PayoutMonitoring';
import NfUpload from './pages/NfUpload';
import PublicRegistration from './pages/PublicRegistration';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/hospitais"
        element={
          <PrivateRoute>
            <Hospitals />
          </PrivateRoute>
        }
      />
      <Route
        path="/hospitais/:id"
        element={
          <PrivateRoute>
            <HospitalDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <PrivateRoute>
            <Users />
          </PrivateRoute>
        }
      />
      <Route
        path="/financeiro"
        element={
          <PrivateRoute>
            <Financial />
          </PrivateRoute>
        }
      />
      <Route
        path="/precos"
        element={
          <PrivateRoute>
            <Prices />
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route
        path="/documentos"
        element={
          <PrivateRoute>
            <Documents />
          </PrivateRoute>
        }
      />
      <Route
        path="/credenciamento"
        element={
          <PrivateRoute>
            <Registrations />
          </PrivateRoute>
        }
      />
      <Route
        path="/vinculos"
        element={
          <PrivateRoute>
            <DoctorLinks />
          </PrivateRoute>
        }
      />
      <Route
        path="/beneficios"
        element={
          <PrivateRoute>
            <Benefits />
          </PrivateRoute>
        }
      />
      {/* <Route
        path="/comunicacoes"
        element={
          <PrivateRoute>
            <Communications />
          </PrivateRoute>
        }
      />
      <Route
        path="/monitoramento"
        element={
          <PrivateRoute>
            <PayoutMonitoring />
          </PrivateRoute>
        }
      /> */}
      {/* PÚBLICA — contador acessa pelo link do e-mail. Sem auth. */}
      <Route path="/nf-upload/:token" element={<NfUpload />} />

      {/* Rota PÚBLICA — sem auth. Cadastro do médico na empresa. */}
      <Route
        path="/credenciamento/:enterprise_id/etapa1"
        element={<PublicRegistration />}
      />
      {/* Nova via de credenciamento com token de link (bank_mode). */}
      <Route
        path="/credenciamento/link/:token"
        element={<PublicRegistration />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <EnterpriseProvider>
            <AppRoutes />
            <ToastContainer position="top-right" autoClose={3000} />
          </EnterpriseProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
